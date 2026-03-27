import type { Product } from "./Product";

export interface IProductRepository {
  getAll(): Promise<Product[]>;
  getById(id: string): Promise<Product | null>;
  getByCategory(categoryId: string): Promise<Product[]>;
  search(query: string): Promise<Product[]>;
  getFamilySiblings(product: Product): Promise<Product[]>;
  saveAll(products: Product[]): Promise<void>;
}
