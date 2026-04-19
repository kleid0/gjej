import { NextRequest, NextResponse } from "next/server";
import { sql, ensureSchema } from "@/src/infrastructure/db/client";

export const dynamic = "force-dynamic";

// GET /api/admin/store-coverage
// Distribution of products.store_count for live catalogue products with a
// recorded lowest price.  Suspicious prices are already excluded upstream
// (cron filters them before writing store_count), so each bucket reflects
// "stores a visitor actually sees on the product page".
//
// Query params (all optional):
//   ?detail=1   — also return a per-product list, sorted by store_count ASC
//                 then brand/family, so worst-covered products surface first.
//   ?limit=<n>  — cap the detail list (default 500, max 5000).
//   ?max=<n>    — include only products with store_count <= n in the detail
//                 list (e.g. ?max=1 to audit single/zero-store products).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Force DDL so the store_count column exists even when DB_SCHEMA_READY=1
    // is set in the Vercel env (which normally gates ensureSchema off).
    await ensureSchema(true);

    const result = await sql`
      SELECT COALESCE(store_count, 0) AS buckets, COUNT(*)::int AS products
      FROM products
      WHERE catalogue_status != 'discontinued'
        AND lowest_price IS NOT NULL
      GROUP BY COALESCE(store_count, 0)
      ORDER BY COALESCE(store_count, 0)
    `;

    const distribution: Record<string, number> = {};
    let total = 0;
    let multiStore = 0;
    for (const row of result.rows) {
      const bucket = Number(row.buckets);
      const count = Number(row.products);
      distribution[String(bucket)] = count;
      total += count;
      if (bucket >= 2) multiStore += count;
    }

    const summary = {
      distribution,
      total,
      multiStore,
      singleStore: distribution["1"] ?? 0,
      unpopulated: distribution["0"] ?? 0,
    };

    // ?debug=1 adds raw row counts so we can tell which filter is emptying
    // the result set (e.g. catalogue_status NULL vs lowest_price NULL).
    let debug: Record<string, number> | undefined;
    if (req.nextUrl.searchParams.get("debug") === "1") {
      const diag = await sql`
        SELECT
          COUNT(*)::int AS all_rows,
          COUNT(*) FILTER (WHERE catalogue_status IS NOT NULL)::int AS with_status,
          COUNT(*) FILTER (WHERE catalogue_status != 'discontinued')::int AS not_discontinued,
          COUNT(*) FILTER (WHERE lowest_price IS NOT NULL)::int AS with_price,
          COUNT(*) FILTER (WHERE store_count IS NOT NULL)::int AS with_store_count
        FROM products
      `;
      const row = diag.rows[0] ?? {};
      debug = {
        allRows: Number(row.all_rows ?? 0),
        withStatus: Number(row.with_status ?? 0),
        notDiscontinued: Number(row.not_discontinued ?? 0),
        withPrice: Number(row.with_price ?? 0),
        withStoreCount: Number(row.with_store_count ?? 0),
      };
    }

    if (req.nextUrl.searchParams.get("detail") !== "1") {
      return NextResponse.json(debug ? { ...summary, debug } : summary);
    }

    const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 500);
    const limit = Math.min(5000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 500));
    const rawMax = req.nextUrl.searchParams.get("max");
    const max = rawMax !== null && Number.isFinite(Number(rawMax)) ? Number(rawMax) : null;

    const detail = max !== null
      ? await sql`
          SELECT id, brand, family, category,
                 COALESCE(store_count, 0)::int AS store_count,
                 lowest_price::int AS lowest_price
          FROM products
          WHERE catalogue_status != 'discontinued'
            AND lowest_price IS NOT NULL
            AND COALESCE(store_count, 0) <= ${max}
          ORDER BY COALESCE(store_count, 0) ASC, brand ASC, family ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, brand, family, category,
                 COALESCE(store_count, 0)::int AS store_count,
                 lowest_price::int AS lowest_price
          FROM products
          WHERE catalogue_status != 'discontinued'
            AND lowest_price IS NOT NULL
          ORDER BY COALESCE(store_count, 0) ASC, brand ASC, family ASC
          LIMIT ${limit}
        `;

    return NextResponse.json({
      ...summary,
      ...(debug ? { debug } : {}),
      products: detail.rows.map((r) => ({
        id: r.id as string,
        brand: r.brand as string,
        family: r.family as string,
        category: r.category as string,
        storeCount: r.store_count as number,
        lowestPrice: r.lowest_price as number,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[store-coverage] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
