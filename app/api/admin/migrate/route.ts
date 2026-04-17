import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { sql, ensureSchema } from "@/src/infrastructure/db/client";
import type { Product } from "@/src/domain/catalog/Product";

// Allow up to 5 minutes for the bulk insert
export const maxDuration = 300;

// GET /api/admin/migrate
// One-time migration: creates all DB tables and imports products from the
// committed JSON snapshot into the `products` table.
// Protected by CRON_SECRET to prevent unauthorised runs.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Create all tables (price_history, price_alerts, products)
  // force=true so this route works even when DB_SCHEMA_READY=1 is set —
  // creating the schema is the entire point of this endpoint.
  try {
    await ensureSchema(true);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Schema creation failed" },
      { status: 500 }
    );
  }

  // 2. Load products from the committed snapshot
  const snapshotPath = path.join(process.cwd(), "data", "discovered-products.json");
  let products: Product[];
  try {
    const raw = await fs.readFile(snapshotPath, "utf-8");
    products = JSON.parse(raw);
  } catch (err) {
    return NextResponse.json({ error: `Failed to read snapshot: ${err}` }, { status: 500 });
  }

  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: "No products found in snapshot" }, { status: 400 });
  }

  // 3. Bulk-upsert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < products.length; i += BATCH) {
    const batch = products.slice(i, i + BATCH);
    await Promise.allSettled(
      batch.map((p) =>
        sql`
          INSERT INTO products (
            id, model_number, family, brand, category, subcategory,
            image_url, storage_options, search_terms,
            variant, specs, description, official_images, enriched_at
          ) VALUES (
            ${p.id},
            ${p.modelNumber ?? ""},
            ${p.family ?? ""},
            ${p.brand ?? ""},
            ${p.category ?? ""},
            ${p.subcategory ?? ""},
            ${p.imageUrl ?? ""},
            ${JSON.stringify(p.storageOptions ?? [])}::jsonb,
            ${JSON.stringify(p.searchTerms ?? [])}::jsonb,
            ${p.variant ? JSON.stringify(p.variant) : null}::jsonb,
            ${p.specs ? JSON.stringify(p.specs) : null}::jsonb,
            ${p.description ?? null},
            ${p.officialImages ? JSON.stringify(p.officialImages) : null}::jsonb,
            ${p.enrichedAt ? new Date(p.enrichedAt).toISOString() : null}
          )
          ON CONFLICT (id) DO UPDATE SET
            model_number    = EXCLUDED.model_number,
            family          = EXCLUDED.family,
            brand           = EXCLUDED.brand,
            category        = EXCLUDED.category,
            subcategory     = EXCLUDED.subcategory,
            image_url       = EXCLUDED.image_url,
            storage_options = EXCLUDED.storage_options,
            search_terms    = EXCLUDED.search_terms,
            variant         = EXCLUDED.variant,
            specs           = EXCLUDED.specs,
            description     = EXCLUDED.description,
            official_images = EXCLUDED.official_images,
            enriched_at     = EXCLUDED.enriched_at,
            updated_at      = NOW()
        `.then(() => { inserted++; })
          .catch(() => { errors++; })
      )
    );
  }

  return NextResponse.json({
    ok: true,
    total: products.length,
    inserted,
    errors,
    timestamp: new Date().toISOString(),
  });
}
