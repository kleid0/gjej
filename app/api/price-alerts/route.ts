import { NextRequest, NextResponse } from "next/server";
import { saveAlert } from "@/src/infrastructure/db/PriceHistoryRepository";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { productId?: string; email?: string; threshold?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Kërkesë e pavlefshme" }, { status: 400 });
  }

  const { productId, email, threshold } = body;

  if (!productId || typeof productId !== "string") {
    return NextResponse.json({ error: "Produkt i pavlefshëm" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email i pavlefshëm" }, { status: 400 });
  }
  const t = parseInt(String(threshold), 10);
  if (isNaN(t) || t <= 0) {
    return NextResponse.json({ error: "Pragu duhet të jetë numër pozitiv" }, { status: 400 });
  }

  try {
    await saveAlert(productId, email, t);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("price-alerts save error:", err);
    return NextResponse.json({ error: "Gabim gjatë ruajtjes — provoni sërish" }, { status: 500 });
  }
}
