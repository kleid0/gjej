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
  USAGE_STATS_FILE,
} from "@/src/infrastructure/persistence/paths";
import { createLogger } from "@/src/infrastructure/logging/logger";
import { flushLogsToGit } from "@/src/infrastructure/logging/gitSink";
import { recordInvocation, enforceUsageBreaker } from "@/src/infrastructure/usage/usageTracker";

export const maxDuration = 300;

const log = createLogger("cron/discover");

// GET /api/cron/discover
// Called daily by Vercel Cron. Searches all stores for new products,
// merges them into data/discovered-products.json, marks discontinued products
// (not seen on any store for 30+ days), and logs the daily summary. All
// touched JSON files get persisted to GitHub in a single commit at the end.
export async function GET(req: NextRequest) {
  const invocationStart = Date.now();
  const invocationCpu = process.cpuUsage();
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
    USAGE_STATS_FILE,
  ]);

  // Usage kill switch — see refresh-prices; resets when the month rolls over.
  const breaker = await enforceUsageBreaker();
  if (breaker.tripped) {
    await flushLogsToGit();
    try {
      await commitDirtyFiles(takeDirtyFiles(), "chore(data): usage breaker pause");
    } catch (err) {
      log.error("commit failed", { err });
    }
    return NextResponse.json({ paused: true, reason: breaker.reason });
  }

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

  log.info("run complete", { discovered, total, fused, discontinued });

  await recordInvocation(Date.now() - invocationStart, process.cpuUsage(invocationCpu));
  await flushLogsToGit();
  let commitSha: string | null = null;
  try {
    commitSha = await commitDirtyFiles(
      takeDirtyFiles(),
      `chore(data): daily discovery (+${discovered}, -${discontinued})`,
    );
  } catch (err) {
    log.error("commit failed", { err });
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
