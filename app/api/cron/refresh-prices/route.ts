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
import { resetQueryCount, getQueryCount, ensureSchema } from "@/src/infrastructure/db/client";
import type { Product } from "@/src/domain/catalog/Product";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

// Allow up to 5 minutes — scraping all products takes time
export const maxDuration = 300;

// How many products to scrape concurrently to avoid OOM on Vercel
const CONCURRENCY = 12;

// GET /api/cron/refresh-prices
// Called daily by Vercel Cron. Scrapes products in concurrent batches,
// writes results to data/prices.json, records to DB, fires price alerts, and
// logs scraper errors to the admin panel.
//
// DB-optimised: all per-product operations are batched per chunk, reducing
// total queries from ~9 per product to ~4 per chunk of 12.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  resetQueryCount();
  // Schema is skipped on read paths via DB_SCHEMA_READY; cron still ensures
  // it so added columns/indexes get applied on the first nightly run.
  await ensureSchema(true);
  const allProducts = await productCatalog.getAllProducts();
  let refreshed = 0;
  let errorCount = 0;

  for (let i = 0; i < allProducts.length; i += CONCURRENCY) {
    const chunk = allProducts.slice(i, i + CONCURRENCY);

    // Phase 1: Scrape all products in the chunk concurrently
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

    // Phase 2: Batch all DB writes for the chunk
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
        // Fix E: capture cross-store matches produced by strictMatchScore so
        // the admin review queue fills up and subsequent runs can short-
        // circuit to the approved store_product_id instead of re-scoring the
        // whole search result set.
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
      // Do NOT set lowest_price = null on failed scrapes — preserve the
      // last known good price so the homepage can still display something.
    }

    // Execute batched DB operations (~4 queries per chunk instead of ~9 per product)
    await Promise.allSettled([
      batchRecordPrices(priceEntries),
      batchUpdateProductPrices(productUpdates),
      batchLogScraperErrors(errors),
      batchRecordStoreMappings(mappings),
    ]);

    // Alerts: batch-query, then send emails, then batch-mark notified
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

  // Invalidate edge caches so fresh lowest-prices / admin-stats are picked
  // up by the next page request instead of waiting for the 1h TTL.
  revalidateTag(LOWEST_PRICES_TAG);
  revalidateTag(ADMIN_STATS_TAG);

  const { count: queryCount } = getQueryCount();
  return NextResponse.json({
    refreshed,
    errors: errorCount,
    dbQueries: queryCount,
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
