import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { catalogDiscovery } from "@/src/infrastructure/container";
import {
  markDiscontinuedProducts,
  logDiscoveryRun,
  ADMIN_STATS_TAG,
  LOWEST_PRICES_TAG,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { takeDirtyFiles } from "@/src/infrastructure/persistence/JsonStore";
import { commitDirtyFiles, hydrateFromGitHub } from "@/src/infrastructure/git/commitDataFiles";
import {
  DISCOVERED_PRODUCTS_FILE,
  DISCOVERY_LOG_FILE,
  CATALOGUE_STATE_FILE,
} from "@/src/infrastructure/persistence/paths";

export const maxDuration = 300;

// GET /api/cron/discover
// Called daily by Vercel Cron. Searches all stores for new products,
// merges them into data/discovered-products.json, marks discontinued products
// (not seen on any store for 30+ days), and logs the daily summary. All
// touched JSON files get persisted to GitHub in a single commit at the end.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the latest committed snapshots into /tmp before reading them so
  // this run merges into the live git state, not the stale bundled snapshot.
  await hydrateFromGitHub([
    DISCOVERED_PRODUCTS_FILE,
    DISCOVERY_LOG_FILE,
    CATALOGUE_STATE_FILE,
  ]);

  const { discovered, total, fused } = await catalogDiscovery.run();

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

  let commitSha: string | null = null;
  try {
    commitSha = await commitDirtyFiles(
      takeDirtyFiles(),
      `chore(data): daily discovery (+${discovered}, -${discontinued})`,
    );
  } catch (err) {
    console.error("[discover] commit failed:", err);
  }

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
    commitSha,
    timestamp: new Date().toISOString(),
  });
}
