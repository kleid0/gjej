// Use case: detect and fuse duplicate products in the catalog
//
// Smarter than the discovery-time dedupKey — handles:
// • Store-specific prefixes (Celular, Telefon, Console, etc.)
// • Albanian + international colour names
// • Brand normalization (Lexar® → lexar)
// • Category-aware storage handling (strip for phones, keep for SSDs)
// • Token-overlap similarity for fuzzy matching

import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";

// ── Normalisation helpers ────────────────────────────────────────────────────

const STORE_PREFIXES =
  /\b(celular|telefon|televizor|laptop|notebook|console|gaming|smartphone|device|produit|monitor)\b/gi;

const COLOURS =
  /\b(black|white|red|blue|green|gold|silver|gray|grey|graphite|midnight|starlight|platinum|rouge|noir|bleu|blanco|negro|pink|purple|orange|cream|titanium|natural|navy|mint|lime|coral|rose|lavender|beige|bronze|copper|ivory|teal|cyan|magenta|i bardh[eë]|i zi|i kaltert|i verdh[eë]|i kuq|jeshil|vjollc[eë]|rozë|i argjend[tëe]|i artë|e zez[eë]|e bardh[eë])\b/gi;

// Categories where storage size is a VARIANT (not a different product).
// For hard drives, SSDs, memory cards — capacity IS the product identity.
const STORAGE_VARIANT_CATEGORIES = new Set(["telefona"]);

const STORAGE_PATTERN = /\b\d+\s*(gb|tb|mb|ram)\b/gi;

// Categories where screen size is cosmetic / store-specific noise.
// For laptops, TVs, monitors — screen size IS a product differentiator.
const SCREEN_SIZE_VARIANT_CATEGORIES = new Set(["telefona"]);

/** Strip trademark symbols and normalise brand string */
function normBrand(brand: string): string {
  return brand
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Build a normalised fusion key for a product.
 * Products that should be considered the same will produce the same key.
 */
export function fusionKey(p: Product): string {
  let cleaned = p.family;

  // Strip store-specific prefixes
  cleaned = cleaned.replace(STORE_PREFIXES, "");

  // Strip colours
  cleaned = cleaned.replace(COLOURS, "");

  // Strip RAM+storage combos like "12+256GB" BEFORE the general storage strip
  // so the full pattern (N+M GB/TB) is still intact when matched.
  cleaned = cleaned.replace(/\b\d+\s*\+\s*\d+\s*(gb|tb)\b/gi, "");

  // Strip storage sizes only for variant categories (phones/tablets)
  if (STORAGE_VARIANT_CATEGORIES.has(p.category)) {
    cleaned = cleaned.replace(STORAGE_PATTERN, "");
  }

  // Strip "eSIM" / "Dual SIM" variants
  cleaned = cleaned.replace(/\b(e\s?sim|dual\s?sim)\b/gi, "");

  // Strip screen sizes only for phones (for laptops/TVs, screen size matters)
  if (SCREEN_SIZE_VARIANT_CATEGORIES.has(p.category)) {
    cleaned = cleaned.replace(/\b\d+([.,]\d+)?\s*["″'']\s*/g, "");
  }

  // Bundle noise: strip " + <addon>" only when the "+" appears late in the
  // name (word index >= 3), indicating a bundle add-on like "Switch 2 + Mario Kart".
  // Early "+" is part of the product name (e.g., "Tastiere + Mouse HP 150").
  const plusIdx = cleaned.indexOf(" + ");
  if (plusIdx > 0) {
    const wordsBefore = cleaned.slice(0, plusIdx).trim().split(/\s+/).length;
    if (wordsBefore >= 3) {
      cleaned = cleaned.slice(0, plusIdx);
    }
  }

  // Strip common model suffixes: SM-S948B, etc.
  cleaned = cleaned.replace(/\bSM-\w+\b/gi, "");

  // Normalise: lowercase, strip punctuation, collapse spaces
  cleaned = cleaned
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${normBrand(p.brand)}::${cleaned}`;
}

// ── Merge logic ──────────────────────────────────────────────────────────────

/** Pick the best product from a group and merge search terms from all */
export function fuseGroup(products: Product[]): Product {
  if (products.length === 1) return products[0];

  // Score each product: prefer one with image, enrichment, shorter family, more search terms
  const scored = products
    .map((p) => {
      let score = 0;
      if (p.imageUrl?.startsWith("http")) score += 10;
      if (p.enrichedAt) score += 5;
      if (p.specs && Object.keys(p.specs).length > 0) score += 5;
      if (p.variant) score += 3;
      // Shorter family = cleaner name (less store noise)
      score -= p.family.length * 0.05;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0].p;

  // Merge all search terms from the group
  const allTerms = new Set<string>();
  for (const p of products) {
    for (const t of p.searchTerms) allTerms.add(t);
  }

  // Merge storage options
  const allStorage = new Map<string, Product["storageOptions"][number]>();
  for (const p of products) {
    for (const opt of p.storageOptions) {
      if (!allStorage.has(opt.label)) allStorage.set(opt.label, opt);
    }
  }

  return {
    ...best,
    searchTerms: Array.from(allTerms),
    storageOptions: Array.from(allStorage.values()),
  };
}

// ── Main service ─────────────────────────────────────────────────────────────

export interface FuseResult {
  /** Number of products before fusion */
  before: number;
  /** Number of products after fusion */
  after: number;
  /** Number of products eliminated */
  eliminated: number;
  /** Number of duplicate groups that were fused (each had 2+ products) */
  groupsFused: number;
  /** Sample of fused groups for the admin UI (up to 20) */
  samples: { kept: string; absorbed: string[] }[];
}

export class DuplicateFuser {
  constructor(private readonly repo: IProductRepository) {}

  /** Detect duplicate groups without modifying data */
  async detect(): Promise<FuseResult> {
    const products = await this.repo.getAll();
    return this.computeFusion(products, false);
  }

  /** Detect and fuse duplicates, saving the cleaned catalog */
  async fuse(): Promise<FuseResult> {
    const products = await this.repo.getAll();
    const result = this.computeFusion(products, true);

    if (result.eliminated > 0) {
      await this.repo.saveAll(result._fused!);
    }

    // Strip internal field before returning
    const { _fused, ...publicResult } = result;
    return publicResult;
  }

  private computeFusion(
    products: Product[],
    includeFused: boolean
  ): FuseResult & { _fused?: Product[] } {
    // Group by fusion key
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = fusionKey(p);
      const group = groups.get(key);
      if (group) group.push(p);
      else groups.set(key, [p]);
    }

    const fused: Product[] = [];
    const samples: FuseResult["samples"] = [];
    let groupsFused = 0;

    for (const group of Array.from(groups.values())) {
      const canonical = fuseGroup(group);
      if (includeFused) fused.push(canonical);

      if (group.length > 1) {
        groupsFused++;
        if (samples.length < 20) {
          samples.push({
            kept: canonical.family,
            absorbed: group
              .filter((p) => p.id !== canonical.id)
              .map((p) => p.family),
          });
        }
      }
    }

    return {
      before: products.length,
      after: groups.size,
      eliminated: products.length - groups.size,
      groupsFused,
      samples,
      ...(includeFused ? { _fused: fused } : {}),
    };
  }
}
