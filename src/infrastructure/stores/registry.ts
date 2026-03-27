// Infrastructure: registry of all supported Albanian retailers

import type { Store } from "@/src/domain/pricing/Store";

export const STORES: Store[] = [
  {
    id: "foleja",
    name: "Foleja.al",
    url: "https://www.foleja.al",
    logo: "/logos/foleja.png",
    color: "#e63946",
    searchUrls: (q) => [
      `https://www.foleja.al/search?search=${encodeURIComponent(q)}`,
      `https://www.foleja.al/search?search=${encodeURIComponent(q.split(" ")[0])}`,
    ],
    selectors: {
      productLink: [
        ".product-box a[href*='/']",
        ".product-card a[href*='/']",
        ".product-info a[href*='/']",
        ".product-name a[href*='/']",
        "a.product-item-link",
        ".cms-element-product-box a[href*='/']",
      ],
      price: [
        ".product-price__price",
        "[class*='product-price'] .price",
        ".price__purchase--price",
        "[data-price-type='finalPrice'] .price",
        ".price-box .price",
      ],
      stock: [".product-detail-delivery-information", ".stock", "[class*='delivery']", "[class*='stock']"],
      inStockText: ["në gjendje", "disponibël", "in stock", "available", "sofort verfügbar"],
      outOfStockText: ["jo në gjendje", "out of stock", "sold out", "nicht verfügbar"],
    },
  },
  {
    id: "shpresa",
    name: "Shpresa Group",
    url: "https://shpresa.al",
    logo: "/logos/shpresa.png",
    color: "#0066cc",
    searchUrls: (q) => [
      `https://shpresa.al/?s=${encodeURIComponent(q)}&post_type=product`,
      `https://shpresa.al/?s=${encodeURIComponent(q.split(" ")[0])}&post_type=product`,
    ],
    selectors: {
      productLink: [
        "a.woocommerce-loop-product__link",
        "a[href*='/product/']",
        "li.product a[href]",
        ".product-name a",
        ".woocommerce-loop-product__title a",
        "h3 a[href*='/product/']",
      ],
      price: [".woocommerce-Price-amount bdi", ".woocommerce-Price-amount", ".price ins .amount", ".price .amount", ".summary .price"],
      stock: [".stock", ".availability", ".in-stock", ".out-of-stock"],
      inStockText: ["in stock", "në gjendje", "disponibël", "available"],
      outOfStockText: ["out of stock", "nuk ka gjendje", "sold out"],
    },
  },
  {
    id: "neptun",
    name: "Neptun",
    url: "https://www.neptun.al",
    logo: "/logos/neptun.png",
    color: "#003087",
    searchUrls: (q) => [`https://www.neptun.al/search?q=${encodeURIComponent(q)}`],
    selectors: {
      productLink: ["a.product-link", ".product-name a", "h2 a", ".product-item a", "article a[href*='/product']"],
      price: [".product-price", ".price", ".offer-price", "[class*='price']"],
      stock: [".stock-label", ".availability", "[class*='stock']"],
      inStockText: ["in stock", "available", "në gjendje"],
      outOfStockText: ["out of stock", "unavailable", "nuk ka"],
    },
  },
  {
    id: "pcstore",
    name: "PC Store",
    url: "https://www.pcstore.al",
    logo: "/logos/pcstore.png",
    color: "#ff6600",
    searchUrls: (q) => [`https://www.pcstore.al/?s=${encodeURIComponent(q)}&post_type=product`],
    selectors: {
      productLink: [
        "a.woocommerce-loop-product__link",
        "a[href*='/product/']",
        "li.product a[href]",
        ".product-title a",
      ],
      price: [".woocommerce-Price-amount bdi", ".woocommerce-Price-amount", ".price ins .amount", ".price .amount", ".summary .price"],
      stock: [".in-stock", ".out-of-stock", ".stock"],
      inStockText: ["in stock", "në gjendje", "available"],
      outOfStockText: ["out of stock", "nuk ka gjendje", "unavailable"],
    },
  },
  {
    id: "globe",
    name: "Globe Albania",
    url: "https://www.globe.al",
    logo: "/logos/globe.png",
    color: "#00a651",
    searchUrls: (q) => [`https://www.globe.al/search?q=${encodeURIComponent(q)}`],
    selectors: {
      productLink: [".product-name a", "a.product-link", "h3 a", ".product-title a"],
      price: [".price", ".product-price", ".final-price", "[class*='price']"],
      stock: [".stock", ".availability", "[class*='stock']"],
      inStockText: ["in stock", "available", "në gjendje"],
      outOfStockText: ["out of stock", "unavailable", "nuk ka gjendje"],
    },
  },
  {
    id: "albagame",
    name: "AlbaGame",
    url: "https://www.albagame.al",
    logo: "/logos/albagame.png",
    color: "#7c3aed",
    searchUrls: (q) => [`https://www.albagame.al/search?q=${encodeURIComponent(q)}&type=product`],
    selectors: {
      productLink: [
        "main a[href*='/products/']",
        "#MainContent a[href*='/products/']",
        ".product-card a[href*='/products/']",
      ],
      price: [".price__current", ".price-item--regular", ".price-item", "[class*='price']"],
      stock: [".product-availability", ".inventory-status", "[class*='availability']"],
      inStockText: ["in stock", "available", "në gjendje"],
      outOfStockText: ["out of stock", "sold out", "unavailable"],
    },
  },
];

export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
