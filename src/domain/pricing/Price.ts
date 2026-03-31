// Domain entities for the Pricing bounded context

export interface ScrapedPrice {
  storeId: string;
  price: number | null;
  inStock: boolean | null;
  stockLabel: string;
  productUrl: string | null;
  lastChecked: string;
  error?: string;
  suspicious?: boolean; // Price is an outlier (>50% from median) — match may be wrong
}

export interface PriceRecord {
  prices: ScrapedPrice[];
  refreshedAt: string;
}
