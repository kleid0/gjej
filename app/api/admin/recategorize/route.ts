import { NextRequest, NextResponse } from "next/server";
import { sql, rawQuery } from "@/src/infrastructure/db/client";
import { guessCategory } from "@/src/infrastructure/scrapers/ProductDiscovery";

// Allow up to 5 minutes for the bulk update
export const maxDuration = 300;

// POST /api/admin/recategorize
// Re-runs guessCategory on every product in the DB using the stored product
// name (family field) and writes the corrected category + subcategory back.
// Protected by CRON_SECRET.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Read all products (id + family only — that's all guessCategory needs)
  const { rows } = await sql`SELECT id, family FROM products ORDER BY id`;

  if (!rows.length) {
    return NextResponse.json({ ok: true, updated: 0, total: 0 });
  }

  // 2. Re-classify each product
  const updates: Array<{ id: string; category: string; subcategory: string }> = [];
  for (const row of rows) {
    const { category, subcategory } = guessCategory(row.family ?? "");
    updates.push({ id: row.id, category, subcategory });
  }

  // 3. Bulk update in batches of 200 using a VALUES list
  const BATCH = 200;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);
    // Build: UPDATE products SET category = v.category, subcategory = v.subcategory
    //        FROM (VALUES ($1,$2,$3), ...) AS v(id,category,subcategory)
    //        WHERE products.id = v.id
    const placeholders: string[] = [];
    const params: string[] = [];
    let p = 1;
    for (const u of batch) {
      placeholders.push(`($${p++}, $${p++}, $${p++})`);
      params.push(u.id, u.category, u.subcategory);
    }
    const queryText = `
      UPDATE products
      SET category    = v.category,
          subcategory = v.subcategory,
          updated_at  = NOW()
      FROM (VALUES ${placeholders.join(", ")}) AS v(id, category, subcategory)
      WHERE products.id = v.id
    `;
    try {
      const result = await rawQuery(queryText, params);
      updated += result.rows.length ?? batch.length;
    } catch {
      errors += batch.length;
    }
  }

  // Count distribution for quick sanity check in the response
  const dist: Record<string, number> = {};
  for (const u of updates) {
    dist[u.category] = (dist[u.category] ?? 0) + 1;
  }

  return NextResponse.json({
    ok: true,
    total: rows.length,
    updated: updates.length - errors,
    errors,
    distribution: dist,
    timestamp: new Date().toISOString(),
  });
}
