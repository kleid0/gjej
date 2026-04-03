import { NextRequest, NextResponse } from "next/server";
import {
  getAdminStats,
  getRecentScraperErrors,
  getDiscoveryLog,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { priceQuery } from "@/src/infrastructure/container";

export const dynamic = "force-dynamic";

// GET /api/admin/stats
// Returns admin panel data: catalogue stats, errors, discovery log, suspicious prices.
// Secured by CRON_SECRET (same token used by cron jobs).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stats, errors, discoveryLog, allPrices] = await Promise.allSettled([
    getAdminStats(),
    getRecentScraperErrors(50),
    getDiscoveryLog(10),
    priceQuery.getAllCachedPrices(),
  ]);

  // Collect suspicious and overpriced prices from the cache
  const suspiciousPrices: Array<{
    productId: string;
    storeId: string;
    price: number;
    flag: "suspicious" | "overpriced";
  }> = [];

  if (allPrices.status === "fulfilled") {
    for (const [productId, record] of Object.entries(allPrices.value)) {
      for (const p of record.prices) {
        if (p.price !== null && p.suspicious) {
          suspiciousPrices.push({ productId, storeId: p.storeId, price: p.price, flag: "suspicious" });
        }
        if (p.price !== null && p.overpriced) {
          suspiciousPrices.push({ productId, storeId: p.storeId, price: p.price, flag: "overpriced" });
        }
      }
    }
  }

  return NextResponse.json({
    stats: stats.status === "fulfilled" ? stats.value : null,
    errors: errors.status === "fulfilled" ? errors.value : [],
    discoveryLog: discoveryLog.status === "fulfilled" ? discoveryLog.value : [],
    suspiciousPrices,
    timestamp: new Date().toISOString(),
  });
}
