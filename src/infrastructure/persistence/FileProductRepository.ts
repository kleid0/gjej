// Infrastructure: file-based implementation of IProductRepository

import { promises as fs } from "fs";
import path from "path";
import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";
import { DISCOVERED_PRODUCTS_FILE, getDiscoveredProductsReadPath } from "./paths";
import { markDirty } from "./JsonStore";
import { scoreAndSortProducts } from "./productSearch";

export class FileProductRepository implements IProductRepository {
  private async readFile(): Promise<Product[]> {
    try {
      return JSON.parse(await fs.readFile(getDiscoveredProductsReadPath(), "utf-8"));
    } catch {
      return [];
    }
  }

  async getAll(): Promise<Product[]> {
    return this.readFile();
  }

  async getById(id: string): Promise<Product | null> {
    const all = await this.readFile();
    // Exact match first (handles most products)
    const exact = all.find((p) => p.id === id);
    if (exact) return exact;
    // Fallback: Next.js URL-decodes dynamic path segments before passing them as
    // params.slug, so "shpresa-...-8″-..." arrives when the stored ID is
    // "shpresa-...-8%e2%80%b3-...". Normalise both sides by decoding percent-
    // encoding so the comparison is canonical regardless of which side is encoded.
    const safe = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
    const norm = safe(id);
    return all.find((p) => safe(p.id) === norm) ?? null;
  }

  async getByCategory(categoryId: string): Promise<Product[]> {
    const all = await this.readFile();
    return all.filter((p) => p.category === categoryId);
  }

  async search(query: string): Promise<Product[]> {
    const all = await this.readFile();
    return scoreAndSortProducts(all, query);
  }

  async getFamilySiblings(product: Product): Promise<Product[]> {
    const all = await this.readFile();
    return all.filter((p) => p.family === product.family && p.id !== product.id);
  }

  async saveAll(products: Product[]): Promise<void> {
    await fs.mkdir(path.dirname(DISCOVERED_PRODUCTS_FILE), { recursive: true });
    await fs.writeFile(DISCOVERED_PRODUCTS_FILE, JSON.stringify(products, null, 2));
    markDirty(DISCOVERED_PRODUCTS_FILE);
  }
}
