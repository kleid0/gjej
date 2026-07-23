import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { priceQuery } from "@/src/infrastructure/container";
import { STORES } from "@/src/infrastructure/stores/registry";
import { withRequestLog } from "@/src/infrastructure/logging/withRequestLog";
import { getProductLowestPrices } from "@/src/infrastructure/db/PriceHistoryRepository";
import {
  PRICES_FILE,
  CATALOGUE_STATE_FILE,
  DISCOVERED_PRODUCTS_FILE,
  snapshotReadPath,
} from "@/src/infrastructure/persistence/paths";

export const dynamic = "force-dynamic";

// GET /api/health
// Returns status of all scrapers and last price update time.
// DB liveness is NOT probed on every call — uptime monitors hitting this
// endpoint would otherwise consume a significant share of the Neon query
// quota. A stalled cron (lastPriceUpdate > 24h) surfaces DB issues anyway.
//
// ?diag=1 adds a `data` section reporting exactly what the running server
// reads for each data file (resolved path, existence, size, parsed counts).
// This is how we tell, from a browser, whether the deployed function can
// actually see the committed price data — reads that work locally can still
// fail at runtime if cwd / file-tracing differs on the host.
export const GET = withRequestLog("health", async (req) => {
  const cacheResult = await checkPriceCache().catch(() => null);

  const lastPriceUpdate = cacheResult?.lastUpdate ?? null;
  const storeStatuses = cacheResult?.storeStatuses
    ?? STORES.map((s) => ({ storeId: s.id, name: s.name, lastSeen: null, ok: false }));

  const allOk = storeStatuses.every((s) => s.ok);

  const wantsDiag = new URL(req.url).searchParams.get("diag") === "1";
  const data = wantsDiag ? await dataDiagnostics() : undefined;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      lastPriceUpdate,
      stores: storeStatuses,
      ...(data ? { data } : {}),
    },
    { status: allOk ? 200 : 503 },
  );
});

/**
 * Report what the running server actually reads for each data file. Every
 * step is guarded so a single failure still yields a JSON row explaining it.
 */
async function dataDiagnostics() {
  const files = [
    { key: "prices", file: PRICES_FILE },
    { key: "catalogueState", file: CATALOGUE_STATE_FILE },
    { key: "discoveredProducts", file: DISCOVERED_PRODUCTS_FILE },
  ];

  const perFile: Record<string, unknown> = {};
  for (const { key, file } of files) {
    const resolved = snapshotReadPath(file);
    const bundlePath = path.join(process.cwd(), "data", path.basename(file));
    let size: number | null = null;
    let readable = false;
    let count: number | null = null;
    try {
      const raw = await fs.readFile(resolved, "utf-8");
      readable = true;
      size = raw.length;
      const parsed = JSON.parse(raw);
      if (key === "discoveredProducts") {
        count = Array.isArray(parsed) ? parsed.length : null;
      } else if (key === "catalogueState") {
        const products = parsed?.products ?? {};
        count = Object.values(products).filter(
          (e): e is { status?: string; lowestPrice?: number | null } =>
            !!e && typeof e === "object",
        ).filter((e) => e.status !== "discontinued" && e.lowestPrice != null).length;
      } else {
        count = Object.keys(parsed).length;
      }
    } catch {
      /* readable stays false */
    }
    perFile[key] = {
      configuredPath: file,
      resolvedPath: resolved,
      existsAtResolved: fsSync.existsSync(resolved),
      existsAtBundle: fsSync.existsSync(bundlePath),
      readable,
      size,
      count, // catalogueState: priced entries; others: total entries
    };
  }

  // The number the category page's fallback actually gets.
  let lowestPricesCount: number | null = null;
  try {
    lowestPricesCount = Object.keys(await getProductLowestPrices()).length;
  } catch {
    /* leave null */
  }

  return {
    cwd: process.cwd(),
    vercel: !!process.env.VERCEL,
    files: perFile,
    getProductLowestPricesCount: lowestPricesCount,
  };
}

async function checkPriceCache(): Promise<{
  lastUpdate: string | null;
  storeStatuses: Array<{ storeId: string; name: string; lastSeen: string | null; ok: boolean }>;
}> {
  const allPrices = await priceQuery.getAllCachedPrices();
  const entries = Object.values(allPrices);

  const lastUpdate = entries.length
    ? entries
        .map((r) => r.refreshedAt)
        .sort()
        .at(-1) ?? null
    : null;

  // For each store, find the most recent time it returned a non-null price
  const storeLastSeen: Record<string, string> = {};
  for (const record of entries) {
    for (const price of record.prices) {
      if (price.price !== null) {
        const prev = storeLastSeen[price.storeId];
        if (!prev || record.refreshedAt > prev) {
          storeLastSeen[price.storeId] = record.refreshedAt;
        }
      }
    }
  }

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const storeStatuses = STORES.map((s) => {
    const lastSeen = storeLastSeen[s.id] ?? null;
    return {
      storeId: s.id,
      name: s.name,
      lastSeen,
      ok: lastSeen !== null && lastSeen > twentyFourHoursAgo,
    };
  });

  return { lastUpdate, storeStatuses };
}
