import axios from "axios";
import * as cheerio from "cheerio";
import { Store } from "./stores";

export interface ScrapedPrice {
  storeId: string;
  price: number | null;
  inStock: boolean | null;  // null = could not determine
  stockLabel: string;       // raw text from store
  productUrl: string | null;
  lastChecked: string;      // ISO timestamp
  error?: string;
}

const DISCLAIMER =
  "Çmimi dhe stoku i shfaqur janë siç reklamohen nga dyqani. Gjej nuk verifikon disponueshmërinë reale të produktit.";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

function extractPrice(text: string): number | null {
  // Match Albanian price formats: 12,500 ALL  /  12.500  /  12500  /  €120
  const cleaned = text.replace(/\s/g, "");
  const match = cleaned.match(/[\d.,]+/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(/,/g, "").replace(/\.(?=\d{3})/g, ""));
  return isNaN(num) ? null : num;
}

function detectStock(
  $: cheerio.CheerioAPI,
  selectors: string[],
  inStockTexts: string[],
  outOfStockTexts: string[]
): { inStock: boolean | null; stockLabel: string } {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const text = el.text().trim().toLowerCase();
      if (outOfStockTexts.some((t) => text.includes(t))) {
        return { inStock: false, stockLabel: el.text().trim() };
      }
      if (inStockTexts.some((t) => text.includes(t))) {
        return { inStock: true, stockLabel: el.text().trim() };
      }
      return { inStock: null, stockLabel: el.text().trim() || "E panjohur" };
    }
  }
  return { inStock: null, stockLabel: "E panjohur" };
}

export async function scrapeStore(
  store: Store,
  searchTerms: string[]
): Promise<ScrapedPrice> {
  const lastChecked = new Date().toISOString();
  let lastError = "Produkti nuk u gjet në këtë dyqan";

  for (const term of searchTerms) {
    for (const searchUrl of store.searchUrls(term)) {
      try {
        const { data, status: httpStatus } = await axios.get(searchUrl, {
          timeout: 10000,
          headers: BROWSER_HEADERS,
        });

        console.log(`[scraper] ${store.id} ${searchUrl} → HTTP ${httpStatus}, html_len=${String(data).length}`);

        const $ = cheerio.load(data);

        // Find first product link
        let productUrl: string | null = null;
        for (const sel of store.selectors.productLink) {
          const link = $(sel).first().attr("href");
          if (link) {
            productUrl = link.startsWith("http") ? link : `${store.url}${link}`;
            console.log(`[scraper] ${store.id} matched selector "${sel}" → ${productUrl}`);
            break;
          }
        }

        if (!productUrl) {
          console.log(`[scraper] ${store.id} no product link found (tried ${store.selectors.productLink.length} selectors)`);
          lastError = "Produkti nuk u gjet në këtë dyqan";
          continue;
        }

        // Fetch the product page for accurate price + stock
        const productPage = await axios.get(productUrl, {
          timeout: 10000,
          headers: { ...BROWSER_HEADERS, "Referer": searchUrl },
        });
        const $p = cheerio.load(productPage.data);

        // Extract price
        let price: number | null = null;
        for (const sel of store.selectors.price) {
          const priceText = $p(sel).first().text().trim();
          if (priceText) {
            price = extractPrice(priceText);
            if (price !== null) break;
          }
        }

        // Extract stock
        const { inStock, stockLabel } = detectStock(
          $p,
          store.selectors.stock,
          store.selectors.inStockText,
          store.selectors.outOfStockText
        );

        return {
          storeId: store.id,
          price,
          inStock,
          stockLabel,
          productUrl,
          lastChecked,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`[scraper] ${store.id} ERROR ${searchUrl}: ${message.slice(0, 120)}`);
        lastError = `Nuk u gjet: ${message.slice(0, 80)}`;
        // Try next URL format
      }
    }
    // All URL formats failed for this term, try next search term
  }

  return {
    storeId: store.id,
    price: null,
    inStock: null,
    stockLabel: "E panjohur",
    productUrl: null,
    lastChecked,
    error: lastError,
  };
}

export { DISCLAIMER };
