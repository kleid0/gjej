// Variant configuration for products with colour/storage options.
// IMPORTANT: Pro, Pro Max, Plus, Ultra, Mini, Air, Edge are SEPARATE products, never variants.

import type { Product } from "./Product";

export interface ColourOption {
  name: string;      // Albanian display name (e.g. "E zeze")
  nameEn: string;    // English name for search queries and URL params
  hex: string;       // Hex colour for swatch
  imageUrl?: string; // Colour-specific product image (from manufacturer CDN)
}

export interface VariantConfig {
  baseFamily: string;
  colours: ColourOption[];
  storageOptions: string[];
  defaultColour: string;
  defaultStorage: string;
}

// Pattern matching for base model extraction.
// Order matters: most specific (Pro Max) before less specific (Pro).
const BASE_MODEL_PATTERNS: Array<{ regex: RegExp; key: string }> = [
  // Apple iPhone 17
  { regex: /iphone\s*17\s*pro\s*max/i, key: "iPhone 17 Pro Max" },
  { regex: /iphone\s*17\s*pro(?!\s*max)/i, key: "iPhone 17 Pro" },
  { regex: /iphone\s*17\s*air/i, key: "iPhone 17 Air" },
  { regex: /iphone\s*17(?!\s*(pro|air|plus|mini))/i, key: "iPhone 17" },
  // Apple iPhone 16
  { regex: /iphone\s*16\s*pro\s*max/i, key: "iPhone 16 Pro Max" },
  { regex: /iphone\s*16\s*pro(?!\s*max)/i, key: "iPhone 16 Pro" },
  { regex: /iphone\s*16\s*plus/i, key: "iPhone 16 Plus" },
  { regex: /iphone\s*16(?!\s*(pro|plus|mini))/i, key: "iPhone 16" },
  // Samsung Galaxy S25
  { regex: /galaxy\s*s25\s*ultra/i, key: "Galaxy S25 Ultra" },
  { regex: /galaxy\s*s25\s*edge/i, key: "Galaxy S25 Edge" },
  { regex: /galaxy\s*s25\s*(\+|plus)/i, key: "Galaxy S25+" },
  { regex: /galaxy\s*s25\s*fe/i, key: "Galaxy S25 FE" },
  { regex: /galaxy\s*s25(?!\s*(ultra|edge|\+|plus|fe))/i, key: "Galaxy S25" },
  // Samsung Galaxy S24
  { regex: /galaxy\s*s24\s*ultra/i, key: "Galaxy S24 Ultra" },
  { regex: /galaxy\s*s24(?!\s*(ultra|\+|plus|fe))/i, key: "Galaxy S24" },
  // Samsung Galaxy A
  { regex: /galaxy\s*a56/i, key: "Galaxy A56" },
  { regex: /galaxy\s*a36/i, key: "Galaxy A36" },
  // Xiaomi
  { regex: /xiaomi\s*15\s*ultra/i, key: "Xiaomi 15 Ultra" },
  { regex: /xiaomi\s*15\s*pro/i, key: "Xiaomi 15 Pro" },
  { regex: /xiaomi\s*15(?!\s*(ultra|pro))/i, key: "Xiaomi 15" },
  // iPad
  { regex: /ipad\s*pro\s*m5/i, key: "iPad Pro M5" },
  { regex: /ipad\s*air\s*m4/i, key: "iPad Air M4" },
  // Samsung Galaxy Tab
  { regex: /galaxy\s*tab\s*s10\s*ultra/i, key: "Galaxy Tab S10 Ultra" },
  { regex: /galaxy\s*tab\s*s10(?!\s*(ultra|\+|plus))/i, key: "Galaxy Tab S10" },
];

// Shared colour palettes
// iPhone 17 actual colours (Black, White, Mist Blue, Sage, Lavender)
const IPHONE_17_COLOURS: ColourOption[] = [
  { name: "E zeze", nameEn: "Black", hex: "#1d1d1f", imageUrl: "https://www.apple.com/v/iphone-17/e/images/overview/product-viewer/colors_black__fzuhc3kqvmq2_large.jpg" },
  { name: "E bardhe", nameEn: "White", hex: "#f5f5f7", imageUrl: "https://www.apple.com/v/iphone-17/e/images/overview/product-viewer/colors_white__979ypubjzdum_large.jpg" },
  { name: "Mjegulle Blu", nameEn: "Mist Blue", hex: "#8fafc8", imageUrl: "https://www.apple.com/v/iphone-17/e/images/overview/product-viewer/colors_mist_blue__700uff6zu2qa_large.jpg" },
  { name: "Sage", nameEn: "Sage", hex: "#8a9a7a", imageUrl: "https://www.apple.com/v/iphone-17/e/images/overview/product-viewer/colors_sage__cr1jt90v1yoi_large.jpg" },
  { name: "Lila", nameEn: "Lavender", hex: "#b8a8c8", imageUrl: "https://www.apple.com/v/iphone-17/e/images/overview/product-viewer/colors_lavender__bcaie9a8npj6_large.jpg" },
];

const APPLE_TITANIUM: ColourOption[] = [
  { name: "Titanium natyral", nameEn: "Natural Titanium", hex: "#b8b0a8" },
  { name: "Titanium i zi", nameEn: "Black Titanium", hex: "#3c3c3c" },
  { name: "Titanium i bardhe", nameEn: "White Titanium", hex: "#e3e0da" },
  { name: "Titanium shkretetire", nameEn: "Desert Titanium", hex: "#c5a778" },
];

const S25_STANDARD: ColourOption[] = [
  { name: "Navy", nameEn: "Navy", hex: "#1b2a4a" },
  { name: "Hije argjendi", nameEn: "Silver Shadow", hex: "#c8c8c8" },
  { name: "Blu akulli", nameEn: "Icy Blue", hex: "#b3d4e8" },
  { name: "Mente", nameEn: "Mint", hex: "#aee4c5" },
];

const S25_ULTRA_COLOURS: ColourOption[] = [
  { name: "Titanium i zi", nameEn: "Titanium Black", hex: "#2c2c2c" },
  { name: "Titanium gri", nameEn: "Titanium Gray", hex: "#8c8c8c" },
  { name: "Titanium blu argjendi", nameEn: "Titanium Silver Blue", hex: "#a8b9c8" },
  { name: "Titanium bardhe argjendi", nameEn: "Titanium White Silver", hex: "#e8e8e8" },
];

const CONFIGS: Record<string, VariantConfig> = {
  // ── Apple iPhone 17 ──────────────────────────────────────
  "iPhone 17": {
    baseFamily: "iPhone 17", colours: IPHONE_17_COLOURS,
    storageOptions: ["256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "256GB",
  },
  "iPhone 17 Pro": {
    baseFamily: "iPhone 17 Pro", colours: APPLE_TITANIUM,
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Natural Titanium", defaultStorage: "256GB",
  },
  "iPhone 17 Pro Max": {
    baseFamily: "iPhone 17 Pro Max", colours: APPLE_TITANIUM,
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Natural Titanium", defaultStorage: "256GB",
  },
  "iPhone 17 Air": {
    baseFamily: "iPhone 17 Air",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "Starlight", nameEn: "Starlight", hex: "#f5eeda" },
      { name: "Blu", nameEn: "Blue", hex: "#5b7fa5" },
      { name: "E gjelber", nameEn: "Green", hex: "#4a6741" },
    ],
    storageOptions: ["128GB", "256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "128GB",
  },
  // ── Apple iPhone 16 ──────────────────────────────────────
  "iPhone 16": {
    baseFamily: "iPhone 16",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "E bardhe", nameEn: "White", hex: "#f5f5f7" },
      { name: "Teal", nameEn: "Teal", hex: "#4a8a7a" },
      { name: "Roze", nameEn: "Pink", hex: "#f2c8c4" },
      { name: "Ultramarine", nameEn: "Ultramarine", hex: "#4a5ca5" },
    ],
    storageOptions: ["128GB", "256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "128GB",
  },
  "iPhone 16 Plus": {
    baseFamily: "iPhone 16 Plus",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "E bardhe", nameEn: "White", hex: "#f5f5f7" },
      { name: "Teal", nameEn: "Teal", hex: "#4a8a7a" },
      { name: "Roze", nameEn: "Pink", hex: "#f2c8c4" },
      { name: "Ultramarine", nameEn: "Ultramarine", hex: "#4a5ca5" },
    ],
    storageOptions: ["128GB", "256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "128GB",
  },
  "iPhone 16 Pro": {
    baseFamily: "iPhone 16 Pro", colours: APPLE_TITANIUM,
    storageOptions: ["128GB", "256GB", "512GB", "1TB"],
    defaultColour: "Natural Titanium", defaultStorage: "128GB",
  },
  "iPhone 16 Pro Max": {
    baseFamily: "iPhone 16 Pro Max", colours: APPLE_TITANIUM,
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Natural Titanium", defaultStorage: "256GB",
  },
  // ── Samsung Galaxy S25 ───────────────────────────────────
  "Galaxy S25": {
    baseFamily: "Galaxy S25", colours: S25_STANDARD,
    storageOptions: ["128GB", "256GB"],
    defaultColour: "Navy", defaultStorage: "128GB",
  },
  "Galaxy S25+": {
    baseFamily: "Galaxy S25+", colours: S25_STANDARD,
    storageOptions: ["256GB", "512GB"],
    defaultColour: "Navy", defaultStorage: "256GB",
  },
  "Galaxy S25 Ultra": {
    baseFamily: "Galaxy S25 Ultra", colours: S25_ULTRA_COLOURS,
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Titanium Black", defaultStorage: "256GB",
  },
  "Galaxy S25 Edge": {
    baseFamily: "Galaxy S25 Edge",
    colours: [
      { name: "Titanium i zi", nameEn: "Titanium Black", hex: "#2c2c2c" },
      { name: "Titanium argjendi", nameEn: "Titanium Silver", hex: "#c0c0c0" },
    ],
    storageOptions: ["256GB", "512GB"],
    defaultColour: "Titanium Black", defaultStorage: "256GB",
  },
  // ── Samsung Galaxy S24 ───────────────────────────────────
  "Galaxy S24": {
    baseFamily: "Galaxy S24",
    colours: [
      { name: "Vjollce", nameEn: "Cobalt Violet", hex: "#6b5ca5" },
      { name: "Hiri", nameEn: "Amber Gray", hex: "#9c8c7c" },
      { name: "Verdhe", nameEn: "Amber Yellow", hex: "#e8c840" },
      { name: "E zeze", nameEn: "Onyx Black", hex: "#1d1d1f" },
    ],
    storageOptions: ["128GB", "256GB"],
    defaultColour: "Onyx Black", defaultStorage: "128GB",
  },
  "Galaxy S24 Ultra": {
    baseFamily: "Galaxy S24 Ultra",
    colours: [
      { name: "Titanium gri", nameEn: "Titanium Gray", hex: "#8c8c8c" },
      { name: "Titanium i zi", nameEn: "Titanium Black", hex: "#2c2c2c" },
      { name: "Titanium vjollce", nameEn: "Titanium Violet", hex: "#8878a8" },
      { name: "Titanium verdhe", nameEn: "Titanium Yellow", hex: "#e8d878" },
    ],
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Titanium Gray", defaultStorage: "256GB",
  },
  // ── Samsung Galaxy A ─────────────────────────────────────
  "Galaxy A56": {
    baseFamily: "Galaxy A56",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "Blu e lehte", nameEn: "Light Blue", hex: "#a8c8e8" },
      { name: "Limoni", nameEn: "Lime", hex: "#c8e840" },
      { name: "Lila", nameEn: "Lilac", hex: "#c8a8d8" },
    ],
    storageOptions: ["128GB", "256GB"],
    defaultColour: "Black", defaultStorage: "128GB",
  },
  "Galaxy A36": {
    baseFamily: "Galaxy A36",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "Blu e lehte", nameEn: "Light Blue", hex: "#a8c8e8" },
      { name: "Lavande", nameEn: "Lavender", hex: "#c8b8d8" },
    ],
    storageOptions: ["128GB", "256GB"],
    defaultColour: "Black", defaultStorage: "128GB",
  },
  // ── Xiaomi ───────────────────────────────────────────────
  "Xiaomi 15": {
    baseFamily: "Xiaomi 15",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "E bardhe", nameEn: "White", hex: "#f5f5f7" },
      { name: "E gjelber", nameEn: "Green", hex: "#4a6741" },
    ],
    storageOptions: ["256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "256GB",
  },
  "Xiaomi 15 Pro": {
    baseFamily: "Xiaomi 15 Pro",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "E bardhe", nameEn: "White", hex: "#f5f5f7" },
      { name: "E gjelber", nameEn: "Green", hex: "#4a6741" },
    ],
    storageOptions: ["256GB", "512GB"],
    defaultColour: "Black", defaultStorage: "256GB",
  },
  "Xiaomi 15 Ultra": {
    baseFamily: "Xiaomi 15 Ultra",
    colours: [
      { name: "E zeze", nameEn: "Black", hex: "#1d1d1f" },
      { name: "E bardhe", nameEn: "White", hex: "#f5f5f7" },
      { name: "Argjendte", nameEn: "Silver", hex: "#c0c0c0" },
    ],
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Black", defaultStorage: "256GB",
  },
  // ── iPad ─────────────────────────────────────────────────
  "iPad Pro M5": {
    baseFamily: "iPad Pro M5",
    colours: [
      { name: "Space Black", nameEn: "Space Black", hex: "#1d1d1f" },
      { name: "Argjendi", nameEn: "Silver", hex: "#e3e3e3" },
    ],
    storageOptions: ["256GB", "512GB", "1TB", "2TB"],
    defaultColour: "Space Black", defaultStorage: "256GB",
  },
  "iPad Air M4": {
    baseFamily: "iPad Air M4",
    colours: [
      { name: "Hapesire gri", nameEn: "Space Gray", hex: "#555555" },
      { name: "Starlight", nameEn: "Starlight", hex: "#f5eeda" },
      { name: "Vjollce", nameEn: "Purple", hex: "#7b6e9b" },
      { name: "Blu", nameEn: "Blue", hex: "#5b7fa5" },
    ],
    storageOptions: ["128GB", "256GB", "512GB", "1TB"],
    defaultColour: "Space Gray", defaultStorage: "128GB",
  },
  // ── Samsung Galaxy Tab ───────────────────────────────────
  "Galaxy Tab S10": {
    baseFamily: "Galaxy Tab S10",
    colours: [
      { name: "Moonstone Gray", nameEn: "Moonstone Gray", hex: "#8c8c8c" },
      { name: "Storm Blue", nameEn: "Storm Blue", hex: "#3a4d63" },
    ],
    storageOptions: ["128GB", "256GB"],
    defaultColour: "Moonstone Gray", defaultStorage: "128GB",
  },
  "Galaxy Tab S10 Ultra": {
    baseFamily: "Galaxy Tab S10 Ultra",
    colours: [
      { name: "Moonstone Gray", nameEn: "Moonstone Gray", hex: "#8c8c8c" },
      { name: "Storm Blue", nameEn: "Storm Blue", hex: "#3a4d63" },
    ],
    storageOptions: ["256GB", "512GB", "1TB"],
    defaultColour: "Moonstone Gray", defaultStorage: "256GB",
  },
};

// Keywords that identify accessories — even if the name contains a phone model
const ACCESSORY_KEYWORDS = /\b(case|cover|casing|screen\s*protector|tempered\s*glass|folie|mbrojtese|kover|aksesore|cable|kabllo|charger|karikues|strap|band|ring|holder|stand|mount|lens|wallet|pouch|sleeve|skin|sticker|bumper|shell)\b/i;

/**
 * Get variant configuration for a product.
 * Returns null for products without a known variant config (accessories, TVs, etc.).
 */
export function getVariantConfig(product: Product): VariantConfig | null {
  const validSubcategories = ["Smartphone", "Tablet", "Laptop"];
  if (!validSubcategories.includes(product.subcategory)) return null;

  // Accessories often mention the phone model in their name — exclude them
  if (ACCESSORY_KEYWORDS.test(product.family)) return null;

  for (const { regex, key } of BASE_MODEL_PATTERNS) {
    if (regex.test(product.family)) {
      return CONFIGS[key] ?? null;
    }
  }
  return null;
}

/** Extract storage size (e.g. "128GB") from a product family name. */
export function extractStorageFromFamily(family: string): string | null {
  const match = family.match(/\b(\d+)\s*(GB|TB)\b/i);
  if (!match) return null;
  return `${match[1]}${match[2].toUpperCase()}`;
}

/**
 * Build variant-specific search terms for the price scraper.
 * "!" prefix tells buildQueries() to preserve the term as-is (bypasses cleanQuery
 * which would strip the storage size).
 */
export function buildVariantSearchTerms(
  product: Product,
  colourEn: string,
  storage: string,
): string[] {
  const config = getVariantConfig(product);
  if (!config) return product.searchTerms;

  const brand = product.brand;
  const base = config.baseFamily;
  const terms: string[] = [];

  if (colourEn && storage) {
    terms.push(`!${brand} ${base} ${storage} ${colourEn}`);
    terms.push(`!${base} ${storage} ${colourEn}`);
  }
  if (colourEn && !storage) {
    terms.push(`!${brand} ${base} ${colourEn}`);
    terms.push(`!${base} ${colourEn}`);
  }
  if (storage) {
    terms.push(`!${brand} ${base} ${storage}`);
    terms.push(`!${base} ${storage}`);
  }

  // Original search terms (cleaned normally by the scraper)
  terms.push(...product.searchTerms);
  return terms;
}
