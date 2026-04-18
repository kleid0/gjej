import { NextRequest, NextResponse } from "next/server";
import { GET as discoverHandler } from "@/app/api/cron/discover/route";
import { POST as fetchImagesHandler } from "@/app/api/admin/fetch-images/route";
import { productCatalog, priceQuery, duplicateFuser } from "@/src/infrastructure/container";
import {
  batchRecordPrices,
  batchUpdateProductPrices,
  batchLogScraperErrors,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import type { Product } from "@/src/domain/catalog/Product";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

export const maxDuration = 300;

// How many products to refresh per trigger call.
// Keep low enough to stay within 5-min Vercel timeout.
const BATCH_SIZE = 80;
// How many products to scrape concurrently within each trigger call.
const CONCURRENCY = 12;

async function refreshBatch(products: Product[]): Promise<{ refreshed: number; errors: number }> {
  let errors = 0;

  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const chunk = products.slice(i, i + CONCURRENCY);

    // Phase 1: Scrape concurrently
    const chunkResults: Array<{ product: Product; prices: ScrapedPrice[] } | null> = await Promise.all(
      chunk.map(async (product) => {
        try {
          const { prices } = await priceQuery.getPricesForProduct(product.id, product.searchTerms);
          return { product, prices };
        } catch {
          errors++;
          return null;
        }
      }),
    );

    // Phase 2: Batch DB writes
    const priceEntries: Array<{ productId: string; prices: ScrapedPrice[] }> = [];
    const productUpdates: Array<{ productId: string; lowestPrice: number | null; storeCount?: number }> = [];
    const scraperErrors: Array<{ storeId: string; errorType: string; errorMessage?: string; productId?: string }> = [];

    for (const result of chunkResults) {
      if (!result) continue;
      const { product, prices } = result;
      priceEntries.push({ productId: product.id, prices });

      for (const p of prices) {
        if (p.error && p.error !== "Produkti nuk u gjet" && p.error !== "Ky variant nuk disponohet") {
          errors++;
          scraperErrors.push({ storeId: p.storeId, errorType: "scrape_failed", errorMessage: p.error, productId: product.id });
        }
      }

      const found = prices.filter((p) => p.price !== null && !p.suspicious);
      if (found.length > 0) {
        const lowest = Math.min(...found.map((p) => p.price!));
        productUpdates.push({ productId: product.id, lowestPrice: lowest, storeCount: found.length });
      }
      // Do NOT set lowest_price = null on failed scrapes — preserve last known price.
    }

    await Promise.allSettled([
      batchRecordPrices(priceEntries),
      batchUpdateProductPrices(productUpdates),
      batchLogScraperErrors(scraperErrors),
    ]);
  }

  return { refreshed: products.length, errors };
}

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { key?: string; startIndex?: number };
  const key = body.key ?? "";

  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Çelës i gabuar" }, { status: 401 });
  }

  const makeReq = (url: string, method = "GET") =>
    new NextRequest(url, {
      method,
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

  try {
    if (action === "refresh-prices") {
      const allProducts = await productCatalog.getAllProducts();
      const startIndex = Math.max(0, body.startIndex ?? 0);
      const batch = allProducts.slice(startIndex, startIndex + BATCH_SIZE);
      const { refreshed, errors } = await refreshBatch(batch);
      const nextIndex = startIndex + refreshed;
      const remaining = Math.max(0, allProducts.length - nextIndex);
      return NextResponse.json({
        ok: true,
        data: { refreshed, errors, total: allProducts.length, nextIndex, remaining },
      });
    }

    if (action === "discover") {
      const handlerResponse = await discoverHandler(makeReq("https://internal/api/cron/discover"));
      const data = await handlerResponse.json().catch(() => ({}));
      return NextResponse.json({ ok: handlerResponse.ok, status: handlerResponse.status, data });
    }

    if (action === "fetch-images") {
      const handlerResponse = await fetchImagesHandler(makeReq("https://internal/api/admin/fetch-images", "POST"));
      const data = await handlerResponse.json().catch(() => ({}));
      return NextResponse.json({ ok: handlerResponse.ok, status: handlerResponse.status, data });
    }

    if (action === "fuse-duplicates") {
      const mode = (body as Record<string, unknown>).mode ?? "fuse";
      const data = mode === "detect"
        ? await duplicateFuser.detect()
        : await duplicateFuser.fuse();
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ error: "Veprim i panjohur" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
