# Release Preparation

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
