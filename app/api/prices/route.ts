import { NextRequest, NextResponse } from "next/server";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";

export const maxDuration = 30;

// GET /api/prices?product=<productId>
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) {
    return NextResponse.json({ error: "product query param required" }, { status: 400 });
  }

  const product = await productCatalog.getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const result = await priceQuery.getPricesForProduct(productId, product.searchTerms);
  return NextResponse.json(result);
}
