import { NextRequest, NextResponse } from "next/server";
import { GET as refreshPricesHandler } from "@/app/api/cron/refresh-prices/route";
import { GET as discoverHandler } from "@/app/api/cron/discover/route";
import { POST as fetchImagesHandler } from "@/app/api/admin/fetch-images/route";

// Allow up to 5 minutes — mirrors the cron routes
export const maxDuration = 300;

// POST /api/admin/trigger?action=refresh-prices|discover|fetch-images
// Calls the cron/admin handlers directly (no internal HTTP fetch — unreliable on Vercel).
// The client sends CRON_SECRET as the key; we validate it server-side.
export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (!action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({})) as { key?: string };
  const key = body.key ?? "";

  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Çelës i gabuar" }, { status: 401 });
  }

  // Build a fake request that satisfies the auth check in each handler
  const makeReq = (url: string, method = "GET") =>
    new NextRequest(url, {
      method,
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

  try {
    let handlerResponse: Response;

    if (action === "refresh-prices") {
      handlerResponse = await refreshPricesHandler(makeReq("https://internal/api/cron/refresh-prices"));
    } else if (action === "discover") {
      handlerResponse = await discoverHandler(makeReq("https://internal/api/cron/discover"));
    } else if (action === "fetch-images") {
      handlerResponse = await fetchImagesHandler(makeReq("https://internal/api/admin/fetch-images", "POST"));
    } else {
      return NextResponse.json({ error: "Veprim i panjohur" }, { status: 400 });
    }

    const data = await handlerResponse.json().catch(() => ({}));
    return NextResponse.json({ ok: handlerResponse.ok, status: handlerResponse.status, data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
