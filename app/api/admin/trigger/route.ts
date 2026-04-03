import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/trigger?action=refresh-prices|discover|fetch-images
// Thin proxy that calls the cron/admin endpoints server-side using the stored CRON_SECRET.
// The client sends the admin key; this validates it matches CRON_SECRET and forwards.
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { key?: string };
  const key = body.key ?? "";

  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const headers = {
    "Authorization": `Bearer ${process.env.CRON_SECRET}`,
    "Content-Type": "application/json",
  };

  let response: Response;

  if (action === "refresh-prices") {
    response = await fetch(`${base}/api/cron/refresh-prices`, { method: "GET", headers });
  } else if (action === "discover") {
    response = await fetch(`${base}/api/cron/discover`, { method: "GET", headers });
  } else if (action === "fetch-images") {
    response = await fetch(`${base}/api/admin/fetch-images`, { method: "POST", headers });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json({ ok: response.ok, status: response.status, data });
}
