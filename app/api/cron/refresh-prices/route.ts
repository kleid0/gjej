import { NextRequest, NextResponse } from "next/server";
import { STORES } from "@/lib/stores";
import { PRODUCTS } from "@/lib/products";
import { scrapeStore, ScrapedPrice } from "@/lib/scraper";
import { setAllPersistedPrices } from "@/lib/price-store";
import { setCached, cacheKey } from "@/lib/cache";

// Allow up to 5 minutes — scraping all products takes time
export const maxDuration = 300;

// GET /api/cron/refresh-prices
// Called hourly by Vercel Cron. Scrapes every known product across all stores
// and writes results to data/prices.json so users always get instant responses.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allPrices: Record<string, ScrapedPrice[]> = {};

  await Promise.all(
    PRODUCTS.map(async (product) => {
      const prices = await Promise.all(
        STORES.map((store) => scrapeStore(store, product.searchTerms))
      );
      allPrices[product.id] = prices;
      setCached(cacheKey("prices", product.id), prices);
    })
  );

  await setAllPersistedPrices(allPrices);

  return NextResponse.json({
    refreshed: PRODUCTS.length,
    timestamp: new Date().toISOString(),
  });
}
