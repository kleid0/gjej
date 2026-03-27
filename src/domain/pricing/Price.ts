// Domain entities for the Pricing bounded context

export interface ScrapedPrice {
  storeId: string;
  price: number | null;
  inStock: boolean | null;
  stockLabel: string;
  productUrl: string | null;
  lastChecked: string;
  error?: string;
}

export interface PriceRecord {
  prices: ScrapedPrice[];
  refreshedAt: string;
}
