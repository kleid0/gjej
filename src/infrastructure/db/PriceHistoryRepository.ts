// Storage layer for price history, scraper logs, store mappings, catalogue
// state, service probes — all file-backed (committed to git via the cron's
// commitDataFiles helper). Alerts remain on Postgres because they're the
// only user-write path that needs concurrent low-latency writes.
//
// Public function names are preserved from the previous Postgres-backed
// implementation so callers don't need to change.

import { sql } from "./client";
import type { ScrapedPrice } from "@/src/domain/pricing/Price";
import { FileProductRepository } from "@/src/infrastructure/persistence/FileProductRepository";
import {
  PRICE_HISTORY_FILE,
  SCRAPER_ERRORS_FILE,
  DISCOVERY_LOG_FILE,
  STORE_MAPPINGS_FILE,
  SERVICE_PROBES_FILE,
  CATALOGUE_STATE_FILE,
} from "@/src/infrastructure/persistence/paths";
import {
  readJsonFile,
  writeJsonFile,
  markDirty,
} from "@/src/infrastructure/persistence/JsonStore";

// Cache tags retained for backward compatibility with cron routes that
// call revalidateTag. With everything served from local files, the wraps
// are no-ops, but the tags themselves are still safe to revalidate.
export const LOWEST_PRICES_TAG = "product-lowest-prices";
export const ADMIN_STATS_TAG = "admin-stats";

const PRICE_HISTORY_DAYS = 90;
const MAX_PRICE_HISTORY_DAYS = 90;
const MAX_SCRAPER_ERRORS = 200;
const MAX_DISCOVERY_LOG_ROWS = 30;
const DISCONTINUED_AFTER_DAYS = 30;

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

// ── Price history ────────────────────────────────────────────────────────────

interface PriceHistoryFile {
  updatedAt: string;
  /** byProduct[productId][YYYY-MM-DD][storeId] = price | null */
  byProduct: Record<string, Record<string, Record<string, number | null>>>;
}

async function readPriceHistory(): Promise<PriceHistoryFile> {
  return readJsonFile<PriceHistoryFile>(PRICE_HISTORY_FILE, {
    updatedAt: new Date(0).toISOString(),
    byProduct: {},
  });
}

function pruneOldDays(file: PriceHistoryFile): void {
  const cutoff = daysAgoIso(PRICE_HISTORY_DAYS);
  for (const productId of Object.keys(file.byProduct)) {
    const days = file.byProduct[productId];
    for (const date of Object.keys(days)) {
      if (date < cutoff) delete days[date];
    }
    if (Object.keys(days).length === 0) delete file.byProduct[productId];
  }
}

export async function recordPrices(productId: string, prices: ScrapedPrice[]): Promise<void> {
  if (prices.length === 0) return;
  const file = await readPriceHistory();
  const today = todayUtc();
  const productDays = (file.byProduct[productId] ??= {});
  const dayBucket = (productDays[today] ??= {});
  for (const p of prices) {
    dayBucket[p.storeId] = p.price;
  }
  pruneOldDays(file);
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(PRICE_HISTORY_FILE, file);
  markDirty(PRICE_HISTORY_FILE);
}

export async function batchRecordPrices(
  entries: Array<{ productId: string; prices: ScrapedPrice[] }>,
): Promise<void> {
  if (entries.length === 0) return;
  const file = await readPriceHistory();
  const today = todayUtc();
  for (const { productId, prices } of entries) {
    const productDays = (file.byProduct[productId] ??= {});
    const dayBucket = (productDays[today] ??= {});
    for (const p of prices) {
      dayBucket[p.storeId] = p.price;
    }
  }
  pruneOldDays(file);
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(PRICE_HISTORY_FILE, file);
  markDirty(PRICE_HISTORY_FILE);
}

export interface DailyPriceRow {
  date: string;
  [storeId: string]: string | number | null;
}

export async function getPriceHistory(
  productId: string,
  days: number,
): Promise<{ rows: DailyPriceRow[]; daysOldest: number }> {
  const clampedDays = Math.min(Math.max(days, 1), MAX_PRICE_HISTORY_DAYS);
  const since = daysAgoIso(clampedDays);
  const file = await readPriceHistory();
  const productDays = file.byProduct[productId] ?? {};
  const dates = Object.keys(productDays).filter((d) => d >= since).sort();
  const rows: DailyPriceRow[] = dates.map((date) => ({ date, ...productDays[date] }));
  const daysOldest =
    rows.length > 0
      ? Math.floor((Date.now() - new Date(rows[0].date + "T00:00:00Z").getTime()) / 86_400_000)
      : 0;
  return { rows, daysOldest };
}

/** Returns the most recent recorded date per store across all products. */
export async function getStoreLastRecorded(): Promise<Record<string, string>> {
  const file = await readPriceHistory();
  const out: Record<string, string> = {};
  for (const productDays of Object.values(file.byProduct)) {
    for (const [date, stores] of Object.entries(productDays)) {
      for (const [storeId, price] of Object.entries(stores)) {
        if (price === null) continue;
        if (!out[storeId] || date > out[storeId]) out[storeId] = date;
      }
    }
  }
  return out;
}

// ── Price alerts (Postgres) ──────────────────────────────────────────────────

export interface AlertRow {
  id: number;
  email: string;
  threshold: number;
}

let alertSchemaReady = false;
async function ensureAlertSchema(): Promise<void> {
  if (alertSchemaReady) return;
  if (process.env.DB_SCHEMA_READY === "1") {
    alertSchemaReady = true;
    return;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id               SERIAL PRIMARY KEY,
      product_id       TEXT        NOT NULL,
      email            TEXT        NOT NULL,
      threshold        INTEGER     NOT NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_notified_at TIMESTAMPTZ,
      UNIQUE(product_id, email)
    )
  `;
  alertSchemaReady = true;
}

export async function saveAlert(
  productId: string,
  email: string,
  threshold: number,
): Promise<void> {
  await ensureAlertSchema();
  await sql`
    INSERT INTO price_alerts (product_id, email, threshold)
    VALUES (${productId}, ${email}, ${threshold})
    ON CONFLICT (product_id, email)
    DO UPDATE SET threshold = EXCLUDED.threshold
  `;
}

export async function getAlertsToNotify(
  productId: string,
  currentLowest: number,
): Promise<AlertRow[]> {
  await ensureAlertSchema();
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

export async function batchGetAlertsToNotify(
  products: Array<{ productId: string; lowestPrice: number }>,
): Promise<Map<string, AlertRow[]>> {
  const result = new Map<string, AlertRow[]>();
  if (products.length === 0) return result;
  try {
    await ensureAlertSchema();
    const ids = products.map((p) => p.productId);
    const lowest = products.map((p) => p.lowestPrice);
    const res = await sql`
      SELECT pa.id, pa.email, pa.threshold, pa.product_id
      FROM price_alerts pa
      INNER JOIN UNNEST(${ids}::text[], ${lowest}::int[]) AS v(pid, lowest)
        ON pa.product_id = v.pid
      WHERE pa.threshold >= v.lowest
        AND (pa.last_notified_at IS NULL OR pa.last_notified_at < NOW() - INTERVAL '24 hours')
    `;
    for (const row of res.rows) {
      const pid = row.product_id as string;
      if (!result.has(pid)) result.set(pid, []);
      result.get(pid)!.push({ id: row.id, email: row.email, threshold: row.threshold });
    }
  } catch {
    /* non-fatal */
  }
  return result;
}

export async function batchMarkAlertsNotified(alertIds: number[]): Promise<void> {
  if (alertIds.length === 0) return;
  try {
    await ensureAlertSchema();
    await sql`UPDATE price_alerts SET last_notified_at = NOW() WHERE id = ANY(${alertIds}::int[])`;
  } catch {
    /* non-fatal */
  }
}

// ── Scraper errors ────────────────────────────────────────────────────────────

export interface ScraperErrorRow {
  id: number;
  store_id: string;
  error_type: string;
  error_message: string | null;
  product_id: string | null;
  occurred_at: string;
}

interface ScraperErrorsFile {
  updatedAt: string;
  errors: ScraperErrorRow[];
  nextId: number;
}

async function readScraperErrors(): Promise<ScraperErrorsFile> {
  return readJsonFile<ScraperErrorsFile>(SCRAPER_ERRORS_FILE, {
    updatedAt: new Date(0).toISOString(),
    errors: [],
    nextId: 1,
  });
}

export async function logScraperError(
  storeId: string,
  errorType: string,
  errorMessage?: string,
  productId?: string,
): Promise<void> {
  const file = await readScraperErrors();
  file.errors.unshift({
    id: file.nextId++,
    store_id: storeId,
    error_type: errorType,
    error_message: errorMessage ?? null,
    product_id: productId ?? null,
    occurred_at: new Date().toISOString(),
  });
  if (file.errors.length > MAX_SCRAPER_ERRORS) {
    file.errors.length = MAX_SCRAPER_ERRORS;
  }
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(SCRAPER_ERRORS_FILE, file);
  markDirty(SCRAPER_ERRORS_FILE);
}

export async function batchLogScraperErrors(
  errors: Array<{ storeId: string; errorType: string; errorMessage?: string; productId?: string }>,
): Promise<void> {
  if (errors.length === 0) return;
  const file = await readScraperErrors();
  const occurredAt = new Date().toISOString();
  for (const e of errors) {
    file.errors.unshift({
      id: file.nextId++,
      store_id: e.storeId,
      error_type: e.errorType,
      error_message: e.errorMessage ?? null,
      product_id: e.productId ?? null,
      occurred_at: occurredAt,
    });
  }
  if (file.errors.length > MAX_SCRAPER_ERRORS) {
    file.errors.length = MAX_SCRAPER_ERRORS;
  }
  file.updatedAt = occurredAt;
  await writeJsonFile(SCRAPER_ERRORS_FILE, file);
  markDirty(SCRAPER_ERRORS_FILE);
}

export async function getRecentScraperErrors(limit = 100): Promise<ScraperErrorRow[]> {
  const file = await readScraperErrors();
  return file.errors.slice(0, limit);
}

// ── Discovery log ─────────────────────────────────────────────────────────────

export interface DiscoveryLogRow {
  id: number;
  run_at: string;
  total_discovered: number;
  auto_added: number;
  pending_review: number;
  discontinued: number;
}

interface DiscoveryLogFile {
  updatedAt: string;
  runs: DiscoveryLogRow[];
  nextId: number;
}

async function readDiscoveryLog(): Promise<DiscoveryLogFile> {
  return readJsonFile<DiscoveryLogFile>(DISCOVERY_LOG_FILE, {
    updatedAt: new Date(0).toISOString(),
    runs: [],
    nextId: 1,
  });
}

export async function logDiscoveryRun(stats: {
  totalDiscovered: number;
  autoAdded: number;
  pendingReview: number;
  discontinued: number;
}): Promise<void> {
  const file = await readDiscoveryLog();
  file.runs.unshift({
    id: file.nextId++,
    run_at: new Date().toISOString(),
    total_discovered: stats.totalDiscovered,
    auto_added: stats.autoAdded,
    pending_review: stats.pendingReview,
    discontinued: stats.discontinued,
  });
  if (file.runs.length > MAX_DISCOVERY_LOG_ROWS) file.runs.length = MAX_DISCOVERY_LOG_ROWS;
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(DISCOVERY_LOG_FILE, file);
  markDirty(DISCOVERY_LOG_FILE);
}

export async function getDiscoveryLog(limit = 30): Promise<DiscoveryLogRow[]> {
  const file = await readDiscoveryLog();
  return file.runs.slice(0, limit);
}

// ── Store mappings ────────────────────────────────────────────────────────────

export interface StoreMappingRecord {
  storeId: string;
  storeProductId: string;
  storeProductName: string | null;
  catalogueProductId: string;
  confidence: number;
  matchMethod?: string;
}

interface StoreMappingEntry {
  storeId: string;
  storeProductId: string;
  storeProductName: string | null;
  catalogueProductId: string;
  matchMethod: string;
  confidence: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

interface StoreMappingsFile {
  updatedAt: string;
  /** mapping[`${storeId}:${storeProductId}`] = StoreMappingEntry */
  mappings: Record<string, StoreMappingEntry>;
}

async function readStoreMappings(): Promise<StoreMappingsFile> {
  return readJsonFile<StoreMappingsFile>(STORE_MAPPINGS_FILE, {
    updatedAt: new Date(0).toISOString(),
    mappings: {},
  });
}

export async function batchRecordStoreMappings(
  mappings: StoreMappingRecord[],
): Promise<void> {
  if (mappings.length === 0) return;
  const file = await readStoreMappings();
  const now = new Date().toISOString();
  for (const m of mappings) {
    const key = `${m.storeId}:${m.storeProductId}`;
    const existing = file.mappings[key];
    // Postgres semantics: ON CONFLICT DO UPDATE ... WHERE status = 'pending'.
    // Don't overwrite an admin-approved mapping with a fresh auto-match.
    if (existing && existing.status !== "pending") continue;
    file.mappings[key] = {
      storeId: m.storeId,
      storeProductId: m.storeProductId,
      storeProductName: m.storeProductName,
      catalogueProductId: m.catalogueProductId,
      matchMethod: m.matchMethod ?? "name_match",
      confidence: Math.max(0, Math.min(100, Math.round(m.confidence))),
      status: existing?.status ?? "pending",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }
  file.updatedAt = now;
  await writeJsonFile(STORE_MAPPINGS_FILE, file);
  markDirty(STORE_MAPPINGS_FILE);
}

async function countPendingMappings(): Promise<number> {
  const file = await readStoreMappings();
  let count = 0;
  for (const m of Object.values(file.mappings)) {
    if (m.status === "pending") count++;
  }
  return count;
}

// ── Catalogue state (per-product lowest price + coverage) ────────────────────

export interface ProductPriceInfo {
  price: number;
  storeCount: number;
}

interface CatalogueStateEntry {
  lowestPrice: number | null;
  storeCount: number | null;
  lastSeenAt: string | null;
  status: "discovered" | "discontinued";
  lowestPriceUpdatedAt: string | null;
}

interface CatalogueStateFile {
  updatedAt: string;
  products: Record<string, CatalogueStateEntry>;
}

async function readCatalogueState(): Promise<CatalogueStateFile> {
  return readJsonFile<CatalogueStateFile>(CATALOGUE_STATE_FILE, {
    updatedAt: new Date(0).toISOString(),
    products: {},
  });
}

function ensureProductEntry(
  file: CatalogueStateFile,
  productId: string,
): CatalogueStateEntry {
  let entry = file.products[productId];
  if (!entry) {
    entry = {
      lowestPrice: null,
      storeCount: null,
      lastSeenAt: null,
      status: "discovered",
      lowestPriceUpdatedAt: null,
    };
    file.products[productId] = entry;
  }
  return entry;
}

export async function getProductLowestPrices(): Promise<Record<string, ProductPriceInfo>> {
  const file = await readCatalogueState();
  const out: Record<string, ProductPriceInfo> = {};
  for (const [id, entry] of Object.entries(file.products)) {
    if (entry.status === "discontinued") continue;
    if (entry.lowestPrice == null) continue;
    out[id] = {
      price: entry.lowestPrice,
      storeCount: entry.storeCount ?? 1,
    };
  }
  return out;
}

export async function updateProductLowestPrice(
  productId: string,
  lowestPrice: number | null,
): Promise<void> {
  const file = await readCatalogueState();
  const entry = ensureProductEntry(file, productId);
  entry.lowestPrice = lowestPrice;
  entry.lowestPriceUpdatedAt = new Date().toISOString();
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(CATALOGUE_STATE_FILE, file);
  markDirty(CATALOGUE_STATE_FILE);
}

export async function markProductLastSeen(productId: string): Promise<void> {
  const file = await readCatalogueState();
  const entry = ensureProductEntry(file, productId);
  entry.lastSeenAt = new Date().toISOString();
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(CATALOGUE_STATE_FILE, file);
  markDirty(CATALOGUE_STATE_FILE);
}

export async function batchUpdateProductPrices(
  updates: Array<{ productId: string; lowestPrice: number | null; storeCount?: number }>,
): Promise<void> {
  if (updates.length === 0) return;
  const file = await readCatalogueState();
  const now = new Date().toISOString();
  for (const u of updates) {
    const entry = ensureProductEntry(file, u.productId);
    entry.lowestPrice = u.lowestPrice;
    entry.lowestPriceUpdatedAt = now;
    entry.lastSeenAt = now;
    if (u.storeCount != null) entry.storeCount = u.storeCount;
  }
  file.updatedAt = now;
  await writeJsonFile(CATALOGUE_STATE_FILE, file);
  markDirty(CATALOGUE_STATE_FILE);
}

export async function markDiscontinuedProducts(): Promise<number> {
  const file = await readCatalogueState();
  const cutoff = Date.now() - DISCONTINUED_AFTER_DAYS * 86_400_000;
  let count = 0;
  for (const entry of Object.values(file.products)) {
    if (entry.status === "discontinued") continue;
    const seen = entry.lastSeenAt ? new Date(entry.lastSeenAt).getTime() : 0;
    if (seen < cutoff) {
      entry.status = "discontinued";
      count++;
    }
  }
  if (count > 0) {
    file.updatedAt = new Date().toISOString();
    await writeJsonFile(CATALOGUE_STATE_FILE, file);
    markDirty(CATALOGUE_STATE_FILE);
  }
  return count;
}

// ── Admin stats ───────────────────────────────────────────────────────────────

export interface AdminStats {
  totalProducts: number;
  enrichedProducts: number;
  discontinuedProducts: number;
  missingImageProducts: number;
  pendingReviewMappings: number;
  recentErrors: number;
}

const productRepoForStats = new FileProductRepository();

export async function getAdminStats(): Promise<AdminStats> {
  const [products, errFile, catalogueState, pendingMappings] = await Promise.all([
    productRepoForStats.getAll(),
    readScraperErrors(),
    readCatalogueState(),
    countPendingMappings(),
  ]);

  let enriched = 0;
  let missingImage = 0;
  for (const p of products) {
    if (p.enrichedAt) enriched++;
    if (!p.imageUrl) missingImage++;
  }

  let discontinued = 0;
  for (const entry of Object.values(catalogueState.products)) {
    if (entry.status === "discontinued") discontinued++;
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let recentErrors = 0;
  for (const e of errFile.errors) {
    if (new Date(e.occurred_at).getTime() > cutoff) recentErrors++;
    else break; // errors are stored newest-first
  }

  return {
    totalProducts: products.length,
    enrichedProducts: enriched,
    discontinuedProducts: discontinued,
    missingImageProducts: missingImage,
    pendingReviewMappings: pendingMappings,
    recentErrors,
  };
}

// ── Service probes ────────────────────────────────────────────────────────────

export interface ServiceProbeState {
  lastStatus: "up" | "down";
  lastNotified: Date | null;
}

interface ServiceProbeEntry {
  lastStatus: "up" | "down";
  lastChecked: string;
  lastNotified: string | null;
}

interface ServiceProbesFile {
  updatedAt: string;
  services: Record<string, ServiceProbeEntry>;
}

async function readServiceProbes(): Promise<ServiceProbesFile> {
  return readJsonFile<ServiceProbesFile>(SERVICE_PROBES_FILE, {
    updatedAt: new Date(0).toISOString(),
    services: {},
  });
}

export async function getServiceProbeState(service: string): Promise<ServiceProbeState | null> {
  const file = await readServiceProbes();
  const entry = file.services[service];
  if (!entry) return null;
  return {
    lastStatus: entry.lastStatus,
    lastNotified: entry.lastNotified ? new Date(entry.lastNotified) : null,
  };
}

export async function recordServiceProbe(
  service: string,
  status: "up" | "down",
  notified: boolean,
): Promise<void> {
  const file = await readServiceProbes();
  const now = new Date().toISOString();
  const existing = file.services[service];
  file.services[service] = {
    lastStatus: status,
    lastChecked: now,
    lastNotified: notified ? now : existing?.lastNotified ?? null,
  };
  file.updatedAt = now;
  await writeJsonFile(SERVICE_PROBES_FILE, file);
  markDirty(SERVICE_PROBES_FILE);
}
