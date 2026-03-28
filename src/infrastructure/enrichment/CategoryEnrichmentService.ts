// Infrastructure: fetches product specs from multiple sources for non-phone products.
// Tries manufacturer websites (Samsung AL, LG, etc.), store product pages (enhanced
// extraction with JSON-LD, OG tags, HTML tables), and Shopify JSON API (AlbaGame).
// Falls back gracefully — returns null if no source yields data.

import axios from "axios";
import * as cheerio from "cheerio";
import type { ProductSpecs, ProductVariant, Product } from "@/src/domain/catalog/Product";
import { enrichFromProductPage, type ManufacturerResult } from "./ManufacturerService";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,sq;q=0.8",
};

export interface CategoryEnrichmentResult {
  specs: ProductSpecs;
  officialImages: string[];
  variant: ProductVariant;
  description?: string;
  source: string; // human-readable source name for attribution
  sourceUrl?: string;
}

// ── Samsung AL ──────────────────────────────────────────────────────────────────
// Samsung's Albanian site has JSON-LD Product schema with full specs.
// We construct a search URL and find the product page, then extract JSON-LD.
async function enrichFromSamsungAL(
  product: Product
): Promise<CategoryEnrichmentResult | null> {
  try {
    // Extract Samsung model number from family name (e.g. QE65Q60DAUXXH)
    const modelMatch = product.family.match(
      /\b([A-Z]{2}\d{2,3}[A-Z0-9]{3,})\b/
    );
    const searchQuery = modelMatch
      ? modelMatch[1]
      : product.family
          .replace(/televizor\s*/i, "")
          .replace(/,.*$/, "")
          .trim();

    const searchUrl = `https://www.samsung.com/al/search/?searchvalue=${encodeURIComponent(searchQuery)}`;
    const { data: searchHtml } = await axios.get(searchUrl, {
      headers: HEADERS,
      timeout: 10000,
    });

    // Find product link in search results
    const $search = cheerio.load(searchHtml);
    let productPath: string | null = null;

    $search("a").each((_: number, el: unknown) => {
      if (productPath) return;
      const href = $search(el as any).attr("href") || "";
      if (
        href.includes("/al/") &&
        (href.includes("/tvs/") ||
          href.includes("/smartphones/") ||
          href.includes("/monitors/") ||
          href.includes("/computing/") ||
          href.includes("/home-appliances/") ||
          href.includes("/audio-sound/"))
      ) {
        productPath = href;
      }
    });

    const productUrl = productPath
      ? (productPath as string).startsWith("http")
        ? productPath
        : `https://www.samsung.com${productPath}`
      : null;

    if (!productUrl) return null;

    const result = await enrichFromProductPage(productUrl);
    if (!result || Object.keys(result.specs).length === 0) return null;

    return {
      specs: result.specs,
      officialImages: result.officialImages,
      variant: result.variant,
      description: result.description,
      source: "Samsung Albania",
      sourceUrl: productUrl,
    };
  } catch {
    return null;
  }
}

// ── LG AL ───────────────────────────────────────────────────────────────────────
async function enrichFromLGAL(
  product: Product
): Promise<CategoryEnrichmentResult | null> {
  try {
    const modelMatch = product.family.match(
      /\b(\d{2}[A-Z]{2,4}\d{2,4}[A-Z0-9]*)\b/
    );
    if (!modelMatch) return null;

    const model = modelMatch[1];
    const productUrl = `https://www.lg.com/al/tvs/${model.toLowerCase()}/`;
    const result = await enrichFromProductPage(productUrl);
    if (!result || Object.keys(result.specs).length === 0) return null;

    return {
      specs: result.specs,
      officialImages: result.officialImages,
      variant: result.variant,
      description: result.description,
      source: "LG Albania",
      sourceUrl: productUrl,
    };
  } catch {
    return null;
  }
}

// ── Enhanced HTML extraction ────────────────────────────────────────────────────
// Goes beyond JSON-LD: extracts specs from HTML tables, definition lists,
// meta/OG tags, and structured product divs. Used for store product pages.
async function extractProductDataFromHTML(
  url: string,
  sourceName: string
): Promise<CategoryEnrichmentResult | null> {
  try {
    const { data: html } = await axios.get(url, {
      headers: HEADERS,
      timeout: 10000,
    });
    if (typeof html !== "string") return null;

    const $ = cheerio.load(html);
    const specs: ProductSpecs = {};
    const images: string[] = [];
    let description = "";

    // 1. Try JSON-LD first (via ManufacturerService)
    const jsonLdResult = await enrichFromProductPage(url);
    if (jsonLdResult && Object.keys(jsonLdResult.specs).length > 0) {
      return {
        specs: jsonLdResult.specs,
        officialImages: jsonLdResult.officialImages,
        variant: jsonLdResult.variant,
        description: jsonLdResult.description,
        source: sourceName,
        sourceUrl: url,
      };
    }

    // 2. Extract from HTML tables (common for spec sheets)
    let currentSection = "Tjera";
    $("table").each((_: number, table: unknown) => {
      const $table = $(table as any);
      // Check if it looks like a spec table
      const rows = $table.find("tr");
      if (rows.length < 2 || rows.length > 100) return;

      rows.each((_2: number, row: unknown) => {
        const $row = $(row as any);
        const cells = $row.find("td, th");

        // Section header (single cell spanning full width)
        if (cells.length === 1) {
          const text = cells.first().text().trim();
          if (text.length > 0 && text.length < 60) currentSection = text;
          return;
        }

        if (cells.length >= 2) {
          const key = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          if (
            key &&
            value &&
            key.length < 80 &&
            value.length < 300 &&
            key !== value
          ) {
            const fullKey =
              currentSection !== "Tjera"
                ? `${currentSection}: ${key}`
                : key;
            specs[fullKey] = value;
          }
        }
      });
    });

    // 3. Extract from definition lists (<dl><dt><dd>)
    $("dl").each((_: number, dl: unknown) => {
      const $dl = $(dl as any);
      const dts = $dl.find("dt");
      const dds = $dl.find("dd");
      const count = Math.min(dts.length, dds.length);
      for (let i = 0; i < count; i++) {
        const key = $(dts[i]).text().trim();
        const value = $(dds[i]).text().trim();
        if (key && value && key.length < 80 && value.length < 300) {
          specs[key] = value;
        }
      }
    });

    // 4. Extract from structured attribute divs (Shopware/WooCommerce patterns)
    $(
      ".product-detail-properties .property-item, .woocommerce-product-attributes tr, .product-attributes li"
    ).each((_: number, el: unknown) => {
      const $el = $(el as any);
      const key = (
        $el.find(".property-label, th, .attr-label").text() || ""
      ).trim();
      const value = (
        $el.find(".property-value, td, .attr-value").text() || ""
      ).trim();
      if (key && value && key.length < 80 && value.length < 300) {
        specs[key] = value;
      }
    });

    // 5. Extract OG/meta description
    description =
      $('meta[property="og:description"]').attr("content")?.trim() ||
      $('meta[name="description"]').attr("content")?.trim() ||
      "";
    description = description.slice(0, 500);

    // 6. Extract images
    const ogImage = $('meta[property="og:image"]').attr("content");
    if (ogImage && ogImage.startsWith("http")) images.push(ogImage);

    $("img").each((_: number, img: unknown) => {
      const src =
        $(img as any).attr("src") ||
        $(img as any).attr("data-src") ||
        "";
      if (
        src.startsWith("http") &&
        (src.includes("product") || src.includes("media")) &&
        !src.includes("logo") &&
        !src.includes("icon") &&
        !images.includes(src) &&
        images.length < 8
      ) {
        images.push(src);
      }
    });

    if (Object.keys(specs).length === 0 && images.length === 0 && !description)
      return null;

    return {
      specs,
      officialImages: images,
      variant: {
        modelCode: "",
        region: "Unknown",
        confidence: "unclear",
      },
      description: description || undefined,
      source: sourceName,
      sourceUrl: url,
    };
  } catch {
    return null;
  }
}

// ── Shopify JSON API ────────────────────────────────────────────────────────────
// AlbaGame uses Shopify. Their product pages expose /products/{handle}.json
// which returns structured data without scraping.
async function enrichFromShopify(
  storeUrl: string,
  productHandle: string
): Promise<CategoryEnrichmentResult | null> {
  try {
    const apiUrl = `${storeUrl}/products/${productHandle}.json`;
    const { data } = await axios.get(apiUrl, {
      headers: HEADERS,
      timeout: 10000,
    });
    const product = data?.product;
    if (!product) return null;

    const specs: ProductSpecs = {};
    const images: string[] = [];

    // Extract images
    if (Array.isArray(product.images)) {
      for (const img of product.images.slice(0, 8)) {
        if (img?.src) images.push(img.src);
      }
    }

    // Parse body_html for specs
    if (product.body_html) {
      const $ = cheerio.load(product.body_html);

      // Extract from lists
      $("li").each((_: number, li: unknown) => {
        const text = $(li as any).text().trim();
        const colonIdx = text.indexOf(":");
        if (colonIdx > 0 && colonIdx < 60) {
          const key = text.slice(0, colonIdx).trim();
          const value = text.slice(colonIdx + 1).trim();
          if (key && value && value.length < 300) specs[key] = value;
        }
      });

      // Extract from tables
      $("table tr").each((_: number, row: unknown) => {
        const cells = $(row as any).find("td, th");
        if (cells.length >= 2) {
          const key = $(cells[0]).text().trim();
          const value = $(cells[1]).text().trim();
          if (key && value && key.length < 80 && value.length < 300)
            specs[key] = value;
        }
      });
    }

    // Extract product type/vendor as basic info
    if (product.product_type) specs["Type"] = product.product_type;
    if (product.vendor) specs["Brand"] = product.vendor;

    // Extract tags as features
    if (Array.isArray(product.tags) && product.tags.length > 0) {
      specs["Tags"] = product.tags.slice(0, 10).join(", ");
    }

    const description = product.body_html
      ? cheerio
          .load(product.body_html)
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 500)
      : undefined;

    if (
      Object.keys(specs).length === 0 &&
      images.length === 0 &&
      !description
    )
      return null;

    return {
      specs,
      officialImages: images,
      variant: {
        modelCode: product.variants?.[0]?.sku || "",
        region: "Unknown",
        confidence: "unclear",
      },
      description,
      source: "AlbaGame",
      sourceUrl: `${storeUrl}/products/${productHandle}`,
    };
  } catch {
    return null;
  }
}

// ── Manufacturer URL builders ───────────────────────────────────────────────────
// Constructs manufacturer product page URLs based on brand.
function getManufacturerSearchUrls(
  product: Product
): Array<{ url: string; source: string }> {
  const urls: Array<{ url: string; source: string }> = [];
  const brand = product.brand.toLowerCase();
  const family = product.family;

  // Extract model number patterns from family name
  const modelPatterns = family.match(
    /\b[A-Z]{1,3}\d{2,4}[A-Z0-9]{2,}[A-Z0-9/]*\b/g
  );
  const modelNumber = modelPatterns?.[0] || product.modelNumber;

  switch (brand) {
    case "samsung":
      if (modelNumber) {
        urls.push({
          url: `https://www.samsung.com/al/search/?searchvalue=${encodeURIComponent(modelNumber)}`,
          source: "Samsung Albania",
        });
      }
      break;
    case "lg":
      if (modelNumber) {
        urls.push({
          url: `https://www.lg.com/al/search/result?keyword=${encodeURIComponent(modelNumber)}`,
          source: "LG Albania",
        });
      }
      break;
    case "hp":
    case "hewlett-packard":
      if (modelNumber) {
        urls.push({
          url: `https://support.hp.com/al-en/product/details/${encodeURIComponent(modelNumber)}`,
          source: "HP Support",
        });
      }
      break;
    case "dell":
      if (modelNumber) {
        urls.push({
          url: `https://www.dell.com/support/home/al/en/albsdt1/product-support/servicetag/${encodeURIComponent(modelNumber)}`,
          source: "Dell Support",
        });
      }
      break;
    case "lenovo":
      if (modelNumber) {
        urls.push({
          url: `https://pcsupport.lenovo.com/al/en/products/${encodeURIComponent(modelNumber)}`,
          source: "Lenovo Support",
        });
      }
      break;
  }

  return urls;
}

// ── Spec parser from product name ──────────────────────────────────────────────
// Albanian stores embed detailed specs in product names (e.g.
// "Dell Latitude 7410 14″, 16GB, 512GB SSD, Core i5").
// This parser extracts structured specs from the family name + category context.
function parseSpecsFromName(product: Product): CategoryEnrichmentResult | null {
  const family = product.family;
  const category = product.category;
  const subcategory = product.subcategory.toLowerCase();
  const specs: ProductSpecs = {};

  // Brand is always known
  if (product.brand) specs["Marka"] = product.brand;

  // Model number
  if (product.modelNumber && product.modelNumber.length > 2) {
    specs["Numri i modelit"] = product.modelNumber;
  }

  // ── Laptop / Desktop / Monitor specs ────────────────────────────────
  if (category === "kompjutera" || subcategory.includes("laptop") || subcategory.includes("desktop") || subcategory.includes("monitor")) {
    // Screen size: 14", 15.6″, 27", etc.
    const screenMatch = family.match(/(\d{2}(?:\.\d)?)[″"']\s*(?:,|\s|$)/);
    if (screenMatch) specs["Ekrani: Madhësia"] = `${screenMatch[1]}″`;

    // Touchscreen
    if (/touchscreen/i.test(family)) specs["Ekrani: Lloji"] = "Touchscreen";

    // RAM: 8GB, 16GB, 32GB
    const ramMatch = family.match(/(\d+)\s*GB(?:\s*RAM)?/i);
    if (ramMatch) specs["Memoria: RAM"] = `${ramMatch[1]} GB`;

    // Storage: 256GB SSD, 512GB, 1TB SSD
    const storageMatch = family.match(/(\d+)\s*(GB|TB)\s*(SSD|HDD|NVMe)?/gi);
    if (storageMatch && storageMatch.length > 0) {
      // Take the storage mention (skip RAM which is first match usually)
      const storageStr = ramMatch
        ? storageMatch.find((s) => s !== ramMatch[0]) || storageMatch[storageMatch.length - 1]
        : storageMatch[0];
      if (storageStr) specs["Hapësira: Disku"] = storageStr.trim();
    }

    // CPU: Core i5, Core i7, Core Ultra 7, Snapdragon X Elite, Ryzen 5, etc.
    const cpuMatch = family.match(
      /(?:Core[™\s]*(?:Ultra\s*)?[ui]\d|Snapdragon\s*X\s*\w+|Ryzen\s*\d\s*\w*|Pentium|Celeron|Athlon|M[1-4]\s*(?:Pro|Max|Ultra)?)/i
    );
    if (cpuMatch) specs["Procesori"] = cpuMatch[0].replace(/[™]/g, "").trim();

    // Resolution patterns
    const resMatch = family.match(
      /\b(FHD\+?|QHD\+?|4K|UHD|2K|WQHD|Full\s*HD|HD\+?|1080p|1440p|2160p)\b/i
    );
    if (resMatch) specs["Ekrani: Rezolucioni"] = resMatch[1];
  }

  // ── TV specs ────────────────────────────────────────────────────────
  if (subcategory === "tv" || /televizor/i.test(family)) {
    // Screen size
    const tvSizeMatch = family.match(/(\d{2,3})[″"']/);
    if (tvSizeMatch) specs["Ekrani: Madhësia"] = `${tvSizeMatch[1]}″`;

    // Panel technology
    const panelMatch = family.match(
      /\b(OLED|QLED|Neo\s*QLED|Mini\s*LED|LED|LCD|NanoCell|ULED)\b/i
    );
    if (panelMatch) specs["Ekrani: Teknologjia"] = panelMatch[1].toUpperCase();

    // Resolution
    const tvResMatch = family.match(
      /\b(8K|4K\s*Ultra\s*HD|4K|UHD|Full\s*HD|HD|FHD)\b/i
    );
    if (tvResMatch) specs["Ekrani: Rezolucioni"] = tvResMatch[1];

    // Smart TV
    if (/smart\s*tv/i.test(family)) specs["Funksione: Smart TV"] = "Po";

    // Wi-Fi
    if (/wi-?fi/i.test(family)) specs["Lidhja: Wi-Fi"] = "Po";

    // Model number from name (Samsung TV model codes like QE65Q60DAUXXH)
    const tvModelMatch = family.match(/\b([A-Z]{2}\d{2,3}[A-Z]\d{2,}[A-Z0-9]*)\b/);
    if (tvModelMatch) specs["Numri i modelit"] = tvModelMatch[1];
  }

  // ── Gaming console specs ────────────────────────────────────────────
  if (subcategory === "gaming" || subcategory.includes("konsol")) {
    // Nintendo Switch specs (well-known, hardcoded)
    if (/nintendo\s*switch.*2\b/i.test(family) && !/lite/i.test(family) && !/oled/i.test(family)) {
      specs["Ekrani"] = "7.9″ LCD, 1080p";
      specs["Procesori"] = "NVIDIA T239 (Custom Ampere)";
      specs["Memoria: RAM"] = "12 GB";
      specs["Hapësira"] = "256 GB";
      specs["Lidhja"] = "Wi-Fi 6, Bluetooth 5.2, USB-C";
      specs["Rezolucioni (Docked)"] = "Deri 4K";
      specs["Kontrollerët"] = "Joy-Con magnetik";
      specs["Pesha"] = "~320g (pa Joy-Con)";
      specs["Bateria"] = "~4.5 orë lojë";
    } else if (/nintendo\s*switch.*oled/i.test(family)) {
      specs["Ekrani"] = "7″ OLED, 720p";
      specs["Procesori"] = "NVIDIA Custom Tegra";
      specs["Memoria: RAM"] = "4 GB";
      specs["Hapësira"] = "64 GB";
      specs["Lidhja"] = "Wi-Fi, Bluetooth 4.1, USB-C";
      specs["Rezolucioni (Docked)"] = "1080p";
    } else if (/nintendo\s*switch\s*lite/i.test(family)) {
      specs["Ekrani"] = "5.5″ LCD, 720p";
      specs["Procesori"] = "NVIDIA Custom Tegra";
      specs["Memoria: RAM"] = "4 GB";
      specs["Hapësira"] = "32 GB";
      specs["Lidhja"] = "Wi-Fi, Bluetooth 4.1, USB-C";
      specs["Pesha"] = "275g";
    } else if (/ps5|playstation\s*5/i.test(family)) {
      specs["Procesori"] = "AMD Zen 2, 8 bërthama, 3.5 GHz";
      specs["GPU"] = "AMD RDNA 2, 10.28 TFLOPS";
      specs["Memoria: RAM"] = "16 GB GDDR6";
      specs["Hapësira"] = "825 GB SSD";
      specs["Rezolucioni"] = "Deri 4K @ 120Hz";
      specs["Lidhja"] = "Wi-Fi 6, Bluetooth 5.1, HDMI 2.1";
    } else if (/xbox\s*series\s*x/i.test(family)) {
      specs["Procesori"] = "AMD Zen 2, 8 bërthama, 3.8 GHz";
      specs["GPU"] = "AMD RDNA 2, 12 TFLOPS";
      specs["Memoria: RAM"] = "16 GB GDDR6";
      specs["Hapësira"] = "1 TB SSD";
      specs["Rezolucioni"] = "Deri 4K @ 120Hz";
      specs["Lidhja"] = "Wi-Fi, HDMI 2.1, USB 3.1";
    } else if (/xbox\s*series\s*s/i.test(family)) {
      specs["Procesori"] = "AMD Zen 2, 8 bërthama, 3.6 GHz";
      specs["GPU"] = "AMD RDNA 2, 4 TFLOPS";
      specs["Memoria: RAM"] = "10 GB GDDR6";
      specs["Hapësira"] = "512 GB SSD";
      specs["Rezolucioni"] = "Deri 1440p @ 120Hz";
    }

    // Bundle info
    if (/\+\s*.+/.test(family)) {
      const bundleMatch = family.match(/\+\s*(.+)/);
      if (bundleMatch) specs["Paketa përfshin"] = bundleMatch[1].trim();
    }
  }

  // ── Audio / Headphone specs ─────────────────────────────────────────
  if (subcategory.includes("audio") || subcategory.includes("kufje") || /headphon|earbuds|speaker|altoparlant/i.test(family)) {
    if (/wireless|bluetooth|pa\s*tel/i.test(family)) specs["Lidhja"] = "Pa tel (Bluetooth)";
    if (/anc|noise\s*cancell/i.test(family)) specs["ANC"] = "Po";
    const driverMatch = family.match(/(\d+)\s*mm/);
    if (driverMatch) specs["Driver"] = `${driverMatch[1]}mm`;
  }

  // ── Appliance specs ─────────────────────────────────────────────────
  if (category === "shtepi") {
    // Power/Wattage
    const wattMatch = family.match(/(\d+)\s*W\b/);
    if (wattMatch) specs["Fuqia"] = `${wattMatch[1]}W`;

    // Capacity (liters)
    const literMatch = family.match(/(\d+(?:\.\d+)?)\s*[Ll]\b/);
    if (literMatch) specs["Kapaciteti"] = `${literMatch[1]}L`;

    // Voltage
    const voltMatch = family.match(/(\d+)\s*V\b/);
    if (voltMatch) specs["Tensioni"] = `${voltMatch[1]}V`;
  }

  // ── Common extractors for all categories ────────────────────────────
  // Color
  const colorMap: Record<string, string> = {
    "i zi": "E zezë", "e zezë": "E zezë", "black": "E zezë",
    "i bardhë": "E bardhë", "e bardhë": "E bardhë", "white": "E bardhë",
    "blu": "Blu", "blue": "Blu",
    "kuq": "E kuqe", "red": "E kuqe",
    "silver": "Argjend", "grey": "Gri", "gray": "Gri",
    "gold": "Ar", "green": "Jeshile", "pink": "Rozë",
  };
  for (const [pattern, label] of Object.entries(colorMap)) {
    if (family.toLowerCase().includes(pattern)) {
      specs["Ngjyra"] = label;
      break;
    }
  }

  // Category / Subcategory
  specs["Kategoria"] = product.subcategory || product.category;

  // Remove brand-only results (need at least 3 specs to be useful)
  const specCount = Object.keys(specs).filter((k) => k !== "Marka" && k !== "Kategoria" && k !== "Numri i modelit").length;
  if (specCount < 1) return null;

  return {
    specs,
    officialImages: product.imageUrl ? [product.imageUrl] : [],
    variant: {
      modelCode: product.modelNumber || "",
      region: "Unknown",
      confidence: "unclear",
    },
    source: "informacioni i produktit",
    description: undefined,
  };
}

// ── Main enrichment router ──────────────────────────────────────────────────────
// Tries multiple sources in priority order based on brand and category.
export async function enrichNonPhoneProduct(
  product: Product
): Promise<CategoryEnrichmentResult | null> {
  const brand = product.brand.toLowerCase();

  // 1. Samsung brand → try Samsung AL site (confirmed JSON-LD)
  if (brand === "samsung") {
    const samsung = await enrichFromSamsungAL(product);
    if (samsung) return samsung;
  }

  // 2. LG brand → try LG AL site
  if (brand === "lg") {
    const lg = await enrichFromLGAL(product);
    if (lg) return lg;
  }

  // 3. Try store product page URLs from searchTerms (enhanced extraction)
  for (const term of product.searchTerms) {
    if (term.startsWith("https://")) {
      const storeName = term.includes("foleja.al")
        ? "Foleja.al"
        : term.includes("shpresa.al")
          ? "Shpresa Group"
          : term.includes("neptun.al")
            ? "Neptun"
            : term.includes("pcstore.al")
              ? "PC Store"
              : term.includes("globe.al")
                ? "Globe Albania"
                : term.includes("albagame.al")
                  ? "AlbaGame"
                  : "dyqani";
      const result = await extractProductDataFromHTML(term, storeName);
      if (result && Object.keys(result.specs).length > 3) return result;
    }
  }

  // 4. Try AlbaGame Shopify JSON API (if product is from AlbaGame)
  if (product.id.startsWith("albagame-")) {
    const handle = product.id.slice("albagame-".length);
    const shopify = await enrichFromShopify(
      "https://www.albagame.al",
      handle
    );
    if (shopify && Object.keys(shopify.specs).length > 2) return shopify;
  }

  // 5. Parse specs from product name (always available, no network calls)
  const parsed = parseSpecsFromName(product);
  if (parsed) return parsed;

  return null;
}
