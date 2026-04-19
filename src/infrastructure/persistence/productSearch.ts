// Shared product search scoring used by both FileProductRepository and
// DbProductRepository. Extracted so swapping the persistence layer doesn't
// change search behaviour.

import type { Product } from "@/src/domain/catalog/Product";

export function parseSearchQuery(query: string): { q: string; words: string[] } {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  return { q, words };
}

export function scoreAndSortProducts(
  products: Product[],
  query: string,
): Product[] {
  const { q, words } = parseSearchQuery(query);
  if (words.length === 0) return [];

  return products
    .map((p) => {
      const family = p.family.toLowerCase();
      const brand = p.brand.toLowerCase();
      const model = p.modelNumber.toLowerCase();
      const terms = p.searchTerms.map((t) => t.toLowerCase()).join(" ");

      const matchField = (w: string) =>
        family.includes(w) || brand.includes(w) || model.includes(w) || terms.includes(w);
      if (words.length > 1 && !words.every(matchField)) return null;
      if (words.length === 1 && !matchField(words[0])) return null;

      let score = 0;
      if (family.includes(q)) score += 100;
      const familyWordHits = words.filter((w) => family.includes(w)).length;
      score += familyWordHits * 10;
      if (familyWordHits === words.length) score += 20;
      if (family.startsWith(q)) score += 30;
      const familyWordCount = family.split(/\s+/).length;
      score += (familyWordHits / familyWordCount) * 20;
      score -= p.family.length * 0.15;

      return { p, score };
    })
    .filter((item): item is { p: Product; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .map(({ p }) => p);
}
