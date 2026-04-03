import { NextRequest, NextResponse } from "next/server";
import { FileProductRepository } from "@/src/infrastructure/persistence/FileProductRepository";
import { enrichPhone } from "@/src/infrastructure/enrichment/GSMArenaService";

// Allow up to 5 minutes — GSMArena fetching takes time
export const maxDuration = 300;

// Priority order for categories
const PHONE_CATEGORIES = new Set(["telefona"]);
const LAPTOP_CATEGORIES = new Set(["kompjutera"]);
const PHONE_SUBCATEGORIES = new Set(["Smartphone", "Tablet"]);
const LAPTOP_SUBCATEGORIES = new Set(["Laptop"]);

// POST /api/admin/fetch-images
// Fetches missing images from GSMArena for products without an imageUrl.
// Prioritises phones and laptops. Secured by Bearer CRON_SECRET.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repo = new FileProductRepository();
  const allProducts = await repo.getAll();

  const missing = allProducts.filter((p) => !p.imageUrl);
  if (missing.length === 0) {
    return NextResponse.json({ updated: 0, skipped: 0, total: 0 });
  }

  // Sort: phones first, then laptops, then everything else
  missing.sort((a, b) => {
    const priorityA = PHONE_SUBCATEGORIES.has(a.subcategory) ? 0
      : LAPTOP_SUBCATEGORIES.has(a.subcategory) ? 1
      : PHONE_CATEGORIES.has(a.category) ? 2
      : LAPTOP_CATEGORIES.has(a.category) ? 3
      : 4;
    const priorityB = PHONE_SUBCATEGORIES.has(b.subcategory) ? 0
      : LAPTOP_SUBCATEGORIES.has(b.subcategory) ? 1
      : PHONE_CATEGORIES.has(b.category) ? 2
      : LAPTOP_CATEGORIES.has(b.category) ? 3
      : 4;
    return priorityA - priorityB;
  });

  // Limit to avoid Vercel timeout — process up to 50 per run
  const batch = missing.slice(0, 50);

  let updated = 0;
  let skipped = 0;

  // Build updated product list (mutating a copy)
  const productMap = new Map(allProducts.map((p) => [p.id, { ...p }]));

  for (const product of batch) {
    // Only enrich phones/tablets/laptops from GSMArena
    const isPhone = PHONE_SUBCATEGORIES.has(product.subcategory) || PHONE_CATEGORIES.has(product.category);
    const isLaptop = LAPTOP_SUBCATEGORIES.has(product.subcategory) || LAPTOP_CATEGORIES.has(product.category);

    if (!isPhone && !isLaptop) {
      skipped++;
      continue;
    }

    try {
      const searchName = `${product.brand} ${product.family}`.trim();
      const result = await enrichPhone(searchName, product.brand || undefined);

      if (result?.officialImages?.[0]) {
        const p = productMap.get(product.id)!;
        p.imageUrl = result.officialImages[0];
        if (!p.officialImages) p.officialImages = result.officialImages;
        updated++;
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  if (updated > 0) {
    await repo.saveAll(Array.from(productMap.values()));
  }

  return NextResponse.json({
    updated,
    skipped,
    total: missing.length,
    remaining: Math.max(0, missing.length - batch.length),
    timestamp: new Date().toISOString(),
  });
}
