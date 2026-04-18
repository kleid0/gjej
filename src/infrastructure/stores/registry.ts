// Infrastructure: registry of all supported Albanian retailers

import type { Store } from "@/src/domain/pricing/Store";

// All stores the app has ever known about. Kept for STORE_MAP so historical
// price rows / discovered products with a disabled store's prefix still
// resolve to a human-readable name.
const ALL_STORES: Store[] = [
  {
    id: "foleja",
    name: "Foleja.al",
    url: "https://www.foleja.al",
    logo: "/logos/foleja.png",
    color: "#e63946",
    platform: "shopware",
  },
  {
    id: "shpresa",
    name: "Shpresa Group",
    url: "https://shpresa.al",
    logo: "/logos/shpresa.png",
    color: "#0066cc",
    platform: "woocommerce",
  },
  {
    id: "neptun",
    name: "Neptun",
    url: "https://www.neptun.al",
    logo: "/logos/neptun.png",
    color: "#003087",
    platform: "neptun",
  },
  {
    id: "pcstore",
    name: "PC Store",
    url: "https://www.pcstore.al",
    logo: "/logos/pcstore.png",
    color: "#ff6600",
    platform: "woocommerce",
    // Cloudflare WAF blocks all automated requests to pcstore.al (including
    // the Googlebot UA workaround); scraping produces only errors and no
    // recorded prices. Disabled until a reliable access method is found.
    enabled: false,
  },
  {
    id: "globe",
    name: "Globe Albania",
    url: "https://www.globe.al",
    logo: "/logos/globe.png",
    color: "#00a651",
    platform: "globe",
  },
  {
    id: "albagame",
    name: "AlbaGame",
    url: "https://www.albagame.al",
    logo: "/logos/albagame.png",
    color: "#7c3aed",
    platform: "shopify",
  },
];

export const STORES: Store[] = ALL_STORES.filter((s) => s.enabled !== false);

export const STORE_MAP = Object.fromEntries(ALL_STORES.map((s) => [s.id, s]));
