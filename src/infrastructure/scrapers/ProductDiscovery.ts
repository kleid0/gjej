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
const MODEL_PATTERNS = [
  /\b(SM-[A-Z0-9]+[A-Z]?)\b/i,           // Samsung: SM-G991B
  /\b(MQ[A-Z0-9]{2,4}[A-Z]{0,2}\/[A-Z])\b/i, // Apple: MQ6T3LL/A style
  /\b(RTX\s*\d{4}[A-Z\s]*Ti?)\b/i,        // NVIDIA: RTX 4090
  /\b(GTX\s*\d{3,4}[A-Z\s]*Ti?)\b/i,      // NVIDIA: GTX 1660
  /\b(RX\s*\d{4}[A-Z\s]*XT?)\b/i,         // AMD: RX 6700 XT
  /\b(i[3579]-\d{4,5}[A-Z]{0,2})\b/i,     // Intel: i7-13700K
  /\b(Ryzen\s+[3579]\s+\d{4}[A-Z]{0,2})\b/i, // AMD Ryzen
  /\b(Xeon\s+[A-Z0-9-]+)\b/i,             // Intel Xeon
  /\b([A-Z]{2,4}\d{2,4}[A-Z]{0,3}\d*)\b/, // Generic: TV50UQ, PS5
];

function extractModelNumber(name: string, fallbackSku: string): string {
  for (const pattern of MODEL_PATTERNS) {
    const m = name.match(pattern);
    if (m) return m[1].replace(/\s+/g, " ").trim();
  }
  // Fall back to SKU only if it looks like a real model number (not a store ID / number)
  if (fallbackSku && /[A-Z]/.test(fallbackSku) && fallbackSku.length >= 4) return fallbackSku;
  // Last resort: use the slugified product name (first 20 chars)
  return slugify(name).slice(0, 20);
}

function guessCategory(name: string, tags: string[] = [], productType = "", categories: string[] = []): { category: string; subcategory: string } {
  const text = [name, productType, ...tags, ...categories].join(" ").toLowerCase();
  if (/iphone|samsung galaxy|xiaomi|redmi|oneplus|oppo|realme|motorola|smartphone|telefon celular/i.test(text)) return { category: "telefona", subcategory: "Smartphone" };
  if (/ipad|tablet|samsung tab|lenovo tab|huawei matepad/i.test(text)) return { category: "telefona", subcategory: "Tablet" };
  if (/macbook|laptop|notebook|thinkpad|chromebook/i.test(text)) return { category: "kompjutera", subcategory: "Laptop" };
  if (/desktop|pc gaming|all-in-one|imac|mini pc/i.test(text)) return { category: "kompjutera", subcategory: "Desktop PC" };
  if (/\bmonitor\b/i.test(text)) return { category: "kompjutera", subcategory: "Monitor" };
  if (/printer|printues/i.test(text)) return { category: "kompjutera", subcategory: "Printer" };
  if (/keyboard|tastier|mouse|webcam|headset pc|usb hub|ssd|hard disk|\bram\b|procesor|\bgpu\b/i.test(text)) return { category: "kompjutera", subcategory: "Aksesore PC" };
  if (/televizor|smart tv|oled tv|qled tv|4k tv/i.test(text)) return { category: "elektronike", subcategory: "TV" };
  if (/headphone|kufje|speaker|soundbar|earbuds|airpods|earphones|subwoofer/i.test(text)) return { category: "elektronike", subcategory: "Audio" };
  if (/playstation|xbox|nintendo|ps5|ps4|gaming chair|controller|joystick/i.test(text)) return { category: "elektronike", subcategory: "Gaming" };
  if (/kamera|camera|dslr|mirrorless|gopro|drone/i.test(text)) return { category: "elektronike", subcategory: "Kamera" };
  if (/lavatrice|frigorifer|lavastovilje|mikroval|kondicionier|furr|aspirator/i.test(text)) return { category: "elektronike", subcategory: "Shtëpiake" };
  if (/charger|karikues|power bank|kavo|adapter|\bups\b|toner/i.test(text)) return { category: "elektronike", subcategory: "Aksesorë" };
  if (/parfum|eau de toilette/i.test(text)) return { category: "bukuri", subcategory: "Parfum" };
  if (/skincare|moisturizer|serum|krema|maska/i.test(text)) return { category: "bukuri", subcategory: "Kujdes Lëkure" };
  if (/hair dryer|hekur flokesh|shaver|epilator/i.test(text)) return { category: "bukuri", subcategory: "Elektrik" };
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

async function fetchWooCommerce(storeId: string, baseUrl: string): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/wp-json/wc/store/v1/products`, { params: { per_page: perPage, page }, timeout: 15000, headers: JSON_HEADERS });
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
    try {
      const { data } = await axios.get("https://www.foleja.al/search", { params: { search: term, p: 1 }, timeout: 12000, headers: HEADERS });
      const $ = cheerio.load(data);
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
        discovered.set(id, { id, modelNumber: extractModelNumber(name, ""), family: name, brand: extractBrand(name), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name] });
      });
    } catch { /* blocked or unreachable */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  return Array.from(discovered.values());
}

// ── HTML fallback ─────────────────────────────────────────────────────────────
const HTML_STORES = [
  { id: "neptun", searchUrls: (q: string) => [`https://www.neptun.al/search?q=${encodeURIComponent(q)}`], selectors: ["a.product-link", ".product-name a", "h2 a", ".product-item a"], terms: ["laptop", "telefon", "iPhone", "televizor", "Gaming", "PlayStation"] },
  { id: "pcstore", searchUrls: (q: string) => [`https://www.pcstore.al/?s=${encodeURIComponent(q)}&post_type=product`], selectors: ["a.woocommerce-loop-product__link", "a[href*='/product/']", "li.product a[href]", ".product-title a"], terms: ["laptop", "SSD", "monitor", "keyboard", "mouse", "RAM"] },
];

async function fetchHtmlStore(store: typeof HTML_STORES[0]): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  for (const term of store.terms) {
    for (const url of store.searchUrls(term)) {
      try {
        const { data } = await axios.get(url, { timeout: 12000, headers: HEADERS });
        const $ = cheerio.load(data);
        for (const sel of store.selectors) {
          let found = 0;
          $(sel).each((_: number, el: any) => {
            const $el = $(el);
            const href = $el.attr("href");
            if (!href) return;
            const $c = $el.closest("[class*='product'], article, li.item, [class*='card']").first();
            const name = ($el.text().trim() || $el.attr("title") || $c.find("h2,h3,h4,[class*='title'],[class*='name']").first().text().trim() || "").replace(/\s+/g, " ").trim();
            if (!name || name.length < 4 || name.length > 200) return;
            const img = $c.find("img").first();
            const rawSrc = img.attr("src") || img.attr("data-src") || "";
            const imageUrl = rawSrc ? (rawSrc.startsWith("http") ? rawSrc : `https://www.${store.id}.al${rawSrc}`) : "";
            const id = `${store.id}-${slugify(name)}`;
            if (discovered.has(id)) return;
            const { category, subcategory } = guessCategory(name);
            discovered.set(id, { id, modelNumber: extractModelNumber(name, ""), family: name, brand: extractBrand(name), category, subcategory, imageUrl, storageOptions: [], searchTerms: [name] });
            found++;
          });
          if (found > 0) break;
        }
      } catch { /* blocked */ }
    }
    await new Promise((r) => setTimeout(r, 400));
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
      fetchFoleja(),
      ...HTML_STORES.map((s) => fetchHtmlStore(s)),
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
