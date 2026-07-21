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

// Included allowances. Vercel periodically reshapes pricing, so every knob is
// env-overridable — set them from the numbers on your dashboard's Usage tab.
// Under Fluid compute the binding limit for this app has been ACTIVE CPU
// (the June 2026 near-miss that got the daily schedule paused), so that's
// metered directly via process.cpuUsage(); wall-clock GB-hours is kept as a
// second, conservative meter.
const GBHOURS_LIMIT = Number(process.env.VERCEL_GBHOURS_LIMIT) || 100;
const CPU_HOURS_LIMIT = Number(process.env.VERCEL_CPU_HOURS_LIMIT) || 4;
const WARN_PCT = Number(process.env.VERCEL_USAGE_WARN_PCT) || 80;
// Hard circuit breaker: cron routes refuse to run past this % of EITHER
// limit (actual month-to-date, not projection) until the month rolls over.
const BREAKER_PCT = Number(process.env.VERCEL_USAGE_BREAKER_PCT) || 95;

// Vercel Node functions run on AWS Lambda, which exposes its memory size.
// Fall back to 1769 MB (a common Vercel size) — overestimating is the safe
// direction for a warning system.
const MEMORY_GB =
  (Number(process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE) || 1769) / 1024;

export interface MonthUsage {
  invocations: number;
  functionSeconds: number;
  gbHours: number;
  /** Active CPU seconds (user+system) measured via process.cpuUsage(). */
  cpuSeconds?: number;
  /** Set when the warning email for this month has been sent. */
  warnedAt: string | null;
  /** Set when the breaker-tripped email for this month has been sent. */
  breakerNotifiedAt?: string | null;
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
 * Add one function invocation's duration (and, when provided, its active-CPU
 * delta from process.cpuUsage(start)) to the current month's estimate.
 * Callers time the handler body; the trailing GitHub commit (~2-4 s) isn't
 * included, so the estimate runs slightly low — acceptable for a tripwire.
 */
export async function recordInvocation(
  durationMs: number,
  cpu?: NodeJS.CpuUsage,
): Promise<void> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = (file.months[key] ??= {
    invocations: 0,
    functionSeconds: 0,
    gbHours: 0,
    cpuSeconds: 0,
    warnedAt: null,
  });
  const seconds = Math.max(0, durationMs) / 1000;
  month.invocations += 1;
  month.functionSeconds = Math.round((month.functionSeconds + seconds) * 100) / 100;
  month.gbHours = Math.round((month.gbHours + (seconds / 3600) * MEMORY_GB) * 10000) / 10000;
  if (cpu) {
    const cpuSec = Math.max(0, cpu.user + cpu.system) / 1e6;
    month.cpuSeconds = Math.round(((month.cpuSeconds ?? 0) + cpuSec) * 100) / 100;
  }
  file.months = pruneMonths(file.months);
  file.updatedAt = new Date().toISOString();
  await writeJsonFile(USAGE_STATS_FILE, file);
  markDirty(USAGE_STATS_FILE);
}

// ── Circuit breaker ──────────────────────────────────────────────────────────

export interface BreakerLimits {
  gbHoursLimit: number;
  cpuHoursLimit: number;
  breakerPct: number;
}

const DEFAULT_LIMITS: BreakerLimits = {
  gbHoursLimit: GBHOURS_LIMIT,
  cpuHoursLimit: CPU_HOURS_LIMIT,
  breakerPct: BREAKER_PCT,
};

/**
 * Pure verdict: has this month's ACTUAL usage crossed the breaker threshold
 * on either meter? (Actuals, not projections — a kill switch must not trip
 * on day-1 extrapolation noise.)
 */
export function breakerVerdict(
  month: MonthUsage | undefined,
  limits: BreakerLimits = DEFAULT_LIMITS,
): { tripped: boolean; reason: string; cpuHours: number; gbHours: number } {
  const cpuHours = Math.round(((month?.cpuSeconds ?? 0) / 3600) * 1000) / 1000;
  const gbHours = month?.gbHours ?? 0;
  const cpuCap = (limits.cpuHoursLimit * limits.breakerPct) / 100;
  const gbCap = (limits.gbHoursLimit * limits.breakerPct) / 100;
  if (cpuHours >= cpuCap) {
    return {
      tripped: true, cpuHours, gbHours,
      reason: `active CPU ${cpuHours}h >= ${limits.breakerPct}% of ${limits.cpuHoursLimit}h limit`,
    };
  }
  if (gbHours >= gbCap) {
    return {
      tripped: true, cpuHours, gbHours,
      reason: `function ${gbHours} GB-hours >= ${limits.breakerPct}% of ${limits.gbHoursLimit} GB-hour limit`,
    };
  }
  return { tripped: false, reason: "", cpuHours, gbHours };
}

/**
 * The kill switch. Cron routes call this after hydrating the usage file and
 * BEFORE doing any work; when it reports tripped they log, persist, and
 * return early — so the app stops burning Vercel compute on its own, with no
 * human in the loop. Resets automatically when the month rolls over (fresh
 * month bucket) or when the limits are raised via env.
 *
 * On the first trip of the month this also emails ADMIN_EMAIL (once).
 */
export async function enforceUsageBreaker(): Promise<{ tripped: boolean; reason: string }> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = file.months[key];
  const verdict = breakerVerdict(month);
  if (!verdict.tripped || !month) return { tripped: verdict.tripped, reason: verdict.reason };

  log.warn("usage breaker TRIPPED — cron paused until month rolls over", {
    month: key,
    reason: verdict.reason,
    cpuHours: verdict.cpuHours,
    gbHours: verdict.gbHours,
  });

  const to = process.env.ADMIN_EMAIL;
  if (!month.breakerNotifiedAt && to && process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Gjej.al <noreply@gjej.al>",
        to,
        subject: `Cron-et u NDALUAN: limiti i Vercel u arrit (${key})`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#dc2626;margin-bottom:8px">Siguresa e përdorimit u aktivizua</h2>
            <p style="color:#374151">
              Cron-et e scraping-ut u ndaluan automatikisht që të mos kalohet
              limiti i Vercel:<br><strong>${verdict.reason}</strong>
            </p>
            <p style="color:#374151">
              Rifillojnë vetë muajin e ardhshëm. Për t'i rikthyer më herët,
              rrit <code>VERCEL_CPU_HOURS_LIMIT</code> /
              <code>VERCEL_GBHOURS_LIMIT</code> në Vercel env (kontrollo më parë
              panelin Usage) dhe redeploy.
            </p>
          </div>
        `,
      });
      month.breakerNotifiedAt = new Date().toISOString();
      file.updatedAt = month.breakerNotifiedAt;
      await writeJsonFile(USAGE_STATS_FILE, file);
      markDirty(USAGE_STATS_FILE);
    } catch (err) {
      log.error("breaker email failed", { err });
    }
  }
  return { tripped: true, reason: verdict.reason };
}

/** Current-month usage + projection, for the admin panel. Null if untracked. */
export async function getUsageSnapshot(): Promise<
  | (MonthUsage & {
      month: string;
      limitGbHours: number;
      projectedGbHours: number;
      pctProjected: number;
      cpuHours: number;
      limitCpuHours: number;
      breakerTripped: boolean;
    })
  | null
> {
  const file = await readJsonFile<UsageFile>(USAGE_STATS_FILE, EMPTY);
  const key = monthKeyUtc(new Date());
  const month = file.months[key];
  if (!month) return null;
  const p = projectMonthly(month.gbHours, new Date());
  const cpuHours = Math.round(((month.cpuSeconds ?? 0) / 3600) * 1000) / 1000;
  return {
    ...month,
    month: key,
    limitGbHours: GBHOURS_LIMIT,
    projectedGbHours: Math.round(p.projected * 100) / 100,
    pctProjected: Math.round(p.pctProjected * 10) / 10,
    cpuHours,
    limitCpuHours: CPU_HOURS_LIMIT,
    breakerTripped: breakerVerdict(month).tripped,
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
  const cpuHours = Math.round(((month.cpuSeconds ?? 0) / 3600) * 1000) / 1000;
  const cpuP = projectMonthly(cpuHours, new Date(), CPU_HOURS_LIMIT);
  log.info("vercel usage snapshot", {
    month: key,
    invocations: month.invocations,
    gbHours: month.gbHours,
    limitGbHours: GBHOURS_LIMIT,
    pctUsed: Math.round(p.pctUsed * 10) / 10,
    projectedGbHours: Math.round(p.projected * 100) / 100,
    pctProjected: Math.round(p.pctProjected * 10) / 10,
    cpuHours,
    limitCpuHours: CPU_HOURS_LIMIT,
    cpuPctProjected: Math.round(cpuP.pctProjected * 10) / 10,
  });

  if ((p.pctProjected < WARN_PCT && cpuP.pctProjected < WARN_PCT) || month.warnedAt) return;

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
