// Use case: discover products from external stores and persist them

import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";

export interface IProductDiscoveryService {
  discover(): Promise<Product[]>;
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Re-use the fusionKey from DuplicateFuser for consistent dedup behaviour
// across discovery-time and admin-triggered fusion.

import { fusionKey } from "./DuplicateFuser";

function dedupKey(p: Product): string {
  return fusionKey(p);
}

// Merge two products: keep the one with the better image, richer searchTerms
function mergeProducts(a: Product, b: Product): Product {
  const hasImageA = a.imageUrl.startsWith("http");
  const hasImageB = b.imageUrl.startsWith("http");
  const base = hasImageA ? a : hasImageB ? b : a;

  // Combine searchTerms so the price scraper can find it under both names
  const terms = Array.from(new Set([...a.searchTerms, ...b.searchTerms]));
  return { ...base, searchTerms: terms };
}

function deduplicateProducts(products: Product[]): Product[] {
  const canonical = new Map<string, Product>();
  for (const p of products) {
    const key = dedupKey(p);
    const existing = canonical.get(key);
    canonical.set(key, existing ? mergeProducts(existing, p) : p);
  }
  return Array.from(canonical.values());
}

// ── Use case ──────────────────────────────────────────────────────────────────
export class CatalogDiscovery {
  constructor(
    private readonly repo: IProductRepository,
    private readonly discoveryService: IProductDiscoveryService
  ) {}

  async run(): Promise<{ discovered: number; total: number }> {
    const fresh = await this.discoveryService.discover();
    const existing = await this.repo.getAll();

    // Merge fresh into existing by id, then deduplicate cross-store duplicates
    const byId = new Map(existing.map((p) => [p.id, p]));
    for (const p of fresh) byId.set(p.id, p);

    const merged = deduplicateProducts(Array.from(byId.values()));
    await this.repo.saveAll(merged);

    return { discovered: fresh.length, total: merged.length };
  }
}
