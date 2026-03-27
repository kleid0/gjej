import type { ScrapedPrice, PriceRecord } from "./Price";

export interface IPriceRepository {
  getByProductId(productId: string): Promise<PriceRecord | null>;
  save(productId: string, prices: ScrapedPrice[]): Promise<void>;
  saveAll(all: Record<string, ScrapedPrice[]>): Promise<void>;
}
