import { NextRequest, NextResponse } from "next/server";
import { productCatalog, priceQuery } from "@/src/infrastructure/container";
import {
  fetchTrendsScores,
  writeTrendsCache,
} from "@/src/infrastructure/trends/TrendsService";
import { markDirty, takeDirtyFiles } from "@/src/infrastructure/persistence/JsonStore";
import { commitDirtyFiles, hydrateFromGitHub } from "@/src/infrastructure/git/commitDataFiles";
import { TRENDS_FILE } from "@/src/infrastructure/persistence/paths";

// Google Trends batches 5 keywords per request with ~1.2s delay between batches.
// 50 products = 10 batches ≈ 12 seconds. Give plenty of headroom.
export const maxDuration = 120;

// GET /api/cron/trends
// Fetches Google Trends interest scores for the top products (by store coverage)
// and writes the result to data/trends.json. Called daily by Vercel Cron.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await hydrateFromGitHub([TRENDS_FILE]);

  const [allProducts, allPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
  ]);

  // Limit to top 50 products by store coverage to keep API calls manageable
  const TOP_N = 50;
  const candidates = allProducts
    .map((p) => {
      const record = allPrices[p.id];
      const storeCount = record
        ? record.prices.filter(
            (price) => price.price !== null && !price.suspicious && !price.overpriced,
          ).length
        : 0;
      return { product: p, storeCount };
    })
    .sort((a, b) => b.storeCount - a.storeCount)
    .slice(0, TOP_N)
    .map((s) => s.product);

  const scores = await fetchTrendsScores(candidates);
  writeTrendsCache(scores);
  markDirty(TRENDS_FILE);

  let commitSha: string | null = null;
  try {
    commitSha = await commitDirtyFiles(
      takeDirtyFiles(),
      "chore(data): update trends scores",
    );
  } catch (err) {
    console.error("[trends] commit failed:", err);
  }

  const nonZero = Object.values(scores).filter((s) => s > 0).length;
  return NextResponse.json({
    total: Object.keys(scores).length,
    nonZero,
    commitSha,
    timestamp: new Date().toISOString(),
  });
}
