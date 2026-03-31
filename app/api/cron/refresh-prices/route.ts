import { NextRequest, NextResponse } from "next/server";
import { priceQuery, productCatalog } from "@/src/infrastructure/container";
import {
  recordPrices,
  getAlertsToNotify,
  markAlertNotified,
} from "@/src/infrastructure/db/PriceHistoryRepository";
import type { Product } from "@/src/domain/catalog/Product";

// Allow up to 5 minutes — scraping all products takes time
export const maxDuration = 300;

// GET /api/cron/refresh-prices
// Called daily by Vercel Cron. Scrapes every known product across all stores,
// writes results to data/prices.json, records to DB, and fires price alerts.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allProducts = await productCatalog.getAllProducts();

  const results = await Promise.all(
    allProducts.map((product) =>
      priceQuery.getPricesForProduct(product.id, product.searchTerms)
    )
  );

  // Record to DB and check price alerts (failures are isolated per product)
  await Promise.allSettled(
    allProducts.map(async (product, i) => {
      const { prices } = results[i];
      await recordPrices(product.id, prices);

      const found = prices.filter((p) => p.price !== null);
      if (found.length === 0) return;
      const lowest = Math.min(...found.map((p) => p.price!));

      const alerts = await getAlertsToNotify(product.id, lowest);
      for (const alert of alerts) {
        await sendAlertEmail(alert.email, product, lowest, alert.threshold);
        await markAlertNotified(alert.id);
      }
    })
  );

  return NextResponse.json({
    refreshed: allProducts.length,
    timestamp: new Date().toISOString(),
  });
}

async function sendAlertEmail(
  email: string,
  product: Product,
  price: number,
  threshold: number
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const productName = `${product.brand} ${product.family}`.trim();
    const priceFormatted = price.toLocaleString("sq-AL");
    const thresholdFormatted = threshold.toLocaleString("sq-AL");
    await resend.emails.send({
      from: "Gjej.al <noreply@gjej.al>",
      to: email,
      subject: `Çmimi u ul: ${productName} — ${priceFormatted} ALL`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#ea580c;margin-bottom:8px">Çmimi u ul!</h2>
          <p style="color:#374151">
            <strong>${productName}</strong> tani mund të gjendet për
            <strong style="color:#ea580c">${priceFormatted} ALL</strong>,
            nën pragun tuaj prej ${thresholdFormatted} ALL.
          </p>
          <a href="https://gjej.al/produkt/${product.id}"
             style="display:inline-block;margin-top:16px;background:#ea580c;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">
            Shiko ofertën →
          </a>
          <p style="color:#9ca3af;font-size:12px;margin-top:24px">
            Gjej.al — Krahasimi i Çmimeve në Shqipëri.<br>
            Për të çaktivizuar njoftimet, vizitoni faqen e produktit.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send alert email to", email, err);
  }
}
