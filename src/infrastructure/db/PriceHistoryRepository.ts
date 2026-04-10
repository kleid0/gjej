// Repository for time-series price data and alert subscriptions

import { sql, rawQuery, ensureSchema } from "./client";
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
  if (prices.length === 0) return;
  // Single multi-row INSERT instead of N individual queries
  const params: unknown[] = [];
  const rows: string[] = [];
  for (const p of prices) {
    const i = params.length;
    params.push(productId, p.storeId, p.price, p.inStock);
    rows.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, CURRENT_DATE)`);
  }
  await rawQuery(
    `INSERT INTO price_history (product_id, store_id, price, in_stock, recorded_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (product_id, store_id, recorded_at)
     DO UPDATE SET price = EXCLUDED.price, in_stock = EXCLUDED.in_stock`,
    params,
  );
}

/**
 * Batch-record prices for multiple products in a single INSERT.
 * Used by cron/admin to collapse an entire chunk (e.g. 12 products × 6 stores
 * = 72 rows) into one query instead of 72.
 */
export async function batchRecordPrices(
  entries: Array<{ productId: string; prices: ScrapedPrice[] }>,
): Promise<void> {
  await ready();
  const params: unknown[] = [];
  const rows: string[] = [];
  for (const { productId, prices } of entries) {
    for (const p of prices) {
      const i = params.length;
      params.push(productId, p.storeId, p.price, p.inStock);
      rows.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, CURRENT_DATE)`);
    }
  }
  if (rows.length === 0) return;
  await rawQuery(
    `INSERT INTO price_history (product_id, store_id, price, in_stock, recorded_at)
     VALUES ${rows.join(", ")}
     ON CONFLICT (product_id, store_id, recorded_at)
     DO UPDATE SET price = EXCLUDED.price, in_stock = EXCLUDED.in_stock`,
    params,
  );
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
    // Single query: COALESCE products.lowest_price with the latest price_history
    // fallback for products whose lowest_price was cleared by a failed cron run.
    const result = await sql`
      SELECT p.id,
             COALESCE(p.lowest_price, hist.lowest_price) AS lowest_price
      FROM products p
      LEFT JOIN LATERAL (
        SELECT MIN(ph.price) AS lowest_price
        FROM price_history ph
        WHERE ph.product_id = p.id
          AND ph.price IS NOT NULL
          AND ph.recorded_at = (
            SELECT MAX(ph2.recorded_at)
            FROM price_history ph2
            WHERE ph2.product_id = p.id AND ph2.price IS NOT NULL
          )
      ) hist ON p.lowest_price IS NULL
      WHERE p.lowest_price IS NOT NULL
         OR hist.lowest_price IS NOT NULL
    `;
    return Object.fromEntries(
      result.rows.map((r) => [r.id as string, r.lowest_price as number]),
    );
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

/**
 * Batch-update last_seen_at + lowest_price for multiple products in a single
 * query. Replaces per-product markProductLastSeen() + updateProductLowestPrice()
 * calls — saves ~2 queries per product.
 */
export async function batchUpdateProductPrices(
  updates: Array<{ productId: string; lowestPrice: number | null }>,
): Promise<void> {
  if (updates.length === 0) return;
  try {
    await ready();
    // Use unnest to batch-update in a single query
    const ids: string[] = [];
    const prices: (number | null)[] = [];
    for (const u of updates) {
      ids.push(u.productId);
      prices.push(u.lowestPrice);
    }
    await rawQuery(
      `UPDATE products
       SET last_seen_at = NOW(),
           lowest_price = batch.price,
           lowest_price_updated_at = NOW()
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::int[]) AS price) AS batch
       WHERE products.id = batch.id`,
      [ids, prices],
    );
  } catch { /* non-fatal */ }
}

/**
 * Batch-insert scraper errors in a single INSERT.
 * Replaces per-error logScraperError() calls.
 */
export async function batchLogScraperErrors(
  errors: Array<{ storeId: string; errorType: string; errorMessage?: string; productId?: string }>,
): Promise<void> {
  if (errors.length === 0) return;
  try {
    await ready();
    const params: unknown[] = [];
    const rows: string[] = [];
    for (const e of errors) {
      const i = params.length;
      params.push(e.storeId, e.errorType, e.errorMessage ?? null, e.productId ?? null);
      rows.push(`($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4})`);
    }
    await rawQuery(
      `INSERT INTO scraper_errors (store_id, error_type, error_message, product_id)
       VALUES ${rows.join(", ")}`,
      params,
    );
  } catch { /* non-fatal */ }
}

/**
 * Query alerts for multiple products at once and return them grouped by product.
 * Replaces per-product getAlertsToNotify() calls.
 */
export async function batchGetAlertsToNotify(
  products: Array<{ productId: string; lowestPrice: number }>,
): Promise<Map<string, AlertRow[]>> {
  const result = new Map<string, AlertRow[]>();
  if (products.length === 0) return result;
  try {
    await ready();
    // Build a VALUES list of (product_id, lowest_price) pairs
    const params: unknown[] = [];
    const rows: string[] = [];
    for (const p of products) {
      const i = params.length;
      params.push(p.productId, p.lowestPrice);
      rows.push(`($${i + 1}, $${i + 2}::int)`);
    }
    const res = await rawQuery(
      `SELECT pa.id, pa.email, pa.threshold, pa.product_id
       FROM price_alerts pa
       INNER JOIN (VALUES ${rows.join(", ")}) AS v(pid, lowest)
         ON pa.product_id = v.pid
       WHERE pa.threshold >= v.lowest
         AND (pa.last_notified_at IS NULL OR pa.last_notified_at < NOW() - INTERVAL '24 hours')`,
      params,
    );
    for (const row of res.rows) {
      const pid = row.product_id as string;
      if (!result.has(pid)) result.set(pid, []);
      result.get(pid)!.push({ id: row.id, email: row.email, threshold: row.threshold });
    }
  } catch { /* non-fatal */ }
  return result;
}

/**
 * Batch-mark multiple alerts as notified in a single UPDATE.
 */
export async function batchMarkAlertsNotified(alertIds: number[]): Promise<void> {
  if (alertIds.length === 0) return;
  try {
    await rawQuery(
      `UPDATE price_alerts SET last_notified_at = NOW() WHERE id = ANY($1::int[])`,
      [alertIds],
    );
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
