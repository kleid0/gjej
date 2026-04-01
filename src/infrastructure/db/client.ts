// Vercel Postgres client + auto-schema bootstrap
// Requires POSTGRES_URL env var (auto-injected by Vercel when DB is linked)

import { sql } from "@vercel/postgres";
export { sql };

let schemaEnsured = false;

export async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;

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

  schemaEnsured = true;
}
