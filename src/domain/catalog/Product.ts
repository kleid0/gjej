// Domain entities for the Product Catalog bounded context

export interface StorageOption {
  label: string;
  sku?: string;
}

export interface ProductSpecs {
  [key: string]: string;  // e.g. "Display" → "6.2\" FHD+, 120Hz"
}

export interface ProductVariant {
  modelCode: string;      // e.g. "SM-S931B"
  region: string;         // "EU" | "US" | "Global" | "Unknown"
  confidence: "confirmed" | "likely" | "unclear";
  notes?: string;         // e.g. "Exynos 2500 (Europe)"
}

export interface Product {
  id: string;
  modelNumber: string;
  family: string;
  brand: string;
  category: string;
  subcategory: string;
  imageUrl: string;
  storageOptions: StorageOption[];
  searchTerms: string[];
  variant?: ProductVariant;
  specs?: ProductSpecs;
  description?: string;
  officialImages?: string[];
  enrichedAt?: string;       // ISO timestamp of last enrichment
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  { id: "telefona",   name: "Telefona & Tablets",  icon: "📱", subcategories: ["Smartphone", "Tablet", "Aksesore Telefoni"] },
  { id: "kompjutera", name: "Kompjutera",           icon: "💻", subcategories: ["Laptop", "Desktop PC", "Monitor", "Printer", "Aksesore PC"] },
  { id: "elektronike",name: "Elektronikë",          icon: "🔌", subcategories: ["TV", "Audio", "Kamera", "Gaming", "Shtëpiake", "Aksesorë"] },
  { id: "shtepi",     name: "Shtëpi & Kopsht",      icon: "🏠", subcategories: ["Pajisje Kuzhine", "Pastrimi", "Ndriçim", "Kopsht"] },
  { id: "sporte",     name: "Sporte & Outdoor",     icon: "⚽", subcategories: ["Fitness", "Veshje Sportive", "Biçikleta", "Camping"] },
  { id: "veshje",     name: "Veshje & Këpucë",      icon: "👟", subcategories: ["Këpucë", "Xhaketë", "Aksesore Mode"] },
  { id: "lodra",      name: "Lodra & Fëmijë",       icon: "🧸", subcategories: ["Lodra", "Libra Fëmijësh", "Kujdes Bebe"] },
  { id: "bukuri",     name: "Bukuri & Shëndet",     icon: "💊", subcategories: ["Parfum", "Kujdes Lëkure", "Shëndet", "Rruajtje", "Elektrik"] },
];
