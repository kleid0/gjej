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
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const all = await this.readFile();

    const scored = all
      .map((p) => {
        const family = p.family.toLowerCase();
        const brand = p.brand.toLowerCase();
        const model = p.modelNumber.toLowerCase();
        const terms = p.searchTerms.map((t) => t.toLowerCase()).join(" ");

        // For multi-word queries all words must appear somewhere; single-word allows partial
        const matchField = (w: string) =>
          family.includes(w) || brand.includes(w) || model.includes(w) || terms.includes(w);
        if (words.length > 1 && !words.every(matchField)) return null;
        if (words.length === 1 && !matchField(words[0])) return null;

        let score = 0;

        // Exact phrase in family name → strongest signal
        if (family.includes(q)) score += 100;

        // How many query words appear in the family name
        const familyWordHits = words.filter((w) => family.includes(w)).length;
        score += familyWordHits * 10;

        // All words in family → bonus
        if (familyWordHits === words.length) score += 20;

        // Family starts with query → very specific match
        if (family.startsWith(q)) score += 30;

        // Query word density in the family (penalises long accessory names)
        const familyWordCount = family.split(/\s+/).length;
        score += (familyWordHits / familyWordCount) * 20;

        // Shorter family name = more specific product (not an accessory/bundle)
        score -= p.family.length * 0.15;

        return { p, score };
      })
      .filter((item): item is { p: Product; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map(({ p }) => p);

    return scored;
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
