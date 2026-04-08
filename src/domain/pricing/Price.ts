// Domain entities for the Pricing bounded context

export interface ScrapedPrice {
  storeId: string;
  price: number | null;
  inStock: boolean | null;
  stockLabel: string;
  productUrl: string | null;
  lastChecked: string;
  error?: string;
  suspicious?: boolean;   // Price >40% below average — likely wrong match
  overpriced?: boolean;   // Price >60% above average — flagged for review
  stale?: boolean;        // Price data is older than 24h
  unverified?: boolean;   // Store match confidence below verification threshold
  colourWarning?: string;
  matchedName?: string;   // Product name the store actually matched — used for post-validation
}

export interface PriceRecord {
  prices: ScrapedPrice[];
  refreshedAt: string;
}
