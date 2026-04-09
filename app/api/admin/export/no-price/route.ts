// API route: export products with no prices as .xlsx
// GET /api/admin/export/no-price

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";

export const dynamic = "force-dynamic";

export async function GET() {
  const [allProducts, allPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
  ]);

  // A product "has a price" if at least one store returned a non-null price
  const productsNoPrice = allProducts.filter((p) => {
    const record = allPrices[p.id];
    if (!record) return true;
    return !record.prices.some((sp) => sp.price !== null);
  });

  const rows = productsNoPrice.map((p) => ({
    ID: p.id,
    Emri: p.family,
    Marka: p.brand,
    Kategoria: p.category,
    Nënkategoria: p.subcategory,
    "Nr. Modeli": p.modelNumber,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pa Çmim");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="produkte-pa-cmim.xlsx"`,
    },
  });
}
