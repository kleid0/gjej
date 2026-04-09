import { NextResponse } from "next/server";
import { Client } from "pg";

export const dynamic = "force-dynamic";

function makeClient() {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;
  if (!connectionString) throw new Error("No connection string");
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } });
}

// GET: check price_history stats
export async function GET() {
  const client = makeClient();
  await client.connect();
  try {
    const count = await client.query("SELECT COUNT(*) FROM price_history");
    const sample = await client.query(
      "SELECT product_id, store_id, price, recorded_at FROM price_history LIMIT 5"
    );
    const stores = await client.query(
      "SELECT store_id, COUNT(*), MAX(recorded_at) FROM price_history GROUP BY store_id"
    );
    return NextResponse.json({
      total_rows: count.rows[0].count,
      sample: sample.rows,
      by_store: stores.rows,
    });
  } finally {
    await client.end().catch(() => {});
  }
}

// POST: seed test price data so the suspicious-prices export can be verified
export async function POST() {
  const client = makeClient();
  await client.connect();
  try {
    // Two real product IDs from the catalog; four stores from the registry.
    // Prices are designed so pcstore is ~62% above avg (flagged high)
    // and globe is ~52% below avg (flagged low).
    const testRows = [
      // Product 1
      { product_id: "shpresa-hp-elitebook-840-g11-14-16gb-512gb-core-ultra-7-3", store_id: "shpresa",  price: 150000 },
      { product_id: "shpresa-hp-elitebook-840-g11-14-16gb-512gb-core-ultra-7-3", store_id: "neptun",   price: 150000 },
      { product_id: "shpresa-hp-elitebook-840-g11-14-16gb-512gb-core-ultra-7-3", store_id: "pcstore",  price: 255000 },
      { product_id: "shpresa-hp-elitebook-840-g11-14-16gb-512gb-core-ultra-7-3", store_id: "globe",    price:  75000 },
      // Product 2
      { product_id: "shpresa-lenovo-thinkpad-x1-2-in-1-g10-14-touchscreen-32gb-1tb-ssd-core-ultra-7-2", store_id: "shpresa", price: 200000 },
      { product_id: "shpresa-lenovo-thinkpad-x1-2-in-1-g10-14-touchscreen-32gb-1tb-ssd-core-ultra-7-2", store_id: "neptun",  price: 195000 },
      { product_id: "shpresa-lenovo-thinkpad-x1-2-in-1-g10-14-touchscreen-32gb-1tb-ssd-core-ultra-7-2", store_id: "pcstore", price: 340000 },
      { product_id: "shpresa-lenovo-thinkpad-x1-2-in-1-g10-14-touchscreen-32gb-1tb-ssd-core-ultra-7-2", store_id: "globe",   price: 110000 },
    ];

    let inserted = 0;
    for (const row of testRows) {
      await client.query(
        `INSERT INTO price_history (product_id, store_id, price, in_stock, recorded_at)
         VALUES ($1, $2, $3, true, CURRENT_DATE)
         ON CONFLICT (product_id, store_id, recorded_at)
         DO UPDATE SET price = EXCLUDED.price, in_stock = EXCLUDED.in_stock`,
        [row.product_id, row.store_id, row.price]
      );
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, rows: testRows });
  } finally {
    await client.end().catch(() => {});
  }
}
