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

export const PRODUCTS: Product[] = [
  // ── Samsung Galaxy S7 family ─────────────────────────────────────
  // Each model number is a separate product; storage options are selectable within a model
  {
    id: "SM-G930F",
    modelNumber: "SM-G930F",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7", "G930F", "SM-G930F"],
  },
  {
    id: "SM-G930FD",
    modelNumber: "SM-G930FD",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7 Dual", "G930FD", "SM-G930FD", "S7 dual sim"],
  },
  {
    id: "SM-G930W8",
    modelNumber: "SM-G930W8",
    family: "Samsung Galaxy S7",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/global/sm-g930/gallery/global-galaxy-s7-sm-g930-sm-g930fzkaxfe-001-front-black",
    storageOptions: [{ label: "32GB" }],
    searchTerms: ["Samsung Galaxy S7 W8", "G930W8", "SM-G930W8"],
  },

  // ── Samsung Galaxy S24 family ────────────────────────────────────
  {
    id: "SM-S921B",
    modelNumber: "SM-S921B",
    family: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-s921-sm-s921bzadeue-thumb-539572882",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    searchTerms: ["Samsung Galaxy S24", "S921B", "SM-S921B"],
  },
  {
    id: "SM-S921B-DS",
    modelNumber: "SM-S921B/DS",
    family: "Samsung Galaxy S24",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-s921-sm-s921bzadeue-thumb-539572882",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }],
    searchTerms: ["Samsung Galaxy S24 Dual", "S921B/DS", "SM-S921B/DS", "S24 dual sim"],
  },
  {
    id: "SM-S928B",
    modelNumber: "SM-S928B",
    family: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/2401/gallery/al-galaxy-s24-ultra-s928-sm-s928bzageue-thumb-539572882",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["Samsung Galaxy S24 Ultra", "S928B", "SM-S928B"],
  },

  // ── Apple iPhone 15 family ───────────────────────────────────────
  {
    id: "A3090",
    modelNumber: "A3090",
    family: "Apple iPhone 15",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-black",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }],
    searchTerms: ["iPhone 15", "A3090", "iPhone15"],
  },
  {
    id: "A2848",
    modelNumber: "A2848",
    family: "Apple iPhone 15 Pro",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium",
    storageOptions: [{ label: "128GB" }, { label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 15 Pro", "A2848"],
  },
  {
    id: "A2849",
    modelNumber: "A2849",
    family: "Apple iPhone 15 Pro Max",
    brand: "Apple",
    category: "telefona",
    subcategory: "Smartphone",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium",
    storageOptions: [{ label: "256GB" }, { label: "512GB" }, { label: "1TB" }],
    searchTerms: ["iPhone 15 Pro Max", "A2849"],
  },

  // ── MacBook Pro M3 ───────────────────────────────────────────────
  {
    id: "MTL73",
    modelNumber: "MTL73",
    family: "Apple MacBook Pro 14\" M3",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spacegray-select-202310",
    storageOptions: [{ label: "8GB / 512GB" }, { label: "16GB / 1TB" }],
    searchTerms: ["MacBook Pro 14 M3", "MTL73", "MacBook Pro M3 2023"],
  },
  {
    id: "MTL83",
    modelNumber: "MTL83",
    family: "Apple MacBook Pro 14\" M3 Pro",
    brand: "Apple",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp14-spaceblack-select-202310",
    storageOptions: [{ label: "18GB / 512GB" }, { label: "36GB / 1TB" }],
    searchTerms: ["MacBook Pro 14 M3 Pro", "MTL83"],
  },

  // ── Dell XPS ─────────────────────────────────────────────────────
  {
    id: "XPS9530-7749SLV",
    modelNumber: "XPS9530-7749SLV-PUS",
    family: "Dell XPS 15 9530",
    brand: "Dell",
    category: "kompjutera",
    subcategory: "Laptop",
    imageUrl: "https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/notebooks/xps-notebooks/xps-15-9530/media-gallery/laptop-xps-9530-nt-blue-gallery-4.psd",
    storageOptions: [{ label: "16GB / 512GB" }, { label: "32GB / 1TB" }],
    searchTerms: ["Dell XPS 15 9530", "XPS9530", "XPS 15 2023"],
  },

  // ── Samsung TV ───────────────────────────────────────────────────
  {
    id: "QE55Q80CATXXH",
    modelNumber: "QE55Q80CATXXH",
    family: "Samsung QLED Q80C",
    brand: "Samsung",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/qn65q80cafxza/gallery/al-qled-q80c-qn65q80cafxza-535157854",
    storageOptions: [],
    searchTerms: ["Samsung Q80C 55", "QE55Q80C", "QLED Q80C 55 inch"],
  },
  {
    id: "QE65Q80CATXXH",
    modelNumber: "QE65Q80CATXXH",
    family: "Samsung QLED Q80C",
    brand: "Samsung",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://images.samsung.com/is/image/samsung/p6pim/al/qn65q80cafxza/gallery/al-qled-q80c-qn65q80cafxza-535157854",
    storageOptions: [],
    searchTerms: ["Samsung Q80C 65", "QE65Q80C", "QLED Q80C 65 inch"],
  },
  {
    id: "OLED55C34LA",
    modelNumber: "OLED55C34LA",
    family: "LG OLED C3",
    brand: "LG",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://gscs-b2c.lge.com/downloadFile?fileId=sbRxYPF78z7HxE6b2oTJmA",
    storageOptions: [],
    searchTerms: ["LG OLED C3 55", "OLED55C3", "C34LA 55"],
  },
  {
    id: "OLED65C34LA",
    modelNumber: "OLED65C34LA",
    family: "LG OLED C3",
    brand: "LG",
    category: "elektronike",
    subcategory: "TV",
    imageUrl: "https://gscs-b2c.lge.com/downloadFile?fileId=sbRxYPF78z7HxE6b2oTJmA",
    storageOptions: [],
    searchTerms: ["LG OLED C3 65", "OLED65C3", "C34LA 65"],
  },

  // ── Gaming ───────────────────────────────────────────────────────
  {
    id: "CFI-1216A",
    modelNumber: "CFI-1216A",
    family: "Sony PlayStation 5",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21",
    storageOptions: [],
    searchTerms: ["PlayStation 5", "PS5", "CFI-1216A", "PS5 Disc"],
  },
  {
    id: "CFI-1216B",
    modelNumber: "CFI-1216B",
    family: "Sony PlayStation 5 Digital",
    brand: "Sony",
    category: "elektronike",
    subcategory: "Gaming",
    imageUrl: "https://gmedia.playstation.com/is/image/SIEPDC/ps5-product-thumbnail-01-en-14sep21",
    storageOptions: [],
    searchTerms: ["PlayStation 5 Digital", "PS5 Digital", "CFI-1216B"],
  },
];

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
