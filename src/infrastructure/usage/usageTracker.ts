// Self-metered "eyes" on Vercel Hobby usage.
//
// Vercel won't let a Hobby account configure usage alerts (Pro feature), so
// the app meters its own dominant consumer: the cron functions. Each tracked
// invocation adds its duration to a monthly GB-hours estimate persisted in
// data/usage-stats.json (riding the cron's chore(data): commit like every
// other state file). Once a day, at the end of the full refresh run, a usage
// snapshot is logged and — if the month is PROJECTED to cross the warn
// threshold — a one-email-per-month warning goes to ADMIN_EMAIL via Resend.
//
// Honest scope: this tracks the cron routes (refresh-prices ≈ 99% of function
// time, plus discover/trends). User-facing requests are short and not counted
// — Vercel's own dashboard/emails remain the authoritative meter; this is the
// early tripwire so the limit isn't tripped by surprise.

import {
  readJsonFile,
  writeJsonFile,
  markDirty,
} from "@/src/infrastructure/persistence/JsonStore";
import { USAGE_STATS_FILE } from "@/src/infrastructure/persistence/paths";
import { createLogger } from "@/src/infrastructure/logging/logger";

const log = createLogger("usage");

// Hobby's classic included function allowance is 100 GB-hours/month. Vercel
// periodically reshapes pricing, so both knobs are env-overridable.
const GBHOURS_LIMIT = Number(process.env.VERCEL_GBHOURS_LIMIT) || 100;
const WARN_PCT = Number(process.env.VERCEL_USAGE_WARN_PCT) || 80;

// Vercel Node functions run on AWS Lambda, which exposes its memory size.
// Fall back to 1769 MB (a common Vercel size) — overestimating is the safe
// direction for a warning system.
const MEMORY_GB =
  (Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 1769) / 1024;

export interface MonthUsage {
  invocations: number;
  functionSeconds: number;
  gbHours: number;
  /** Set when the warning email for this month has been sent. */
  warnedAt: string | null;
}

interface UsageFile {
  updatedAt: string;
  months: Record<string, MonthUsage>;
}

const EMPTY: UsageFile = { updatedAt: new Date(0).toISOString(), months: {} };

export function monthKeyUtc(d: Date): string {
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

/** Keep only the `keep` most recent month buckets (pure, for tests). */
export function pruneMonths(
  months: Record<string, MonthUsage>,
  keep = 3,
): Record<string, MonthUsage> {
  const keys = Object.keys(months).sort();
  const kept = keys.slice(-keep);
  const out: Record<string, MonthUsage> = {};
  for (const k of kept) out[k] = months[k];
  return out;
}

/** Linear month-end projection of GB-hours usage (pure, for tests). */
export function projectMonthly(
  usedGbHours: number,
  now: Date,
  limit: number = GBHOURS_LIMIT,
): { projected: number; pctUsed: number; pctProjected: number } {
  const day = now.getUTCDate();
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const projected = day > 0 ? (usedGbHours / day) * daysInMonth : usedGbHours;
  return {
    projected,
    pctUsed: (usedGbHours / limit) * 100,
    pctProjected: (projected / limit) * 100,
  };
}

/**
 * Add one function invocation's duration to the current month's estimate.
 * Callers time the handler body; the trailing GitHub commit (~2-4 s) isn't
 * included, so the estimate runs slightly low — acceptable for a tripwire.
 */
export async function recordInvocation(durationMs: number): Promise<void> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = (file.months[key] ??= {
    invocations: 0,
    functionSeconds: 0,
    gbHours: 0,
    warnedAt: null,
  });
  const seconds = Math.max(0, durationMs) / 1000;
  month.invocations += 1;
  month.functionSeconds = Math.round((month.functionSeconds + seconds) * 100) / 100;
  month.gbHours = Math.round((month.gbHours + (seconds / 3600) * MEMORY_GB) * 10000) / 10000;
  file.months = pruneMonths(file.months);
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(USAGE_STATS_FILE, file);
  markDirty(USAGE_STATS_FILE);
}

/** Current-month usage + projection, for the admin panel. Null if untracked. */
export async function getUsageSnapshot(): Promise<
  (MonthUsage & { month: string; limitGbHours: number; projectedGbHours: number; pctProjected: number }) | null
> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = file.months[key];
  if (!month) return null;
  const p = projectMonthly(month.gbHours, new Date());
  return {
    ...month,
    month: key,
    limitGbHours: GBHOURS_LIMIT,
    projectedGbHours: Math.round(p.projected * 100) / 100,
    pctProjected: Math.round(p.pctProjected * 10) / 10,
  };
}

/**
 * Log the daily usage snapshot and, when the month-end projection crosses
 * WARN_PCT, email ADMIN_EMAIL — at most once per month. Called once per day
 * at the end of the full refresh run, before the log flush so the snapshot
 * rides the same commit.
 */
export async function maybeWarnUsage(): Promise<void> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = file.months[key];
  if (!month) return;

  const p = projectMonthly(month.gbHours, new Date());
  log.info("vercel usage snapshot", {
    month: key,
    invocations: month.invocations,
    gbHours: month.gbHours,
    limitGbHours: GBHOURS_LIMIT,
    pctUsed: Math.round(p.pctUsed * 10) / 10,
    projectedGbHours: Math.round(p.projected * 100) / 100,
    pctProjected: Math.round(p.pctProjected * 10) / 10,
  });

  if (p.pctProjected < WARN_PCT || month.warnedAt) return;

  log.warn("vercel usage projected to cross threshold", {
    month: key,
    pctProjected: Math.round(p.pctProjected * 10) / 10,
    warnPct: WARN_PCT,
  });

  const to = process.env.ADMIN_EMAIL;
  if (to && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Gjej.al <noreply@gjej.al>",
        to,
        subject: `Kujdes: përdorimi i Vercel ~${Math.round(p.pctProjected)}% i limitit (projeksion ${key})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#d97706;margin-bottom:8px">Përdorimi i Vercel po i afrohet limitit</h2>
            <p style="color:#374151">
              Deri tani këtë muaj: <strong>${month.gbHours} GB-orë</strong> nga
              ${GBHOURS_LIMIT} të përfshira (funksionet cron).<br>
              Projeksioni për fund muaji: <strong>${Math.round(p.projected)} GB-orë
              (~${Math.round(p.pctProjected)}%)</strong>.
            </p>
            <p style="color:#374151">
              Kontrollo panelin e Vercel → Usage për shifrat zyrtare. Për të ulur
              konsumin: rrit intervalin e cron-it ose zvogëlo BATCH_SIZE.
            </p>
          </div>
        `,
      });
      month.warnedAt = new Date().toISOString();
      file.updatedAt = month.warnedAt;
      await writeJsonFile(USAGE_STATS_FILE, file);
      markDirty(USAGE_STATS_FILE);
    } catch (err) {
      log.error("usage warning email failed", { err });
    }
  }
}
