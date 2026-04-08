import { NextRequest, NextResponse } from "next/server";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";
import { buildVariantSearchTerms } from "@/src/domain/catalog/variants";

export const maxDuration = 30;

// GET /api/prices?product=<productId>[&ngjyre=<colour>][&hapesire=<storage>][&force=1]
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) {
    return NextResponse.json({ error: "product query param required" }, { status: 400 });
  }

  const product = await productCatalog.getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const colourParam  = req.nextUrl.searchParams.get("ngjyre");
  const storageParam = req.nextUrl.searchParams.get("hapesire");
  const forceRefresh = req.nextUrl.searchParams.get("force") === "1";

  let searchTerms = product.searchTerms;
  let cacheKey: string | undefined;

  if (colourParam || storageParam) {
    searchTerms = buildVariantSearchTerms(product, colourParam ?? "", storageParam ?? "");
    cacheKey = `${productId}:${(colourParam ?? "").toLowerCase()}:${(storageParam ?? "").toLowerCase()}`;
  }

  const result = await priceQuery.getPricesForProduct(productId, searchTerms, cacheKey, forceRefresh);

  // For variant-specific queries, use a clearer "not found" message
  if (colourParam || storageParam) {
    result.prices = result.prices.map((p) => ({
      ...p,
      error: p.error === "Produkti nuk u gjet" ? "Ky variant nuk disponohet" : p.error,
    }));
  }

  return NextResponse.json(result);
}
