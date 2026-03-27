import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { productCatalog } from "@/src/infrastructure/container";
import { enrichPhone } from "@/src/infrastructure/enrichment/GSMArenaService";
import { enrichFromProductPage } from "@/src/infrastructure/enrichment/ManufacturerService";

export const maxDuration = 30;

const CACHE_DIR = process.env.VERCEL ? "/tmp/enrichment" : path.join(process.cwd(), "data", "enrichment");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function readCache(productId: string) {
  try {
    const file = path.join(CACHE_DIR, `${productId.replace(/[^a-z0-9-]/gi, "_")}.json`);
    const raw = await fs.readFile(file, "utf-8");
    const cached = JSON.parse(raw);
    if (Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS) {
      return cached.data;
    }
  } catch { /* cache miss */ }
  return null;
}

async function writeCache(productId: string, data: unknown) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${productId.replace(/[^a-z0-9-]/gi, "_")}.json`);
    await fs.writeFile(file, JSON.stringify({ cachedAt: new Date().toISOString(), data }));
  } catch { /* cache write failed — continue anyway */ }
}

// GET /api/enrich?product=<productId>
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product");
  if (!productId) return NextResponse.json({ error: "product param required" }, { status: 400 });

  const product = await productCatalog.getProductById(productId);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  // Try cache first
  const cached = await readCache(productId);
  if (cached) return NextResponse.json({ ...cached, fromCache: true });

  let result = null;

  // For phones and tablets: use GSMArena
  const isPhone = product.category === "telefona" ||
    ["telefona", "smartphone", "tablet"].includes(product.subcategory.toLowerCase());

  if (isPhone) {
    // Use model-stripped family name for better GSMArena match
    const searchName = product.family
      .replace(/,.*$/, "")           // remove specs after comma
      .replace(/\b\d+\s*(gb|tb)\b/gi, "")  // remove storage
      .replace(/\s+/g, " ").trim();
    // Pass brand so GSMArena results are validated against the right manufacturer
    result = await enrichPhone(searchName, product.brand);
  }

  // For Foleja products: try JSON-LD from the product URL stored in searchTerms
  if (!result) {
    const folejUrl = product.searchTerms.find((t) => t.startsWith("https://www.foleja.al/"));
    if (folejUrl) {
      result = await enrichFromProductPage(folejUrl);
    }
  }

  // For Shpresa products: try the product permalink
  if (!result && productId.startsWith("shpresa-")) {
    const slug = productId.slice("shpresa-".length);
    const shpresaUrl = `https://shpresa.al/shop/${slug}`;
    result = await enrichFromProductPage(shpresaUrl);
  }

  if (result) {
    await writeCache(productId, result);
    return NextResponse.json({ ...result, fromCache: false });
  }

  return NextResponse.json({
    specs: {},
    officialImages: [],
    variant: { modelCode: product.modelNumber || "", region: "Unknown", confidence: "unclear" },
    fromCache: false,
    notFound: true,
  });
}
