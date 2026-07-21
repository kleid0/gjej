// Combo/bundle grouping for the product page + listings.
//
// A base product ("Nintendo Switch 2") and its bundles ("Nintendo Switch 2 +
// Mario Kart") are distinct catalogue entries. This groups them at read time
// so the product page can offer a bundle selector and listings can collapse a
// base + its bundles into a single entry — no data migration, no fuser change.

import type { Product } from "@/src/domain/catalog/Product";

/**
 * The bundle add-on ("Mario Kart") when this product is a base plus something,
 * else null. Mirrors the fuser's late-"+" rule: the " + " must come after at
 * least 3 words, so multi-device names like "Tastiere + Mouse HP 150" are not
 * mistaken for bundles.
 */
export function comboAddon(p: Product): string | null {
  const idx = p.family.indexOf(" + ");
  if (idx <= 0) return null;
  if (p.family.slice(0, idx).trim().split(/\s+/).length < 3) return null;
  return p.family.slice(idx + 3).trim() || null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Key shared by a base product and every bundle built on it. */
export function comboBaseKey(p: Product): string {
  const idx = p.family.indexOf(" + ");
  const base = comboAddon(p) ? p.family.slice(0, idx) : p.family;
  return `${norm(p.brand)}::${p.category}::${norm(base)}`;
}

export interface ComboVariant {
  id: string;
  label: string; // "Vetëm produkti" or "+ Mario Kart"
  isBase: boolean;
}

/**
 * Every variant (base + bundles) sharing this product's base, base(s) first.
 * Returns [] when the group has fewer than two members or contains no bundle —
 * i.e. there's nothing to select.
 */
export function groupCombos(product: Product, all: Product[]): ComboVariant[] {
  const key = comboBaseKey(product);
  const group = all.filter((p) => comboBaseKey(p) === key);
  if (group.length < 2 || !group.some((p) => comboAddon(p))) return [];

  const variants = group.map((p) => {
    const addon = comboAddon(p);
    return { id: p.id, isBase: !addon, label: addon ? `+ ${addon}` : "Vetëm produkti" };
  });
  variants.sort((a, b) =>
    a.isBase === b.isBase ? a.label.localeCompare(b.label) : a.isBase ? -1 : 1,
  );
  return variants;
}

/**
 * For listings: drop bundle variants whose base product is also present, so a
 * base and its bundles collapse to the single base entry (the bundles stay
 * reachable through the selector on that product's page). Bundles whose base
 * isn't in the catalogue are kept so they remain discoverable.
 */
export function collapseToBase(products: Product[]): Product[] {
  const baseKeys = new Set(
    products.filter((p) => !comboAddon(p)).map(comboBaseKey),
  );
  return products.filter((p) => !(comboAddon(p) && baseKeys.has(comboBaseKey(p))));
}
