import path from "path";
import fs from "fs";

const SNAPSHOT_DIR = path.join(process.cwd(), "data");

export const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : SNAPSHOT_DIR;

export const DISCOVERED_PRODUCTS_FILE = path.join(DATA_DIR, "discovered-products.json");
export const PRICES_FILE = path.join(DATA_DIR, "prices.json");
export const TRENDS_FILE = path.join(DATA_DIR, "trends.json");

// On Vercel, /tmp is ephemeral. Fall back to the committed snapshot in data/.
export function getDiscoveredProductsReadPath(): string {
  if (process.env.VERCEL && !fs.existsSync(DISCOVERED_PRODUCTS_FILE)) {
    const snapshot = path.join(SNAPSHOT_DIR, "discovered-products.json");
    if (fs.existsSync(snapshot)) return snapshot;
  }
  return DISCOVERED_PRODUCTS_FILE;
}
