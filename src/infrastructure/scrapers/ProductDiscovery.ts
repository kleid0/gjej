// Infrastructure: discovers products from Albanian retailers via platform-specific APIs

import axios from "axios";
import * as cheerio from "cheerio";
import type { IProductDiscoveryService } from "@/src/application/catalog/CatalogDiscovery";
import type { Product } from "@/src/domain/catalog/Product";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};
const JSON_HEADERS = { ...HEADERS, "Accept": "application/json" };
// PC Store blocks standard UAs via WAF; Googlebot UA is accepted
const GOOGLEBOT_HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Accept": "application/json" };

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ").trim();
}

const KNOWN_BRANDS = [
  "Samsung", "Apple", "Xiaomi", "Huawei", "Sony", "LG", "Dell", "HP", "Lenovo",
  "ASUS", "Acer", "Microsoft", "Nokia", "Motorola", "OnePlus", "Oppo", "Realme",
  "Philips", "Bosch", "Siemens", "Dyson", "iRobot", "Whirlpool", "Indesit",
  "Nintendo", "Dior", "Chanel", "Nike", "Adidas", "Braun", "Oral-B", "Redragon",
  "Logitech", "Razer", "MSI", "Gigabyte", "NZXT", "Corsair", "Kingston",
];

function extractBrand(name: string, vendor?: string): string {
  if (vendor && vendor !== "Others" && vendor !== "Unknown") return vendor;
  for (const brand of KNOWN_BRANDS) {
    if (new RegExp(`\\b${brand}\\b`, "i").test(name)) return brand;
  }
  return name.split(/\s+/)[0] ?? "Unknown";
}

// Known manufacturer model number patterns (e.g. SM-G991B, RTX 4090, i7-13700K)
const MODEL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(SM-[A-Z]\d{3}[A-Z0-9]{1,3})\b/i, "Samsung"],           // Samsung: SM-S931B, SM-G991B
  [/\b(MQ[A-Z0-9]{2,4}[A-Z]{0,2}\/[A-Z])\b/i, "Apple"],       // Apple: MQ6T3LL/A style
  [/\b([A-Z]{1,2}\d{4}[A-Z]{2,3}\/[A-Z])\b/i, "Apple"],       // Apple: MYYN3LL/A, MYM23QL/A
  [/\b(RTX\s*\d{4}[A-Z\s]*Ti?)\b/i, "NVIDIA"],                 // NVIDIA: RTX 4090
  [/\b(GTX\s*\d{3,4}[A-Z\s]*Ti?)\b/i, "NVIDIA"],               // NVIDIA: GTX 1660
  [/\b(RX\s*\d{4}[A-Z\s]*XT?)\b/i, "AMD"],                     // AMD: RX 6700 XT
  [/\b(i[3579]-\d{4,5}[A-Z]{0,2})\b/i, "Intel"],               // Intel: i7-13700K
  [/\b(Core\s+Ultra\s+[579]\s+\d{3}[A-Z]?)\b/i, "Intel"],      // Intel Core Ultra 7 165H
  [/\b(Ryzen\s+[3579]\s+\d{4}[A-Z]{0,2})\b/i, "AMD"],          // AMD Ryzen
  [/\b(Xeon\s+[A-Z0-9-]+)\b/i, "Intel"],                       // Intel Xeon
  [/\b(M[1-9]\s+(?:Pro|Max|Ultra)?)\b/i, "Apple"],             // Apple M3 Pro, M4
  [/\b(A\d{4}(?:\s*[A-Z]{1,2})?)\b/, "Apple"],                 // Apple A17 Pro chip
  [/\b(Snapdragon\s+\d+\s*[A-Z]*)\b/i, "Qualcomm"],            // Snapdragon 8 Elite
  [/\b(Dimensity\s+\d+[A-Z]*)\b/i, "MediaTek"],                // Dimensity 9400
  [/\b(Kirin\s+\d+[A-Z]*)\b/i, "Huawei"],                      // Kirin 9000
  [/\b([A-Z]{2,5}\d{3,6}[A-Z]{0,3})\b/, "Generic"],            // Generic: TV50UQ8000, PS5, EW7B66
];

// Store-internal SKU patterns to reject (not real model numbers)
const STORE_SKU_PATTERNS = [
  /^DUN\d{4}/, // Shpresa internal: DUN4745-M
  /^SAS\d{4}/, // Shpresa internal: SAS1317
  /^CEL\d{4}/i,
  /^ACN-\d/,
  /^KST-\d/,
  /^ABP-\d/,
  /^ERG-\d/,
  /^MAR-\d/,
  /^YLL-\d/,
];

function isStoreInternalSku(sku: string): boolean {
  return STORE_SKU_PATTERNS.some((p) => p.test(sku));
}

function extractModelNumber(name: string, fallbackSku: string): string {
  for (const [pattern] of MODEL_PATTERNS) {
    const m = name.match(pattern);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  // Use SKU only if it looks like a real manufacturer model (not a store-internal ID)
  if (fallbackSku && /[A-Z]/i.test(fallbackSku) && fallbackSku.length >= 4 && !isStoreInternalSku(fallbackSku)) {
    return fallbackSku;
  }
  // Return empty string — no real model number found
  // (better than a slugified store name which would be misleading)
  return "";
}

function guessCategory(name: string, tags: string[] = [], productType = "", categories: string[] = []): { category: string; subcategory: string } {
  const text = [name, productType, ...tags, ...categories].join(" ").toLowerCase();
  // Phones: include Albanian prefixes "celular", "smartphone" + known brands/models
  if (/\b(celular|smartphone|telefon celular)\b|iphone|samsung galaxy [as]\d+|pixel \d|xiaomi \d+|redmi|oneplus|oppo|realme|motorola edge|motorola moto/i.test(text)) return { category: "telefona", subcategory: "Smartphone" };
  if (/ipad|tablet|samsung tab|lenovo tab|huawei matepad/i.test(text)) return { category: "telefona", subcategory: "Tablet" };
  if (/macbook|laptop|notebook|thinkpad|chromebook|precision \d{4}|elitebook|thinkbook/i.test(text)) return { category: "kompjutera", subcategory: "Laptop" };
  if (/desktop|pc gaming|all-in-one|imac|\bmini pc\b/i.test(text)) return { category: "kompjutera", subcategory: "Desktop PC" };
  if (/\bmonitor\b/i.test(text)) return { category: "kompjutera", subcategory: "Monitor" };
  if (/printer|printues/i.test(text)) return { category: "kompjutera", subcategory: "Printer" };
  if (/keyboard|tastier|mouse|webcam|headset pc|usb hub|\bssd\b|hard disk|\bram\b|procesor|\bgpu\b/i.test(text)) return { category: "kompjutera", subcategory: "Aksesore PC" };
  if (/televizor|smart tv|oled tv|qled tv|4k tv/i.test(text)) return { category: "elektronike", subcategory: "TV" };
  if (/headphone|kufje|speaker|soundbar|earbuds|airpods|earphones|subwoofer/i.test(text)) return { category: "elektronike", subcategory: "Audio" };
  if (/playstation|xbox|nintendo|ps5|ps4|gaming chair|controller|joystick/i.test(text)) return { category: "elektronike", subcategory: "Gaming" };
  if (/kamera|camera|dslr|mirrorless|gopro|drone/i.test(text)) return { category: "elektronike", subcategory: "Kamera" };
  if (/lavatrice|frigorifer|lavastovilje|mikroval|kondicionier|furr|aspirator|\btharëse\b|hand dryer|airblade/i.test(text)) return { category: "elektronike", subcategory: "Shtëpiake" };
  if (/charger|karikues|power bank|kavo|adapter|\bups\b|toner/i.test(text)) return { category: "elektronike", subcategory: "Aksesorë" };
  if (/parfum|eau de toilette/i.test(text)) return { category: "bukuri", subcategory: "Parfum" };
  if (/skincare|moisturizer|serum|krema|maska/i.test(text)) return { category: "bukuri", subcategory: "Kujdes Lëkure" };
  if (/hair dryer|hekur flokesh|shaver|epilator|airwrap|airstrait|straightener/i.test(text)) return { category: "bukuri", subcategory: "Elektrik" };
  if (/lego|toys|barbie|hot wheels|puzzle|lodra|funko/i.test(text)) return { category: "lodra", subcategory: "Lodra" };
  if (/nike|adidas|puma|veshje sportive/i.test(text)) return { category: "sporte", subcategory: "Veshje Sportive" };
  if (/fitness|tapis roulant|elliptical/i.test(text)) return { category: "sporte", subcategory: "Fitness" };
  return { category: "elektronike", subcategory: "Aksesorë" };
}

// ── Shopify ───────────────────────────────────────────────────────────────────
interface ShopifyProduct { handle: string; title: string; vendor: string; product_type: string; tags: string[]; images: Array<{ src: string }>; variants: Array<{ sku: string }>; }

async function fetchShopify(storeId: string, baseUrl: string): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/products.json`, { params: { limit: 250, page }, timeout: 15000, headers: JSON_HEADERS });
      const items: ShopifyProduct[] = data?.products ?? [];
      if (!items.length) break;
      for (const item of items) {
        if (!item.title || item.title.length < 3) continue;
        const { category, subcategory } = guessCategory(item.title, item.tags ?? [], item.product_type ?? "");
        products.push({ id: `${storeId}-${item.handle ?? slugify(item.title)}`, modelNumber: extractModelNumber(item.title, item.variants?.[0]?.sku ?? ""), family: item.title, brand: extractBrand(item.title, item.vendor), category, subcategory, imageUrl: item.images?.[0]?.src ?? "", storageOptions: [], searchTerms: [item.title] });
      }
      if (items.length < 250) break;
      page++;
    } catch { break; }
  }
  return products;
}

// ── WooCommerce ───────────────────────────────────────────────────────────────
interface WooProduct { name: string; slug: string; sku: string; categories: Array<{ name: string }>; images: Array<{ src: string }>; }

async function fetchWooCommerce(storeId: string, baseUrl: string, extraHeaders?: Record<string, string>): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  const perPage = 100;
  const headers = extraHeaders ? { ...JSON_HEADERS, ...extraHeaders } : JSON_HEADERS;
  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/wp-json/wc/store/v1/products`, { params: { per_page: perPage, page }, timeout: 25000, headers });
      const items: WooProduct[] = Array.isArray(data) ? data : [];
      if (!items.length) break;
      for (const item of items) {
        if (!item.name || item.name.length < 3) continue;
        const name = decodeHtml(item.name);
        const cats = item.categories?.map((c) => c.name) ?? [];
        const { category, subcategory } = guessCategory(name, [], "", cats);
        products.push({ id: `${storeId}-${item.slug ?? slugify(name)}`, modelNumber: extractModelNumber(name, item.sku ?? ""), family: name, brand: extractBrand(name), category, subcategory, imageUrl: item.images?.[0]?.src ?? "", storageOptions: [], searchTerms: [name] });
      }
      if (items.length < perPage) break;
      page++;
      await new Promise((r) => setTimeout(r, 500));
    } catch { break; }
  }
  return products;
}

// ── Shopware (Foleja.al) ──────────────────────────────────────────────────────
const FOLEJA_TERMS = ["smartphone", "Samsung Galaxy", "iPhone", "Xiaomi", "laptop", "MacBook", "Dell", "HP laptop", "ASUS", "monitor", "televizor", "Smart TV", "PlayStation", "Xbox", "Nintendo", "headphones", "bluetooth speaker", "printer", "SSD", "keyboard", "mouse", "power bank", "parfum", "Dyson", "lavatrice", "frigorifer", "tablet", "iPad"];

async function fetchFoleja(): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  for (const term of FOLEJA_TERMS) {
    for (let page = 1; page <= 5; page++) {
      try {
        const { data } = await axios.get("https://www.foleja.al/search", { params: { search: term, p: page }, timeout: 12000, headers: HEADERS });
        const $ = cheerio.load(data);
        let found = 0;
        $(".product-box, .product-info, .product-name").each((_: number, el: any) => {
          const $el = $(el);
          const link = $el.find("a[href*='/']").first();
          const href = link.attr("href") ?? $el.closest("a").attr("href");
          if (!href) return;
          const name = ($el.find(".product-name, h2, h3, .name").first().text().trim() || link.text().trim() || "").replace(/\s+/g, " ").trim();
          if (!name || name.length < 4 || name.length > 200) return;
          const img = $el.find("img").first();
          const rawSrc = img.attr("src") || img.attr("data-src") || "";
          const imageUrl = rawSrc ? (rawSrc.startsWith("http") ? rawSrc : `https://www.foleja.al${rawSrc}`) : "";
          const id = `foleja-${slugify(name)}`;
          if (discovered.has(id)) return;
          const { category, subcategory } = guessCategory(name);
          const productUrl = href.startsWith("http") ? href : `https://www.foleja.al${href}`;
          discovered.set(id, { id, modelNumber: extractModelNumber(name, ""), family: name, brand: extractBrand(name), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name, productUrl] });
          found++;
        });
        if (found === 0) break; // no more results for this term
      } catch { break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return Array.from(discovered.values());
}

// ── Globe Albania ─────────────────────────────────────────────────────────────
interface GlobeProduct { id: number; name: string; price: number; image: string | null; images: string[]; category: string; sku: string; brand: string; stock: number; categories: string[]; }

async function fetchGlobe(): Promise<Product[]> {
  try {
    const { data } = await axios.get<GlobeProduct[]>("https://www.globe.al/api/products", { timeout: 20000, headers: JSON_HEADERS });
    if (!Array.isArray(data)) return [];
    return data
      .filter((item) => item.name && item.name.length >= 3)
      .map((item) => {
        const name = decodeHtml(item.name);
        const cats = item.categories ?? [];
        const { category, subcategory } = guessCategory(name, [], "", cats);
        const imageUrl = item.image ?? item.images?.[0] ?? "";
        return { id: `globe-${item.id}`, modelNumber: extractModelNumber(name, item.sku ?? ""), family: name, brand: extractBrand(name, item.brand), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name] };
      });
  } catch { return []; }
}

// ── Neptun Albania ────────────────────────────────────────────────────────────
// Neptun uses an AngularJS frontend with a JSON API at NeptunCategories/LoadProductsForCategory.
// Products are not in static HTML; a mobile UA is required to bypass Cloudflare.
const NEPTUN_MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const NEPTUN_IMAGE_BASE = "https://www.neptun.al/";

// Category IDs discovered by probing the API (IDs 1–300 scanned; only non-empty ones listed).
// Covers phones, tablets, computers, TVs, audio, cameras, gaming, accessories, and home appliances.
const NEPTUN_CATEGORY_IDS = [
  // Phones & wearables
  144, 143, 149, 146, 147,
  // Tablets & computers
  106, 82, 80, 81, 92,
  // TV & audio
  276, 165, 138, 84, 162,
  // Cameras
  35, 73, 36, 75,
  // Gaming
  261, 187, 192,
  // Printers & office
  100, 99, 101, 103,
  // PC peripherals
  93, 96, 90, 94,
  // Mobile accessories
  136, 140, 135, 134, 139, 131,
  // Large accessories buckets
  241, 250, 130, 236, 237,
  // Small kitchen appliances
  24, 25, 26, 28, 29, 31, 37, 38, 40, 41, 43, 45, 46, 47, 48, 49, 51, 53, 63,
  // Personal care
  54, 56, 120, 122, 123, 124, 125, 127,
  // Vacuum & floor
  20, 21, 219, 220,
  // Irons & steam
  23, 118, 221,
  // Lighting
  60,
  // Health
  110, 111,
  // Cookware
  238, 227,
  // Other accessories
  240, 243, 244, 246, 247, 248, 251, 260,
  // Misc
  33, 85, 91,
];

interface NeptunItem {
  Id: number;
  Title: string;
  Manufacturer: { Name: string } | null;
  Category: { Id: number; Name: string; NameEn: string } | null;
  ModelNumber: string | null;
  ProductCode: string | null;
  Thumbnail: string | null;
}

async function fetchNeptunCategory(categoryId: number): Promise<NeptunItem[]> {
  const items: NeptunItem[] = [];
  let page = 1;
  const pageSize = 100;
  while (true) {
    try {
      const { data } = await axios.post(
        "https://www.neptun.al/NeptunCategories/LoadProductsForCategory",
        { model: { CategoryId: categoryId, Sort: 4, Manufacturers: [], PriceRange: null, BoolFeatures: [], DropdownFeatures: [], MultiSelectFeatures: [], ShowAllProducts: false, ItemsPerPage: pageSize, CurrentPage: page } },
        { timeout: 20000, headers: { ...JSON_HEADERS, "User-Agent": NEPTUN_MOBILE_UA, "X-Requested-With": "XMLHttpRequest", "Referer": "https://www.neptun.al/" } }
      );
      const batch = data?.Batch;
      if (!batch?.Items?.length) break;
      items.push(...batch.Items);
      if (items.length >= batch.Config?.TotalItems || batch.Items.length < pageSize) break;
      page++;
      await new Promise((r) => setTimeout(r, 300));
    } catch { break; }
  }
  return items;
}

async function fetchNeptun(): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  for (const catId of NEPTUN_CATEGORY_IDS) {
    try {
      const items = await fetchNeptunCategory(catId);
      for (const item of items) {
        if (!item.Title || item.Title.length < 3) continue;
        const id = `neptun-${item.Id}`;
        if (discovered.has(id)) continue;
        const name = decodeHtml(item.Title);
        const catNameEn = item.Category?.NameEn ?? item.Category?.Name ?? "";
        const { category, subcategory } = guessCategory(name, [], catNameEn);
        const imageUrl = item.Thumbnail ? `${NEPTUN_IMAGE_BASE}${item.Thumbnail}` : "";
        discovered.set(id, {
          id,
          modelNumber: extractModelNumber(name, item.ModelNumber ?? item.ProductCode ?? ""),
          family: name,
          brand: extractBrand(name, item.Manufacturer?.Name),
          category,
          subcategory,
          imageUrl,
          storageOptions: [],
          searchTerms: [name],
        });
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch { /* skip failed category */ }
  }
  return Array.from(discovered.values());
}

// ── Main discovery service ────────────────────────────────────────────────────
export class ProductDiscoveryService implements IProductDiscoveryService {
  async discover(): Promise<Product[]> {
    const all: Product[] = [];
    const seen = new Set<string>();

    const results = await Promise.allSettled([
      fetchShopify("albagame", "https://www.albagame.al"),
      fetchWooCommerce("shpresa", "https://shpresa.al"),
      fetchWooCommerce("pcstore", "https://www.pcstore.al", GOOGLEBOT_HEADERS),
      fetchFoleja(),
      fetchGlobe(),
      fetchNeptun(),
    ]);

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const p of result.value) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            all.push(p);
          }
        }
      }
    }

    return all;
  }
}
