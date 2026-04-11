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
  { id: "telefona",    name: "Telefona & Tablets",  icon: "📱", subcategories: ["Smartphone", "Tablet", "Smartwatch", "Aksesore Telefoni", "Karikues & Kabllo", "Kufje", "Mbrojtese & Kover"] },
  { id: "kompjutera",  name: "Kompjutera",          icon: "💻", subcategories: ["Laptop", "Desktop PC", "Monitor", "Printer", "Printer 3D", "Aksesore PC", "Mouse & Tastiere", "Karte Grafike", "SSD & RAM", "Rrjete & WiFi"] },
  { id: "elektronike", name: "Elektronike",         icon: "🔌", subcategories: ["TV", "Audio & Altoparlant", "Kamera", "Gaming", "Konsola", "Shtepiake", "Dron", "Projektor", "Aksesore"] },
  { id: "shtepi",      name: "Shtepi & Kopsht",     icon: "🏠", subcategories: ["Pajisje Kuzhine", "Pastrimi", "Aspirapluhar", "Ndricim", "Kopsht", "Mobilje", "Dekorim"] },
  { id: "sporte",      name: "Sporte & Outdoor",    icon: "⚽", subcategories: ["Fitness", "Veshje Sportive", "Bicikleta", "Camping", "Trotinet Elektrik", "Peshkim"] },
  { id: "veshje",      name: "Veshje & Kepuce",     icon: "👟", subcategories: ["Kepuce", "Xhakete", "Aksesore Mode", "Canta", "Syze Dielli", "Ore"] },
  { id: "lodra",       name: "Lodra & Femije",      icon: "🧸", subcategories: ["Lodra", "LEGO", "Lodra Edukative", "Libra Femijesh", "Kujdes Bebe", "Karroca"] },
  { id: "bukuri",      name: "Bukuri & Shendet",    icon: "💊", subcategories: ["Parfum", "Kujdes Lekure", "Makeup", "Shendet", "Rruajtje", "Kujdes Flokesh", "Elektrik"] },
];
