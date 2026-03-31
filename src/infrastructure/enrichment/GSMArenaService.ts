// Infrastructure: fetches phone/tablet specs from GSMArena.
// GSMArena is the most reliable source for exact variant model numbers.
// Fails gracefully — if blocked or unavailable, returns null.

import axios from "axios";
import * as cheerio from "cheerio";
import type { ProductSpecs, ProductVariant } from "@/src/domain/catalog/Product";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface GSMArenaResult {
  name: string;
  deviceUrl: string;
  specs: ProductSpecs;
  officialImages: string[];
  variant: ProductVariant;
  description?: string;
}

// ── Brand-aware model patterns ────────────────────────────────────────────────
// Each brand has its own model number format. Mixing them across brands is
// always wrong (SM-* are Samsung, A#### are Apple, etc.).
const BRAND_MODEL_PATTERNS: Record<string, RegExp> = {
  "Samsung":   /\bSM-[A-Z]\d{3}[A-Z0-9]{1,3}\b/g,
  "Apple":     /\bA\d{4}\b/g,
  "Xiaomi":    /\b(?:M\d{4}[A-Z]\d?|2\d{9,10}[A-Z]?)\b/g,
  "Huawei":    /\b(?:MED|CLT|ELS|NOH|OCE|VRD|DUB|BND|ANE)-[A-Z]{1,2}\d{2,3}[A-Z]?\b/g,
  "OnePlus":   /\bPHB\d{3}\b/g,
  "Motorola":  /\bXT\d{4}-\d\b/g,
};

// Which GSMArena brand name prefix to validate against
// (GSMArena lists devices as "Samsung Galaxy S25" or "Apple iPhone 17 Pro")
const BRAND_GSMARENA_NAME: Record<string, string> = {
  "Samsung":  "samsung",
  "Apple":    "apple",
  "Xiaomi":   "xiaomi",
  "Huawei":   "huawei",
  "OnePlus":  "oneplus",
  "Motorola": "motorola",
  "Nokia":    "nokia",
  "Oppo":     "oppo",
  "Realme":   "realme",
  "Sony":     "sony",
  "LG":       "lg",
};

// ── Region / variant inference ────────────────────────────────────────────────
function inferRegion(
  models: string[],
  brand?: string
): { region: string; confidence: "confirmed" | "likely" | "unclear" } {
  // Samsung: trailing letter indicates region (B=EU, U/U1=US, N=Korea, etc.)
  if (!brand || brand === "Samsung") {
    const euModels = models.filter((m) => /SM-[A-Z0-9]+B$/.test(m));
    const usModels = models.filter((m) => /SM-[A-Z0-9]+U\d?$/.test(m));
    if (euModels.length > 0 && usModels.length === 0) return { region: "EU", confidence: "confirmed" };
    if (usModels.length > 0 && euModels.length === 0) return { region: "US", confidence: "confirmed" };
    if (euModels.length > 0) return { region: "EU", confidence: "likely" };
    if (models.length > 0) return { region: "Unknown", confidence: "unclear" };
  }
  // Apple: model numbers (A####) don't directly encode region; Albanian market
  // gets EU-distributed stock. Mark as EU with "likely" confidence.
  if (brand === "Apple") {
    return models.length > 0
      ? { region: "EU", confidence: "likely" }
      : { region: "Unknown", confidence: "unclear" };
  }
  return { region: models.length > 0 ? "Global" : "Unknown", confidence: "unclear" };
}

function selectAlbanianVariant(models: string[], brand?: string): string {
  if (!models.length) return "";
  if (brand === "Samsung" || models.some((m) => m.startsWith("SM-"))) {
    // Albanian stores stock EU Samsung models (suffix B)
    return models.find((m) => /SM-[A-Z0-9]+B$/.test(m)) ?? models[0];
  }
  // Apple and others: return first model
  return models[0];
}

// ── Validation helpers ────────────────────────────────────────────────────────
// Check that a GSMArena device name is consistent with the expected brand.
// e.g. brand="Apple" → device name must contain "apple" (case-insensitive)
function deviceNameMatchesBrand(deviceName: string, brand: string): boolean {
  const expected = BRAND_GSMARENA_NAME[brand]?.toLowerCase() ?? brand.toLowerCase();
  return deviceName.toLowerCase().includes(expected);
}

// Check that extracted model codes are consistent with the expected brand.
// Samsung models (SM-*) must NOT appear for Apple products, etc.
function modelsMatchBrand(models: string[], brand: string): boolean {
  if (!models.length) return true; // no models → no conflict
  const hasSamsung = models.some((m) => /^SM-/.test(m));
  const hasApple   = models.some((m) => /^A\d{4}$/.test(m));
  if (brand === "Apple"   && hasSamsung) return false;
  if (brand === "Samsung" && hasApple)   return false;
  return true;
}

// ── Strict model matching ─────────────────────────────────────────────────────
// "iPhone 17" must NOT match "iPhone 17 Pro", "iPhone 17 Pro Max", etc.
// After locating the search term inside the result name, rejects if a known
// variant suffix (pro, max, plus, air, ultra, …) follows immediately.
const VARIANT_SUFFIX_RE = /\b(pro|max|plus|air|ultra|edge|mini|fe|lite|note|slim)\b/i;

function isStrictModelMatch(searchName: string, resultName: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/\b(apple|samsung|xiaomi|huawei|motorola|oneplus|oppo|realme|nokia|sony|lg|google|vivo|honor|tecno|infinix|nothing)\b/gi, "")
      .replace(/\s+/g, " ").trim();

  const search = norm(searchName);
  const result = norm(resultName);

  const idx = result.indexOf(search);
  if (idx < 0) return false;

  // Text after the matched portion — must not start with a variant qualifier
  const after = result.slice(idx + search.length).trim();
  return !VARIANT_SUFFIX_RE.test(after);
}

// ── GSMArena search ───────────────────────────────────────────────────────────
// Searches GSMArena and returns the device URL for the best matching result.
// Uses strict model matching so "iPhone 17" never pulls "iPhone 17 Pro Max".
export async function searchGSMArena(productName: string, brand?: string): Promise<string | null> {
  try {
    const url = `https://www.gsmarena.com/results.php3?sQuickSearch=1&fDisplayInchesMin=0&fDisplayInchesMax=0&s=${encodeURIComponent(productName)}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const expectedBrand = brand ? (BRAND_GSMARENA_NAME[brand]?.toLowerCase() ?? brand.toLowerCase()) : null;
    let devicePath: string | null = null;

    $(".makers li").each((_: number, el: any) => {
      if (devicePath) return;
      const link = $(el).find("a").first();
      const href = link.attr("href");
      const resultName = link.find("strong span").last().text().trim() || link.text().trim();

      // Brand gate: reject results from the wrong manufacturer
      if (expectedBrand && !resultName.toLowerCase().includes(expectedBrand)) return;

      // Strict model gate: "iPhone 17" must not match "iPhone 17 Pro Max"
      if (!isStrictModelMatch(productName, resultName)) return;

      if (href && !href.startsWith("http")) {
        devicePath = href;
      }
    });

    return devicePath ? `https://www.gsmarena.com/${devicePath}` : null;
  } catch {
    return null;
  }
}

// ── GSMArena device page ──────────────────────────────────────────────────────
// Fetches and parses a GSMArena device page.
// brand param enables brand-aware model extraction (only Samsung models for
// Samsung devices, only Apple models for Apple devices, etc.).
export async function fetchGSMArenaDevice(deviceUrl: string, brand?: string): Promise<GSMArenaResult | null> {
  try {
    const { data } = await axios.get(deviceUrl, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const name = $(".specs-phone-name-title, h1.specs-phone-name-title").text().trim();
    if (!name) return null;

    // Validate: device name must contain the expected brand
    if (brand && !deviceNameMatchesBrand(name, brand)) return null;

    // Extract specs using data-spec attributes (most reliable)
    const specs: ProductSpecs = {};
    let currentSection = "";

    $("#specs-list table").each((_: number, table: any) => {
      $(table).find("tr").each((_2: number, row: any) => {
        const $row = $(row);
        const th = $row.find("th").text().trim();
        if (th) currentSection = th;
        const ttl = $row.find("td.ttl").text().trim();
        let nfo = $row.find("td.nfo").text().trim().replace(/\s+/g, " ");
        if (ttl && nfo) {
          specs[currentSection ? `${currentSection} · ${ttl}` : ttl] = nfo;
        }
      });
    });

    // Extract model numbers — brand-aware to prevent cross-brand contamination
    const modelsRaw = $("td[data-spec='models']").text().trim() ||
                      specs["Launch · Models"] || specs["Models"] || "";

    let models: string[] = [];
    const brandPattern = brand ? BRAND_MODEL_PATTERNS[brand] : undefined;
    if (brandPattern) {
      // Only extract models matching this brand's pattern
      models = modelsRaw.match(brandPattern) ?? [];
    } else {
      // Unknown brand: try Samsung then Apple (most common)
      const samsungModels = modelsRaw.match(BRAND_MODEL_PATTERNS["Samsung"]) ?? [];
      const appleModels   = modelsRaw.match(BRAND_MODEL_PATTERNS["Apple"])   ?? [];
      models = [...samsungModels, ...appleModels];
    }

    // Deduplicate
    models = models.filter((m, i) => models.indexOf(m) === i);

    // Final safety check: ensure extracted models are consistent with brand
    if (brand && !modelsMatchBrand(models, brand)) return null;

    const regionInfo   = inferRegion(models, brand);
    const primaryModel = selectAlbanianVariant(models, brand);

    const variant: ProductVariant = {
      modelCode:  primaryModel || "",
      region:     regionInfo.region,
      confidence: regionInfo.confidence,
      notes:      models.length > 0 ? `Modelet: ${models.join(", ")}` : undefined,
    };

    // Extract official images
    const officialImages: string[] = [];
    $("div.pictures-list img, img.phone-big-photo").each((_: number, img: any) => {
      const src = $(img).attr("src") || $(img).attr("data-src") || "";
      if (src && src.includes("gsmarena") && !officialImages.includes(src)) {
        officialImages.push(src);
      }
    });
    const mainImg = $("div.review-header img").attr("src") || $("div.specs-photo img").attr("src");
    if (mainImg && mainImg.startsWith("http")) officialImages.unshift(mainImg);

    const description = $("p.article-info-meta-text, .review-intro-text, .article-intro")
      .first().text().trim().slice(0, 500) || undefined;

    // Build curated specs subset
    const curatedSpecs: ProductSpecs = {};
    for (const key of Object.keys(specs)) {
      const shortKey = key.replace(/^[^·]+·\s*/, "");
      const section  = key.split(" · ")[0];
      if (["Display", "Platform", "Memory", "Main Camera", "Battery", "Launch", "Network", "Misc"].includes(section)) {
        curatedSpecs[`${section}: ${shortKey}`] = specs[key];
      }
    }

    return { name, deviceUrl, specs: curatedSpecs, officialImages, variant, description };
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function enrichPhone(productName: string, brand?: string): Promise<GSMArenaResult | null> {
  const deviceUrl = await searchGSMArena(productName, brand);
  if (!deviceUrl) return null;

  const result = await fetchGSMArenaDevice(deviceUrl, brand);
  if (!result) return null;

  // Final guard: if a brand is known, the returned device must belong to it
  if (brand && !deviceNameMatchesBrand(result.name, brand)) return null;

  return result;
}
