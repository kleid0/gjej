import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { discoverProducts } from "@/lib/discover";
import type { Product } from "@/lib/products";

export const maxDuration = 300;

const DATA_FILE = path.join(process.cwd(), "data", "discovered-products.json");

// GET /api/cron/discover
// Called daily by Vercel Cron. Searches all stores for new products
// and merges them into data/discovered-products.json.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fresh = await discoverProducts();

  let existing: Product[] = [];
  try {
    existing = JSON.parse(await fs.readFile(DATA_FILE, "utf-8"));
  } catch {
    // file doesn't exist yet
  }

  const map = new Map(existing.map((p) => [p.id, p]));
  for (const p of fresh) map.set(p.id, p);
  const merged = Array.from(map.values());

  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(merged, null, 2));

  return NextResponse.json({
    discovered: fresh.length,
    total: merged.length,
    timestamp: new Date().toISOString(),
  });
}
