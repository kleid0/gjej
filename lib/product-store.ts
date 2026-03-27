// Server-side module: merges the static curated products with anything
// that has been discovered via /api/discover.
// Do NOT import this from client components.

import { promises as fs } from "fs";
import { PRODUCTS, type Product } from "./products";
import { DISCOVERED_PRODUCTS_FILE } from "./data-path";

const DATA_FILE = DISCOVERED_PRODUCTS_FILE;

async function loadDiscovered(): Promise<Product[]> {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export async function getAllProducts(): Promise<Product[]> {
  const discovered = await loadDiscovered();
  // Static curated products take priority over auto-discovered ones
  const map = new Map<string, Product>(discovered.map((p) => [p.id, p]));
  for (const p of PRODUCTS) map.set(p.id, p);
  return Array.from(map.values());
}

export async function searchAllProducts(query: string): Promise<Product[]> {
  const q = query.toLowerCase();
  const all = await getAllProducts();
  return all.filter(
    (p) =>
      p.family.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.modelNumber.toLowerCase().includes(q) ||
      p.searchTerms.some((t) => t.toLowerCase().includes(q))
  );
}

export async function getProductsByCategoryAll(categoryId: string): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter((p) => p.category === categoryId);
}
