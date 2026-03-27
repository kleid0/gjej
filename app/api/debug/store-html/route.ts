import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { STORE_MAP } from "@/lib/stores";

// Temporary debug endpoint — remove before merging to main
// GET /api/debug/store-html?store=albagame&q=Nintendo+Switch+2
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("store");
  const q = req.nextUrl.searchParams.get("q") ?? "Nintendo Switch 2";
  const offset = parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10);

  const store = storeId ? STORE_MAP[storeId] : null;
  if (!store) {
    return NextResponse.json({ error: "unknown store", available: Object.keys(STORE_MAP) }, { status: 400 });
  }

  const urls = store.searchUrls(q);
  const results: { url: string; status: number | string; html: string }[] = [];

  for (const url of urls) {
    try {
      const { status, data } = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "sq-AL,sq;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
      // Return 8000 chars starting at offset so we can inspect different parts
      results.push({ url, status, html: String(data).slice(offset, offset + 8000) });
      break;
    } catch (err: unknown) {
      const e = err as { response?: { status: number }; message: string };
      results.push({ url, status: e.response?.status ?? e.message, html: "" });
    }
  }

  return NextResponse.json(results);
}
