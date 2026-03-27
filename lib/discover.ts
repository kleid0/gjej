import axios from "axios";
import * as cheerio from "cheerio";
import type { Product } from "./products";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
};

const JSON_HEADERS = {
  "User-Agent": HEADERS["User-Agent"],
  "Accept": "application/json",
  "Accept-Language": HEADERS["Accept-Language"],
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

function guessCategory(
  name: string,
  tags: string[] = [],
  productType: string = "",
  categories: string[] = []
): { category: string; subcategory: string } {
  const text = [name, productType, ...tags, ...categories].join(" ").toLowerCase();

  if (/iphone|samsung galaxy|xiaomi|redmi|oneplus|oppo|realme|motorola|android phone|smartphone|telefon celular/i.test(text))
    return { category: "telefona", subcategory: "Smartphone" };
  if (/ipad|tablet|samsung tab|lenovo tab|huawei matepad/i.test(text))
    return { category: "telefona", subcategory: "Tablet" };
  if (/macbook|laptop|notebook|dell xps|thinkpad|chromebook/i.test(text))
    return { category: "kompjutera", subcategory: "Laptop" };
  if (/desktop|pc gaming|all-in-one|imac|mini pc/i.test(text))
    return { category: "kompjutera", subcategory: "Desktop PC" };
  if (/monitor/i.test(text))
    return { category: "kompjutera", subcategory: "Monitor" };
  if (/printer|printues|scanner/i.test(text))
    return { category: "kompjutera", subcategory: "Printer" };
  if (/keyboard|tastier|mouse|webcam|headset pc|usb hub|ssd|hard disk|ram|procesor|gpu|grafik/i.test(text))
    return { category: "kompjutera", subcategory: "Aksesore PC" };
  if (/televizor|smart tv|oled tv|qled tv|4k tv/i.test(text))
    return { category: "elektronike", subcategory: "TV" };
  if (/headphone|kufje|speaker|soundbar|earbuds|airpods|earphones|subwoofer/i.test(text))
    return { category: "elektronike", subcategory: "Audio" };
  if (/playstation|xbox|nintendo|ps5|ps4|gaming chair|controller|joystick/i.test(text))
    return { category: "elektronike", subcategory: "Gaming" };
  if (/kamera|camera|dslr|mirrorless|gopro|drone|webcam/i.test(text))
    return { category: "elektronike", subcategory: "Kamera" };
  if (/lavatrice|frigorifer|lavastovilje|mikroval|kondicionier|ngrohes|furr|aspirator/i.test(text))
    return { category: "elektronike", subcategory: "Shtëpiake" };
  if (/charger|karikues|power bank|kavo|adapter|ups|toner|batterie/i.test(text))
    return { category: "elektronike", subcategory: "Aksesorë" };
  if (/parfum|eau de toilette/i.test(text))
    return { category: "bukuri", subcategory: "Parfum" };
  if (/skincare|moisturizer|serum|krema|maska|lekure/i.test(text))
    return { category: "bukuri", subcategory: "Kujdes Lëkure" };
  if (/tharëse|hair dryer|hekur flokesh|shaver|epilator|electric toothbrush/i.test(text))
    return { category: "bukuri", subcategory: "Elektrik" };
  if (/lego|toys|barbie|hot wheels|puzzle|lodra|playset|funko/i.test(text))
    return { category: "lodra", subcategory: "Lodra" };
  if (/nike|adidas|puma|veshje sportive|kep.c. sport/i.test(text))
    return { category: "sporte", subcategory: "Veshje Sportive" };
  if (/fitness|tapis roulant|elliptical|biçiklet/i.test(text))
    return { category: "sporte", subcategory: "Fitness" };

  return { category: "elektronike", subcategory: "Aksesorë" };
}

// ── Shopify: fetch all products via /products.json ─────────────────────────────
async function fetchShopifyProducts(storeId: string, baseUrl: string): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;

  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/products.json`, {
        params: { limit: 250, page },
        timeout: 15000,
        headers: JSON_HEADERS,
      });

      const items: ShopifyProduct[] = data?.products ?? [];
      if (items.length === 0) break;

      for (const item of items) {
        if (!item.title || item.title.length < 3) continue;
        const id = `${storeId}-${item.handle ?? slugify(item.title)}`;
        const { category, subcategory } = guessCategory(
          item.title,
          item.tags ?? [],
          item.product_type ?? ""
        );
        const imageUrl = item.images?.[0]?.src ?? "";
        products.push({
          id,
          modelNumber: item.variants?.[0]?.sku ?? slugify(item.title).slice(0, 20),
          family: item.title,
          brand: extractBrand(item.title, item.vendor),
          category,
          subcategory,
          imageUrl,
          storageOptions: [],
          searchTerms: [item.title],
        });
      }

      if (items.length < 250) break;
      page++;
    } catch {
      break;
    }
  }

  return products;
}

// ── WooCommerce Store API: /wp-json/wc/store/v1/products ──────────────────────
async function fetchWooCommerceProducts(storeId: string, baseUrl: string): Promise<Product[]> {
  const products: Product[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    try {
      const { data } = await axios.get(`${baseUrl}/wp-json/wc/store/v1/products`, {
        params: { per_page: perPage, page },
        timeout: 15000,
        headers: JSON_HEADERS,
      });

      const items: WooProduct[] = Array.isArray(data) ? data : [];
      if (items.length === 0) break;

      for (const item of items) {
        if (!item.name || item.name.length < 3) continue;
        const id = `${storeId}-${item.slug ?? slugify(item.name)}`;
        const cats = item.categories?.map((c) => c.name) ?? [];
        const { category, subcategory } = guessCategory(item.name, [], "", cats);
        const imageUrl = item.images?.[0]?.src ?? "";
        products.push({
          id,
          modelNumber: item.sku ?? slugify(item.name).slice(0, 20),
          family: item.name,
          brand: extractBrand(item.name),
          category,
          subcategory,
          imageUrl,
          storageOptions: [],
          searchTerms: [item.name],
        });
      }

      if (items.length < perPage) break;
      page++;
      // Brief pause to avoid rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      break;
    }
  }

  return products;
}

// ── Shopware (Foleja.al): search-based HTML scraping ─────────────────────────
const FOLEJA_SEARCH_TERMS = [
  "smartphone", "Samsung Galaxy", "iPhone", "Xiaomi", "laptop", "MacBook",
  "Dell", "HP laptop", "ASUS", "monitor", "televizor", "Smart TV", "Sony TV",
  "LG TV", "Samsung TV", "PlayStation", "Xbox", "Nintendo", "gaming",
  "headphones", "bluetooth speaker", "earbuds", "AirPods", "printer",
  "SSD", "RAM", "keyboard", "mouse", "webcam", "power bank", "parfum",
  "Dyson", "lavatrice", "frigorifer", "kondicionier", "kamera",
  "tablet", "iPad", "Samsung Tab",
];

async function fetchFolejaProducts(): Promise<Product[]> {
  const discovered = new Map<string, Product>();
  const baseUrl = "https://www.foleja.al";

  for (const term of FOLEJA_SEARCH_TERMS) {
    try {
      const { data } = await axios.get(`${baseUrl}/search`, {
        params: { search: term, p: 1 },
        timeout: 12000,
        headers: HEADERS,
      });

      const $ = cheerio.load(data);

      // Shopware product listing: .product-box or .product-info
      $(".product-box, .product-info, .product-name").each((_: number, el: cheerio.AnyNode) => {
        const $el = $(el);
        const link = $el.find("a[href*='/']").first();
        const href = link.attr("href") ?? $el.closest("a").attr("href");
        if (!href) return;

        const productUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;

        const name = (
          $el.find(".product-name, h2, h3, .name").first().text().trim() ||
          link.text().trim() ||
          link.attr("title") || ""
        ).replace(/\s+/g, " ").trim();

        if (!name || name.length < 4 || name.length > 200) return;

        const img = $el.find("img").first();
        const rawSrc = img.attr("src") || img.attr("data-src") || "";
        const imageUrl = rawSrc ? (rawSrc.startsWith("http") ? rawSrc : `${baseUrl}${rawSrc}`) : "";

        const id = `foleja-${slugify(name)}`;
        if (discovered.has(id)) return;

        const { category, subcategory } = guessCategory(name);
        discovered.set(id, {
          id,
          modelNumber: slugify(name).slice(0, 20),
          family: name,
          brand: extractBrand(name),
          category,
          subcategory,
          imageUrl,
          storageOptions: [],
          searchTerms: [name, productUrl],
        });
      });
    } catch {
      // Store unreachable or blocked — skip silently
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return Array.from(discovered.values());
}

// ── HTML fallback for other stores ──────────────────────────────────────────

interface HtmlStore {
  id: string;
  searchUrls: (q: string) => string[];
  productLinkSelectors: string[];
  terms: string[];
}

const HTML_STORES: HtmlStore[] = [
  {
    id: "neptun",
    searchUrls: (q) => [`https://www.neptun.al/search?q=${encodeURIComponent(q)}`],
    productLinkSelectors: ["a.product-link", ".product-name a", "h2 a", ".product-item a", "a.product-item-link"],
    terms: ["laptop", "telefon", "iPhone", "Samsung", "televizor", "Gaming", "PlayStation"],
  },
  {
    id: "pcstore",
    searchUrls: (q) => [`https://www.pcstore.al/?s=${encodeURIComponent(q)}&post_type=product`],
    productLinkSelectors: [
      "a.woocommerce-loop-product__link",
      "a[href*='/product/']",
      "li.product a[href]",
      ".product-title a",
    ],
    terms: ["laptop", "gaming PC", "SSD", "monitor", "keyboard", "mouse", "RAM", "GPU"],
  },
];

async function fetchHtmlStoreProducts(store: HtmlStore): Promise<Product[]> {
  const discovered = new Map<string, Product>();

  for (const term of store.terms) {
    for (const url of store.searchUrls(term)) {
      try {
        const { data } = await axios.get(url, { timeout: 12000, headers: HEADERS });
        const $ = cheerio.load(data);

        for (const sel of store.productLinkSelectors) {
          let found = 0;
          $(sel).each((_: number, el: cheerio.AnyNode) => {
            const $el = $(el);
            const href = $el.attr("href");
            if (!href) return;

            const productUrl = href.startsWith("http") ? href : `https://www.${store.id}.al${href}`;
            const $container = $el.closest("[class*='product'], article, li.item, .item, [class*='card']").first();
            const name = (
              $el.text().trim() ||
              $el.attr("title") ||
              $container.find("h2,h3,h4,[class*='title'],[class*='name']").first().text().trim()
            ).replace(/\s+/g, " ").trim();

            if (!name || name.length < 4 || name.length > 200) return;

            const img = $container.find("img").first();
            const rawSrc = img.attr("src") || img.attr("data-src") || "";
            const imageUrl = rawSrc ? (rawSrc.startsWith("http") ? rawSrc : `https://www.${store.id}.al${rawSrc}`) : "";

            const id = `${store.id}-${slugify(name)}`;
            if (discovered.has(id)) return;

            const { category, subcategory } = guessCategory(name);
            discovered.set(id, {
              id,
              modelNumber: slugify(name).slice(0, 20),
              family: name,
              brand: extractBrand(name),
              category,
              subcategory,
              imageUrl,
              storageOptions: [],
              searchTerms: [name],
            });
            found++;
          });
          if (found > 0) break;
        }
      } catch {
        // blocked or unreachable
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return Array.from(discovered.values());
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ShopifyProduct {
  handle: string;
  title: string;
  vendor: string;
  product_type: string;
  tags: string[];
  images: Array<{ src: string }>;
  variants: Array<{ sku: string }>;
}

interface WooProduct {
  name: string;
  slug: string;
  sku: string;
  categories: Array<{ name: string }>;
  images: Array<{ src: string }>;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function discoverProducts(): Promise<Product[]> {
  const all: Product[] = [];
  const seen = new Set<string>();

  function addAll(items: Product[]) {
    for (const p of items) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
  }

  // Run all stores in parallel for speed
  const [albagame, shpresa, foleja, ...htmlResults] = await Promise.allSettled([
    fetchShopifyProducts("albagame", "https://www.albagame.al"),
    fetchWooCommerceProducts("shpresa", "https://shpresa.al"),
    fetchFolejaProducts(),
    ...HTML_STORES.map((s) => fetchHtmlStoreProducts(s)),
  ]);

  if (albagame.status === "fulfilled") addAll(albagame.value);
  if (shpresa.status === "fulfilled") addAll(shpresa.value);
  if (foleja.status === "fulfilled") addAll(foleja.value);
  for (const r of htmlResults) {
    if (r.status === "fulfilled") addAll(r.value);
  }

  return all;
}
