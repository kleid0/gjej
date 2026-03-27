import { promises as fs } from "fs";
import path from "path";
import type { ScrapedPrice } from "./scraper";

const PRICES_FILE = path.join(process.cwd(), "data", "prices.json");

export interface PriceRecord {
  prices: ScrapedPrice[];
  refreshedAt: string;
}

type PriceFile = Record<string, PriceRecord>;

async function readFile(): Promise<PriceFile> {
  try {
    const raw = await fs.readFile(PRICES_FILE, "utf-8");
    return JSON.parse(raw) as PriceFile;
  } catch {
    return {};
  }
}

export async function getPersistedPrices(productId: string): Promise<PriceRecord | null> {
  const data = await readFile();
  return data[productId] ?? null;
}

export async function setPersistedPrices(productId: string, prices: ScrapedPrice[]): Promise<void> {
  await fs.mkdir(path.dirname(PRICES_FILE), { recursive: true });
  const data = await readFile();
  data[productId] = { prices, refreshedAt: new Date().toISOString() };
  await fs.writeFile(PRICES_FILE, JSON.stringify(data, null, 2));
}

export async function setAllPersistedPrices(all: Record<string, ScrapedPrice[]>): Promise<void> {
  await fs.mkdir(path.dirname(PRICES_FILE), { recursive: true });
  const refreshedAt = new Date().toISOString();
  const existing = await readFile();
  for (const [productId, prices] of Object.entries(all)) {
    existing[productId] = { prices, refreshedAt };
  }
  await fs.writeFile(PRICES_FILE, JSON.stringify(existing, null, 2));
}
