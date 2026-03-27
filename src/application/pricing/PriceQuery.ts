// Use case: get prices for a product, with cache and persistence layers

import type { IPriceRepository } from "@/src/domain/pricing/IPriceRepository";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";
import type { Store } from "@/src/domain/pricing/Store";

export interface IPriceScraper {
  scrape(store: Store, searchTerms: string[], productId: string): Promise<ScrapedPrice>;
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

export class PriceQuery {
  constructor(
    private readonly priceRepo: IPriceRepository,
    private readonly scraper: IPriceScraper,
    private readonly stores: Store[]
  ) {}

  async getPricesForProduct(
    productId: string,
    searchTerms: string[]
  ): Promise<{ prices: ScrapedPrice[]; fromCache: boolean; refreshedAt?: string }> {
    // 1. Check persisted prices (written by cron)
    const persisted = await this.priceRepo.getByProductId(productId);
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
    const prices = await Promise.all(
      this.stores.map((store) => this.scraper.scrape(store, searchTerms, productId))
    );

    try {
      await this.priceRepo.save(productId, prices);
    } catch {
      // File write may fail on read-only Vercel deployment; continue anyway
    }

    return { prices, fromCache: false };
  }
}
