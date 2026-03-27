export interface Store {
  id: string;
  name: string;
  url: string;
  logo: string;
  color: string;
  searchUrls: (query: string) => string[];
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
    searchUrls: (q) => [
      `https://www.foleja.al/catalogsearch/result/?q=${encodeURIComponent(q)}`,
      `https://www.foleja.al/search?q=${encodeURIComponent(q)}`,
      `https://www.foleja.al/kerko?q=${encodeURIComponent(q)}`,
    ],
    selectors: {
      productLink: [
        "a.product-item-link",
        ".product-item-info a",
        "a.product-title",
        ".product-card a",
        "h2.product-name a",
        "li.product-item a",
      ],
      price: [
        "[data-price-type='finalPrice'] .price",
        ".special-price .price",
        ".regular-price .price",
        ".price-box .price",
        ".woocommerce-Price-amount",
      ],
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
    searchUrls: (q) => [
      `https://www.shpresa.al/catalogsearch/result/?q=${encodeURIComponent(q)}`,
      `https://www.shpresa.al/search?q=${encodeURIComponent(q)}`,
    ],
    selectors: {
      productLink: [
        "a.product-item-link",
        ".product-item-info a",
        ".product-title a",
        ".product-name a",
        "h3 a",
      ],
      price: [
        "[data-price-type='finalPrice'] .price",
        ".special-price .price",
        ".regular-price .price",
        ".price",
        ".product-price",
        ".woocommerce-Price-amount",
        "[class*='price']",
      ],
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
    searchUrls: (q) => [
      `https://www.neptun.al/search?keywords=${encodeURIComponent(q)}`,
      `https://www.neptun.al/search?q=${encodeURIComponent(q)}`,
      `https://www.neptun.al/?s=${encodeURIComponent(q)}`,
    ],
    selectors: {
      productLink: [
        "a.product-link",
        ".product-name a",
        "h2 a",
        ".product-item a",
        "a.product-item-link",
      ],
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
    searchUrls: (q) => [
      `https://www.pcstore.al/?s=${encodeURIComponent(q)}`,
      `https://www.pcstore.al/?s=${encodeURIComponent(q)}&post_type=product`,
    ],
    selectors: {
      productLink: [
        "a.woocommerce-loop-product__link",
        "a.woocommerce-LoopProduct-link",
        "a[href*='/product/']",
        "li.product a[href]",
        "ul.products a[href]",
        ".product-title a",
        ".product-name a",
      ],
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
    searchUrls: (q) => [
      `https://www.globe.al/search?q=${encodeURIComponent(q)}`,
    ],
    selectors: {
      productLink: [".product-name a", "a.product-link", "h3 a", ".product-title a"],
      price: [".price", ".product-price", ".final-price", "[class*='price']"],
      stock: [".stock", ".availability", "[class*='stock']", ".product-status"],
      inStockText: ["in stock", "available", "në gjendje", "disponibël"],
      outOfStockText: ["out of stock", "unavailable", "nuk ka gjendje"],
    },
  },
  {
    // Shopify store (albagame-sh-p-k.myshopify.com), Wokiee theme
    id: "albagame",
    name: "AlbaGame",
    url: "https://www.albagame.al",
    logo: "/logos/albagame.png",
    color: "#7c3aed",
    searchUrls: (q) => [
      `https://www.albagame.al/search?q=${encodeURIComponent(q)}&type=product`,
      `https://www.albagame.al/search?q=${encodeURIComponent(q)}`,
    ],
    selectors: {
      productLink: [
        // Shopify: scope to <main> to avoid header/nav gift-card links
        "main a[href*='/products/']",
        "#MainContent a[href*='/products/']",
        ".tt-product a[href*='/products/']",
        ".product-card a[href*='/products/']",
      ],
      price: [
        ".price__current",
        ".price-item--regular",
        ".price__sale .price-item",
        ".price-item",
        "[class*='price']",
      ],
      stock: [
        ".product-availability",
        ".inventory-status",
        "[class*='availability']",
        "[class*='inventory']",
      ],
      inStockText: ["in stock", "available", "në gjendje", "in magazinë"],
      outOfStockText: ["out of stock", "sold out", "unavailable", "nuk ka"],
    },
  },
];

export const STORE_MAP = Object.fromEntries(STORES.map((s) => [s.id, s]));
