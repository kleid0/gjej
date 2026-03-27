// Infrastructure: fetches product specs from manufacturer websites and product pages.
// Used for appliances, laptops, and other non-phone products.
// Uses Schema.org JSON-LD structured data where available.

import axios from "axios";
import type { ProductSpecs, ProductVariant } from "@/src/domain/catalog/Product";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface ManufacturerResult {
  name?: string;
  specs: ProductSpecs;
  officialImages: string[];
  variant: ProductVariant;
  description?: string;
  sourceUrl?: string;
}

// Extract specs from Schema.org JSON-LD on a product page
export async function enrichFromProductPage(url: string): Promise<ManufacturerResult | null> {
  try {
    const { data: html } = await axios.get(url, {
      headers: HEADERS,
      timeout: 10000,
    });
    if (typeof html !== "string") return null;

    // Parse all JSON-LD blocks
    const ldRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    const blocks: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = ldRegex.exec(html)) !== null) blocks.push(m);

    for (const [, raw] of blocks) {
      try {
        const ld = JSON.parse(raw.trim());
        const items: unknown[] = Array.isArray(ld) ? ld : ld?.["@graph"] ? ld["@graph"] : [ld];
        const product = items.find((x: any) => x?.["@type"] === "Product") as any;
        if (!product) continue;

        const specs: ProductSpecs = {};

        // Extract from additionalProperty
        if (Array.isArray(product.additionalProperty)) {
          for (const prop of product.additionalProperty) {
            if (prop?.name && prop?.value != null) {
              specs[prop.name] = String(prop.value);
            }
          }
        }

        // Extract from offers for price (just as spec)
        const offers = Array.isArray(product.offers) ? product.offers : product.offers ? [product.offers] : [];

        // Extract images
        const officialImages: string[] = [];
        if (product.image) {
          const imgs = Array.isArray(product.image) ? product.image : [product.image];
          for (const img of imgs) {
            const src = typeof img === "string" ? img : img?.url || img?.contentUrl;
            if (src && src.startsWith("http")) officialImages.push(src);
          }
        }

        const description = typeof product.description === "string"
          ? product.description.slice(0, 500)
          : undefined;

        // Model number from product
        const modelCode = product.model || product.sku || product.mpn || product.gtin || "";

        const variant: ProductVariant = {
          modelCode: typeof modelCode === "string" ? modelCode : "",
          region: "Unknown",
          confidence: modelCode ? "likely" : "unclear",
        };

        if (Object.keys(specs).length > 0 || officialImages.length > 0) {
          return {
            name: product.name || undefined,
            specs,
            officialImages,
            variant,
            description,
            sourceUrl: url,
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // network error
  }
  return null;
}
