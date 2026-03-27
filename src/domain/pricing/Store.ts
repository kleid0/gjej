// Store entity — represents a retailer with platform-specific integration

export type StorePlatform = "shopify" | "woocommerce" | "shopware" | "magento" | "neptun" | "html";

export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string;
  color: string;
  platform: StorePlatform;
}
