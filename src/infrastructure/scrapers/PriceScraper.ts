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

// Words that indicate an accessory/peripheral rather than the main product.
// Penalise results containing these when the query does not.
const ACCESSORY_WORDS = new Set([
  "kontrollues", "kontroller", "controller", "joy-con", "joystick", "gamepad",
  "volant", "steering", "wheel", "adapter", "charger", "karikues", "kabel",
  "cable", "case", "kover", "mbrojtes", "mbrojtese", "protective", "glass",
  "tempered", "screen", "dock", "stand", "pouch", "bag", "backpack",
  "headset", "headphone", "kufje", "mouse", "tastierë", "keyboard",
]);

// ── Strict match helpers ──────────────────────────────────────────────────────
// These guards are applied BEFORE the fuzzy matchScore to eliminate hard mismatches:
//   1. Generation mismatch  → "iPhone 17" must not match "iPhone 15"
//   2. Tier mismatch        → "iPhone 17" must not match "iPhone 17 Pro / Pro Max / Air"
//   3. Storage conflict     → "256GB" in query must not match "1TB" in result
//   4. Accessory result     → a case/cable must not win when user wants the device
//   5. Low confidence       → fewer than 60% of query words found in result

// Model tiers, ordered from most-specific to least-specific so "pro max" is
// tested before "pro" (prevents "Pro Max" being wrongly classified as "Pro").
const TIER_PRIORITY = [
  "pro max", "pro plus", "pro",
  "plus", "ultra", "air", "edge", "mini", "fe", "lite", "note", "slim",
];

/** Return the primary tier of a product name, or null if none. */
function extractTier(text: string): string | null {
  const lower = text.toLowerCase();
  for (const tier of TIER_PRIORITY) {
    const re = new RegExp(`\\b${tier.replace(" ", "\\s+")}\\b`);
    if (re.test(lower)) return tier;
  }
  return null;
}

/**
 * Extract 2-4 digit standalone numbers that represent model/generation numbers.
 * Storage sizes (128GB, 256GB, 1TB) and screen-size notations (65") are stripped
 * first so they do not interfere with model number comparison.
 */
function extractGenerationNumbers(text: string): Set<string> {
  const cleaned = text.toLowerCase()
    .replace(/\b\d+\s*(gb|tb)\b/gi, "")          // strip storage: 128GB, 1TB
    .replace(/\b\d+(?:\.\d+)?\s*["″"''in]\b/gi, ""); // strip screen sizes: 65", 6.1in
  return new Set(cleaned.match(/\b\d{2,4}\b/g) ?? []);
}

/** Return the normalised storage string ("256GB", "1TB") or null if none. */
function extractStorageSize(text: string): string | null {
  const m = text.match(/\b(\d+)\s*(gb|tb)\b/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
}

/**
 * Colour token list — ordered most-specific first so "Mist Blue" is matched
 * before "Blue", and "Black Titanium" before plain "Black".
 * Each key is the canonical identifier compared across query and result.
 * Patterns include Albanian colour words (e zezë, i bardhë, blu e lehtë…)
 * because Foleja uses Albanian product names.
 */
const COLOUR_TOKENS: Array<{ key: string; pattern: RegExp }> = [
  // Titanium sub-variants (must precede plain "titanium" / "black" / "white")
  { key: "natural-titanium",     pattern: /\bnatural\s+titanium\b/i },
  { key: "black-titanium",       pattern: /\b(black\s+titanium|titanium\s+black)\b/i },
  { key: "white-titanium",       pattern: /\b(white\s+titanium|titanium\s+white(?:\s+silver)?)\b/i },
  { key: "desert-titanium",      pattern: /\bdesert\s+titanium\b/i },
  { key: "silver-blue-titanium", pattern: /\btitanium\s+silver\s+blue\b/i },
  { key: "gray-titanium",        pattern: /\btitanium\s+gr[ae]y\b/i },
  { key: "silver-titanium",      pattern: /\btitanium\s+silver\b/i },
  // Multi-word named colours (before single-word fallbacks)
  { key: "mist-blue",     pattern: /\bmist\s+blu?e?\b/i },
  { key: "icy-blue",      pattern: /\bicy\s+blu?e?\b/i },
  { key: "storm-blue",    pattern: /\bstorm\s+blu?e?\b/i },
  { key: "light-blue",    pattern: /\b(light\s+blu?e?|blu\s+e\s+leht[eë])\b/i },
  { key: "deep-blue",     pattern: /\bdeep\s+blu?e?\b/i },
  { key: "silver-shadow", pattern: /\bsilver\s+shadow\b/i },
  { key: "space-gray",    pattern: /\b(space\s+gr[ae]y|hap[eë]sir[eë]\s+gri)\b/i },
  { key: "space-black",   pattern: /\bspace\s+black\b/i },
  { key: "cosmic-orange", pattern: /\bcosmic\s+orange\b/i },
  { key: "cobalt-violet", pattern: /\bcobalt\s+violet\b/i },
  { key: "phantom-black", pattern: /\bphantom\s+black\b/i },
  // Specific single-word named colours (before generic aliases)
  { key: "sage",        pattern: /\bsage\b/i },
  { key: "lavender",    pattern: /\b(lavender|lila)\b/i },
  { key: "ultramarine", pattern: /\bultramarine\b/i },
  { key: "teal",        pattern: /\bteal\b/i },
  { key: "mint",        pattern: /\bmint\b/i },
  { key: "navy",        pattern: /\bnavy\b/i },
  { key: "starlight",   pattern: /\bstarlight\b/i },
  { key: "moonstone",   pattern: /\bmoonstone\b/i },
  // Generic colours + Albanian / common-European translations
  { key: "black",  pattern: /\b(black|e\s*ze(?:z[eë])?|i\s+zi|onyx|midnight|graphite|nero|negro)\b/i },
  { key: "white",  pattern: /\b(white|bardhë?|e\s+bardhë?|i\s+bardhë?|blanc|pearl|ivory)\b/i },
  { key: "silver", pattern: /\b(silver|argjend[ti]?[ae]?|platinum)\b/i },
  { key: "blue",   pattern: /\b(blue|blu)\b/i },
  { key: "green",  pattern: /\b(green|e\s+gjelb[eë]r|verde|lime|forest)\b/i },
  { key: "purple", pattern: /\b(purple|violet|vjollc[eë]|mauve)\b/i },
  { key: "red",    pattern: /\b(red|e\s+kuqe|rouge|scarlet|crimson)\b/i },
  { key: "yellow", pattern: /\b(yellow|verdh[eë]|gold|amber)\b/i },
  { key: "pink",   pattern: /\b(pink|roz[eë]?|rose|peach|coral)\b/i },
  { key: "gray",   pattern: /\b(gr[ae]y|gri)\b/i },
  { key: "orange", pattern: /\borange\b/i },
];

/**
 * Return the canonical colour key from a product name / query string, or null.
 * Iterates COLOUR_TOKENS in order so the most-specific pattern wins.
 */
function extractColour(text: string): string | null {
  for (const { key, pattern } of COLOUR_TOKENS) {
    if (pattern.test(text)) return key;
  }
  return null;
}

/**
 * Extract the requested colour from scraper search terms.
 * Looks at !-prefixed exact terms (e.g. "!Apple iPhone 17 256GB Black")
 * which are the variant-specific queries built by buildVariantSearchTerms().
 */
function extractColourFromTerms(searchTerms: string[]): string | null {
  for (const term of searchTerms) {
    if (term.startsWith("!")) {
      const c = extractColour(term.slice(1));
      if (c) return c;
    }
  }
  return null;
}

/**
 * Fraction of query words that appear in the result name (0 – 1).
 * Used as a confidence backstop after the hard-reject checks.
 */
function confidenceRatio(resultName: string, queryTerms: string[]): number {
  const n = resultName.toLowerCase();
  const words = queryTerms.join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  if (!words.length) return 0;
  return words.filter((w) => n.includes(w)).length / words.length;
}

const MIN_CONFIDENCE = 0.6;

/**
 * Strict-then-fuzzy scorer.
 * Returns 0 for hard mismatches (wrong generation, wrong tier, storage conflict,
 * accessory result for a non-accessory query, or confidence below threshold).
 * Otherwise returns the fuzzy matchScore.
 */
function strictMatchScore(resultName: string, queryTerms: string[]): number {
  const queryText  = queryTerms.join(" ");
  const resultLow  = resultName.toLowerCase();
  const queryLow   = queryText.toLowerCase();

  // 1. Generation numbers: every number in the query must exist in the result.
  //    Prevents "iPhone 17" matching "iPhone 15" or "iPhone 16".
  const queryNums  = extractGenerationNumbers(queryLow);
  const resultNums = extractGenerationNumbers(resultLow);
  if (!Array.from(queryNums).every((n) => resultNums.has(n))) return 0;

  // 2. Model tier must match exactly.
  //    "iPhone 17" (tier=null) must not match "iPhone 17 Pro" (tier="pro").
  //    "iPhone 17 Pro" (tier="pro") must not match "iPhone 17 Pro Max" (tier="pro max").
  if (extractTier(queryLow) !== extractTier(resultLow)) return 0;

  // 3. Storage conflict: if both sides specify storage and they differ → reject.
  //    "iPhone 17 256GB" must not match "iPhone 17 1TB Silver".
  const qs = extractStorageSize(queryLow);
  const rs = extractStorageSize(resultLow);
  if (qs && rs && qs !== rs) return 0;

  // 3b. Colour conflict: if the query specifies a colour and the result shows a
  //     DIFFERENT colour → reject.  If only one side has a detectable colour
  //     (e.g. the result name doesn't mention colour at all), allow it through —
  //     the store may not include colour in the product name.
  //     This fixes Foleja returning "i bardhë" (White) for a "Black" query.
  const qc = extractColour(queryLow);
  const rc = extractColour(resultLow);
  if (qc && rc && qc !== rc) return 0;

  // 4. Accessory hard reject: if the result is an accessory (case, cable, glass…)
  //    but the query is not, score is zero regardless of word overlap.
  const queryWords  = queryLow.split(/\s+/).filter((w) => w.length > 1);
  const resultWords = resultLow.split(/\W+/).filter((w) => w.length > 1);
  const queryIsAccessory  = queryWords.some((w)  => ACCESSORY_WORDS.has(w));
  const resultIsAccessory = resultWords.some((w) => ACCESSORY_WORDS.has(w));
  if (!queryIsAccessory && resultIsAccessory) return 0;

  // 5. Minimum confidence: at least 60 % of query words must appear in result.
  if (confidenceRatio(resultName, queryTerms) < MIN_CONFIDENCE) return 0;

  // Colour-match bonus: if both sides agree on colour, boost score so the
  // explicit-colour result wins over a colour-less result with equal word overlap.
  const base = matchScore(resultName, queryTerms);
  return (qc && rc && qc === rc) ? base * 1.5 : base;
}

// Score a product name against search terms — higher = better match.
// Applies two penalties to prevent false positives:
//  1. Precision factor: discounts results with many extra words not in the query
//     (Joy-Con "Kontrollues Joy-Con 2 Nintendo Switch 2 i kuq" has many extras)
//  2. Accessory penalty (×0.3): if the result contains accessory keywords absent
//     from the query, the user is looking for the main product not an accessory.
function matchScore(name: string, terms: string[]): number {
  const n = name.toLowerCase();
  const queryWords = terms.join(" ").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const matchingWords = queryWords.filter((w) => n.includes(w));
  if (matchingWords.length === 0) return 0;

  // Precision: penalise extra result words that aren't in the query
  const resultWords = n.split(/\W+/).filter((w) => w.length > 1);
  const unmatchedExtras = resultWords.filter(
    (w) => !queryWords.some((qw) => qw.includes(w) || w.includes(qw))
  ).length;
  const precisionFactor = matchingWords.length / (matchingWords.length + unmatchedExtras * 0.4);

  // Accessory penalty: suppress peripheral results when the query is for the main product
  const queryHasAccessory = queryWords.some((w) => ACCESSORY_WORDS.has(w));
  const resultHasAccessory = resultWords.some((w) => ACCESSORY_WORDS.has(w));
  const accessoryMultiplier = !queryHasAccessory && resultHasAccessory ? 0.3 : 1.0;

  return matchingWords.length * precisionFactor * accessoryMultiplier;
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
  const exactQueries: string[] = [];
  const modelQueries: string[] = [];
  const nameQueries: string[] = [];

  for (const term of searchTerms) {
    // Skip URL-like terms — not useful as store search queries
    if (/^https?:\/\//.test(term)) continue;

    // Exact variant queries (! prefix): already cleaned, bypass processing
    if (term.startsWith("!")) {
      const q = term.slice(1).trim();
      if (q.length >= 3) exactQueries.push(q);
      continue;
    }

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

    // Brand-stripped variant: some stores (e.g. Neptun) don't use brand prefixes
    // "Apple iPhone 17" → "iPhone 17", "Samsung Galaxy S25" → "Galaxy S25"
    const matchedBrand = BRANDS.find((b) => cleaned.toLowerCase().startsWith(b.toLowerCase() + " "));
    if (matchedBrand) {
      const stripped = cleaned.slice(matchedBrand.length).trim();
      if (stripped.length >= 3 && stripped !== cleaned) nameQueries.push(stripped);
    }

    // Fallback: first 4 words of the full cleaned query
    const short = cleaned.split(/\s+/).slice(0, 4).join(" ");
    if (short !== cleaned && short !== branded && short.length >= 3) nameQueries.push(short);
  }

  const all = [...exactQueries, ...modelQueries, ...nameQueries];
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

// ── Shopify variant picker ────────────────────────────────────────────────────
// Shopify products have an `options` array describing what each option slot means
// (e.g. options[0]={name:"Color"}, options[1]={name:"Storage"}).  Each variant
// then has option1/option2/option3 values corresponding to those slots.
// We match the requested colour and storage against those values.
// Falls back to variants[0] when no searchTerms hint is available.

interface ShopifyVariant { option1?: string; option2?: string; option3?: string; price?: string; available?: boolean }
interface ShopifyProduct { options?: Array<{ name: string }>; variants?: ShopifyVariant[] }

function pickShopifyVariant(product: ShopifyProduct, searchTerms: string[]): ShopifyVariant | undefined {
  const variants = product.variants ?? [];
  if (!variants.length) return undefined;

  const requestedColour  = extractColourFromTerms(searchTerms);
  const requestedStorage = (() => {
    for (const t of searchTerms) {
      if (t.startsWith("!")) {
        const s = extractStorageSize(t.slice(1));
        if (s) return s.toLowerCase();
      }
    }
    return null;
  })();

  if (!requestedColour && !requestedStorage) return variants[0];

  const options = product.options ?? [];
  // Find which option slot (option1/option2/option3) corresponds to colour vs storage
  const optionKeys = ["option1", "option2", "option3"] as const;

  const colourSlot  = options.findIndex((o) => /colou?r|ngjyre|color/i.test(o.name));
  const storageSlot = options.findIndex((o) => /storage|capacity|memory|hapesire|gb|tb/i.test(o.name));

  const match = variants.find((v) => {
    const colourVal  = colourSlot  >= 0 ? (v[optionKeys[colourSlot]]  ?? "") : "";
    const storageVal = storageSlot >= 0 ? (v[optionKeys[storageSlot]] ?? "") : "";

    const colourOk  = !requestedColour  || !colourVal  || extractColour(colourVal)  === requestedColour;
    const storageOk = !requestedStorage || !storageVal || extractStorageSize(storageVal)?.toLowerCase() === requestedStorage;
    return colourOk && storageOk;
  });

  return match ?? variants[0] ?? undefined;
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
      const variant = product ? pickShopifyVariant(product, searchTerms) : null;
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
  // Some stores (e.g. AlbaGame) have Cloudflare rules that return HTML for
  // search.json. Detect that and fall back to handle-inference direct lookup.
  function toShopifyHandle(s: string): string {
    return s.toLowerCase()
      .replace(/[™®©℠''`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }

  for (const term of buildQueries(searchTerms)) {
    try {
      const { data } = await axios.get(`${store.url}/search.json`, {
        params: { type: "product", q: term, limit: 10 },
        timeout: 8000,
        headers: HEADERS,
      });

      // If response is HTML (Cloudflare redirect / no JSON API), fall back to
      // handle inference: try /products/{slugified-term}.json directly.
      if (typeof data !== "object" || !data?.resources) {
        // Generate candidate handles: full term, without brand prefix, shortened
        const candidateHandles: string[] = [];
        candidateHandles.push(toShopifyHandle(term));
        // AlbaGame stores Nintendo games as "Switch 2 {game}" not "Nintendo Switch 2 {game}"
        const withoutNintendo = toShopifyHandle(term.replace(/^nintendo\s+/i, ""));
        if (withoutNintendo !== candidateHandles[0]) candidateHandles.push(withoutNintendo);
        // Also try without "Nintendo Switch 2 " prefix → just the game/product name
        const withoutNS2 = toShopifyHandle(term.replace(/^nintendo\s+switch\s+2\s*/i, ""));
        if (withoutNS2 !== candidateHandles[0] && withoutNS2 !== withoutNintendo && withoutNS2.length > 3) {
          candidateHandles.push(withoutNS2);
        }
        for (const h of candidateHandles) {
          try {
            const { data: pd } = await axios.get(`${store.url}/products/${h}.json`, {
              timeout: 5000, headers: HEADERS,
            });
            const prd = pd?.product;
            if (!prd) continue;
            const variant = pickShopifyVariant(prd, searchTerms);
            if (!variant) continue;
            const price = variant.price ? parseFloat(variant.price) : null;
            if (price === null) continue;
            return {
              storeId: store.id,
              price,
              inStock: variant.available ?? null,
              stockLabel: variant.available === true ? "Në gjendje" : variant.available === false ? "Jo në gjendje" : "E panjohur",
              productUrl: `${store.url}/products/${h}`,
              lastChecked,
            };
          } catch { continue; }
        }
        continue; // handle inference failed — try next query term
      }

      const results: Array<{ title: string; url: string; price: string; available: boolean }> =
        data?.resources?.results?.products ?? [];
      if (!results.length) continue;

      const best = results
        .map((r) => ({ r, score: strictMatchScore(r.title, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.r;
      if (!best) continue;

      const handle = best.url.split("/products/")[1]?.split("?")[0];
      if (!handle) continue;

      const { data: pd } = await axios.get(`${store.url}/products/${handle}.json`, {
        timeout: 8000,
        headers: HEADERS,
      });
      const product = pd?.product;
      if (!product) continue;
      const variant = pickShopifyVariant(product, searchTerms);
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

  type WooVariationAttr = { name: string; value: string };
  type WooVariation = { id: number; attributes?: WooVariationAttr[] };

  type WooItem = {
    id?: number;
    name: string;
    slug: string;
    permalink: string;
    // "variable" = parent product with colour/storage variants
    type?: string;
    // WooCommerce Store v1 returns variation summaries on the parent object.
    // Each entry has an id and (when available) attribute name→value pairs.
    variations?: Array<WooVariation | number>;
    prices: { price: string; regular_price: string; currency_minor_unit: number };
    is_in_stock: boolean;
    stock_status: string;
  };

  function parseWooItem(item: WooItem, fallbackUrl?: string): ScrapedPrice {
    const minorUnit = item.prices?.currency_minor_unit ?? 0;
    const divisor = minorUnit > 0 ? Math.pow(10, minorUnit) : 1;
    const rawPrice = item.prices?.price ?? item.prices?.regular_price;
    const price = rawPrice ? parseInt(rawPrice, 10) / divisor : null;
    const inStock = item.is_in_stock ?? item.stock_status === "instock";
    return {
      storeId: store.id,
      price,
      inStock,
      stockLabel: inStock ? "Në gjendje" : "Jo në gjendje",
      productUrl: item.permalink ?? fallbackUrl ?? null,
      lastChecked,
    };
  }

  /**
   * Resolve a specific colour variation for a WooCommerce variable product.
   *
   * The Store API returns variations as plain numeric IDs on the parent.
   * We fetch every variation, check its attributes for a colour match,
   * and return that variation's stock and price directly.
   *
   * Returns ScrapedPrice if we could determine the answer (including
   * "not available in this colour"). Returns undefined only when we
   * have no colour preference or all network calls failed.
   */
  async function resolveVariation(parent: WooItem): Promise<ScrapedPrice | undefined> {
    const requestedColour = extractColourFromTerms(searchTerms);
    if (!requestedColour) return undefined;

    // Collect all variation IDs (Shpresa Store API returns plain numbers)
    const ids: number[] = [];
    for (const v of parent.variations ?? []) {
      if (typeof v === "number") ids.push(v);
      else if (typeof v === "object" && v !== null && "id" in v) ids.push((v as WooVariation).id);
    }
    if (!ids.length) return undefined;

    // Fetch every variation in parallel — each has its own attributes, stock, price
    type VarData = {
      is_in_stock: boolean;
      stock_status: string;
      prices: { price: string; regular_price: string; currency_minor_unit: number };
      attributes: Array<{ name: string; value: string }>;
      permalink: string;
    };
    const results = await Promise.all(
      ids.slice(0, 20).map((id) =>
        axios
          .get<VarData>(`${store.url}/wp-json/wc/store/v1/products/${id}`, {
            timeout: 8000,
            headers: HEADERS,
          })
          .then((r) => r.data)
          .catch(() => null)
      )
    );

    const fetched = results.filter((r): r is VarData => r !== null);
    if (!fetched.length) return undefined; // all requests failed — fall back to parent

    // Find the variation whose attributes contain the requested colour
    const match = fetched.find((v) =>
      (v.attributes ?? []).some((a) => extractColour(a.value) === requestedColour)
    );

    if (!match) {
      return {
        storeId: store.id,
        price: null,
        inStock: null,
        stockLabel: "E panjohur",
        productUrl: parent.permalink ?? null,
        lastChecked,
        error: "Ky variant nuk disponohet",
      };
    }

    const minorUnit = match.prices?.currency_minor_unit ?? 0;
    const divisor = minorUnit > 0 ? Math.pow(10, minorUnit) : 1;
    const rawPrice = match.prices?.price ?? match.prices?.regular_price;
    const price = rawPrice ? parseInt(rawPrice, 10) / divisor : null;
    const inStock = match.is_in_stock ?? match.stock_status === "instock";
    return {
      storeId: store.id,
      price,
      inStock,
      stockLabel: inStock ? "Në gjendje" : "Jo në gjendje",
      productUrl: match.permalink || parent.permalink || null,
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
      if (items.length) {
        const item = items[0];
        if (item.type === "variable") {
          const varResult = await resolveVariation(item);
          if (varResult !== undefined) return varResult;
        }
        return parseWooItem(item);
      }
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
        .map((item) => ({ item, score: strictMatchScore(item.name, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.item;
      if (!best) continue;

      // For variable products (e.g. Shpresa): resolve the specific colour variation
      if (best.type === "variable") {
        const varResult = await resolveVariation(best);
        if (varResult !== undefined) return varResult;
      }

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
      type Candidate = { name: string; url: string; listingPrice: number | null };
      const candidates: Candidate[] = [];

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

        // Extract listing price from the card — "65.800 L" → 65800 (Albanian thousands sep)
        const priceText = $el.find(".price-unit-price, [class*='price-unit']").first().text();
        const priceStr = priceText.replace(/\./g, "").replace(/[^0-9]/g, "");
        const listingPrice = priceStr ? parseInt(priceStr, 10) : null;

        candidates.push({ name, url: href.startsWith("http") ? href : `${storeBase}${href}`, listingPrice });
      });

      if (!candidates.length) continue;

      const scored = candidates
        .map((c) => ({ c, score: strictMatchScore(c.name, [term]) }))
        .filter((x) => x.score > 0);

      // Price sanity check: if listing prices are available, penalise candidates
      // whose price is dramatically lower than the most expensive match (×10).
      // This catches Joy-Con (6,000 L) listed alongside a console (65,800 L).
      if (scored.length > 1) {
        const prices = scored.map((x) => x.c.listingPrice).filter((p): p is number => p !== null && p > 0);
        if (prices.length > 1) {
          const maxPrice = Math.max(...prices);
          scored.forEach((x) => {
            if (x.c.listingPrice !== null && x.c.listingPrice < maxPrice * 0.1) {
              x.score *= 0.1; // Implausibly cheap → heavy penalty
            }
          });
        }
      }

      const best = scored.sort((a, b) => b.score - a.score)[0]?.c;
      if (!best) continue;

      // Use listing price if available (saves a second HTTP request)
      if (best.listingPrice !== null && best.listingPrice > 0) {
        return {
          storeId: store.id,
          price: best.listingPrice,
          inStock: null,
          stockLabel: "E panjohur",
          productUrl: best.url,
          lastChecked: new Date().toISOString(),
        };
      }

      const result = await scrapeShopwareProductPage(best.url, store.id);
      if (result) return result;
    } catch {
      continue;
    }
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── Globe Albania ────────────────────────────────────────────────────────────
// Globe.al is a React SPA backed by a custom REST API at /api/.
// The /api/products endpoint returns the full catalog (no server-side search),
// but supports ?brand= filtering to reduce payload.
// Strategy: extract brand from search terms, fetch filtered products, client-side match.
async function scrapeGlobe(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();
  const queries = buildQueries(searchTerms);

  // Extract brand from first search term (e.g. "Apple iPhone 17" → "Apple")
  const firstTerm = queries[0] ?? "";
  const brand = BRANDS.find((b) => firstTerm.toLowerCase().startsWith(b.toLowerCase()));

  type GlobeItem = {
    id: number;
    name: string;
    price: number;
    salePrice: number | null;
    offerPrice: number | null;
    stock: number;
    brand: string;
  };

  try {
    const params: Record<string, string> = {};
    if (brand) params.brand = brand;

    const { data } = await axios.get(`${store.url}/api/products`, {
      params,
      timeout: 15000,
      headers: HEADERS,
    });

    const items: GlobeItem[] = Array.isArray(data) ? data : [];
    if (!items.length) return notFound(store.id, "Produkti nuk u gjet");

    // Try each query against the catalog, best match wins
    for (const term of queries) {
      const scored = items
        .filter((item) => item.price > 0)
        .map((item) => ({ item, score: strictMatchScore(item.name, [term]) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.item;
      if (!best) continue;

      const price = best.offerPrice ?? best.salePrice ?? best.price;
      const inStock = best.stock > 0;

      return {
        storeId: store.id,
        price,
        inStock,
        stockLabel: inStock ? "Në gjendje" : "Jo në gjendje",
        productUrl: `${store.url}/products/${best.id}`,
        lastChecked,
      };
    }
  } catch {
    // network or parse error
  }

  return notFound(store.id, "Produkti nuk u gjet");
}

// ── Neptun ────────────────────────────────────────────────────────────────────
// Neptun.al is an ASP.NET + AngularJS app. The HTML search page is a shell that
// loads results via AJAX. The actual product search API is:
//   POST /Product/SearchProductsAutocomplete
//   Body: { term, page, itemsPerPage }
//   Header: FROM-ANGULAR: true
// Returns { ProductsResult: { total, results: [{ Title, ActualPrice, Url, ... }] } }
async function scrapeNeptun(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();

  type NeptunItem = {
    Title: string;
    Url: string;
    RegularPrice: number;
    DiscountPrice: number;
    HasDiscount: boolean;
    ActualPrice: number;
    AvailableWebshop: boolean;
    Manufacturer: string;
  };

  // Try ALL queries and pick the overall best match (Neptun's search API
  // is fast, and different query formulations yield very different results —
  // e.g. "Apple iPhone 17" returns cases, "iPhone 17" returns actual phones).
  let bestItem: NeptunItem | null = null;
  let bestScore = 0;

  for (const term of buildQueries(searchTerms)) {
    try {
      const { data } = await axios.post(
        `${store.url}/Product/SearchProductsAutocomplete`,
        { term, page: 1, itemsPerPage: 20 },
        {
          timeout: 10000,
          headers: {
            ...HEADERS,
            "Content-Type": "application/json",
            "FROM-ANGULAR": "true",
          },
        }
      );

      const results: NeptunItem[] = data?.ProductsResult?.results ?? [];
      if (!results.length) continue;

      for (const r of results) {
        if (r.ActualPrice <= 0) continue;
        const score = strictMatchScore(r.Title, [term]);
        if (score > bestScore) {
          bestScore = score;
          bestItem = r;
        }
      }
    } catch {
      continue;
    }
  }

  if (!bestItem) return notFound(store.id, "Produkti nuk u gjet");

  const price = bestItem.HasDiscount && bestItem.DiscountPrice > 0
    ? bestItem.DiscountPrice
    : bestItem.ActualPrice;

  return {
    storeId: store.id,
    price,
    inStock: bestItem.AvailableWebshop,
    stockLabel: bestItem.AvailableWebshop ? "Në gjendje" : "Jo në gjendje",
    productUrl: `${store.url}${bestItem.Url}`,
    lastChecked,
  };
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
      case "globe":
        return scrapeGlobe(store, searchTerms);
      case "neptun":
        return scrapeNeptun(store, searchTerms);
      case "html":
        return scrapeHtmlFallback(store);
    }
  }
}
