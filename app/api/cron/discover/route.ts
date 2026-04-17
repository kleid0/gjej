import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { catalogDiscovery } from "@/src/infrastructure/container";
import {
  markDiscontinuedProducts,
  logDiscoveryRun,
  ADMIN_STATS_TAG,
  LOWEST_PRICES_TAG,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { ensureSchema } from "@/src/infrastructure/db/client";

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

  await ensureSchema(true);
  const { discovered, total, fused } = await catalogDiscovery.run();

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

  // Discontinued flag affects getProductLowestPrices output; stats change too.
  revalidateTag(LOWEST_PRICES_TAG);
  revalidateTag(ADMIN_STATS_TAG);

  return NextResponse.json({
    discovered,
    total,
    fused,
    autoAdded,
    pendingReview,
    discontinued,
    timestamp: new Date().toISOString(),
  });
}
