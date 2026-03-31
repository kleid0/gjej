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

  schemaEnsured = true;
}
