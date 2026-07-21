// Per-store HTTP plumbing for scrapers: the failure tally surfaced in cron
// "run complete" logs, plus request throttling and 403 backoff-retry.
//
// Why: run #56's tally measured shpresa.al 403-ing ~9% of lookups, starting
// only after ~20 minutes of sustained scraping — a rate-limit signature, not
// a hard block (pcstore's WAF is the hard-block case). So shpresa requests
// are throttled (small concurrency cap + minimum gap between request starts,
// instead of the cron's 12-way bursts) and a transient 403 gets one delayed
// retry. Recovered retries are tallied as `${storeId}:403-recovered` so the
// next run's logs show whether the fix is working.

import axios from "axios";
import type { AxiosRequestConfig, AxiosResponse } from "axios";

// ── Failure tally ────────────────────────────────────────────────────────────
// Keyed `${storeId}:${status}` (HTTP code, or "timeout"/"network"/"error").
// One map per cron invocation; snapshot-and-reset via takeStoreHttpFailures()
// at the end of each batch. A 403/timeout otherwise looks identical to
// "product not found", so without this the gap is invisible.

const tallies = new Map<string, number>();

function bump(key: string): void {
  tallies.set(key, (tallies.get(key) ?? 0) + 1);
}

export function recordStoreHttpFailure(storeId: string, e: unknown): void {
  let status: string | number = "error";
  if (axios.isAxiosError(e)) {
    status = e.response?.status ?? (e.code === "ECONNABORTED" ? "timeout" : e.code ?? "network");
  }
  bump(`${storeId}:${status}`);
}

/** Snapshot and reset the failure tally. Call once at the end of a cron batch. */
export function takeStoreHttpFailures(): Record<string, number> {
  const out: Record<string, number> = {};
  tallies.forEach((v, k) => { out[k] = v; });
  tallies.clear();
  return out;
}

// ── Per-store throttle ───────────────────────────────────────────────────────

interface StoreLimit {
  /** Max in-flight requests to the store. */
  concurrency: number;
  /** Minimum gap between request STARTS, across all lanes. */
  minGapMs: number;
}

// Stores that need throttling; everything else passes through untouched.
// Tuned to smooth the cron's bursts without meaningfully slowing the run:
// requests are latency-bound (~300-800ms each), so 3 lanes with a 150ms
// start gap caps bursts while sustaining similar overall throughput.
const LIMITS: Record<string, StoreLimit> = {
  shpresa: { concurrency: 3, minGapMs: 150 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class StoreLimiter {
  private active = 0;
  private lastStart = 0;
  private queue: Array<() => void> = [];

  constructor(private readonly cfg: StoreLimit) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.active >= this.cfg.concurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    // Reserve the next start slot so bursts are spaced even across lanes.
    const now = Date.now();
    const startAt = Math.max(now, this.lastStart + this.cfg.minGapMs);
    this.lastStart = startAt;
    if (startAt > now) await sleep(startAt - now);
    try {
      return await fn();
    } finally {
      this.active--;
      this.queue.shift()?.();
    }
  }
}

const limiters = new Map<string, StoreLimiter>();

function limiterFor(storeId: string): StoreLimiter | null {
  const cfg = LIMITS[storeId];
  if (!cfg) return null;
  let limiter = limiters.get(storeId);
  if (!limiter) {
    limiter = new StoreLimiter(cfg);
    limiters.set(storeId, limiter);
  }
  return limiter;
}

// ── 403 backoff-retry ────────────────────────────────────────────────────────

const RETRY_403_DELAY_MS = 1500;

/**
 * Run a store request through its throttle (if configured), retrying exactly
 * once after a delay when the store answers 403. The retry re-enters the
 * throttle. Recoveries are tallied; a second 403 propagates to the caller's
 * catch, which records the final failure.
 */
export async function with403Retry<T>(
  storeId: string,
  fn: () => Promise<T>,
  retryDelayMs: number = RETRY_403_DELAY_MS,
): Promise<T> {
  const limiter = limiterFor(storeId);
  const run = () => (limiter ? limiter.run(fn) : fn());
  try {
    return await run();
  } catch (e) {
    if (!(axios.isAxiosError(e) && e.response?.status === 403)) throw e;
    await sleep(retryDelayMs);
    const result = await run();
    bump(`${storeId}:403-recovered`);
    return result;
  }
}

/** Throttled, 403-retrying axios.get for store endpoints. */
export function storeGet<T = unknown>(
  storeId: string,
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> {
  return with403Retry(storeId, () => axios.get<T>(url, config));
}
