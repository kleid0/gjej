/**
 * Standalone price-refresh runner — the primary refresh path.
 *
 * Runs entirely inside a GitHub Actions runner (.github/workflows/refresh-prices.yml).
 * Because process.env.VERCEL is unset here, JsonStore reads/writes go straight
 * to the repo's data/ dir; the workflow commits data/ afterwards as a
 * `chore(data,deploy):` commit that Vercel rebuilds from. Net effect: the heavy
 * scraping no longer runs on Vercel, so it stops consuming Fluid Active CPU.
 *
 * Exit 0 on success, 1 on fatal error. Always prints a one-line summary.
 */
import { productCatalog } from "@/src/infrastructure/container";
import { refreshProducts } from "@/src/application/pricing/refreshCatalogue";
import { sendPriceAlertEmail } from "@/src/infrastructure/email/priceAlertEmail";
import { flushLogsToGit } from "@/src/infrastructure/logging/gitSink";
import { takeStoreHttpFailures } from "@/src/infrastructure/scrapers/PriceScraper";
import { createLogger } from "@/src/infrastructure/logging/logger";

const log = createLogger("scripts/refresh-prices");

async function main(): Promise<void> {
  const startedAt = Date.now();
  const allProducts = await productCatalog.getAllProducts();

  // REFRESH_LIMIT (from the workflow's `limit` input) scrapes only the first N
  // products — handy for a quick sample run to confirm store reachability from
  // the runner without walking the whole catalogue. Blank/0/invalid = all.
  const limit = parseInt(process.env.REFRESH_LIMIT ?? "", 10);
  const products =
    Number.isFinite(limit) && limit > 0 ? allProducts.slice(0, limit) : allProducts;

  log.info("refresh start", { total: products.length, catalogue: allProducts.length });
  console.log(
    `Refreshing ${products.length}${
      products.length !== allProducts.length ? ` of ${allProducts.length}` : ""
    } products…`,
  );

  const { refreshed, errors } = await refreshProducts(products, {
    // Only attempt alert emails when a Resend key is present. The alert lookup
    // (batchGetAlertsToNotify) already no-ops without a database, so omitting
    // onAlert here keeps a secret-less CI run fully functional — it just
    // refreshes prices without sending emails.
    onAlert: process.env.RESEND_API_KEY ? sendPriceAlertEmail : undefined,
    onProgress: ({ processed, total, refreshed: r, errors: e }) => {
      if (processed === total || processed % 240 === 0) {
        console.log(`  ${processed}/${total}  refreshed=${r} errors=${e}`);
      }
    },
  });

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  log.info("refresh complete", {
    total: products.length,
    refreshed,
    errors,
    seconds,
    httpFailures: takeStoreHttpFailures(),
  });

  // Persist buffered structured logs to data/logs/events.ndjson so the workflow
  // commits them alongside the refreshed data. No-op if nothing was buffered.
  await flushLogsToGit();

  console.log(
    `Done. total=${products.length} refreshed=${refreshed} errors=${errors} seconds=${seconds}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("refresh-prices failed:", err);
    process.exit(1);
  });
