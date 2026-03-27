// Returns a writable directory for runtime data files.
// On Vercel (production), the project directory is read-only; /tmp is writable.
// Locally, use the project's data/ directory for persistence across restarts.

import path from "path";

export const DATA_DIR = process.env.VERCEL
  ? "/tmp"
  : path.join(process.cwd(), "data");

export const DISCOVERED_PRODUCTS_FILE = path.join(DATA_DIR, "discovered-products.json");
export const PRICES_FILE = path.join(DATA_DIR, "prices.json");
