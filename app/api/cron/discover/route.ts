import { NextRequest, NextResponse } from "next/server";
import { catalogDiscovery } from "@/src/infrastructure/container";

export const maxDuration = 300;

// GET /api/cron/discover
// Called daily by Vercel Cron. Searches all stores for new products
// and merges them into data/discovered-products.json.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { discovered, total } = await catalogDiscovery.run();

  return NextResponse.json({
    discovered,
    total,
    timestamp: new Date().toISOString(),
  });
}
