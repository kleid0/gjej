// API route: export entries with suspicious prices as .xlsx
// GET /api/admin/export/suspicious-prices

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET() {
  const [allProducts, allPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
  ]);

  const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));

  const rows: object[] = [];

  for (const [productId, record] of Object.entries(allPrices)) {
    const product = productMap[productId];
    for (const sp of record.prices) {
      if (!sp.suspicious) continue;
      rows.push({
        "ID Produkti": productId,
        Emri: product?.family ?? productId,
        Marka: product?.brand ?? "",
        Kategoria: product?.category ?? "",
        Dyqani: sp.storeId,
        "Çmimi (Lekë)": sp.price ?? "",
        "Emri i Dyqanit": sp.matchedName ?? "",
        "URL": sp.productUrl ?? "",
        "Kontrolluar më": sp.lastChecked,
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
