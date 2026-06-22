// Shared price-refresh engine: scrape a list of products and persist the
// results (price history, per-product lowest price, store mappings, scraper
// errors), optionally notifying price-alert subscribers.
//
// Extracted from app/api/cron/refresh-prices so two callers share ONE
// implementation:
//   • the Vercel route — runs one BATCH_SIZE slice per HTTP invocation;
//   • scripts/refresh-prices.ts — runs the whole catalogue in one process
//     inside a GitHub Actions runner (where process.env.VERCEL is unset, so
//     JsonStore writes go straight to the repo's data/ dir and the workflow
//     commits them). This keeps the heavy scraping off Vercel's Fluid CPU.

import { priceQuery } from "@/src/infrastructure/container";
import { computeProductPriceSummary } from "@/src/application/pricing/PriceQuery";
import {
  batchRecordPrices,
  batchUpdateProductPrices,
  batchLogScraperErrors,
  batchRecordStoreMappings,
  batchGetAlertsToNotify,
  batchMarkAlertsNotified,
  type StoreMappingRecord,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import { createLogger } from "@/src/infrastructure/logging/logger";
import type { Product } from "@/src/domain/catalog/Product";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

const log = createLogger("pricing/refreshCatalogue");

// How many products to scrape concurrently to avoid OOM / connection floods.
export const DEFAULT_CONCURRENCY = 12;

export interface RefreshProgress {
  processed: number;
  total: number;
  refreshed: number;
  errors: number;
}

export interface RefreshOptions {
  /** Products scraped in parallel per chunk. Defaults to DEFAULT_CONCURRENCY. */
  concurrency?: number;
  /**
   * Invoked for each subscriber whose alert threshold is now met. Omit to
   * skip alert lookups/notifications entirely (no Postgres access).
   */
  onAlert?: (
    email: string,
    product: Product,
    price: number,
    threshold: number,
  ) => Promise<void>;
  /** Called after each chunk so long runs can log progress. */
  onProgress?: (progress: RefreshProgress) => void;
}

export interface RefreshResult {
  refreshed: number;
  errors: number;
}

/**
 * Scrape `products` and persist the results. Returns counts of successfully
 * refreshed products and errors encountered.
 */
export async function refreshProducts(
  products: Product[],
  opts: RefreshOptions = {},
): Promise<RefreshResult> {
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  let refreshed = 0;
  let errorCount = 0;

  for (let i = 0; i < products.length; i += concurrency) {
    const chunk = products.slice(i, i + concurrency);

    const chunkResults: Array<{ product: Product; prices: ScrapedPrice[] } | null> =
      await Promise.all(
        chunk.map(async (product) => {
          try {
            const { prices } = await priceQuery.getPricesForProduct(
              product.id,
              product.searchTerms,
            );
            refreshed++;
            return { product, prices };
          } catch {
            errorCount++;
            return null;
          }
        }),
      );

    const priceEntries: Array<{ productId: string; prices: ScrapedPrice[] }> = [];
    const productUpdates: Array<{ productId: string; lowestPrice: number | null; storeCount?: number }> = [];
    const errors: Array<{ storeId: string; errorType: string; errorMessage?: string; productId?: string }> = [];
    const alertLookups: Array<{ productId: string; lowestPrice: number; product: Product }> = [];
    const mappings: StoreMappingRecord[] = [];

    for (const result of chunkResults) {
      if (!result) continue;
      const { product, prices } = result;

      priceEntries.push({ productId: product.id, prices });

      for (const p of prices) {
        if (p.error && p.error !== "Produkti nuk u gjet" && p.error !== "Ky variant nuk disponohet") {
          errorCount++;
          errors.push({ storeId: p.storeId, errorType: "scrape_failed", errorMessage: p.error, productId: product.id });
        }
        if (p.storeProductId && p.matchConfidence !== undefined) {
          mappings.push({
            storeId: p.storeId,
            storeProductId: p.storeProductId,
            storeProductName: p.matchedName ?? null,
            catalogueProductId: product.id,
            confidence: p.matchConfidence,
          });
        }
      }

      const summary = computeProductPriceSummary(prices);
      if (summary) {
        productUpdates.push({ productId: product.id, lowestPrice: summary.lowestPrice, storeCount: summary.storeCount });
        alertLookups.push({ productId: product.id, lowestPrice: summary.lowestPrice, product });
      }
    }

    await Promise.allSettled([
      batchRecordPrices(priceEntries),
      batchUpdateProductPrices(productUpdates),
      batchLogScraperErrors(errors),
      batchRecordStoreMappings(mappings),
    ]);

    if (opts.onAlert && alertLookups.length > 0) {
      const alertMap = await batchGetAlertsToNotify(
        alertLookups.map((a) => ({ productId: a.productId, lowestPrice: a.lowestPrice })),
      );
      const notifiedIds: number[] = [];
      for (const lookup of alertLookups) {
        const alerts = alertMap.get(lookup.productId) ?? [];
        for (const alert of alerts) {
          await opts.onAlert(alert.email, lookup.product, lookup.lowestPrice, alert.threshold);
          notifiedIds.push(alert.id);
        }
      }
      await batchMarkAlertsNotified(notifiedIds);
    }

    opts.onProgress?.({
      processed: Math.min(i + concurrency, products.length),
      total: products.length,
      refreshed,
      errors: errorCount,
    });
    log.debug("chunk done", { from: i, size: chunk.length, refreshed, errors: errorCount });
  }

  return { refreshed, errors: errorCount };
}
