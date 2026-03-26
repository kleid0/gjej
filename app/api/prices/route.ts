import { NextRequest, NextResponse } from "next/server";
import { STORES } from "@/lib/stores";
import { getProductById } from "@/lib/products";
import { scrapeStore, ScrapedPrice } from "@/lib/scraper";
import { getCached, setCached, cacheKey } from "@/lib/cache";

// GET /api/prices?product=SM-G930F
// Returns live prices from all 5 stores for a given product model number
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) {
    return NextResponse.json({ error: "product query param required" }, { status: 400 });
  }

  const product = getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  // Check cache first
  const key = cacheKey("prices", productId);
  const cached = getCached<ScrapedPrice[]>(key);
  if (cached) {
    return NextResponse.json({ prices: cached, fromCache: true });
  }

  // Scrape all stores in parallel
  const results = await Promise.all(
    STORES.map((store) => scrapeStore(store, product.searchTerms))
  );

  setCached(key, results);

  return NextResponse.json({ prices: results, fromCache: false });
}
