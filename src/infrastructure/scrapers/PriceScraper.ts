// Infrastructure: price scraper — uses platform-native APIs (Shopify/WooCommerce/Shopware)
// instead of fragile HTML scraping so prices are always accurate.

import axios from "axios";
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

// Decode HTML entities and strip specs so searches actually match store listings.
// "HP EliteBook 840 G11 14&#8243;, 16GB, 512GB" → "HP EliteBook 840 G11"
function cleanQuery(term: string): string {
  const decoded = term
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&\w+;/g, " ");
  // Drop everything after the first comma (usually specs)
  const beforeComma = decoded.split(",")[0];
  // Drop dimension notations and storage sizes
  return beforeComma
    .replace(/\d+\.?\d*\s*["″"'']/g, "")
    .replace(/\b\d+\s*(gb|tb|mb|ram)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build a list of queries to try: cleaned full name, then progressively shorter
function buildQueries(searchTerms: string[]): string[] {
  const queries: string[] = [];
  for (const term of searchTerms) {
    const cleaned = cleanQuery(term);
    if (cleaned.length >= 3) queries.push(cleaned);
    // Fallback: first 4 words (brand + model without variants)
    const short = cleaned.split(/\s+/).slice(0, 4).join(" ");
    if (short !== cleaned && short.length >= 3) queries.push(short);
  }
  return queries.filter((q, i) => queries.indexOf(q) === i);
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
        timeout: 10000,
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
        timeout: 10000,
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
        timeout: 10000,
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
        timeout: 10000,
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
        timeout: 10000,
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
// Shopware exposes a search suggest endpoint that returns JSON product data
// including price and stock. Falls back to the store search page JSON-LD.
async function scrapeShopware(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();

  for (const term of buildQueries(searchTerms)) {
    try {
      const { data } = await axios.get(`${store.url}/suggest`, {
        params: { search: term },
        timeout: 10000,
        headers: HEADERS,
      });

      // Shopware suggest returns { products: { elements: [...] } }
      const elements: Array<{
        name?: string;
        translated?: { name?: string };
        calculatedPrice?: { totalPrice: number };
        price?: Array<{ gross: number }>;
        stock?: number;
        availableStock?: number;
        seoUrls?: Array<{ seoPathInfo: string }>;
      }> = data?.products?.elements ?? data?.elements ?? [];

      if (!elements.length) continue;

      const best = elements
        .map((el) => ({ el, score: matchScore(el.name ?? el.translated?.name ?? "", [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.el;
      if (!best) continue;

      const price = best.calculatedPrice?.totalPrice ?? best.price?.[0]?.gross ?? null;
      const availableStock = best.availableStock ?? best.stock ?? 0;
      const inStock = availableStock > 0;
      const seoPath = best.seoUrls?.[0]?.seoPathInfo;
      const productUrl = seoPath ? `${store.url}/${seoPath}` : null;

      return {
        storeId: store.id,
        price,
        inStock,
        stockLabel: inStock ? "Në gjendje" : "Jo në gjendje",
        productUrl,
        lastChecked,
      };
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── HTML fallback ─────────────────────────────────────────────────────────────
// For stores that don't expose a JSON API (or block our requests).
// Returns unavailable rather than showing wrong data.
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
      case "html":
        return scrapeHtmlFallback(store);
    }
  }
}
