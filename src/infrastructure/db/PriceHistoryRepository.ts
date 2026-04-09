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

// ── Scraper error logging ─────────────────────────────────────────────────────

export async function logScraperError(
  storeId: string,
  errorType: string,
  errorMessage?: string,
  productId?: string,
): Promise<void> {
  try {
    await ready();
    await sql`
      INSERT INTO scraper_errors (store_id, error_type, error_message, product_id)
      VALUES (${storeId}, ${errorType}, ${errorMessage ?? null}, ${productId ?? null})
    `;
  } catch {
    // Don't let logging failures break the scraper
  }
}

export interface ScraperErrorRow {
  id: number;
  store_id: string;
  error_type: string;
  error_message: string | null;
  product_id: string | null;
  occurred_at: string;
}

export async function getRecentScraperErrors(limit = 100): Promise<ScraperErrorRow[]> {
  await ready();
  const result = await sql`
    SELECT id, store_id, error_type, error_message, product_id,
           occurred_at AT TIME ZONE 'Europe/Tirane' AS occurred_at
    FROM scraper_errors
    ORDER BY occurred_at DESC
    LIMIT ${limit}
  `;
  return result.rows as ScraperErrorRow[];
}

// ── Discovery log ─────────────────────────────────────────────────────────────

export async function logDiscoveryRun(stats: {
  totalDiscovered: number;
  autoAdded: number;
  pendingReview: number;
  discontinued: number;
}): Promise<void> {
  try {
    await ready();
    await sql`
      INSERT INTO discovery_log (total_discovered, auto_added, pending_review, discontinued)
      VALUES (${stats.totalDiscovered}, ${stats.autoAdded}, ${stats.pendingReview}, ${stats.discontinued})
    `;
  } catch { /* non-fatal */ }
}

export interface DiscoveryLogRow {
  id: number;
  run_at: string;
  total_discovered: number;
  auto_added: number;
  pending_review: number;
  discontinued: number;
}

export async function getDiscoveryLog(limit = 30): Promise<DiscoveryLogRow[]> {
  await ready();
  const result = await sql`
    SELECT id, run_at AT TIME ZONE 'Europe/Tirane' AS run_at,
           total_discovered, auto_added, pending_review, discontinued
    FROM discovery_log
    ORDER BY run_at DESC
    LIMIT ${limit}
  `;
  return result.rows as DiscoveryLogRow[];
}

// ── Store health ──────────────────────────────────────────────────────────────

/** Returns the most recent recorded_at date string per store (from price_history). */
export async function getStoreLastRecorded(): Promise<Record<string, string>> {
  try {
    await ready();
    const result = await sql`
      SELECT store_id, MAX(recorded_at)::text AS last_recorded
      FROM price_history
      WHERE price IS NOT NULL
      GROUP BY store_id
    `;
    return Object.fromEntries(result.rows.map((r) => [r.store_id as string, r.last_recorded as string]));
  } catch {
    return {};
  }
}

// ── Bulk lowest-price lookup (used as fallback when file cache is empty) ──────

/**
 * Returns a map of productId → lowest_price for all products that have a
 * recorded lowest price in the DB. Used as a fallback when prices.json has
 * not yet been populated by the cron/admin trigger.
 */
export async function getProductLowestPrices(): Promise<Record<string, number>> {
  try {
    await ready();
    // Primary: products.lowest_price kept up-to-date by the cron
    const productResult = await sql`
      SELECT id, lowest_price FROM products WHERE lowest_price IS NOT NULL
    `;
    const prices: Record<string, number> = Object.fromEntries(
      productResult.rows.map((r) => [r.id as string, r.lowest_price as number])
    );

    // Fallback: for any product whose lowest_price was cleared (e.g. by a
    // failed cron run), pull the minimum price from the most-recent date in
    // price_history so the homepage can still show something.
    const histResult = await sql`
      SELECT ph.product_id, MIN(ph.price) AS lowest_price
      FROM price_history ph
      INNER JOIN (
        SELECT product_id, MAX(recorded_at) AS max_date
        FROM price_history
        WHERE price IS NOT NULL
        GROUP BY product_id
      ) latest
        ON ph.product_id = latest.product_id
       AND ph.recorded_at  = latest.max_date
      WHERE ph.price IS NOT NULL
      GROUP BY ph.product_id
    `;
    for (const r of histResult.rows) {
      const id = r.product_id as string;
      if (!(id in prices)) {
        prices[id] = r.lowest_price as number;
      }
    }

    return prices;
  } catch {
    return {};
  }
}

// ── Product catalogue helpers ─────────────────────────────────────────────────

export async function updateProductLowestPrice(
  productId: string,
  lowestPrice: number | null,
): Promise<void> {
  try {
    await ready();
    await sql`
      UPDATE products
      SET lowest_price = ${lowestPrice},
          lowest_price_updated_at = NOW()
      WHERE id = ${productId}
    `;
  } catch { /* non-fatal */ }
}

export async function markProductLastSeen(productId: string): Promise<void> {
  try {
    await ready();
    await sql`UPDATE products SET last_seen_at = NOW() WHERE id = ${productId}`;
  } catch { /* non-fatal */ }
}

export async function markDiscontinuedProducts(): Promise<number> {
  try {
    await ready();
    const result = await sql`
      UPDATE products
      SET catalogue_status = 'discontinued'
      WHERE catalogue_status NOT IN ('discontinued')
        AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '30 days')
      RETURNING id
    `;
    return result.rows.length;
  } catch {
    return 0;
  }
}

export interface AdminStats {
  totalProducts: number;
  enrichedProducts: number;
  discontinuedProducts: number;
  missingImageProducts: number;
  pendingReviewMappings: number;
  recentErrors: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  await ready();
  const [totals, errCount] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE catalogue_status != 'discontinued') AS total,
        COUNT(*) FILTER (WHERE enriched_at IS NOT NULL) AS enriched,
        COUNT(*) FILTER (WHERE catalogue_status = 'discontinued') AS discontinued,
        COUNT(*) FILTER (WHERE (image_url IS NULL OR image_url = '') AND catalogue_status != 'discontinued') AS missing_image
      FROM products
    `,
    sql`
      SELECT COUNT(*) AS cnt FROM scraper_errors
      WHERE occurred_at > NOW() - INTERVAL '24 hours'
    `,
  ]);

  let pendingMappings = 0;
  try {
    const mappingResult = await sql`
      SELECT COUNT(*) AS cnt FROM store_mappings WHERE status = 'pending'
    `;
    pendingMappings = Number(mappingResult.rows[0]?.cnt ?? 0);
  } catch { /* table may not exist yet */ }

  const t = totals.rows[0];
  return {
    totalProducts: Number(t?.total ?? 0),
    enrichedProducts: Number(t?.enriched ?? 0),
    discontinuedProducts: Number(t?.discontinued ?? 0),
    missingImageProducts: Number(t?.missing_image ?? 0),
    pendingReviewMappings: pendingMappings,
    recentErrors: Number(errCount.rows[0]?.cnt ?? 0),
  };
}
