import { NextRequest, NextResponse } from "next/server";
import { productCatalog } from "@/src/infrastructure/container";
import { getProductLowestPrices } from "@/src/infrastructure/db/PriceHistoryRepository";

export const dynamic = "force-dynamic";

// GET /api/admin/store-coverage
// Distribution of per-product store counts for live catalogue products with
// a recorded lowest price. Reads from catalogue-state.json (and the product
// catalogue file for brand/family lookup) instead of the products table.
//
// Query params (all optional):
//   ?detail=1   — also return a per-product list, sorted by store_count ASC
//   ?limit=<n>  — cap the detail list (default 500, max 5000)
//   ?max=<n>    — include only products with store_count <= n in the detail
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [products, priceMap] = await Promise.all([
      productCatalog.getAllProducts(),
      getProductLowestPrices(),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));

    const distribution: Record<string, number> = {};
    let total = 0;
    let multiStore = 0;

    interface DetailRow {
      id: string;
      brand: string;
      family: string;
      category: string;
      storeCount: number;
      lowestPrice: number;
    }
    const detailRows: DetailRow[] = [];

    for (const [id, info] of Object.entries(priceMap)) {
      const product = productMap.get(id);
      if (!product) continue;
      const bucket = info.storeCount ?? 0;
      distribution[String(bucket)] = (distribution[String(bucket)] ?? 0) + 1;
      total += 1;
      if (bucket >= 2) multiStore += 1;
      detailRows.push({
        id,
        brand: product.brand,
        family: product.family,
        category: product.category,
        storeCount: bucket,
        lowestPrice: info.price,
      });
    }

    const summary = {
      distribution,
      total,
      multiStore,
      singleStore: distribution["1"] ?? 0,
      unpopulated: distribution["0"] ?? 0,
    };

    if (req.nextUrl.searchParams.get("detail") !== "1") {
      return NextResponse.json(summary);
    }

    const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 500);
    const limit = Math.min(5000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 500));
    const rawMax = req.nextUrl.searchParams.get("max");
    const max = rawMax !== null && Number.isFinite(Number(rawMax)) ? Number(rawMax) : null;

    const filtered = max !== null
      ? detailRows.filter((r) => r.storeCount <= max)
      : detailRows;
    filtered.sort((a, b) =>
      a.storeCount - b.storeCount || a.brand.localeCompare(b.brand) || a.family.localeCompare(b.family),
    );

    return NextResponse.json({
      ...summary,
      products: filtered.slice(0, limit),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[store-coverage] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
