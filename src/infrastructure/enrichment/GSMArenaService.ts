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

// Map from region suffix in model numbers to region name
function inferRegion(models: string[]): { region: string; confidence: "confirmed" | "likely" | "unclear" } {
  // Samsung model suffixes: B=Europe, U=USA, W=Canada, N=Korea, 0=China
  const euModels = models.filter((m) => /SM-[A-Z0-9]+B$/.test(m));
  const usModels = models.filter((m) => /SM-[A-Z0-9]+U[01]?$/.test(m));
  if (euModels.length > 0 && usModels.length === 0) return { region: "EU", confidence: "confirmed" };
  if (usModels.length > 0 && euModels.length === 0) return { region: "US", confidence: "confirmed" };
  // For Albanian market, EU variant is most common (Albania is in Europe)
  if (euModels.length > 0) return { region: "EU", confidence: "likely" };
  return { region: "Unknown", confidence: "unclear" };
}

// Find the most likely model number sold in Albanian stores
// Albanian stores are European → prefer EU variant
function selectAlbanianVariant(models: string[]): string {
  if (!models.length) return "";
  // Prefer EU Samsung models (suffix B)
  const euModel = models.find((m) => /SM-[A-Z0-9]+B$/.test(m));
  if (euModel) return euModel;
  // Prefer international Apple models (contain LL/A for US or international)
  // Apple model numbers in Europe often end with /QL, /B, /NF etc.
  // Just return first model as fallback
  return models[0];
}

export async function searchGSMArena(productName: string): Promise<string | null> {
  try {
    const url = `https://www.gsmarena.com/results.php3?sQuickSearch=1&fDisplayInchesMin=0&fDisplayInchesMax=0&s=${encodeURIComponent(productName)}`;
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    // GSMArena search results are in .makers ul li
    let devicePath: string | null = null;
    $(".makers li").each((_: number, el: any) => {
      if (devicePath) return;
      const link = $(el).find("a").first();
      const href = link.attr("href");
      const name = link.find("strong span").last().text().trim() || link.text().trim();
      // Pick first result that matches the search
      if (href && !href.startsWith("http")) {
        devicePath = href;
      }
    });

    return devicePath ? `https://www.gsmarena.com/${devicePath}` : null;
  } catch {
    return null;
  }
}

export async function fetchGSMArenaDevice(deviceUrl: string): Promise<GSMArenaResult | null> {
  try {
    const { data } = await axios.get(deviceUrl, { headers: HEADERS, timeout: 10000 });
    const $ = cheerio.load(data);

    const name = $(".specs-phone-name-title, h1.specs-phone-name-title").text().trim();
    if (!name) return null;

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
          const specKey = currentSection ? `${currentSection} · ${ttl}` : ttl;
          specs[specKey] = nfo;
        }
      });
    });

    // Extract model numbers
    const modelsRaw = $("td[data-spec='models']").text().trim() ||
                      specs["Launch · Models"] || specs["Models"] || "";
    const samsungModels = modelsRaw.match(/SM-[A-Z0-9]+/g) ?? [];
    const appleModels = modelsRaw.match(/A\d{4}/g) ?? [];
    const allModels = [...samsungModels, ...appleModels];

    // Remove duplicate models
    const models = allModels.filter((m, i) => allModels.indexOf(m) === i);

    // Determine variant for Albanian market
    const regionInfo = inferRegion(models);
    const primaryModel = selectAlbanianVariant(models);

    const variant: ProductVariant = {
      modelCode: primaryModel || "",
      region: regionInfo.region,
      confidence: regionInfo.confidence,
      notes: models.length > 0 ? `Modelet: ${models.join(", ")}` : undefined,
    };

    // Extract official images from the phone photos page
    const officialImages: string[] = [];
    $("div.pictures-list img, img.phone-big-photo").each((_: number, img: any) => {
      const src = $(img).attr("src") || $(img).attr("data-src") || "";
      if (src && src.includes("gsmarena") && !officialImages.includes(src)) {
        officialImages.push(src);
      }
    });
    // Also check for the main phone image
    const mainImg = $("div.review-header img").attr("src") || $("div.specs-photo img").attr("src");
    if (mainImg && mainImg.startsWith("http")) officialImages.unshift(mainImg);

    // Short description
    const description = $("p.article-info-meta-text, .review-intro-text, .article-intro").first().text().trim().slice(0, 500) || undefined;

    // Build a curated specs subset (most important specs for display)
    const importantKeys = [
      "Display · Size", "Display · Resolution", "Display · Type",
      "Platform · OS", "Platform · Chipset", "Platform · CPU", "Platform · GPU",
      "Memory · Internal",
      "Main Camera · Triple", "Main Camera · Dual", "Main Camera · Single",
      "Battery · Type",
      "Sound · 3.5mm jack", "Sound · USB",
      "Network · Technology",
      "Misc · Models", "Misc · Colors",
      "Launch · Announced", "Launch · Status",
    ];

    const curatedSpecs: ProductSpecs = {};
    for (const key of Object.keys(specs)) {
      const shortKey = key.replace(/^[^·]+·\s*/, ""); // "Display · Size" → "Size"
      const section = key.split(" · ")[0];
      // Include all specs from important sections
      if (["Display", "Platform", "Memory", "Main Camera", "Battery", "Launch", "Network", "Misc"].includes(section)) {
        curatedSpecs[`${section}: ${shortKey}`] = specs[key];
      }
    }

    return { name, deviceUrl, specs: curatedSpecs, officialImages, variant, description };
  } catch {
    return null;
  }
}

export async function enrichPhone(productName: string): Promise<GSMArenaResult | null> {
  const deviceUrl = await searchGSMArena(productName);
  if (!deviceUrl) return null;
  return fetchGSMArenaDevice(deviceUrl);
}
