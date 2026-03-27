// Infrastructure: price scraper — uses platform-native APIs (Shopify/WooCommerce/Shopware)
// instead of fragile HTML scraping so prices are always accurate.

import axios from "axios";
import * as cheerio from "cheerio";
import type { IPriceScraper } from "@/src/application/pricing/PriceQuery";
import type { Store } from "@/src/domain/pricing/Store";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
};

function notFound(storeId: string, error: string): ScrapedPrice {
  return {
    storeId,
    price: null,
    inStock: null,
    stockLabel: "E panjohur",
    productUrl: null,
    lastChecked: new Date().toISOString(),
    error,
  };
}

// Score a product name against search terms — higher = better match
function matchScore(name: string, terms: string[]): number {
  const n = name.toLowerCase();
  const words = terms.join(" ").toLowerCase().split(/\s+/).filter(Boolean);
  return words.filter((w) => n.includes(w)).length;
}

// Decode HTML entities and strip noise so searches match store listings.
// "HP EliteBook 840 G11 14&#8243;, 16GB" → "HP EliteBook 840 G11"
// "Nintendo Switch™ 2" → "Nintendo Switch 2"
function cleanQuery(term: string): string {
  const decoded = term
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&\w+;/g, " ");
  // Strip trademark/copyright/registered symbols
  const noSymbols = decoded.replace(/[™®©℠]/g, "").replace(/\s+/g, " ").trim();
  // Drop everything after the first comma (usually specs)
  const beforeComma = noSymbols.split(",")[0];
  // Drop bundle suffixes (e.g. "+ Mario Kart World")
  const noBundle = beforeComma.split(/\s+\+\s+/)[0];
  // Drop dimension notations and storage sizes
  return noBundle
    .replace(/\d+\.?\d*\s*["″"'']/g, "")
    .replace(/\b\d+\s*(gb|tb|mb|ram)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Known brand names — used to strip non-English/Albanian prefix words
// e.g. "Tharëse duarësh Dyson Airblade 9KJ" → "Dyson Airblade 9KJ"
const BRANDS = [
  "Samsung", "Apple", "Xiaomi", "Huawei", "Sony", "LG", "Dell", "HP", "Lenovo",
  "ASUS", "Acer", "Microsoft", "Nokia", "Motorola", "OnePlus", "Oppo", "Realme",
  "Philips", "Bosch", "Siemens", "Dyson", "iRobot", "Whirlpool", "Indesit",
  "Nintendo", "Nike", "Adidas", "Braun", "Oral-B", "Logitech", "Razer", "MSI",
  "Gigabyte", "Corsair", "Kingston", "WD", "Seagate", "Canon", "Nikon", "Epson",
  "Panasonic", "Toshiba", "Sharp", "Hisense", "TCL", "Beko", "Arçelik", "Gorenje",
];

// If the cleaned query starts with non-English/Albanian words before a known brand,
// return a brand-forward variant starting at the brand.
function brandForward(query: string): string | null {
  const lower = query.toLowerCase();
  for (const brand of BRANDS) {
    const idx = lower.indexOf(brand.toLowerCase());
    if (idx > 0) return query.slice(idx);
  }
  return null;
}

// Detect if a term looks like a manufacturer model number (not a natural-language name)
// e.g. "SM-S931B", "RTX 4090", "i7-13700K"
function isModelNumber(term: string): boolean {
  return /^(SM-[A-Z0-9]+|RTX|GTX|RX\s+\d|i[3579]-\d|Ryzen|[A-Z]{2,5}\d{3,6})/i.test(term);
}

// Build a list of queries to try, most specific first.
// Priority order:
//   1. Model numbers (most specific — exact cross-store match)
//   2. Brand-forward names (strips Albanian/foreign prefix)
//   3. Full cleaned name
//   4. 4-word fallback
// Skips URL-like terms.
function buildQueries(searchTerms: string[]): string[] {
  const modelQueries: string[] = [];
  const nameQueries: string[] = [];

  for (const term of searchTerms) {
    // Skip URL-like terms — not useful as store search queries
    if (/^https?:\/\//.test(term)) continue;

    const cleaned = cleanQuery(term);
    if (cleaned.length < 3) continue;

    // Model numbers go first for the most precise cross-store matching
    if (isModelNumber(cleaned)) {
      modelQueries.push(cleaned);
      continue;
    }

    // Brand-forward variant: strips Albanian/foreign prefix before the brand name
    // e.g. "Tharëse duarësh Dyson Airblade 9KJ" → "Dyson Airblade 9KJ"
    const branded = brandForward(cleaned);
    if (branded && branded !== cleaned && branded.length >= 3) {
      nameQueries.push(branded);
      const brandedShort = branded.split(/\s+/).slice(0, 3).join(" ");
      if (brandedShort !== branded && brandedShort.length >= 3) nameQueries.push(brandedShort);
    }

    nameQueries.push(cleaned);

    // Fallback: first 4 words of the full cleaned query
    const short = cleaned.split(/\s+/).slice(0, 4).join(" ");
    if (short !== cleaned && short !== branded && short.length >= 3) nameQueries.push(short);
  }

  const all = [...modelQueries, ...nameQueries];
  return all.filter((q, i) => all.indexOf(q) === i);
}

// Parse JSON-LD structured data from an HTML page to extract price/stock.
// Most e-commerce platforms include Schema.org Product markup which is reliable
// and doesn't require platform-specific API knowledge.
async function scrapeJsonLd(url: string, storeId: string): Promise<ScrapedPrice | null> {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
    });
    if (typeof html !== "string") return null;

    // Collect all JSON-LD blocks
    const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    const ldBlocks: RegExpExecArray[] = [];
    let ldMatch: RegExpExecArray | null;
    while ((ldMatch = ldRegex.exec(html)) !== null) ldBlocks.push(ldMatch);
    for (const [, raw] of ldBlocks) {
      try {
        const ld = JSON.parse(raw.trim());
        const items: unknown[] = Array.isArray(ld) ? ld : ld?.["@graph"] ? ld["@graph"] : [ld];
        const product = items.find((x: any) => x?.["@type"] === "Product") as any;
        if (!product) continue;

        const offerList: any[] = Array.isArray(product.offers)
          ? product.offers
          : product.offers ? [product.offers] : [];
        if (!offerList.length) continue;

        const offer = offerList[0];
        const rawPrice = offer?.price ?? offer?.lowPrice;
        const price = rawPrice != null ? parseFloat(String(rawPrice)) : null;
        if (price === null || isNaN(price)) continue;

        const avail: string = offer?.availability ?? "";
        const inStock = avail ? avail.toLowerCase().includes("instock") : null;

        return {
          storeId,
          price,
          inStock,
          stockLabel: inStock === true ? "Në gjendje" : inStock === false ? "Jo në gjendje" : "E panjohur",
          productUrl: url,
          lastChecked: new Date().toISOString(),
        };
      } catch {
        continue;
      }
    }
  } catch {
    // network error or not HTML
  }
  return null;
}

// ── Shopify ───────────────────────────────────────────────────────────────────
// Uses /products/{handle}.json when the product came from this store,
// falls back to /search.json for cross-store lookups.
async function scrapeShopify(
  store: Store,
  searchTerms: string[],
  productId: string
): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();

  // Direct handle lookup — only works when product was discovered from this store
  const ownPrefix = `${store.id}-`;
  if (productId.startsWith(ownPrefix)) {
    const handle = productId.slice(ownPrefix.length);
    try {
      const { data } = await axios.get(`${store.url}/products/${handle}.json`, {
        timeout: 8000,
        headers: HEADERS,
      });
      const product = data?.product;
      const variant = product?.variants?.[0];
      if (variant) {
        const price = variant.price ? parseFloat(variant.price) : null;
        const available = variant.available ?? null;
        return {
          storeId: store.id,
          price,
          inStock: available,
          stockLabel: available === true ? "Në gjendje" : available === false ? "Jo në gjendje" : "E panjohur",
          productUrl: `${store.url}/products/${handle}`,
          lastChecked,
        };
      }
    } catch {
      // fall through to search
    }
  }

  // Cross-store search via Shopify search API
  for (const term of buildQueries(searchTerms)) {
    try {
      const { data } = await axios.get(`${store.url}/search.json`, {
        params: { type: "product", q: term, limit: 10 },
        timeout: 8000,
        headers: HEADERS,
      });
      const results: Array<{ title: string; url: string; price: string; available: boolean }> =
        data?.resources?.results?.products ?? [];
      if (!results.length) continue;

      const best = results
        .map((r) => ({ r, score: matchScore(r.title, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.r;
      if (!best) continue;

      const handle = best.url.split("/products/")[1]?.split("?")[0];
      if (!handle) continue;

      const { data: pd } = await axios.get(`${store.url}/products/${handle}.json`, {
        timeout: 8000,
        headers: HEADERS,
      });
      const variant = pd?.product?.variants?.[0];
      if (!variant) continue;
      const price = variant.price ? parseFloat(variant.price) : null;
      const available = variant.available ?? null;
      return {
        storeId: store.id,
        price,
        inStock: available,
        stockLabel: available === true ? "Në gjendje" : available === false ? "Jo në gjendje" : "E panjohur",
        productUrl: `${store.url}/products/${handle}`,
        lastChecked,
      };
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── WooCommerce ───────────────────────────────────────────────────────────────
// Uses the public WooCommerce Store API (no auth required).
// For own-store products: direct slug lookup (always correct).
// For cross-store: name search with best-match scoring.
async function scrapeWooCommerce(
  store: Store,
  searchTerms: string[],
  productId: string
): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();

  type WooItem = {
    name: string;
    slug: string;
    permalink: string;
    prices: { price: string; regular_price: string; currency_minor_unit: number };
    is_in_stock: boolean;
    stock_status: string;
  };

  function parseWooItem(item: WooItem): ScrapedPrice {
    const minorUnit = item.prices?.currency_minor_unit ?? 2;
    const divisor = Math.pow(10, minorUnit);
    const rawPrice = item.prices?.price ?? item.prices?.regular_price;
    const price = rawPrice ? parseInt(rawPrice, 10) / divisor : null;
    const inStock = item.is_in_stock ?? item.stock_status === "instock";
    return {
      storeId: store.id,
      price,
      inStock,
      stockLabel: inStock ? "Në gjendje" : "Jo në gjendje",
      productUrl: item.permalink ?? null,
      lastChecked,
    };
  }

  // Direct slug lookup for own-store products
  const ownPrefix = `${store.id}-`;
  if (productId.startsWith(ownPrefix)) {
    const slug = productId.slice(ownPrefix.length);
    try {
      const { data } = await axios.get(`${store.url}/wp-json/wc/store/v1/products`, {
        params: { slug, per_page: 1 },
        timeout: 8000,
        headers: HEADERS,
      });
      const items: WooItem[] = Array.isArray(data) ? data : [];
      if (items.length) return parseWooItem(items[0]);
    } catch {
      // fall through to search
    }
  }

  // Cross-store or slug lookup failed — search by name
  for (const term of buildQueries(searchTerms)) {
    try {
      const { data } = await axios.get(`${store.url}/wp-json/wc/store/v1/products`, {
        params: { search: term, per_page: 10 },
        timeout: 8000,
        headers: HEADERS,
      });
      const items: WooItem[] = Array.isArray(data) ? data : [];
      if (!items.length) continue;

      const best = items
        .map((item) => ({ item, score: matchScore(item.name, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.item;
      if (!best) continue;

      return parseWooItem(best);
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── Shopware (Foleja) ─────────────────────────────────────────────────────────
// Foleja runs Shopware 6 but its frontend does NOT expose a JSON suggest API —
// the /suggest endpoint returns HTML. Product pages also lack JSON-LD; prices
// are in the GTM dataLayer instead. Strategy:
// 1. For own-store products: fetch the stored product URL and extract price
//    from JSON-LD (if present) or GTM dataLayer ("productPrice":"19934.00").
// 2. Cross-store: search via /search?search= HTML page, parse product cards
//    with cheerio, then fetch the matched product page for price.

async function scrapeShopwareProductPage(url: string, storeId: string): Promise<ScrapedPrice | null> {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
    });
    if (typeof html !== "string") return null;

    // Try JSON-LD Product schema first (works for many Shopware stores)
    const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let ldMatch: RegExpExecArray | null;
    while ((ldMatch = ldRegex.exec(html)) !== null) {
      try {
        const ld = JSON.parse(ldMatch[1].trim());
        const items: unknown[] = Array.isArray(ld) ? ld : ld?.["@graph"] ? ld["@graph"] : [ld];
        const product = items.find((x: any) => x?.["@type"] === "Product") as any;
        if (!product) continue;
        const offerList: any[] = Array.isArray(product.offers) ? product.offers
          : product.offers ? [product.offers] : [];
        const offer = offerList[0];
        const rawPrice = offer?.price ?? offer?.lowPrice;
        const price = rawPrice != null ? parseFloat(String(rawPrice)) : null;
        if (price !== null && !isNaN(price) && price > 0) {
          const avail = offer?.availability ?? "";
          const inStock = avail ? avail.toLowerCase().includes("instock") : null;
          return {
            storeId, price, inStock,
            stockLabel: inStock === true ? "Në gjendje" : inStock === false ? "Jo në gjendje" : "E panjohur",
            productUrl: url,
            lastChecked: new Date().toISOString(),
          };
        }
      } catch { continue; }
    }

    // Foleja.al uses GTM dataLayer instead of JSON-LD: "productPrice":"19934.00"
    const priceMatch = html.match(/"productPrice"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1]);
    if (isNaN(price) || price <= 0) return null;

    return {
      storeId,
      price,
      inStock: null,
      stockLabel: "E panjohur",
      productUrl: url,
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function scrapeShopware(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  const storeBase = store.url.replace(/\/$/, "");

  // 1. Direct product page lookup — own-store products have their Foleja URL in searchTerms
  for (const term of searchTerms) {
    if (!term.startsWith(storeBase + "/")) continue;
    const result = await scrapeShopwareProductPage(term, store.id);
    if (result) return result;
    break;
  }

  // 2. Cross-store: search the HTML search page and match by name
  for (const term of buildQueries(searchTerms)) {
    try {
      const { data: html } = await axios.get(`${store.url}/search`, {
        params: { search: term },
        timeout: 8000,
        headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
      });
      if (typeof html !== "string") continue;

      const $ = cheerio.load(html);
      const candidates: Array<{ name: string; url: string }> = [];

      // Shopware 6 product cards are in .product-box containers
      $(".product-box").each((_, el) => {
        const $el = $(el);
        const link = $el.find("a.product-name, .product-name a, a[href^='/']").first();
        const href = link.attr("href");
        if (!href || href === "/") return;
        const name = (
          $el.find(".product-name").first().text().trim() ||
          link.text().trim() ||
          $el.find("h2, h3, [class*='name']").first().text().trim()
        ).replace(/\s+/g, " ").trim();
        if (!name || name.length < 3) return;
        candidates.push({ name, url: href.startsWith("http") ? href : `${storeBase}${href}` });
      });

      if (!candidates.length) continue;

      const best = candidates
        .map((c) => ({ c, score: matchScore(c.name, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.c;
      if (!best) continue;

      const result = await scrapeShopwareProductPage(best.url, store.id);
      if (result) return result;
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── Magento (Globe Albania) ───────────────────────────────────────────────────
// Globe Albania runs Magento. Magento has a public product search REST API.
async function scrapeMagento(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();

  for (const term of buildQueries(searchTerms)) {
    try {
      // Magento 2 REST API — public catalog search (no auth needed for public store)
      const { data } = await axios.get(`${store.url}/rest/V1/products`, {
        params: {
          "searchCriteria[filter_groups][0][filters][0][field]": "name",
          "searchCriteria[filter_groups][0][filters][0][value]": `%${term}%`,
          "searchCriteria[filter_groups][0][filters][0][conditionType]": "like",
          "searchCriteria[pageSize]": 10,
          "fields": "items[id,name,sku,price,extension_attributes[stock_item[is_in_stock]],custom_attributes[url_key]]",
        },
        timeout: 8000,
        headers: HEADERS,
      });

      const items: Array<{
        name: string;
        sku: string;
        price: number;
        extension_attributes?: { stock_item?: { is_in_stock: boolean } };
        custom_attributes?: Array<{ attribute_code: string; value: string }>;
      }> = data?.items ?? [];
      if (!items.length) continue;

      const best = items
        .map((item) => ({ item, score: matchScore(item.name, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.item;
      if (!best) continue;

      const price = best.price ?? null;
      const inStock = best.extension_attributes?.stock_item?.is_in_stock ?? null;
      const urlKey = best.custom_attributes?.find((a) => a.attribute_code === "url_key")?.value;
      const productUrl = urlKey ? `${store.url}/${urlKey}.html` : null;

      return {
        storeId: store.id,
        price,
        inStock,
        stockLabel: inStock === true ? "Në gjendje" : inStock === false ? "Jo në gjendje" : "E panjohur",
        productUrl,
        lastChecked,
      };
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── Neptun ────────────────────────────────────────────────────────────────────
// Neptun.al uses a custom ASP.NET platform. Product data on search/category
// pages is embedded as JSON-LD ItemList in the server HTML. Individual product
// pages may have JSON-LD pricing. Note: content is partially JS-rendered, so
// this may not find all products.
async function scrapeNeptun(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  for (const term of buildQueries(searchTerms)) {
    try {
      const { data: html } = await axios.get(`${store.url}/search-product-result.nspx`, {
        params: { keyword: term },
        timeout: 8000,
        headers: { ...HEADERS, Accept: "text/html,application/xhtml+xml" },
      });
      if (typeof html !== "string") continue;

      // Neptun embeds product listings as JSON-LD ItemList in some page variants
      const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
      let ldMatch: RegExpExecArray | null;
      let bestUrl: string | null = null;
      let bestScore = 0;

      while ((ldMatch = ldRegex.exec(html)) !== null) {
        try {
          const ld = JSON.parse(ldMatch[1].trim());
          const items: any[] = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item?.["@type"] !== "ItemList") continue;
            for (const el of item.itemListElement ?? []) {
              const name = el.name ?? el.item?.name ?? "";
              const url = el.url ?? el.item?.url ?? "";
              if (!name || !url) continue;
              const score = matchScore(name, [term]);
              if (score > bestScore) { bestScore = score; bestUrl = url; }
            }
          }
        } catch { continue; }
      }

      if (!bestUrl || bestScore === 0) continue;

      // Fetch the matched product page and try JSON-LD pricing
      const result = await scrapeJsonLd(bestUrl, store.id);
      if (result) return result;
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── HTML fallback ─────────────────────────────────────────────────────────────
function scrapeHtmlFallback(store: Store): ScrapedPrice {
  return notFound(store.id, "Dyqani nuk mbështet kërkim automatik");
}

// ── Main scraper ──────────────────────────────────────────────────────────────
export class PriceScraper implements IPriceScraper {
  async scrape(store: Store, searchTerms: string[], productId: string): Promise<ScrapedPrice> {
    switch (store.platform) {
      case "shopify":
        return scrapeShopify(store, searchTerms, productId);
      case "woocommerce":
        return scrapeWooCommerce(store, searchTerms, productId);
      case "shopware":
        return scrapeShopware(store, searchTerms);
      case "magento":
        return scrapeMagento(store, searchTerms);
      case "neptun":
        return scrapeNeptun(store, searchTerms);
      case "html":
        return scrapeHtmlFallback(store);
    }
  }
}
