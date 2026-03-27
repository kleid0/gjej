// Infrastructure: registry of all supported Albanian retailers

import type { Store } from "@/src/domain/pricing/Store";

export const STORES: Store[] = [
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
  },
  {
    id: "globe",
    name: "Globe Albania",
    url: "https://www.globe.al",
    logo: "/logos/globe.png",
    color: "#00a651",
    platform: "magento",
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

export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
