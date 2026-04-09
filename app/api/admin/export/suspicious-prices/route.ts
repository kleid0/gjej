// API route: export entries with suspicious/overpriced prices as .xlsx
// GET /api/admin/export/suspicious-prices
//
// Recomputes deviation flags from raw cached prices rather than relying on
// persisted suspicious/overpriced fields, which may be absent when prices
// were written from a different Vercel function instance.

import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";

export const dynamic = "force-dynamic";

type FlaggedEntry = {
  productId: string;
  family: string;
  brand: string;
  category: string;
  storeId: string;
  price: number;
  flag: "I ulët (>40%)" | "I lartë (>60%)";
  matchedName: string;
  productUrl: string;
  lastChecked: string;
};

function computeFlags(prices: ScrapedPrice[]): FlaggedEntry["flag"][] {
  const found = prices.filter((p): p is ScrapedPrice & { price: number } =>
    p.price !== null && p.price > 0
  );
  if (found.length < 3) {
    // Not enough data points — fall back to saved flags
    return prices.map((p) => {
      if (p.suspicious) return "I ulët (>40%)";
      if (p.overpriced) return "I lartë (>60%)";
      return "" as never;
    });
  }
  const avg = found.reduce((s, p) => s + p.price, 0) / found.length;
  return prices.map((p) => {
    if (p.price === null || p.price <= 0) return "" as never;
    const dev = (p.price - avg) / avg;
    if (dev < -0.4) return "I ulët (>40%)";
    if (dev > 0.6) return "I lartë (>60%)";
    return "" as never;
  });
}

export async function GET() {
  const [allProducts, allPrices] = await Promise.all([
    productCatalog.getAllProducts(),
    priceQuery.getAllCachedPrices(),
  ]);

  const productMap = Object.fromEntries(allProducts.map((p) => [p.id, p]));

  const rows: object[] = [];

  for (const [productId, record] of Object.entries(allPrices)) {
    const product = productMap[productId];
    const flags = computeFlags(record.prices);

    record.prices.forEach((sp, i) => {
      const flag = flags[i];
      if (!flag) return;
      rows.push({
        "ID Produkti": productId,
        Emri: product?.family ?? productId,
        Marka: product?.brand ?? "",
        Kategoria: product?.category ?? "",
        Dyqani: sp.storeId,
        "Çmimi (Lekë)": sp.price ?? "",
        Flamuri: flag,
        "Emri i Dyqanit": sp.matchedName ?? "",
        URL: sp.productUrl ?? "",
        "Kontrolluar më": sp.lastChecked,
      });
    });
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
