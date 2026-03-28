import { NextRequest, NextResponse } from "next/server";
import { productCatalog } from "@/src/infrastructure/container";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ products: [], categories: [] });

  const results = await productCatalog.searchProducts(q);
  const products = results.slice(0, 6).map((p) => ({
    id: p.id,
    family: p.family,
    brand: p.brand,
    imageUrl: p.imageUrl,
    category: p.category,
    subcategory: p.subcategory,
  }));

  const qLower = q.toLowerCase();
  const categories = productCatalog
    .getCategories()
    .filter(
      (c) =>
        c.name.toLowerCase().includes(qLower) ||
        c.subcategories.some((s) => s.toLowerCase().includes(qLower))
    );

  return NextResponse.json({ products, categories });
}
