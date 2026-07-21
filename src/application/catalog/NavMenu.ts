// Builds the header mega-menu data: per category, the subcategory links plus
// top brands and a few featured (image-bearing) products — the END.-style
// panel content. Pure over the product list so it's unit-testable; the layout
// memoizes the result per server instance.

import type { Product } from "@/src/domain/catalog/Product";
import { CATEGORIES } from "@/src/domain/catalog/Product";

export interface NavFeaturedProduct {
  id: string;
  name: string;
  imageUrl: string;
}

export interface NavCategoryData {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
  topBrands: string[];
  featured: NavFeaturedProduct[];
}

const MAX_BRANDS = 8;
const MAX_FEATURED = 3;

// Store-parsing artifacts sometimes land in the brand field ("portativ",
// "pa", "energjie"…). Real brands start with an uppercase letter and aren't
// single stopwords.
function isRealBrand(brand: string): boolean {
  return brand.length > 2 && /^[A-Z0-9]/.test(brand);
}

export function buildNavMenu(products: Product[]): NavCategoryData[] {
  const byCategory = new Map<string, Product[]>();
  for (const p of products) {
    const list = byCategory.get(p.category);
    if (list) list.push(p);
    else byCategory.set(p.category, [p]);
  }

  return CATEGORIES.map((cat) => {
    const inCat = byCategory.get(cat.id) ?? [];

    const brandCounts = new Map<string, number>();
    for (const p of inCat) {
      const brand = (p.brand ?? "").trim();
      if (!isRealBrand(brand)) continue;
      brandCounts.set(brand, (brandCounts.get(brand) ?? 0) + 1);
    }
    const topBrands = Array.from(brandCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_BRANDS)
      .map(([brand]) => brand);

    // Only advertise subcategories that actually contain products.
    const populated = new Set(inCat.map((p) => p.subcategory));
    const subcategories = cat.subcategories.filter((s) => populated.has(s));

    const featured: NavFeaturedProduct[] = inCat
      .filter((p) => p.imageUrl)
      .sort((a, b) => (b.enrichedAt ? 1 : 0) - (a.enrichedAt ? 1 : 0))
      .slice(0, MAX_FEATURED)
      .map((p) => ({
        id: p.id,
        name: `${p.brand} ${p.family}`.trim().slice(0, 60),
        imageUrl: p.imageUrl,
      }));

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      subcategories,
      topBrands,
      featured,
    };
  });
}
