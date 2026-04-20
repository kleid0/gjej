# Release Preparation

## Git-as-DB Migration (2026-04-20) — PLANNING
Branch: `claude/optimize-database-usage-DpFrN`. Triggered by hitting 100% of
Neon free tier. Prior round (e0e2P) of caching/quota-trimming wasn't enough.

### Goal
Eliminate Neon entirely by (a) committing cron-written data as JSON files in
the repo and (b) moving user-writable alerts to Upstash Redis (free tier).

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

### Plan (phased, each phase ships independently)

**Phase A — alerts to Upstash** (unblocks site even if Neon stays paused)
- [ ] Add `@upstash/redis` dep.
- [ ] Export existing alerts from Neon if DB accessible; else start fresh (probably empty or tiny).
- [ ] New `UpstashAlertRepository` implementing existing alert interface.
- [ ] Swap `POST /api/price-alerts` + cron alert-fanout to use it.
- [ ] Keys: `alert:<uuid>` hash; index set `alerts:by-product:<productId>` for cron lookup.

**Phase B — cron writes JSON + commits to GitHub**
- [ ] Add `GITHUB_TOKEN` (fine-grained PAT, `contents:write` on this repo only).
- [ ] Helper: `commitDataFiles(files, message)` uses GitHub Contents API — one commit per cron run (~4/day, trivial).
- [ ] `refresh-prices` cron now writes: `price_history.json`, `discovered-products.json` (with merged lowest_price/store_count), `scraper_errors.json`, `store_mappings.json`, `service_probes.json`.
- [ ] `discover` cron updates `discovery_log.json` + `discovered-products.json`.
- [ ] Each JSON has a simple `{ updatedAt, data }` envelope.

**Phase C — app reads from files, not DB**
- [ ] `getProductLowestPrices()` → read `discovered-products.json`.
- [ ] `getAdminStats()` / `getRecentScraperErrors()` / `getDiscoveryLog()` / `getStoreLastRecorded()` → read the corresponding JSON.
- [ ] `getPriceHistory()` → read `price_history.json`, filter by product + date.
- [ ] Drop all the `unstable_cache` wrappers around DB calls (file reads are fast; Next.js fetch layer caches the file anyway).

**Phase D — remove Neon**
- [ ] Delete `src/infrastructure/db/client.ts`, `PriceHistoryRepository.ts` DB code paths, `ensureSchema`.
- [ ] Remove `pg` from `package.json`.
- [ ] Remove `DATABASE_URL` / `POSTGRES_URL` from docs.

### Risks / open questions
1. **Commit volume**: 4 cron runs/day → ~1.5k commits/yr. Acceptable but noisy. Mitigation: keep the data branch separate? (Decision needed — default is commit to same branch, it's fine for a small project.)
2. **Deploy-time freshness**: Vercel picks up the latest commit on deploy. If cron commits during a deploy there's no race — next request sees old committed file until next cron/deploy. Fine.
3. **Alerts data loss**: if Neon is already paused, we can't export existing alerts. Need to check with user — may be zero or small.
4. **Build size**: `price_history.json` at 90 days × ~300 products × 6 stores ≈ 1–3 MB. Fine.
5. **First-deploy seeding**: Phase B ships empty JSONs initially; first cron run populates them. Admin panel will look empty for ~24h. Acceptable?

### Verification at end
- [ ] `npx tsc --noEmit` + `npm run lint` + `npm test` pass
- [ ] Local: run cron endpoint, confirm JSON files update + commit lands
- [ ] Homepage, search, category, product detail all render with no `DATABASE_URL` set
- [ ] `package.json` has no `pg`
- [ ] Sanity check: site builds + renders with `DATABASE_URL=""`

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
