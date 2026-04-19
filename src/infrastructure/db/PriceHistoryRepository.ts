// Repository for time-series price data and alert subscriptions

import { unstable_cache } from "next/cache";
import { sql, rawQuery, ensureSchema } from "./client";
import { FileProductRepository } from "@/src/infrastructure/persistence/FileProductRepository";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";

// Cache tags used to invalidate wrapped queries after cron writes
export const LOWEST_PRICES_TAG = "product-lowest-prices";
export const ADMIN_STATS_TAG   = "admin-stats";

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

// 90 days is the longest range the product chart can usefully render;
// a year of daily rows × N stores is 10x the data for no visible benefit.
const MAX_PRICE_HISTORY_DAYS = 90;

export async function getPriceHistory(
  productId: string,
  days: number
): Promise<{ rows: DailyPriceRow[]; daysOldest: number }> {
  await ready();

  const clampedDays = Math.min(Math.max(days, 1), MAX_PRICE_HISTORY_DAYS);
  const since = new Date();
  since.setDate(since.getDate() - clampedDays);
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
 *
 * Wrapped in unstable_cache so the full-catalogue LATERAL JOIN runs at most
 * once per hour per edge instead of once per page request. Cron invalidates
 * the tag after writes so fresh data is picked up immediately.
 */
export interface ProductPriceInfo {
  price: number;
  storeCount: number;
}

async function _getProductLowestPrices(): Promise<Record<string, ProductPriceInfo>> {
  try {
    await ready();
    const result = await sql`
      SELECT id, lowest_price, store_count
      FROM products
      WHERE lowest_price IS NOT NULL
        AND catalogue_status != 'discontinued'
    `;
    return Object.fromEntries(
      result.rows.map((r) => [
        r.id as string,
        { price: r.lowest_price as number, storeCount: (r.store_count as number | null) ?? 1 },
      ]),
    );
  } catch {
    return {};
  }
}

export const getProductLowestPrices = unstable_cache(
  _getProductLowestPrices,
  ["product-lowest-prices-v1"],
  { revalidate: 3600, tags: [LOWEST_PRICES_TAG] },
);

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
  updates: Array<{ productId: string; lowestPrice: number | null; storeCount?: number }>,
): Promise<void> {
  if (updates.length === 0) return;
  try {
    await ready();
    const ids: string[] = [];
    const prices: (number | null)[] = [];
    const counts: (number | null)[] = [];
    for (const u of updates) {
      ids.push(u.productId);
      prices.push(u.lowestPrice);
      counts.push(u.storeCount ?? null);
    }
    await rawQuery(
      `UPDATE products
       SET last_seen_at = NOW(),
           lowest_price = batch.price,
           lowest_price_updated_at = NOW(),
           store_count = COALESCE(batch.cnt, store_count)
       FROM (SELECT unnest($1::text[]) AS id, unnest($2::int[]) AS price, unnest($3::smallint[]) AS cnt) AS batch
       WHERE products.id = batch.id`,
      [ids, prices, counts],
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

const productRepoForStats = new FileProductRepository();

async function _getAdminStats(): Promise<AdminStats> {
  await ready();

  // Catalogue counters come from the JSON catalogue (source of truth).
  // The Postgres `products` table is a sparse denormalised cache populated
  // only by the one-shot /admin/migrate endpoint, so counting rows there
  // reported zeros even when the catalogue had thousands of items.
  const [products, errCount, discontinuedRes] = await Promise.all([
    productRepoForStats.getAll(),
    sql`
      SELECT COUNT(*) AS cnt FROM scraper_errors
      WHERE occurred_at > NOW() - INTERVAL '24 hours'
    `,
    sql`
      SELECT COUNT(*) AS cnt FROM products WHERE catalogue_status = 'discontinued'
    `,
  ]);

  let pendingMappings = 0;
  try {
    const mappingResult = await sql`
      SELECT COUNT(*) AS cnt FROM store_mappings WHERE status = 'pending'
    `;
    pendingMappings = Number(mappingResult.rows[0]?.cnt ?? 0);
  } catch { /* table may not exist yet */ }

  let enriched = 0;
  let missingImage = 0;
  for (const p of products) {
    if (p.enrichedAt) enriched++;
    if (!p.imageUrl) missingImage++;
  }

  return {
    totalProducts: products.length,
    enrichedProducts: enriched,
    discontinuedProducts: Number(discontinuedRes.rows[0]?.cnt ?? 0),
    missingImageProducts: missingImage,
    pendingReviewMappings: pendingMappings,
    recentErrors: Number(errCount.rows[0]?.cnt ?? 0),
  };
}

// Admin dashboard stats change at most once per cron run (daily). A short
// TTL keeps the panel reactive when the admin triggers a manual refresh.
export const getAdminStats = unstable_cache(
  _getAdminStats,
  ["admin-stats-v1"],
  { revalidate: 600, tags: [ADMIN_STATS_TAG] },
);

// ── Service probes (disabled-store health checks) ──────────────────────────

export interface ServiceProbeState {
  lastStatus: "up" | "down";
  lastNotified: Date | null;
}

export async function getServiceProbeState(service: string): Promise<ServiceProbeState | null> {
  await ready();
  const result = await sql`
    SELECT last_status, last_notified FROM service_probes WHERE service = ${service}
  `;
  const row = result.rows[0];
  if (!row) return null;
  return {
    lastStatus: row.last_status === "up" ? "up" : "down",
    lastNotified: row.last_notified ? new Date(row.last_notified as string) : null,
  };
}

export async function recordServiceProbe(
  service: string,
  status: "up" | "down",
  notified: boolean,
): Promise<void> {
  await ready();
  if (notified) {
    await sql`
      INSERT INTO service_probes (service, last_status, last_checked, last_notified)
      VALUES (${service}, ${status}, NOW(), NOW())
      ON CONFLICT (service) DO UPDATE
        SET last_status = EXCLUDED.last_status,
            last_checked = NOW(),
            last_notified = NOW()
    `;
  } else {
    await sql`
      INSERT INTO service_probes (service, last_status, last_checked)
      VALUES (${service}, ${status}, NOW())
      ON CONFLICT (service) DO UPDATE
        SET last_status = EXCLUDED.last_status,
            last_checked = NOW()
    `;
  }
}
