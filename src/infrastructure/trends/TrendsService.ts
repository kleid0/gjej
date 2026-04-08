import axios from "axios";
import fs from "fs";
import { TRENDS_FILE } from "@/src/infrastructure/persistence/paths";

const EXPLORE_URL = "https://trends.google.com/trends/api/explore";
const MULTILINE_URL = "https://trends.google.com/trends/api/widgetdata/multiline";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "sq,en-US;q=0.9,en;q=0.8",
};

export interface TrendsCache {
  scores: Record<string, number>;
  updatedAt: string;
}

// Strip the )]}' anti-XSSI prefix Google prepends to all Trends API responses
function stripPrefix(text: string): string {
  return text.replace(/^\)\]\}'/, "").trim();
}

async function getInterestScores(keywords: string[]): Promise<number[]> {
  const comparisonItem = keywords.map((kw) => ({
    keyword: kw.substring(0, 100),
    geo: "AL",
    time: "now 7-d",
  }));

  // Step 1: explore — obtain widget token
  const exploreRes = await axios.get(EXPLORE_URL, {
    params: {
      hl: "sq",
      tz: -60,
      req: JSON.stringify({ comparisonItem, category: 0, property: "" }),
    },
    headers: HEADERS,
    timeout: 15_000,
  });

  const exploreData = JSON.parse(stripPrefix(exploreRes.data as string));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widget = (exploreData.widgets as any[])?.find(
    (w) => w.id === "TIMESERIES",
  );
  if (!widget) return keywords.map(() => 0);

  // Step 2: multiline — fetch interest-over-time values
  const dataRes = await axios.get(MULTILINE_URL, {
    params: {
      hl: "sq",
      tz: -60,
      req: JSON.stringify(widget.request),
      token: widget.token,
    },
    headers: HEADERS,
    timeout: 15_000,
  });

  const multilineData = JSON.parse(stripPrefix(dataRes.data as string));
  const timeline: { value: number[] }[] =
    multilineData.default?.timelineData ?? [];

  const totals = new Array<number>(keywords.length).fill(0);
  const counts = new Array<number>(keywords.length).fill(0);
  for (const point of timeline) {
    (point.value ?? []).forEach((v: number, idx: number) => {
      if (idx < keywords.length) {
        totals[idx] += v;
        counts[idx]++;
      }
    });
  }

  return keywords.map((_, idx) =>
    counts[idx] > 0 ? Math.round(totals[idx] / counts[idx]) : 0,
  );
}

export async function fetchTrendsScores(
  products: Array<{ id: string; family: string; brand: string; searchTerms: string[] }>,
): Promise<Record<string, number>> {
  const scores: Record<string, number> = {};
  const BATCH = 5;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    const keywords = batch.map((p) => {
      const term = p.searchTerms[0] ?? `${p.brand} ${p.family}`;
      return term.substring(0, 100);
    });

    try {
      const batchScores = await getInterestScores(keywords);
      batch.forEach((p, idx) => {
        scores[p.id] = batchScores[idx];
      });
    } catch (err) {
      console.error(`[trends] batch ${Math.floor(i / BATCH) + 1} failed:`, err);
      batch.forEach((p) => {
        scores[p.id] = 0;
      });
    }

    // Avoid hammering Google between batches
    if (i + BATCH < products.length) {
      await new Promise((r) => setTimeout(r, 1_200));
    }
  }

  return scores;
}

export function readTrendsCache(): TrendsCache | null {
  try {
    const raw = fs.readFileSync(TRENDS_FILE, "utf-8");
    const cache = JSON.parse(raw) as TrendsCache;
    // Expire after 25 hours so a daily cron always serves fresh data
    const age = Date.now() - new Date(cache.updatedAt).getTime();
    if (age > 25 * 60 * 60 * 1_000) return null;
    return cache;
  } catch {
    return null;
  }
}

export function writeTrendsCache(scores: Record<string, number>): void {
  const cache: TrendsCache = { scores, updatedAt: new Date().toISOString() };
  fs.writeFileSync(TRENDS_FILE, JSON.stringify(cache));
}
