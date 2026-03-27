export interface StorageOption {
  label: string;       // e.g. "128GB", "8GB/256GB"
  sku?: string;        // store-specific SKU suffix if any
}

export interface Product {
  id: string;          // slug, derived from modelNumber
  modelNumber: string; // unique hardware identifier e.g. "SM-G930F"
  family: string;      // display name e.g. "Samsung Galaxy S7"
  brand: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  storageOptions: StorageOption[]; // selectable on product page (same model, diff storage)
  searchTerms: string[];           // terms used to search stores
}

// Note: different model numbers = separate Product entries (separate pages)
// e.g. SM-G930F and SM-G930FD are siblings but separate items

export interface ProductFamily {
  name: string;        // e.g. "Samsung Galaxy S7"
  brand: string;
  category: string;
  modelNumbers: string[]; // all model IDs in this family, for cross-linking
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  { id: "telefona", name: "Telefona & Tablets", icon: "📱", subcategories: ["Smartphone", "Tablet", "Aksesore Telefoni"] },
  { id: "kompjutera", name: "Kompjutera", icon: "💻", subcategories: ["Laptop", "Desktop PC", "Monitor", "Printer", "Aksesore PC"] },
  { id: "elektronike", name: "Elektronikë", icon: "🔌", subcategories: ["TV", "Audio", "Kamera", "Gaming", "Aksesore"] },
  { id: "shtepi", name: "Shtëpi & Kopsht", icon: "🏠", subcategories: ["Pajisje Kuzhine", "Pastrimi", "Ndriçim", "Kopsht"] },
  { id: "sporte", name: "Sporte & Outdoor", icon: "⚽", subcategories: ["Fitness", "Veshje Sportive", "Biçikleta", "Camping"] },
  { id: "veshje", name: "Veshje & Këpucë", icon: "👟", subcategories: ["Këpucë", "Xhaketë", "Aksesore Mode"] },
  { id: "lodra", name: "Lodra & Fëmijë", icon: "🧸", subcategories: ["Lodra", "Libra Fëmijësh", "Kujdes Bebe"] },
  { id: "bukuri", name: "Bukuri & Shëndet", icon: "💊", subcategories: ["Parfum", "Kujdes Lëkure", "Shëndet", "Rruajtje"] },
];

export const PRODUCTS: Product[] = []

// Products that share a family (for cross-linking on product pages)
export function getFamilySiblings(product: Product): Product[] {
  return PRODUCTS.filter(
    (p) => p.family === product.family && p.id !== product.id
  );
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductsByCategory(categoryId: string): Product[] {
  return PRODUCTS.filter((p) => p.category === categoryId);
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase();
  return PRODUCTS.filter(
    (p) =>
      p.family.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.modelNumber.toLowerCase().includes(q) ||
      p.searchTerms.some((t) => t.toLowerCase().includes(q))
  );
}

export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
