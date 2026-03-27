// Infrastructure: file-based implementation of IProductRepository

import { promises as fs } from "fs";
import path from "path";
import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product } from "@/src/domain/catalog/Product";
import { DISCOVERED_PRODUCTS_FILE, getDiscoveredProductsReadPath } from "./paths";

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
    return all.find((p) => p.id === id) ?? null;
  }

  async getByCategory(categoryId: string): Promise<Product[]> {
    const all = await this.readFile();
    return all.filter((p) => p.category === categoryId);
  }

  async search(query: string): Promise<Product[]> {
    const q = query.toLowerCase();
    const all = await this.readFile();
    return all.filter(
      (p) =>
        p.family.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.modelNumber.toLowerCase().includes(q) ||
        p.searchTerms.some((t) => t.toLowerCase().includes(q))
    );
  }

  async getFamilySiblings(product: Product): Promise<Product[]> {
    const all = await this.readFile();
    return all.filter((p) => p.family === product.family && p.id !== product.id);
  }

  async saveAll(products: Product[]): Promise<void> {
    await fs.mkdir(path.dirname(DISCOVERED_PRODUCTS_FILE), { recursive: true });
    await fs.writeFile(DISCOVERED_PRODUCTS_FILE, JSON.stringify(products, null, 2));
  }
}
