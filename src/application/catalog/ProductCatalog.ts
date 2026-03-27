// Application service: product catalog queries
// Depends on the domain repository interface — never on infrastructure directly.

import type { IProductRepository } from "@/src/domain/catalog/IProductRepository";
import type { Product, Category } from "@/src/domain/catalog/Product";
import { CATEGORIES } from "@/src/domain/catalog/Product";

export class ProductCatalog {
  constructor(private readonly repo: IProductRepository) {}

  async getAllProducts(): Promise<Product[]> {
    return this.repo.getAll();
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.repo.getById(id);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.repo.getByCategory(categoryId);
  }

  async searchProducts(query: string): Promise<Product[]> {
    return this.repo.search(query);
  }

  async getFamilySiblings(product: Product): Promise<Product[]> {
    return this.repo.getFamilySiblings(product);
  }

  getCategories(): Category[] {
    return CATEGORIES;
  }

  getCategoryById(id: string): Category | undefined {
    return CATEGORIES.find((c) => c.id === id);
  }
}
