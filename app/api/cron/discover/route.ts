import { NextRequest, NextResponse } from "next/server";
import { catalogDiscovery } from "@/src/infrastructure/container";
import {
  markDiscontinuedProducts,
  logDiscoveryRun,
} from "@/src/infrastructure/db/PriceHistoryRepository";

export const maxDuration = 300;

// GET /api/cron/discover
// Called daily by Vercel Cron. Searches all stores for new products,
// merges them into data/discovered-products.json, marks discontinued products
// (not seen on any store for 30+ days), and logs the daily summary.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { discovered, total } = await catalogDiscovery.run();

  // Mark products not seen in 30+ days as discontinued (preserves price history)
  const discontinued = await markDiscontinuedProducts();

  // Auto-added: newly discovered products with high-confidence catalogue match
  // Pending review: new products that need manual verification
  // For now we treat all new discovered products as auto-added (confidence ≥80%)
  // since ProductDiscovery already applies quality filtering.
  const autoAdded = discovered;
  const pendingReview = 0;

  await logDiscoveryRun({
    totalDiscovered: discovered,
    autoAdded,
    pendingReview,
    discontinued,
  });

  return NextResponse.json({
    discovered,
    total,
    autoAdded,
    pendingReview,
    discontinued,
    timestamp: new Date().toISOString(),
  });
}
