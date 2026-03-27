import { NextResponse } from "next/server";
import { catalogDiscovery, productCatalog } from "@/src/infrastructure/container";

// POST /api/discover — runs a full discovery scrape and persists results
export async function POST() {
  const { discovered, total } = await catalogDiscovery.run();
  return NextResponse.json({ discovered, total });
}

// GET /api/discover — returns the current set of discovered products
export async function GET() {
  const products = await productCatalog.getAllProducts();
  return NextResponse.json({ total: products.length, products });
}
