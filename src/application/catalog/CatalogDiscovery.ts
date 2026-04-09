// Use case: discover products from external stores and persist them

import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";

export interface IProductDiscoveryService {
  discover(): Promise<Product[]>;
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// Re-uses fusionKey + fuseGroup from DuplicateFuser so discovery automatically
// fuses duplicates with the same smart, category-aware logic.

import { fusionKey, fuseGroup } from "./DuplicateFuser";

function deduplicateProducts(products: Product[]): Product[] {
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const key = fusionKey(p);
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  return Array.from(groups.values()).map(fuseGroup);
}

// ── Use case ──────────────────────────────────────────────────────────────────
export class CatalogDiscovery {
  constructor(
    private readonly repo: IProductRepository,
    private readonly discoveryService: IProductDiscoveryService
  ) {}

  async run(): Promise<{ discovered: number; total: number; fused: number }> {
    const fresh = await this.discoveryService.discover();
    const existing = await this.repo.getAll();

    // Merge fresh into existing by id, then fuse cross-store duplicates
    const byId = new Map(existing.map((p) => [p.id, p]));
    for (const p of fresh) byId.set(p.id, p);

    const beforeDedup = byId.size;
    const merged = deduplicateProducts(Array.from(byId.values()));
    await this.repo.saveAll(merged);

    return { discovered: fresh.length, total: merged.length, fused: beforeDedup - merged.length };
  }
}
