import { NextRequest, NextResponse } from "next/server";
import { STORES } from "@/lib/stores";
import { getProductById } from "@/lib/products";
import { scrapeStore, ScrapedPrice } from "@/lib/scraper";
import { getCached, setCached, cacheKey } from "@/lib/cache";
import { getPersistedPrices, setPersistedPrices } from "@/lib/price-store";

// Serve persisted data if it's less than 2 hours old — cron keeps it fresh
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

// GET /api/prices?product=SM-G930F
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) {
    return NextResponse.json({ error: "product query param required" }, { status: 400 });
  }

  const product = getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // 1. In-memory cache (fastest, short-lived)
  const key = cacheKey("prices", productId);
  const cached = getCached<ScrapedPrice[]>(key);
  if (cached) {
    return NextResponse.json({ prices: cached, fromCache: true });
  }

  // 2. Persistent file written by cron — survives restarts
  const persisted = await getPersistedPrices(productId);
  if (persisted) {
    const ageMs = Date.now() - new Date(persisted.refreshedAt).getTime();
    if (ageMs < STALE_THRESHOLD_MS) {
      setCached(key, persisted.prices);
      return NextResponse.json({
        prices: persisted.prices,
        fromCache: true,
        refreshedAt: persisted.refreshedAt,
      });
    }
  }

  // 3. Live scrape — only when no fresh data exists
  const results = await Promise.all(
    STORES.map((store) => scrapeStore(store, product.searchTerms))
  );

  setCached(key, results);
  try {
    await setPersistedPrices(productId, results);
  } catch {
    // File write may fail on read-only Vercel deployment dir; in-memory cache still works
  }

  return NextResponse.json({ prices: results, fromCache: false });
}
