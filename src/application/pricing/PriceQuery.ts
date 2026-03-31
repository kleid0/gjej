// Use case: get prices for a product, with cache and persistence layers

import type { IPriceRepository } from "@/src/domain/pricing/IPriceRepository";
import type { ScrapedPrice, PriceRecord } from "@/src/domain/pricing/Price";
import type { Store } from "@/src/domain/pricing/Store";

export interface IPriceScraper {
  scrape(store: Store, searchTerms: string[], productId: string): Promise<ScrapedPrice>;
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Flag prices that deviate more than 50% from the median of all found prices.
 * Requires ≥ 3 data points — fewer stores means too little to compute a meaningful median.
 * Flagged entries get suspicious=true so the UI can show a warning to the user.
 */
function flagSuspiciousPrices(prices: ScrapedPrice[]): ScrapedPrice[] {
  const found = prices.filter((p) => p.price !== null && p.price > 0);
  if (found.length < 3) return prices;

  const sorted = found.map((p) => p.price!).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return prices.map((p) => {
    if (p.price === null || p.price <= 0) return p;
    return Math.abs(p.price - median) / median > 0.5
      ? { ...p, suspicious: true }
      : p;
  });
}

export class PriceQuery {
  constructor(
    private readonly priceRepo: IPriceRepository,
    private readonly scraper: IPriceScraper,
    private readonly stores: Store[]
  ) {}

  async getPricesForProduct(
    productId: string,
    searchTerms: string[],
    cacheKey?: string,
  ): Promise<{ prices: ScrapedPrice[]; fromCache: boolean; refreshedAt?: string }> {
    const effectiveKey = cacheKey ?? productId;
    // 1. Check persisted prices (written by cron)
    const persisted = await this.priceRepo.getByProductId(effectiveKey);
    if (persisted) {
      const ageMs = Date.now() - new Date(persisted.refreshedAt).getTime();
      if (ageMs < STALE_THRESHOLD_MS) {
        return {
          prices: persisted.prices,
          fromCache: true,
          refreshedAt: persisted.refreshedAt,
        };
      }
    }

    // 2. Live scrape — only when no fresh data exists
    // allSettled so one slow/failed store never blocks the others
    const settled = await Promise.allSettled(
      this.stores.map((store) => this.scraper.scrape(store, searchTerms, productId))
    );
    const raw = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : { storeId: this.stores[i].id, price: null, inStock: null, stockLabel: "E panjohur", productUrl: null, lastChecked: new Date().toISOString(), error: "Gabim gjatë kërkimit" }
    );

    const prices = flagSuspiciousPrices(raw);

    try {
      await this.priceRepo.save(effectiveKey, prices);
    } catch {
      // File write may fail on read-only Vercel deployment; continue anyway
    }

    return { prices, fromCache: false };
  }

  async getAllCachedPrices(): Promise<Record<string, PriceRecord>> {
    return this.priceRepo.getAll();
  }
}
