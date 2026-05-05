import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";
import { computeProductPriceSummary } from "@/src/application/pricing/PriceQuery";
import {
  batchRecordPrices,
  batchUpdateProductPrices,
  batchLogScraperErrors,
  batchRecordStoreMappings,
  batchGetAlertsToNotify,
  batchMarkAlertsNotified,
  LOWEST_PRICES_TAG,
  ADMIN_STATS_TAG,
  type StoreMappingRecord,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { takeDirtyFiles } from "@/src/infrastructure/persistence/JsonStore";
import { commitDirtyFiles, hydrateFromGitHub } from "@/src/infrastructure/git/commitDataFiles";
import {
  PRICES_FILE,
  PRICE_HISTORY_FILE,
  CATALOGUE_STATE_FILE,
  SCRAPER_ERRORS_FILE,
  STORE_MAPPINGS_FILE,
} from "@/src/infrastructure/persistence/paths";
import type { Product } from "@/src/domain/catalog/Product";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

// Allow up to 5 minutes — scraping a batch takes time
export const maxDuration = 300;

// How many products to scrape concurrently to avoid OOM on Vercel
const CONCURRENCY = 12;

// How many products to refresh per invocation. Tuned so one call fits
// comfortably inside maxDuration even on slow days. Orchestration is
// handled externally by .github/workflows/refresh-prices.yml, which
// loops through the catalogue 80 products at a time until remaining=0.
// (We previously self-chained inside Vercel by aborted-fetch'ing the
// next slice, but that proved flaky once the cron also committed JSON
// files back to git — too many ways for the chain to silently break.
// Moving orchestration to GHA gives us a 6-hour budget per run and
// per-batch logs we can actually inspect.)
const BATCH_SIZE = 80;

// GET /api/cron/refresh-prices
// Processes one BATCH_SIZE slice starting from ?startIndex= (default 0),
// commits the resulting JSON files to GitHub, and returns
// { nextIndex, remaining, ... } so the GHA orchestrator knows where to
// resume from. When remaining=0 the response also revalidates the
// lowest-prices / admin-stats cache tags.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull the latest committed snapshots into /tmp before reading them. Each
  // GHA-orchestrated batch runs in its own (often cold) Vercel container, so
  // without this hydrate every invocation would start from an empty /tmp,
  // overwrite git's accumulated state with just this batch's slice, and lose
  // every prior batch's contribution. The bundled data/ snapshot is only as
  // fresh as the last code deploy, which (per vercel.json's ignoreCommand)
  // doesn't happen on chore(data): commits.
  await hydrateFromGitHub([
    PRICES_FILE,
    PRICE_HISTORY_FILE,
    CATALOGUE_STATE_FILE,
    SCRAPER_ERRORS_FILE,
    STORE_MAPPINGS_FILE,
  ]);

  const allProducts = await productCatalog.getAllProducts();

  const startIndex = Math.max(
    0,
    parseInt(req.nextUrl.searchParams.get("startIndex") ?? "0", 10) || 0,
  );
  const batch = allProducts.slice(startIndex, startIndex + BATCH_SIZE);
  let refreshed = 0;
  let errorCount = 0;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);

    const chunkResults: Array<{
      product: Product;
      prices: ScrapedPrice[];
    } | null> = await Promise.all(
      chunk.map(async (product) => {
        try {
          const { prices } = await priceQuery.getPricesForProduct(product.id, product.searchTerms);
          refreshed++;
          return { product, prices };
        } catch {
          errorCount++;
          return null;
        }
      }),
    );

    const priceEntries: Array<{ productId: string; prices: ScrapedPrice[] }> = [];
    const productUpdates: Array<{ productId: string; lowestPrice: number | null; storeCount?: number }> = [];
    const errors: Array<{ storeId: string; errorType: string; errorMessage?: string; productId?: string }> = [];
    const alertLookups: Array<{ productId: string; lowestPrice: number; product: Product }> = [];
    const mappings: StoreMappingRecord[] = [];

    for (const result of chunkResults) {
      if (!result) continue;
      const { product, prices } = result;

      priceEntries.push({ productId: product.id, prices });

      for (const p of prices) {
        if (p.error && p.error !== "Produkti nuk u gjet" && p.error !== "Ky variant nuk disponohet") {
          errorCount++;
          errors.push({ storeId: p.storeId, errorType: "scrape_failed", errorMessage: p.error, productId: product.id });
        }
        if (p.storeProductId && p.matchConfidence !== undefined) {
          mappings.push({
            storeId: p.storeId,
            storeProductId: p.storeProductId,
            storeProductName: p.matchedName ?? null,
            catalogueProductId: product.id,
            confidence: p.matchConfidence,
          });
        }
      }

      const summary = computeProductPriceSummary(prices);
      if (summary) {
        productUpdates.push({ productId: product.id, lowestPrice: summary.lowestPrice, storeCount: summary.storeCount });
        alertLookups.push({ productId: product.id, lowestPrice: summary.lowestPrice, product });
      }
    }

    await Promise.allSettled([
      batchRecordPrices(priceEntries),
      batchUpdateProductPrices(productUpdates),
      batchLogScraperErrors(errors),
      batchRecordStoreMappings(mappings),
    ]);

    if (alertLookups.length > 0) {
      const alertMap = await batchGetAlertsToNotify(
        alertLookups.map((a) => ({ productId: a.productId, lowestPrice: a.lowestPrice })),
      );
      const notifiedIds: number[] = [];
      for (const lookup of alertLookups) {
        const alerts = alertMap.get(lookup.productId) ?? [];
        for (const alert of alerts) {
          await sendAlertEmail(alert.email, lookup.product, lookup.lowestPrice, alert.threshold);
          notifiedIds.push(alert.id);
        }
      }
      await batchMarkAlertsNotified(notifiedIds);
    }
  }

  const nextIndex = startIndex + batch.length;
  const remaining = Math.max(0, allProducts.length - nextIndex);

  // Persist this invocation's slice of writes to GitHub. prices.json is
  // also written by the scraper so include it explicitly.
  const dirty = takeDirtyFiles();
  if (!dirty.includes(PRICES_FILE)) dirty.push(PRICES_FILE);
  let commitSha: string | null = null;
  try {
    commitSha = await commitDirtyFiles(
      dirty,
      `chore(data): refresh prices ${startIndex}-${nextIndex}`,
    );
  } catch (err) {
    console.error("[refresh-prices] commit failed:", err);
  }

  if (remaining === 0) {
    revalidateTag(LOWEST_PRICES_TAG);
    revalidateTag(ADMIN_STATS_TAG);
  }

  return NextResponse.json({
    refreshed,
    errors: errorCount,
    total: allProducts.length,
    startIndex,
    nextIndex,
    remaining,
    commitSha,
    timestamp: new Date().toISOString(),
  });
}

async function sendAlertEmail(
  email: string,
  product: Product,
  price: number,
  threshold: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const productName = `${product.brand} ${product.family}`.trim();
    const priceFormatted = price.toLocaleString("sq-AL");
    const thresholdFormatted = threshold.toLocaleString("sq-AL");
    await resend.emails.send({
      from: "Gjej.al <noreply@gjej.al>",
      to: email,
      subject: `Çmimi u ul: ${productName} — ${priceFormatted} ALL`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#ea580c;margin-bottom:8px">Çmimi u ul!</h2>
          <p style="color:#374151">
            <strong>${productName}</strong> tani mund të gjendet për
            <strong style="color:#ea580c">${priceFormatted} ALL</strong>,
            nën pragun tuaj prej ${thresholdFormatted} ALL.
          </p>
          <a href="https://gjej.al/produkt/${product.id}"
             style="display:inline-block;margin-top:16px;background:#ea580c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Shiko ofertën →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">
            Gjej.al — Krahasimi i Çmimeve në Shqipëri.<br>
            Për të çaktivizuar njoftimet, vizitoni faqen e produktit.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send alert email to", email, err);
  }
}
