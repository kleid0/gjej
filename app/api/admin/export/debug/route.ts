import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

export async function GET() {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json({ error: "No connection string" });
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const count = await client.query("SELECT COUNT(*) FROM price_history");
    const sample = await client.query("SELECT product_id, store_id, price, recorded_at FROM price_history LIMIT 5");
    const stores = await client.query("SELECT store_id, COUNT(*), MAX(recorded_at) FROM price_history GROUP BY store_id");
    return NextResponse.json({
      total_rows: count.rows[0].count,
      sample: sample.rows,
      by_store: stores.rows,
    });
  } finally {
    await client.end().catch(() => {});
  }
}
