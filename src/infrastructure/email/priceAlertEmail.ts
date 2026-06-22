// Sends a "price dropped below your threshold" email via Resend. Extracted
// from the refresh-prices cron route so the Vercel route and the GitHub
// Actions refresh runner notify subscribers with identical content. No-op
// when RESEND_API_KEY is unset (e.g. local dev or a CI run without secrets).

import type { Product } from "@/src/domain/catalog/Product";
import { createLogger } from "@/src/infrastructure/logging/logger";

const log = createLogger("email/priceAlert");

export async function sendPriceAlertEmail(
  email: string,
  product: Product,
  price: number,
  threshold: number,
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
    log.error("alert email failed", { email, err });
  }
}
