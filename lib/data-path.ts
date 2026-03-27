// Returns paths for runtime data files.
// On Vercel, /tmp is writable but ephemeral. The committed data/ directory is
// read-only but always present. Writes go to /tmp; reads prefer /tmp (fresh
// discovery) and fall back to data/ (committed snapshot).

import path from "path";
import fs from "fs";

export const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "data");

// Committed (read-only on Vercel) snapshot directory
const SNAPSHOT_DIR = path.join(process.cwd(), "data");

export const DISCOVERED_PRODUCTS_FILE = path.join(DATA_DIR, "discovered-products.json");
export const PRICES_FILE = path.join(DATA_DIR, "prices.json");

// Returns the best available path for reading discovered products.
// On Vercel: prefers /tmp (fresh) but falls back to committed data/ snapshot.
export function getDiscoveredProductsReadPath(): string {
  if (process.env.VERCEL && !fs.existsSync(DISCOVERED_PRODUCTS_FILE)) {
    const snapshot = path.join(SNAPSHOT_DIR, "discovered-products.json");
    if (fs.existsSync(snapshot)) return snapshot;
  }
  return DISCOVERED_PRODUCTS_FILE;
}
