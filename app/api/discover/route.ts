import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { discoverProducts } from "@/lib/discover";
import type { Product } from "@/lib/products";

const DATA_FILE = path.join(process.cwd(), "data", "discovered-products.json");

// POST /api/discover — runs a full discovery scrape and persists results
export async function POST() {
  const fresh = await discoverProducts();

  // Load existing discovered products so we don't lose ones that may be
  // temporarily unavailable from a store right now
  let existing: Product[] = [];
  try {
    existing = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  } catch {
    // file doesn't exist yet — start fresh
  }

  // Merge: fresh results override existing by id
  const map = new Map(existing.map((p) => [p.id, p]));
  for (const p of fresh) map.set(p.id, p);

  const merged = Array.from(map.values());
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(merged, null, 2));

  return NextResponse.json({ discovered: fresh.length, total: merged.length });
}

// GET /api/discover — returns the current set of discovered products
export async function GET() {
  try {
    const products: Product[] = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
    return NextResponse.json({ total: products.length, products });
  } catch {
    return NextResponse.json({ total: 0, products: [] });
  }
}
