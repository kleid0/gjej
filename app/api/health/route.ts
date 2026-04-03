import { NextResponse } from "next/server";
import { sql } from "@/src/infrastructure/db/client";
import { priceQuery } from "@/src/infrastructure/container";
import { STORES } from "@/src/infrastructure/stores/registry";

export const dynamic = "force-dynamic";

// GET /api/health
// Returns status of database, all scrapers, and last price update time.
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkPriceCache(),
  ]);

  const dbResult   = checks[0];
  const cacheResult = checks[1];

  const dbOk    = dbResult.status === "fulfilled" && dbResult.value.ok;
  const cacheOk = cacheResult.status === "fulfilled";

  const lastPriceUpdate = cacheResult.status === "fulfilled"
    ? cacheResult.value.lastUpdate
    : null;

  const storeStatuses = cacheResult.status === "fulfilled"
    ? cacheResult.value.storeStatuses
    : STORES.map((s) => ({ storeId: s.id, name: s.name, lastSeen: null, ok: false }));

  const allOk = dbOk && storeStatuses.every((s) => s.ok);

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      database: {
        ok: dbOk,
        error: dbResult.status === "rejected" ? String(dbResult.reason) : undefined,
      },
      lastPriceUpdate,
      stores: storeStatuses,
    },
    { status: allOk ? 200 : 503 },
  );
}

async function checkDatabase(): Promise<{ ok: boolean }> {
  await sql`SELECT 1`;
  return { ok: true };
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
