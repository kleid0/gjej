import { NextRequest, NextResponse } from "next/server";
import { catalogDiscovery, productCatalog } from "@/src/infrastructure/container";

function isAuthorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

// POST /api/discover — runs a full discovery scrape and persists results
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { discovered, total, fused } = await catalogDiscovery.run();
  return NextResponse.json({ discovered, total, fused });
}

// GET /api/discover — returns the current set of discovered products
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const products = await productCatalog.getAllProducts();
  return NextResponse.json({ total: products.length, products });
}
