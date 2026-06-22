import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { productCatalog } from "@/src/infrastructure/container";
import {
  LOWEST_PRICES_TAG,
  ADMIN_STATS_TAG,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { takeDirtyFiles } from "@/src/infrastructure/persistence/JsonStore";
import { commitDirtyFiles, hydrateFromGitHub } from "@/src/infrastructure/git/commitDataFiles";
import {
  PRICES_FILE,
  PRICE_HISTORY_FILE,
  CATALOGUE_STATE_FILE,
  SCRAPER_ERRORS_FILE,
  STORE_MAPPINGS_FILE,
} from "@/src/infrastructure/persistence/paths";
import { createLogger } from "@/src/infrastructure/logging/logger";
import { flushLogsToGit } from "@/src/infrastructure/logging/gitSink";
import { takeStoreHttpFailures } from "@/src/infrastructure/scrapers/PriceScraper";
import { refreshProducts } from "@/src/application/pricing/refreshCatalogue";
import { sendPriceAlertEmail } from "@/src/infrastructure/email/priceAlertEmail";

const log = createLogger("cron/refresh-prices");

// Allow up to 5 minutes — scraping a batch takes time
export const maxDuration = 300;

// How many products to refresh per invocation. Tuned so one call fits
// comfortably inside maxDuration even on slow days. Orchestration is
// handled externally by .github/workflows/refresh-prices.yml.
//
// NOTE: the primary refresh path is now scripts/refresh-prices.ts, which runs
// the whole catalogue inside a GitHub Actions runner (off Vercel's Fluid CPU)
// and shares the same engine via refreshProducts(). This route is retained as
// a manual / per-slice fallback; both call the identical scrape+persist code.
const BATCH_SIZE = 80;

// GET /api/cron/refresh-prices
// Processes one BATCH_SIZE slice starting from ?startIndex= (default 0),
// commits the resulting JSON files to GitHub, and returns
// { nextIndex, remaining, ... } so the GHA orchestrator knows where to
// resume from. When remaining=0 the response also revalidates the
// lowest-prices / admin-stats cache tags.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull the latest committed snapshots into /tmp before reading them. Each
  // GHA-orchestrated batch runs in its own (often cold) Vercel container, so
  // without this hydrate every invocation would start from an empty /tmp,
  // overwrite git's accumulated state with just this batch's slice, and lose
  // every prior batch's contribution. The bundled data/ snapshot is only as
  // fresh as the last code deploy, which (per vercel.json's ignoreCommand)
  // doesn't happen on chore(data): commits.
  await hydrateFromGitHub([
    PRICES_FILE,
    PRICE_HISTORY_FILE,
    CATALOGUE_STATE_FILE,
    SCRAPER_ERRORS_FILE,
    STORE_MAPPINGS_FILE,
  ]);

  const allProducts = await productCatalog.getAllProducts();

  const startIndex = Math.max(
    0,
    parseInt(req.nextUrl.searchParams.get("startIndex") ?? "0", 10) || 0,
  );
  const batch = allProducts.slice(startIndex, startIndex + BATCH_SIZE);

  log.info("run start", { startIndex, batchSize: batch.length, total: allProducts.length });

  const { refreshed, errors: errorCount } = await refreshProducts(batch, {
    onAlert: sendPriceAlertEmail,
  });

  const nextIndex = startIndex + batch.length;
  const remaining = Math.max(0, allProducts.length - nextIndex);

  log.info("run complete", {
    refreshed, errors: errorCount, startIndex, nextIndex, remaining,
    httpFailures: takeStoreHttpFailures(),
  });

  // Persist this invocation's slice of writes to GitHub. prices.json is
  // also written by the scraper so include it explicitly. flushLogsToGit()
  // appends the buffered log lines and marks the NDJSON file dirty so it
  // rides this same commit — must run before takeDirtyFiles().
  await flushLogsToGit();
  const dirty = takeDirtyFiles();
  if (!dirty.includes(PRICES_FILE)) dirty.push(PRICES_FILE);
  let commitSha: string | null = null;
  try {
    commitSha = await commitDirtyFiles(
      dirty,
      // Final batch uses a different prefix so vercel.json's ignoreCommand
      // allows one Vercel redeploy per day, bundling the fully-accumulated
      // prices.json for the /api/health snapshot fallback.
      remaining === 0
        ? `chore(data,deploy): refresh prices ${startIndex}-${nextIndex}`
        : `chore(data): refresh prices ${startIndex}-${nextIndex}`,
    );
  } catch (err) {
    log.error("commit failed", { err });
  }

  if (remaining === 0) {
    revalidateTag(LOWEST_PRICES_TAG);
    revalidateTag(ADMIN_STATS_TAG);
  }

  return NextResponse.json({
    refreshed,
    errors: errorCount,
    total: allProducts.length,
    startIndex,
    nextIndex,
    remaining,
    commitSha,
    timestamp: new Date().toISOString(),
  });
}
