export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string;
  color: string;
  searchUrl: (query: string) => string;
  selectors: {
    productLink: string[];
    price: string[];
    stock: string[];
    inStockText: string[];
    outOfStockText: string[];
  };
}

export const STORES: Store[] = [
  {
    id: "foleja",
    name: "Foleja.al",
    url: "https://www.foleja.al",
    logo: "/logos/foleja.png",
    color: "#e63946",
    searchUrl: (q) => `https://www.foleja.al/search?q=${encodeURIComponent(q)}`,
    selectors: {
      productLink: ["a.product-item-link", "a.product-title", ".product-card a", "h2.product-name a"],
      price: [".price-box .price", ".special-price .price", ".regular-price .price", "[data-price-type='finalPrice']", ".woocommerce-Price-amount"],
      stock: [".stock", ".availability", "[class*='stock']", ".product-stock"],
      inStockText: ["in stock", "në gjendje", "disponibël", "available"],
      outOfStockText: ["out of stock", "jo në gjendje", "sold out", "unavailable"],
    },
  },
  {
    id: "shpresa",
    name: "Shpresa Group",
    url: "https://www.shpresa.al",
    logo: "/logos/shpresa.png",
    color: "#0066cc",
    searchUrl: (q) => `https://www.shpresa.al/search?q=${encodeURIComponent(q)}`,
    selectors: {
      productLink: ["a.product-item-link", ".product-title a", ".product-name a", "h3 a"],
      price: [".price", ".product-price", ".special-price .price", ".woocommerce-Price-amount", "[class*='price']"],
      stock: [".stock", ".availability", ".in-stock", ".out-of-stock", "[class*='stock']"],
      inStockText: ["in stock", "në gjendje", "disponibël", "ka gjendje"],
      outOfStockText: ["out of stock", "nuk ka gjendje", "sold out", "jo disponibël"],
    },
  },
  {
    id: "neptun",
    name: "Neptun",
    url: "https://www.neptun.al",
    logo: "/logos/neptun.png",
    color: "#003087",
    searchUrl: (q) => `https://www.neptun.al/search?keywords=${encodeURIComponent(q)}`,
    selectors: {
      productLink: ["a.product-link", ".product-name a", "h2 a", ".product-item a"],
      price: [".product-price", ".price", ".offer-price", ".current-price", "[class*='price']"],
      stock: [".stock-label", ".availability", ".product-availability", "[class*='stock']"],
      inStockText: ["in stock", "available", "në gjendje", "ka"],
      outOfStockText: ["out of stock", "unavailable", "nuk ka", "jo disponibël"],
    },
  },
  {
    id: "pcstore",
    name: "PC Store",
    url: "https://www.pcstore.al",
    logo: "/logos/pcstore.png",
    color: "#ff6600",
    searchUrl: (q) => `https://www.pcstore.al/?s=${encodeURIComponent(q)}`,
    selectors: {
      productLink: [".product-title a", "h2.woocommerce-loop-product__title a", "a.woocommerce-loop-product__link", ".product-name a"],
      price: [".woocommerce-Price-amount", ".price ins .amount", ".price .amount", ".product-price"],
      stock: [".in-stock", ".out-of-stock", ".stock", "[class*='stock']"],
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
    searchUrl: (q) => `https://www.globe.al/search?q=${encodeURIComponent(q)}`,
    selectors: {
      productLink: [".product-name a", "a.product-link", "h3 a", ".product-title a"],
      price: [".price", ".product-price", ".final-price", "[class*='price']"],
      stock: [".stock", ".availability", "[class*='stock']", ".product-status"],
      inStockText: ["in stock", "available", "në gjendje", "disponibël"],
      outOfStockText: ["out of stock", "unavailable", "nuk ka gjendje"],
    },
  },
];

export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
