// Use case: discover products from external stores and persist them

import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";

export interface IProductDiscoveryService {
  discover(): Promise<Product[]>;
}

export class CatalogDiscovery {
  constructor(
    private readonly repo: IProductRepository,
    private readonly discoveryService: IProductDiscoveryService
  ) {}

  async run(): Promise<{ discovered: number; total: number }> {
    const fresh = await this.discoveryService.discover();
    const existing = await this.repo.getAll();

    // Merge: fresh results take precedence over existing by id
    const map = new Map(existing.map((p) => [p.id, p]));
    for (const p of fresh) map.set(p.id, p);
    const merged = Array.from(map.values());

    await this.repo.saveAll(merged);

    return { discovered: fresh.length, total: merged.length };
  }
}
