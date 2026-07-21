// Homepage "trending" selection.
//
// Google Trends is our real popularity signal, but it 429s from datacenter
// IPs (see cron/trends), so most of the time we fall back to a heuristic.
// The old fallback ranked purely by store-count, which surfaced a homogeneous
// wall of whatever generic item every store happens to stock (kitchen
// appliances). This picks desirable, in-stock, image-bearing products and
// enforces category diversity so the grid feels curated, then rotates daily.

import type { Product } from "@/src/domain/catalog/Product";

export interface ScoredProduct {
  product: Product;
  storeCount: number;
  hasStock: boolean;
}

// What people actually come to a price-comparison site shopping for, over the
// generic long tail. Higher = surfaced sooner.
const CATEGORY_WEIGHT: Record<string, number> = {
  telefona: 5,
  kompjutera: 5,
  gaming: 5,
  "tv-audio": 4,
  "foto-video": 4,
  shtepiake: 2,
  bukuri: 2,
  sporte: 2,
  lodra: 2,
  veshje: 1,
  shtepi: 1,
  elektronike: 1,
};

const KNOWN_BRANDS = new Set([
  "apple", "samsung", "sony", "xiaomi", "lenovo", "dell", "hp", "asus", "lg",
  "nintendo", "microsoft", "playstation", "dyson", "bose", "jbl", "canon",
  "nikon", "google", "huawei", "acer", "msi", "razer", "logitech", "philips",
  "bosch", "tefal", "gopro", "oneplus", "anker",
]);

/** Heuristic desirability score for a product with no trends signal. */
export function popularityScore(s: ScoredProduct): number {
  const p = s.product;
  let score = (CATEGORY_WEIGHT[p.category] ?? 1) * 4;
  if (s.hasStock) score += 8;
  score += Math.min(s.storeCount, 4) * 3; // multi-store = genuinely comparable
  if (p.imageUrl?.startsWith("http")) score += 6;
  if (KNOWN_BRANDS.has((p.brand ?? "").trim().toLowerCase())) score += 5;
  if (p.enrichedAt) score += 2; // has clean specs/images
  return score;
}

export interface FeaturedOptions {
  count?: number;
  /** Day index for the rotation window (e.g. day-of-year). */
  day?: number;
  /** Max products per category in the curated pool. */
  perCat?: number;
  /** Custom score (e.g. trends-weighted); defaults to popularityScore. */
  scoreOf?: (s: ScoredProduct) => number;
}

/**
 * Pick the featured grid: keep only real, in-stock, image-bearing products;
 * rank by score; enforce per-category diversity; then rotate daily over the
 * curated pool so the homepage changes without going random.
 */
export function pickFeatured(scored: ScoredProduct[], opts: FeaturedOptions = {}): Product[] {
  const count = opts.count ?? 8;
  const perCat = opts.perCat ?? 3;
  const day = opts.day ?? 0;
  const scoreOf = opts.scoreOf ?? popularityScore;
  const pool = count * 4;

  const eligible = scored
    .filter((s) => s.product.imageUrl?.startsWith("http") && s.hasStock && s.storeCount >= 1)
    .map((s) => ({ s, score: scoreOf(s) }))
    .sort((a, b) => b.score - a.score);

  // Diversity pass: fill the curated pool, capping each category so no single
  // category can flood the grid. We deliberately do NOT backfill past the cap —
  // a shorter, varied grid beats a full grid that's a wall of one category.
  const perCatCount = new Map<string, number>();
  const curated: ScoredProduct[] = [];
  for (const { s } of eligible) {
    if (curated.length >= pool) break;
    if ((perCatCount.get(s.product.category) ?? 0) < perCat) {
      curated.push(s);
      perCatCount.set(s.product.category, (perCatCount.get(s.product.category) ?? 0) + 1);
    }
  }

  if (curated.length <= count) return curated.map((s) => s.product);

  // Daily rotation: slide a wrap-around window of `count` through the pool.
  const start = (day * count) % curated.length;
  const page = Array.from({ length: count }, (_, i) => curated[(start + i) % curated.length]);
  return page.map((s) => s.product);
}
