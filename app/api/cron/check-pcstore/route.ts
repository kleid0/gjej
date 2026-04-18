import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import {
  getServiceProbeState,
  recordServiceProbe,
} from "@/src/infrastructure/db/PriceHistoryRepository";

export const maxDuration = 30;

const SERVICE = "pcstore";
const PROBE_URL = "https://www.pcstore.al/wp-json/wc/store/v1/products?per_page=1";
const PROBE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Accept": "application/json",
};

// GET /api/cron/check-pcstore
// Weekly health probe for the disabled pcstore.al integration.
// Sends one email when the status flips down→up so the admin knows it's
// time to flip `enabled: true` in the store registry.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await probe();
  const previous = await getServiceProbeState(SERVICE);
  const flippedUp = status === "up" && previous?.lastStatus !== "up";

  let notified = false;
  if (flippedUp) {
    notified = await notifyAdmin();
  }

  await recordServiceProbe(SERVICE, status, notified);

  return NextResponse.json({
    service: SERVICE,
    status,
    previousStatus: previous?.lastStatus ?? null,
    notified,
  });
}

async function probe(): Promise<"up" | "down"> {
  try {
    const res = await axios.get(PROBE_URL, {
      timeout: 10_000,
      headers: PROBE_HEADERS,
      validateStatus: () => true,
    });
    if (res.status !== 200) return "down";
    return Array.isArray(res.data) && res.data.length > 0 ? "up" : "down";
  } catch {
    return "down";
  }
}

async function notifyAdmin(): Promise<boolean> {
  const to = process.env.ADMIN_EMAIL;
  if (!to || !process.env.RESEND_API_KEY) return false;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "Gjej.al <noreply@gjej.al>",
      to,
      subject: "PC Store është përsëri i arritshëm",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#16a34a;margin-bottom:8px">PC Store është përsëri online</h2>
          <p style="color:#374151">
            Probe-i javor i pcstore.al sapo ktheu një përgjigje 200 me produkte.
            WAF-i duket se nuk po bllokon më kërkesat tona.
          </p>
          <p style="color:#374151">
            Për ta riaktivizuar, vendos <code>enabled: true</code> te
            <code>src/infrastructure/stores/registry.ts</code> dhe redeploy.
          </p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Failed to send pcstore-up notification", err);
    return false;
  }
}
