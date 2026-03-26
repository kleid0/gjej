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
  const primaryTerm = searchTerms[0];

  // Try each search term until we find a result
  for (const term of searchTerms) {
    const searchUrl = store.searchUrl(term);
    try {
      const { data } = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GjejBot/1.0; price comparison for Albanian consumers)",
          "Accept-Language": "sq-AL,sq;q=0.9,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const $ = cheerio.load(data);

      // Find first product link
      let productUrl: string | null = null;
      for (const sel of store.selectors.productLink) {
        const link = $(sel).first().attr("href");
        if (link) {
          productUrl = link.startsWith("http") ? link : `${store.url}${link}`;
          break;
        }
      }

      if (!productUrl) continue;

      // Fetch the product page for accurate price + stock
      const productPage = await axios.get(productUrl, {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; GjejBot/1.0; price comparison for Albanian consumers)",
          "Accept-Language": "sq-AL,sq;q=0.9,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
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
      // Try next search term
      const message = err instanceof Error ? err.message : String(err);
      if (searchTerms.indexOf(term) === searchTerms.length - 1) {
        return {
          storeId: store.id,
          price: null,
          inStock: null,
          stockLabel: "E panjohur",
          productUrl: null,
          lastChecked,
          error: `Nuk u gjet: ${message.slice(0, 80)}`,
        };
      }
    }
  }

  return {
    storeId: store.id,
    price: null,
    inStock: null,
    stockLabel: "E panjohur",
    productUrl: null,
    lastChecked,
    error: "Produkti nuk u gjet në këtë dyqan",
  };
}

export { DISCLAIMER };
