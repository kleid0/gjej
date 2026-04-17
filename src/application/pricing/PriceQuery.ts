// Use case: get prices for a product, with cache and persistence layers

import type { IPriceRepository } from "@/src/domain/pricing/IPriceRepository";
import type { ScrapedPrice, PriceRecord } from "@/src/domain/pricing/Price";
import type { Store } from "@/src/domain/pricing/Store";

export interface IPriceScraper {
  scrape(store: Store, searchTerms: string[], productId: string): Promise<ScrapedPrice>;
}

const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const STALE_DISPLAY_MS   = 24 * 60 * 60 * 1000; // 24 hours — show stale warning

// ── Post-collection match validation ────────────────────────────────────────
// Re-checks every price (cached or live) against the product's search terms.
// Catches wrong matches that slipped through or were persisted before guards
// were tightened.  Uses matchedName when available, URL slug as fallback.

const POST_ACCESSORY_WORDS = new Set([
  "kontrollues", "kontroller", "controller", "joystick", "gamepad",
  "charger", "karikues", "kabel", "cable", "case", "kover",
  "mbrojtes", "mbrojtese", "mbështjellës", "mbeshstjelles",
  "protective", "glass", "tempered", "dock", "stand", "pouch", "bag",
  "headset", "kufje", "mouse", "keyboard", "tastierë", "tastiere",
]);

const POST_BUNDLE_WORDS = new Set([
  "bundle", "edition", "pack", "combo", "collection",
  "koleksion", "paketë", "pakete",
  "pokemon", "pokémon", "zelda", "metroid", "kirby", "splatoon", "legends",
]);

/** Strip diacritics so URL-slugified Albanian ("mbeshstjelles") matches originals. */
function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function postTokenize(text: string): string[] {
  return stripDiacritics(text)
    .replace(/[™®©℠]/g, " ")
    .split(/[\s\-/()\[\]{}.,;:!?|+@#%^&*~`]+/)
    .filter((w) => w.length > 1);
}

function extractGenNums(text: string): Set<string> {
  const c = text.replace(/[™®©℠]/g, " ")
    .replace(/\b\d+\s*(gb|tb)\b/gi, "")
    .replace(/\b\d+(?:\.\d+)?\s*(?:["″"'']|in\b)/gi, "") // screen sizes: 14", 6.1in
    .replace(/\b\d+\.\d+\b/g, "")                         // bare decimals like 23.8
    .replace(/\bcore\s+(?:ultra\s*)?i?\s*\d+[a-z0-9]*\b/gi, "")  // Core Ultra 7, Core i7
    .replace(/\b(?:ryzen|xeon|celeron|pentium|athlon)\s+\w*\s*\d+\b/gi, ""); // Ryzen 7, etc.
  // Use (?<!\d) / (?!\d) instead of \b so digits glued to letters
  // (e.g. "S24", "A56") are captured — \b has no boundary between [a-z] and \d.
  return new Set(c.match(/(?<!\d)\d{1,4}(?!\d)/g) ?? []);
}

/** Extract a product name from the URL slug (fallback when matchedName is absent). */
function nameFromUrl(url: string): string | null {
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1];
    if (!slug || /^\d+$/.test(slug)) return null;
    return slug.replace(/\.(html?|php|aspx)$/i, "").replace(/-/g, " ");
  } catch { return null; }
}

function isValidMatch(name: string, searchTerms: string[]): boolean {
  const queryText = stripDiacritics(
    searchTerms.filter((t) => !t.startsWith("http") && !t.startsWith("!")).join(" ")
  ).toLowerCase();
  const resultText = stripDiacritics(name).toLowerCase();

  // Generation numbers: both directions
  const qn = extractGenNums(queryText);
  const rn = extractGenNums(resultText);
  if (!Array.from(qn).every((n) => rn.has(n))) return false;
  if (qn.size > 0 && Array.from(rn).some((n) => !qn.has(n))) return false;

  // Accessory / bundle rejection
  const qw = postTokenize(queryText);
  const rw = postTokenize(resultText);
  if (!qw.some((w) => POST_ACCESSORY_WORDS.has(w)) && rw.some((w) => POST_ACCESSORY_WORDS.has(w))) return false;
  // Reverse: if query is for an accessory, reject non-accessory results (e.g. the phone itself)
  if (qw.some((w) => POST_ACCESSORY_WORDS.has(w)) && !rw.some((w) => POST_ACCESSORY_WORDS.has(w))) return false;
  if (!qw.some((w) => POST_BUNDLE_WORDS.has(w)) && rw.some((w) => POST_BUNDLE_WORDS.has(w))) return false;

  return true;
}

/** Nullify prices whose matched product is clearly wrong. */
function validatePriceMatches(prices: ScrapedPrice[], searchTerms: string[]): ScrapedPrice[] {
  return prices.map((p) => {
    if (p.price === null) return p;
    const name = p.matchedName ?? (p.productUrl ? nameFromUrl(p.productUrl) : null);
    if (!name) return p; // can't validate without a name
    if (!isValidMatch(name, searchTerms)) {
      return { ...p, price: null, inStock: null, error: "Produkti nuk u gjet" };
    }
    return p;
  });
}

/**
 * Flag prices that deviate significantly from the average.
 * Requires ≥ 3 data points — fewer stores means too little signal.
 * - >40% below average → suspicious (likely wrong match)
 * - >60% above average → overpriced (flagged for admin review)
 */
function flagSuspiciousPrices(prices: ScrapedPrice[]): ScrapedPrice[] {
  const found = prices.filter((p) => p.price !== null && p.price > 0);
  if (found.length < 3) return prices;

  const avg = found.reduce((s, p) => s + p.price!, 0) / found.length;

  return prices.map((p) => {
    if (p.price === null || p.price <= 0) return p;
    const deviation = (p.price - avg) / avg;
    if (deviation < -0.4) return { ...p, suspicious: true };
    if (deviation >  0.6) return { ...p, overpriced: true };
    return p;
  });
}

/** Mark prices as stale when cached data is older than 24 hours. */
function markStalePrices(prices: ScrapedPrice[], refreshedAt: string): ScrapedPrice[] {
  const ageMs = Date.now() - new Date(refreshedAt).getTime();
  if (ageMs < STALE_DISPLAY_MS) return prices;
  return prices.map((p) => (p.price !== null ? { ...p, stale: true } : p));
}

export class PriceQuery {
  constructor(
    private readonly priceRepo: IPriceRepository,
    private readonly scraper: IPriceScraper,
    private readonly stores: Store[]
  ) {}

  async getPricesForProduct(
    productId: string,
    searchTerms: string[],
    cacheKey?: string,
    forceRefresh = false,
  ): Promise<{ prices: ScrapedPrice[]; fromCache: boolean; refreshedAt?: string }> {
    const effectiveKey = cacheKey ?? productId;

    // 1. Check persisted prices (written by cron) — skip when force-refresh requested
    if (!forceRefresh) {
      const persisted = await this.priceRepo.getByProductId(effectiveKey);
      if (persisted) {
        const ageMs = Date.now() - new Date(persisted.refreshedAt).getTime();
        if (ageMs < STALE_THRESHOLD_MS) {
          return {
            prices: validatePriceMatches(
              markStalePrices(persisted.prices, persisted.refreshedAt),
              searchTerms,
            ),
            fromCache: true,
            refreshedAt: persisted.refreshedAt,
          };
        }
      }
    }

    // 2. Live scrape — only when no fresh data exists
    // allSettled so one slow/failed store never blocks the others
    const settled = await Promise.allSettled(
      this.stores.map((store) => this.scraper.scrape(store, searchTerms, productId))
    );
    const raw = settled.map((r, i) =>
      r.status === "fulfilled"
        ? r.value
        : {
            storeId: this.stores[i].id,
            price: null,
            inStock: null,
            stockLabel: "E panjohur",
            productUrl: null,
            lastChecked: new Date().toISOString(),
            error: "Gabim gjatë kërkimit",
          }
    );

    const validated = validatePriceMatches(raw, searchTerms);
    const prices = flagSuspiciousPrices(validated);

    try {
      await this.priceRepo.save(effectiveKey, prices);
    } catch {
      // File write may fail on read-only Vercel deployment; continue anyway
    }

    return { prices, fromCache: false };
  }

  async getAllCachedPrices(): Promise<Record<string, PriceRecord>> {
    return this.priceRepo.getAll();
  }
}
