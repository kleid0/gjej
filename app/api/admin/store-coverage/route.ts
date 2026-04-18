import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/src/infrastructure/db/client";

export const dynamic = "force-dynamic";

// GET /api/admin/store-coverage
// Distribution of products.store_count for live catalogue products with a
// recorded lowest price.  Suspicious prices are already excluded upstream
// (cron filters them before writing store_count), so each bucket reflects
// "stores a visitor actually sees on the product page".
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    distribution,
    total,
    multiStore,
    singleStore: distribution["1"] ?? 0,
    unpopulated: distribution["0"] ?? 0,
  });
}
