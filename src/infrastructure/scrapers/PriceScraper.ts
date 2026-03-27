// Infrastructure: price scraper — fetches live prices from a store's product page

import axios from "axios";
import * as cheerio from "cheerio";
import type { IPriceScraper } from "@/src/application/pricing/PriceQuery";
import type { Store } from "@/src/domain/pricing/Store";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Upgrade-Insecure-Requests": "1",
};

function extractPrice(text: string): number | null {
  const cleaned = text.replace(/\s/g, "");
  const match = cleaned.match(/[\d.,]+/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, "").replace(/\.(?=\d{3})/g, ""));
  return isNaN(num) ? null : num;
}

function detectStock(
  $: ReturnType<typeof cheerio.load>,
  selectors: string[],
  inStockTexts: string[],
  outOfStockTexts: string[]
): { inStock: boolean | null; stockLabel: string } {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().trim().toLowerCase();
      if (outOfStockTexts.some((t) => text.includes(t))) return { inStock: false, stockLabel: el.text().trim() };
      if (inStockTexts.some((t) => text.includes(t))) return { inStock: true, stockLabel: el.text().trim() };
      return { inStock: null, stockLabel: el.text().trim() || "E panjohur" };
    }
  }
  return { inStock: null, stockLabel: "E panjohur" };
}

export class PriceScraper implements IPriceScraper {
  async scrape(store: Store, searchTerms: string[]): Promise<ScrapedPrice> {
    const lastChecked = new Date().toISOString();
    let lastError = "Produkti nuk u gjet në këtë dyqan";

    for (const term of searchTerms) {
      for (const searchUrl of store.searchUrls(term)) {
        try {
          const { data } = await axios.get(searchUrl, { timeout: 10000, headers: BROWSER_HEADERS });
          const $ = cheerio.load(data);

          // Collect all candidate links, then pick the one whose anchor text
          // best matches the search term (avoids grabbing a random accessory first)
          const termLower = term.toLowerCase();
          const termWords = termLower.split(/\s+/).filter(Boolean);
          let productUrl: string | null = null;
          let bestScore = -1;

          for (const sel of store.selectors.productLink) {
            $(sel).each((_: number, el: any) => {
              const href = $(el).attr("href");
              if (!href) return;
              const text = ($(el).text().trim() || $(el).attr("title") || "").toLowerCase();
              const score = termWords.filter((w) => text.includes(w)).length;
              if (score > bestScore) {
                bestScore = score;
                productUrl = href.startsWith("http") ? href : `${store.url}${href}`;
              }
            });
            if (productUrl) break;
          }
          if (!productUrl) continue;

          const productPage = await axios.get(productUrl, {
            timeout: 10000,
            headers: { ...BROWSER_HEADERS, "Referer": searchUrl },
          });
          const $p = cheerio.load(productPage.data);

          let price: number | null = null;
          for (const sel of store.selectors.price) {
            const priceText = $p(sel).first().text().trim();
            if (priceText) {
              price = extractPrice(priceText);
              if (price !== null) break;
            }
          }

          const { inStock, stockLabel } = detectStock(
            $p,
            store.selectors.stock,
            store.selectors.inStockText,
            store.selectors.outOfStockText
          );

          return { storeId: store.id, price, inStock, stockLabel, productUrl, lastChecked };
        } catch (err: unknown) {
          lastError = `Nuk u gjet: ${(err instanceof Error ? err.message : String(err)).slice(0, 80)}`;
        }
      }
    }

    return { storeId: store.id, price: null, inStock: null, stockLabel: "E panjohur", productUrl: null, lastChecked, error: lastError };
  }
}
