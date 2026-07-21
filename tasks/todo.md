# Shpresa 403 Mitigation (2026-06-20) — SHIPPED PENDING VERIFICATION
Follow-up to the logging work below. The httpFailures tally (PR #59) measured
shpresa.al 403-ing ~9% of lookups (432/4800), starting only after ~20 min of
sustained scraping — rate-limiting under the cron's 12-way bursts, not a hard
block.

Fix (`src/infrastructure/scrapers/storeHttp.ts`):
- Per-store throttle: shpresa capped at 3 concurrent requests with a 150 ms
  gap between request starts (requests are latency-bound, so this smooths
  bursts without meaningfully slowing the run — GHA's 350-min cap was the
  constraint against heavier throttling).
- One backoff-retry (1.5 s) on 403; recoveries tallied as
  `shpresa:403-recovered` in the run-complete log.
- Tally moved from PriceScraper to storeHttp (re-exported, callers unchanged);
  variation-fetch and slug-inference catches now also record failures.

Verify by comparing `httpFailures` in data/logs/events.ndjson before/after the
deploy: expect `shpresa:403` to drop toward 0 and `shpresa:403-recovered` to
absorb the transient ones.

# Draconian Logging (2026-06-20) — PLAN / IN PROGRESS
Branch: `claude/sweet-newton-9iueew`. Goal: comprehensive structured logging
that (a) Claude can read back later and (b) stays inside Vercel Hobby limits.

## Constraints (why the design is shaped this way)
- Hobby runtime logs are ephemeral (~24h, capped rows), **no Log Drains**, and
  each line is truncated past ~4KB → log single-line JSON, never multi-line.
- `vercel.json` ignoreCommand skips deploys ONLY for `^chore\(data\):` commits.
  → durable logs must ride the cron's existing `chore(data):` commit, never
  make their own (an extra commit = an extra Hobby deploy).
- User-facing routes have no commit-at-end and can't commit per request →
  console-only for them (read via Vercel MCP runtime logs).

## Design — two channels
1. **Console**: structured single-line JSON, gated by `LOG_LEVEL` (default
   `debug` = "everything"). Read live via Vercel MCP `get_runtime_logs`.
2. **Git NDJSON sink**: in-memory buffer of entries ≥ `LOG_PERSIST_LEVEL`
   (default `debug`), flushed at end of committing runs to a SINGLE rolling
   file `data/logs/events.ndjson`, marked dirty so it commits inside the
   existing `chore(data):` commit. Bounded by a ring-buffer cap (newest
   5000 lines / 4 MB win). Chose one rolling file over per-day files so
   pruning is just the cap — no file deletion via the GitHub Git Data API
   (which the commit helper doesn't support). Durable + readable by Claude
   via `Read` in any future session.

## Tasks
- [x] `src/infrastructure/logging/logger.ts` — levels (debug/info/warn/error),
      `LOG_LEVEL` console gate, single-line JSON `{t,level,scope,msg,...}`,
      `createLogger(scope)` + `.child()`, Error/bigint-safe serialization,
      bounded in-memory persist buffer.
- [x] `src/infrastructure/logging/gitSink.ts` — `flushLogsToGit()`: hydrate
      existing file from GitHub, append buffer, `capLines()` ring buffer,
      markDirty. `capLines` is pure + unit-tested.
- [x] `paths.ts` — `LOGS_DIR` + `EVENTS_LOG_FILE`.
- [x] `withRequestLog()` wrapper — one compact console line per API request
      (method, path, status, ms, err). Wrapped all non-committing routes.
- [x] Replaced all ~21 scattered `console.*` calls with scoped loggers
      (refresh-prices, discover, trends, check-pcstore, admin/*, PriceScraper,
      TrendsService, commitDataFiles).
- [x] Committing routes (4 crons + admin/trigger + admin/recategorize) call
      `flushLogsToGit()` before `takeDirtyFiles()` so the log rides the commit.
- [x] `.env.example`: documented `LOG_LEVEL`, `LOG_PERSIST_LEVEL`.
- [x] Unit test for logger formatting + git-sink cap.

## Verification (all green)
- [x] `npx tsc --noEmit`
- [x] `npm run lint` — no warnings/errors
- [x] `npm test` — 8 files, 127 tests pass (+7 new)
- [x] `DATABASE_URL='' npx next build` — all routes build
- [x] End-to-end demo: real NDJSON written; confirmed single-line JSON,
      Error→{name,message,stack}, and cross-invocation append (ran twice → 6
      lines, not clobbered to 3). Demo file removed afterward.

## Review
- **Two channels.** Console (single-line JSON, `LOG_LEVEL`-gated) → Vercel
  runtime logs, read live via dashboard / Vercel MCP, covers every route.
  Durable git sink (`LOG_PERSIST_LEVEL`-gated) → `data/logs/events.ndjson`,
  readable by Claude in any session, covers committing (cron/admin) runs.
- **Hobby-safe by construction.** Logs ride the existing `chore(data):`
  commit (no extra commits → no extra deploys). Single-line JSON dodges the
  ~4 KB per-line truncation. Ring-buffer cap bounds repo growth. Scraper
  match traces stay gated behind the existing `debugMode` so they don't bury
  the high-signal cron summaries in the bounded file.
- **Defaults.** Both levels default to `debug` ("super chatty"). Set
  `LOG_PERSIST_LEVEL=info` to keep only summaries/warnings/errors in git.
- **Limitation (inherent).** User-facing route logs are console-only — they
  have no end-of-run commit to ride, and committing per request is infeasible
  on Hobby. They live ~24h in Vercel's runtime logs (no Log Drains on Hobby).
- **How to read later.** `data/logs/events.ndjson` in the repo, or ask me to
  pull live console logs via the Vercel MCP `get_runtime_logs`.

---

# Release Preparation

## Git-as-DB Migration (2026-04-20) — DONE
Branch: `claude/optimize-database-usage-DpFrN`. Triggered by hitting 100% of
Neon free tier. Prior round (e0e2P) of caching/quota-trimming wasn't enough.

### Goal
Move all read-mostly / cron-written data into JSON files committed to git
(via the cron's GitHub Git Data API helper). Keep `price_alerts` on Neon
because it's the only user-write path and its volume is trivial — Neon
usage drops to a handful of queries per cron run.

### Current DB surface (8 tables)

| Table | Writer | Reader | Destination |
|---|---|---|---|
| `price_history` | cron (daily) | product chart | `data/price_history.json` (90-day window) |
| `products` (lowest_price, store_count, last_seen_at, catalogue_status) | cron | homepage/search | merged into existing `data/discovered-products.json` |
| `scraper_errors` | cron | admin panel | `data/scraper_errors.json` (last 48h, capped) |
| `discovery_log` | cron | admin panel | `data/discovery_log.json` (last 30 rows) |
| `service_probes` | cron | cron | `data/service_probes.json` |
| `store_mappings` | cron | cron/admin | `data/store_mappings.json` |
| `price_alerts` | **user** + cron | cron | **Upstash Redis** |
| schema itself | cron (`ensureSchema`) | — | delete |

### What shipped
- [x] `src/infrastructure/persistence/JsonStore.ts` — generic JSON load/save
      with snapshot fallback (data/ on disk → /tmp on Vercel) and a
      `markDirty/takeDirtyFiles` registry the cron uses at end-of-run.
- [x] `src/infrastructure/git/commitDataFiles.ts` — multi-file commit via
      the GitHub Git Data API. Retries on 422 (concurrent ref move). No-op
      when `GITHUB_TOKEN`/repo is unconfigured (local dev writes data/
      directly).
- [x] `PriceHistoryRepository.ts` rewritten as a thin layer over JSON files
      for: price history, scraper errors, discovery log, store mappings,
      service probes, catalogue state (replaces products.lowest_price /
      store_count / last_seen_at / catalogue_status). Public exports are
      unchanged so callers don't break.
- [x] `saveAlert` / `getAlertsToNotify` / `markAlertNotified` /
      `batchGetAlertsToNotify` / `batchMarkAlertsNotified` stay on
      Postgres. Their `ensureAlertSchema` only creates the `price_alerts`
      table (the previous global `ensureSchema` is gone).
- [x] `DbProductRepository` deleted; `container.ts` uses
      `FileProductRepository` directly.
- [x] Cron routes (`refresh-prices`, `discover`, `check-pcstore`) and
      admin trigger call `commitDirtyFiles(takeDirtyFiles(), …)` after
      writes. `prices.json` is force-included in the refresh cron's
      commit list so the website cache stays fresh.
- [x] Deleted `app/api/admin/migrate/route.ts` (one-time DB migration —
      no longer applicable) and `app/api/admin/db-usage/route.ts` (query
      counter is meaningless now).
- [x] Rewrote `app/api/admin/recategorize/route.ts` and
      `app/api/admin/store-coverage/route.ts` to read the file-backed
      catalogue + commit via the GitHub helper.
- [x] `src/infrastructure/db/client.ts` slimmed to just the `pg.Pool` +
      `sql` tag — no more 17-statement schema bootstrap.
- [x] Deleted `src/infrastructure/db/__tests__/batchRecordStoreMappings.test.ts`
      (asserted SQL shape that no longer exists).
- [x] `package.json`: dropped `@vercel/postgres` (was unused after the
      pg.Pool migration). Kept `pg` + `@types/pg` for alerts.

### Required env in Vercel
- `GITHUB_TOKEN` — fine-grained PAT, contents:write on `kleid0/gjej`.
- `VERCEL_GIT_REPO_OWNER` / `VERCEL_GIT_REPO_SLUG` — already injected by Vercel.
- `DATABASE_URL` — keep, only the alerts table uses it.

### Risks accepted
- Commit volume: ~6–8 commits/day from refresh-prices self-chain plus 1
  for discover. Acceptable; data commits are mixed in with code on main.
- First deploy after the migration: state files start empty. First cron
  run populates them; admin panel shows empty stats until then.

### Verification
- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` clean
- [x] `npm test` — 7 files, 120 tests pass
- [x] `DATABASE_URL='' npx next build` builds all routes without error

## Neon DB Usage Optimization (2026-04-17) — DONE
Branch: `claude/optimize-database-usage-e0e2P`. Triggered by hitting 75% of
Neon free tier.

- [x] Gate `ensureSchema()` behind `DB_SCHEMA_READY=1` — skip 17 DDL queries
      on every serverless cold start. Cron still runs it with `force=true`.
- [x] Wrap `getProductLowestPrices()` in `unstable_cache` (1h TTL, tagged).
      Also simplified query: the LATERAL fallback is replaced by a plain
      indexed scan of `products.lowest_price` (the cron maintains it).
- [x] Wrap `getAdminStats()` in `unstable_cache` (10min TTL, tagged).
- [x] Cron routes (`refresh-prices`, `discover`) invalidate both cache tags
      after writes so fresh data is served immediately.
- [x] `/api/health` no longer runs `SELECT 1` — uptime monitors would
      otherwise consume a large share of the quota. Liveness is inferred from
      cache freshness; a stalled cron surfaces DB problems anyway.
- [x] `getPriceHistory` clamps `days` to 90 (was unbounded up to 365).
- [x] `npx tsc --noEmit`, `npm run lint`, `npm test` all pass.

**Post-deploy action:** set `DB_SCHEMA_READY=1` in Vercel env after first
deploy that contains this branch — that's where ~half of the savings comes
from.

## Critical Security
- [ ] Upgrade Next.js 14.2.3 -> 14.2.35 (2 critical + 6 high CVEs)
- [ ] Secure /api/discover — add CRON_SECRET auth (currently zero auth)
- [ ] Sanitize error responses in /api/admin/trigger (leaks String(err))

## SEO
- [ ] Create app/robots.ts
- [ ] Create app/not-found.tsx (custom 404)
- [ ] Add favicon (app/icon.svg)
- [ ] Create public/og-default.png fallback
- [ ] Add metadata to homepage, search, category pages
- [ ] Complete sitemap (missing categories + static pages)
- [ ] Add noindex to admin layout
- [ ] Enhance root layout metadata (twitter card, url, locale)

## CI/CD
- [ ] Enable test job in GitHub Actions workflow

## Documentation & Config
- [ ] Write proper README.md
- [ ] Create .env.example
- [ ] Add LICENSE file
- [ ] Fix package.json (author, license fields)
- [ ] Harden .gitignore

## Verification
- [ ] Final lint + typecheck + test + build pass

# Pause cron schedules to stop Fluid Active CPU burn (2026-06-22)
Branch: `claude/vigilant-lamport-eb106n`. Trigger: Vercel Fluid Active CPU at
3h18m / 4h — user said "shut it down we can't hit the fluid cpu limit".

Root cause: 5 scheduled GitHub Actions hit Vercel function endpoints daily.
Biggest = refresh-prices (walks whole catalogue, up to 400 × 300s fn calls/day).

## Done
- [x] Commented out `schedule:` in refresh-prices / discover / trends /
      check-pcstore / store-coverage-report. Kept workflow_dispatch + push
      (on-demand) triggers so nothing auto-fires. Site stays live.
- [x] Validated all workflow YAML still parses; schedule_active=False on all 5.

## IMPORTANT — not yet effective on production
GitHub only runs scheduled workflows from the DEFAULT branch (main). These
edits are on a feature branch, so the live crons keep firing until this lands
on `main`. Needs merge to main (PR or direct push w/ permission) to take effect.
