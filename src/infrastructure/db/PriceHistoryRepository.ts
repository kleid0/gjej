// Repository for time-series price data and alert subscriptions

import { sql, ensureSchema } from "./client";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

let schemaReady = false;

async function ready(): Promise<void> {
  if (!schemaReady) {
    await ensureSchema();
    schemaReady = true;
  }
}

// ── Price history ────────────────────────────────────────────────────────────

export async function recordPrices(productId: string, prices: ScrapedPrice[]): Promise<void> {
  await ready();
  for (const p of prices) {
    await sql`
      INSERT INTO price_history (product_id, store_id, price, in_stock, recorded_at)
      VALUES (${productId}, ${p.storeId}, ${p.price}, ${p.inStock}, CURRENT_DATE)
      ON CONFLICT (product_id, store_id, recorded_at)
      DO UPDATE SET price = EXCLUDED.price, in_stock = EXCLUDED.in_stock
    `;
  }
}

export interface DailyPriceRow {
  date: string;
  [storeId: string]: string | number | null;
}

export async function getPriceHistory(
  productId: string,
  days: number
): Promise<{ rows: DailyPriceRow[]; daysOldest: number }> {
  await ready();

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split("T")[0];

  const result = await sql`
    SELECT store_id, price, in_stock, recorded_at::text AS date
    FROM price_history
    WHERE product_id = ${productId}
      AND recorded_at >= ${sinceStr}::date
    ORDER BY recorded_at ASC, store_id
  `;

  // Pivot: rows keyed by date, columns keyed by store_id
  const byDate = new Map<string, Record<string, number | null>>();
  for (const row of result.rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, {});
    byDate.get(row.date)![row.store_id] = row.price as number | null;
  }

  const rows: DailyPriceRow[] = Array.from(byDate.entries()).map(([date, storeData]) => ({
    date,
    ...storeData,
  }));

  const daysOldest =
    result.rows.length > 0
      ? Math.floor(
          (Date.now() - new Date(result.rows[0].date + "T00:00:00Z").getTime()) / 86_400_000
        )
      : 0;

  return { rows, daysOldest };
}

// ── Price alerts ─────────────────────────────────────────────────────────────

export async function saveAlert(
  productId: string,
  email: string,
  threshold: number
): Promise<void> {
  await ready();
  await sql`
    INSERT INTO price_alerts (product_id, email, threshold)
    VALUES (${productId}, ${email}, ${threshold})
    ON CONFLICT (product_id, email)
    DO UPDATE SET threshold = EXCLUDED.threshold
  `;
}

export interface AlertRow {
  id: number;
  email: string;
  threshold: number;
}

export async function getAlertsToNotify(
  productId: string,
  currentLowest: number
): Promise<AlertRow[]> {
  await ready();
  const result = await sql`
    SELECT id, email, threshold
    FROM price_alerts
    WHERE product_id = ${productId}
      AND threshold >= ${currentLowest}
      AND (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '24 hours')
  `;
  return result.rows as AlertRow[];
}

export async function markAlertNotified(alertId: number): Promise<void> {
  await sql`
    UPDATE price_alerts SET last_notified_at = NOW() WHERE id = ${alertId}
  `;
}
