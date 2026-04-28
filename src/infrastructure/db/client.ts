// Postgres client used exclusively by the price_alerts table — every other
// piece of state moved to file-backed JSON committed via the cron's
// commitDataFiles helper, so this module is now small.

import { Pool } from "pg";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING,
  ssl: process.env.NODE_ENV !== "development" ? { rejectUnauthorized: false } : undefined,
});

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
  return pool.query(text, params);
}
