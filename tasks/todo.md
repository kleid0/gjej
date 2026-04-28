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
