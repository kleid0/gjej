import path from "path";
import fs from "fs";

const SNAPSHOT_DIR = path.join(process.cwd(), "data");

export const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : SNAPSHOT_DIR;

// Public-facing repo path used when committing back to GitHub.
export const REPO_DATA_DIR = "data";

export const DISCOVERED_PRODUCTS_FILE = path.join(DATA_DIR, "discovered-products.json");
export const PRICES_FILE = path.join(DATA_DIR, "prices.json");
export const TRENDS_FILE = path.join(DATA_DIR, "trends.json");
export const PRICE_HISTORY_FILE = path.join(DATA_DIR, "price-history.json");
export const SCRAPER_ERRORS_FILE = path.join(DATA_DIR, "scraper-errors.json");
export const DISCOVERY_LOG_FILE = path.join(DATA_DIR, "discovery-log.json");
export const STORE_MAPPINGS_FILE = path.join(DATA_DIR, "store-mappings.json");
export const SERVICE_PROBES_FILE = path.join(DATA_DIR, "service-probes.json");
export const CATALOGUE_STATE_FILE = path.join(DATA_DIR, "catalogue-state.json");

// On Vercel, /tmp is ephemeral. Fall back to the committed snapshot in data/.
export function snapshotReadPath(file: string): string {
  if (process.env.VERCEL && !fs.existsSync(file)) {
    const name = path.basename(file);
    const snapshot = path.join(SNAPSHOT_DIR, name);
    if (fs.existsSync(snapshot)) return snapshot;
  }
  return file;
}

export function getDiscoveredProductsReadPath(): string {
  return snapshotReadPath(DISCOVERED_PRODUCTS_FILE);
}
