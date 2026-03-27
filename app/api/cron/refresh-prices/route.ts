import { NextRequest, NextResponse } from "next/server";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";

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

  const allProducts = await productCatalog.getAllProducts();

  await Promise.all(
    allProducts.map((product) =>
      priceQuery.getPricesForProduct(product.id, product.searchTerms)
    )
  );

  return NextResponse.json({
    refreshed: allProducts.length,
    timestamp: new Date().toISOString(),
  });
}
