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

// Taxonomy note (2026-07 redesign): "elektronike" used to be a junk drawer —
// 40% of the catalogue (Nintendo consoles, Dyson vacuums, camera film,
// motherboards...) landed there. TV/audio, gaming, foto, and large appliances
// are now first-class categories; "elektronike" survives only as the slim
// accessories/other bucket so old URLs keep working. Every consumer of
// categories reads this list, so additions flow to the homepage, sitemap,
// category pages, and search automatically. After changing rules here or in
// guessCategory, run POST /api/admin/recategorize to migrate the catalogue.
export const CATEGORIES: Category[] = [
  { id: "telefona",    name: "Telefona & Tablets", icon: "📱", subcategories: ["Smartphone", "Tablet", "Smartwatch", "Aksesore Telefoni"] },
  { id: "kompjutera",  name: "Kompjutera",         icon: "💻", subcategories: ["Laptop", "Desktop PC", "Monitor", "Komponente PC", "Disqe & Ruajtje", "Tastiere & Mouse", "Karte Grafike", "Printer", "Printer 3D", "Rrjete & WiFi", "Aksesore PC"] },
  { id: "tv-audio",    name: "TV & Audio",         icon: "📺", subcategories: ["TV", "Altoparlant & Soundbar", "Kufje", "Projektor", "Aksesore TV"] },
  { id: "gaming",      name: "Gaming",             icon: "🎮", subcategories: ["Konsola", "Lojera", "Kontrollera", "Karrige Gaming", "Aksesore Gaming"] },
  { id: "foto-video",  name: "Foto & Video",       icon: "📷", subcategories: ["Kamera", "Dron", "Aksesore Foto"] },
  { id: "shtepiake",   name: "Elektroshtepiake",   icon: "🧺", subcategories: ["Lavatrice & Tharese", "Frigorifer", "Furre & Gatim", "Lavastovilje", "Fshesa & Pastrim", "Klimatizim & Ngrohje", "Hekurosje"] },
  { id: "shtepi",      name: "Shtepi & Kopsht",    icon: "🏠", subcategories: ["Pajisje Kuzhine", "Ene Gatimi", "Ndricim", "Kopsht & Vegla", "Mobilje", "Dekorim"] },
  { id: "sporte",      name: "Sporte & Outdoor",   icon: "⚽", subcategories: ["Fitness", "Veshje Sportive", "Bicikleta", "Camping", "Trotinet Elektrik", "Peshkim"] },
  { id: "veshje",      name: "Veshje & Kepuce",    icon: "👟", subcategories: ["Kepuce", "Xhakete", "Aksesore Mode", "Canta", "Syze Dielli", "Ore"] },
  { id: "lodra",       name: "Lodra & Femije",     icon: "🧸", subcategories: ["LEGO", "Figura & Koleksion", "Kukulla & Plush", "Puzzle & Lojera Tavoline", "Lodra", "Kujdes Bebe", "Karroca"] },
  { id: "bukuri",      name: "Bukuri & Shendet",   icon: "💊", subcategories: ["Parfum", "Kujdes Lekure", "Makeup", "Kujdes Flokesh", "Rruajtje & Depilim", "Shendet"] },
  { id: "elektronike", name: "Aksesore & Te Tjera", icon: "🔌", subcategories: ["Karikues & Kabllo", "Power Bank & Bateri", "Smart Home", "Aksesore", "Te Tjera"] },
];
