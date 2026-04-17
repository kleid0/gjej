// Postgres client using pg.Pool — works with Neon, Vercel Postgres, or any
// standard PostgreSQL provider.  Replaces @vercel/postgres sql tag which only
// accepts pooled URLs.

import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||          // Neon (preferred)
    process.env.POSTGRES_URL ||          // Vercel / Prisma Postgres
    process.env.POSTGRES_URL_NON_POOLING,
  ssl: process.env.NODE_ENV !== "development" ? { rejectUnauthorized: false } : undefined,
});

// ── Query monitoring ────────────────────────────────────────────────────────
// Tracks total queries executed so we can expose usage stats in the admin panel
// and detect quota-risk situations early.

let _queryCount = 0;
let _queryCountResetAt = Date.now();

/** Number of queries executed since the last reset. */
export function getQueryCount(): { count: number; since: string } {
  return { count: _queryCount, since: new Date(_queryCountResetAt).toISOString() };
}

/** Reset the query counter (called at the start of each cron run). */
export function resetQueryCount(): void {
  _queryCount = 0;
  _queryCountResetAt = Date.now();
}

// pg returns untyped rows; callers cast as needed
// deno-lint-ignore no-explicit-any
type SqlResult = { rows: any[] };

export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<SqlResult> {
  let text = "";
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      params.push(values[i]);
      text += `$${params.length}`;
    }
  }
  _queryCount++;
  return pool.query(text, params);
}

/**
 * Execute a raw SQL string with positional parameters.
 * Used by batch operations that build multi-row VALUES clauses dynamically.
 */
export async function rawQuery(text: string, params: unknown[] = []): Promise<SqlResult> {
  _queryCount++;
  return pool.query(text, params);
}

let schemaEnsured = false;

// In production, schema is stable — set DB_SCHEMA_READY=1 to skip the 17
// idempotent DDL round-trips that otherwise run on every serverless cold
// start. Cron routes that need a fresh schema can call ensureSchema(true).
export async function ensureSchema(force = false): Promise<void> {
  if (schemaEnsured) return;
  if (!force && process.env.DB_SCHEMA_READY === "1") {
    schemaEnsured = true;
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id          SERIAL PRIMARY KEY,
      product_id  TEXT    NOT NULL,
      store_id    TEXT    NOT NULL,
      price       INTEGER,
      in_stock    BOOLEAN,
      recorded_at DATE    NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE(product_id, store_id, recorded_at)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_price_history_lookup
    ON price_history(product_id, recorded_at DESC)
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id              TEXT PRIMARY KEY,
      model_number    TEXT        NOT NULL DEFAULT '',
      family          TEXT        NOT NULL DEFAULT '',
      brand           TEXT        NOT NULL DEFAULT '',
      category        TEXT        NOT NULL DEFAULT '',
      subcategory     TEXT        NOT NULL DEFAULT '',
      image_url       TEXT        NOT NULL DEFAULT '',
      storage_options JSONB       NOT NULL DEFAULT '[]',
      search_terms    JSONB       NOT NULL DEFAULT '[]',
      variant         JSONB,
      specs           JSONB,
      description     TEXT,
      official_images JSONB,
      enriched_at     TIMESTAMPTZ,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_brand
    ON products(brand)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_products_family
    ON products(family)
  `;

  // Catalogue status + discovery tracking columns (idempotent)
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS catalogue_status TEXT NOT NULL DEFAULT 'discovered'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS lowest_price INTEGER`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS lowest_price_updated_at TIMESTAMPTZ`;

  // Store mappings: persist store→catalogue product mapping decisions
  await sql`
    CREATE TABLE IF NOT EXISTS store_mappings (
      id                   SERIAL PRIMARY KEY,
      store_id             TEXT        NOT NULL,
      store_product_id     TEXT        NOT NULL,
      store_product_name   TEXT,
      catalogue_product_id TEXT        NOT NULL,
      match_method         TEXT        NOT NULL DEFAULT 'name_match',
      confidence           INTEGER     NOT NULL DEFAULT 0,
      status               TEXT        NOT NULL DEFAULT 'pending',
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(store_id, store_product_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_store_mappings_catalogue
    ON store_mappings(catalogue_product_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_store_mappings_status
    ON store_mappings(status)
  `;

  // Scraper errors log for admin panel visibility
  await sql`
    CREATE TABLE IF NOT EXISTS scraper_errors (
      id            SERIAL PRIMARY KEY,
      store_id      TEXT        NOT NULL,
      error_type    TEXT        NOT NULL,
      error_message TEXT,
      product_id    TEXT,
      occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_scraper_errors_occurred
    ON scraper_errors(occurred_at DESC)
  `;

  // Discovery log: daily summary rows
  await sql`
    CREATE TABLE IF NOT EXISTS discovery_log (
      id                SERIAL PRIMARY KEY,
      run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total_discovered  INTEGER     NOT NULL DEFAULT 0,
      auto_added        INTEGER     NOT NULL DEFAULT 0,
      pending_review    INTEGER     NOT NULL DEFAULT 0,
      discontinued      INTEGER     NOT NULL DEFAULT 0
    )
  `;

  schemaEnsured = true;
}
