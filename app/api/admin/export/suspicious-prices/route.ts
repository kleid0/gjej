// API route: export entries with suspicious/overpriced prices as .xlsx
// GET /api/admin/export/suspicious-prices
//
// Reads from the persisted price_history DB table (not the ephemeral
// /tmp/prices.json) so it works regardless of which Vercel instance serves
// the request.  Computes deviation flags inline from the latest price per
// store per product.

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@vercel/postgres";
import { productCatalog } from "@/src/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET() {
  // Use createClient() so it works with both pooled and direct connection strings
  const client = createClient();
  let dbRows: Record<string, unknown>[];
  try {
    await client.connect();
    const result = await client.query(`
      SELECT ph.product_id, ph.store_id, ph.price, ph.recorded_at::text AS recorded_at
      FROM price_history ph
      INNER JOIN (
        SELECT product_id, store_id, MAX(recorded_at) AS latest
        FROM price_history
        WHERE price IS NOT NULL AND price > 0
        GROUP BY product_id, store_id
      ) latest
        ON ph.product_id = latest.product_id
       AND ph.store_id   = latest.store_id
       AND ph.recorded_at = latest.latest
      WHERE ph.price IS NOT NULL AND ph.price > 0
      ORDER BY ph.product_id
    `);
    dbRows = result.rows as Record<string, unknown>[];
  } catch (err) {
    return NextResponse.json(
      { error: "DB query failed", detail: String(err) },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => {});
  }

  type StoreEntry = { storeId: string; price: number; recordedAt: string };

  // Group prices by product
  const byProduct: Record<string, StoreEntry[]> = {};
  for (const row of dbRows) {
    const pid = row.product_id as string;
    if (!byProduct[pid]) byProduct[pid] = [];
    byProduct[pid].push({
      storeId: row.store_id as string,
      price: row.price as number,
      recordedAt: row.recorded_at as string,
    });
  }

  // Load product names
  const allProducts = await productCatalog.getAllProducts();
  const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));

  const rows: object[] = [];

  for (const [productId, entries] of Object.entries(byProduct)) {
    if (entries.length < 3) continue; // need ≥3 stores to flag deviations

    const avg = entries.reduce((s: number, e: StoreEntry) => s + e.price, 0) / entries.length;
    const product = productMap[productId];

    for (const entry of entries) {
      const dev = (entry.price - avg) / avg;
      let flag: string | null = null;
      if (dev < -0.4) flag = "I ulët (>40% nën mesatare)";
      else if (dev > 0.6) flag = "I lartë (>60% mbi mesatare)";
      if (!flag) continue;

      rows.push({
        "ID Produkti": productId,
        Emri: product?.family ?? productId,
        Marka: product?.brand ?? "",
        Kategoria: product?.category ?? "",
        Dyqani: entry.storeId,
        "Çmimi (Lekë)": entry.price,
        "Mesatarja (Lekë)": Math.round(avg),
        "Devijimi %": `${(dev * 100).toFixed(1)}%`,
        Flamuri: flag,
        "Data": entry.recordedAt,
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Çmime të Dyshimta");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cmime-te-dyshimta.xlsx"`,
    },
  });
}
