import { NextRequest, NextResponse } from "next/server";
import { GET as discoverHandler } from "@/app/api/cron/discover/route";
import { POST as fetchImagesHandler } from "@/app/api/admin/fetch-images/route";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import {
  recordPrices,
  logScraperError,
  updateProductLowestPrice,
  markProductLastSeen,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import type { Product } from "@/src/domain/catalog/Product";

export const maxDuration = 300;

// How many products to refresh per trigger call.
// Keep low enough to stay within 5-min Vercel timeout.
const BATCH_SIZE = 80;
// How many products to scrape concurrently within each trigger call.
const CONCURRENCY = 12;

async function refreshBatch(products: Product[]): Promise<{ refreshed: number; errors: number }> {
  let errors = 0;

  // Process in parallel chunks of CONCURRENCY to avoid OOM
  for (let i = 0; i < products.length; i += CONCURRENCY) {
    const chunk = products.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (product) => {
        try {
          const { prices } = await priceQuery.getPricesForProduct(product.id, product.searchTerms);
          await recordPrices(product.id, prices);

          for (const p of prices) {
            if (p.error && p.error !== "Produkti nuk u gjet" && p.error !== "Ky variant nuk disponohet") {
              errors++;
              await logScraperError(p.storeId, "scrape_failed", p.error, product.id);
            }
          }

          const found = prices.filter((p) => p.price !== null && !p.suspicious);
          if (found.length > 0) {
            await markProductLastSeen(product.id);
            const lowest = Math.min(...found.map((p) => p.price!));
            await updateProductLowestPrice(product.id, lowest);
          } else {
            await updateProductLowestPrice(product.id, null);
          }
        } catch {
          errors++;
        }
      })
    );
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

    return NextResponse.json({ error: "Veprim i panjohur" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
