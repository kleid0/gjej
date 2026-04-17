// Store entity — represents a retailer with platform-specific integration

export type StorePlatform = "shopify" | "woocommerce" | "shopware" | "globe" | "neptun" | "html";

export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string;
  color: string;
  platform: StorePlatform;
  // When false, the store is kept in STORE_MAP (so historical price rows
  // still resolve to a name) but is excluded from scraping and the admin
  // health table. Defaults to true when omitted.
  enabled?: boolean;
}
