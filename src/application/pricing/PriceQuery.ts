// Use case: get prices for a product, with cache and persistence layers

import type { IPriceRepository } from "@/src/domain/pricing/IPriceRepository";
import type { ScrapedPrice, PriceRecord } from "@/src/domain/pricing/Price";
import type { Store } from "@/src/domain/pricing/Store";

export interface IPriceScraper {
  scrape(store: Store, searchTerms: string[], productId: string): Promise<ScrapedPrice>;
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const STALE_DISPLAY_MS   = 24 * 60 * 60 * 1000; // 24 hours — show stale warning

/**
 * Flag prices that deviate significantly from the average.
 * Requires ≥ 3 data points — fewer stores means too little signal.
 * - >40% below average → suspicious (likely wrong match)
 * - >60% above average → overpriced (flagged for admin review)
 */
function flagSuspiciousPrices(prices: ScrapedPrice[]): ScrapedPrice[] {
  const found = prices.filter((p) => p.price !== null && p.price > 0);
  if (found.length < 3) return prices;

  const avg = found.reduce((s, p) => s + p.price!, 0) / found.length;

  return prices.map((p) => {
    if (p.price === null || p.price <= 0) return p;
    const deviation = (p.price - avg) / avg;
    if (deviation < -0.4) return { ...p, suspicious: true };
    if (deviation >  0.6) return { ...p, overpriced: true };
    return p;
  });
}

/** Mark prices as stale when cached data is older than 24 hours. */
function markStalePrices(prices: ScrapedPrice[], refreshedAt: string): ScrapedPrice[] {
  const ageMs = Date.now() - new Date(refreshedAt).getTime();
  if (ageMs < STALE_DISPLAY_MS) return prices;
  return prices.map((p) => (p.price !== null ? { ...p, stale: true } : p));
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
          prices: markStalePrices(persisted.prices, persisted.refreshedAt),
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
        : {
            storeId: this.stores[i].id,
            price: null,
            inStock: null,
            stockLabel: "E panjohur",
            productUrl: null,
            lastChecked: new Date().toISOString(),
            error: "Gabim gjatë kërkimit",
          }
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
