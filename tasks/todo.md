# Prisma Postgres Quota Fix — Migrate to Neon + Batch DB Operations

## Problem

Prisma Postgres free tier hit 100% of monthly operations limit.
Root cause: the daily `refresh-prices` cron executes ~146,000+ DB operations
(16,240 products × ~9 queries each).

## Solution (two-pronged)

### 1. Migrate from Prisma Postgres to Neon

Neon charges by **compute time**, not operation count. The free tier gives
191.9 compute hours/month — more than enough for our workload.

**Steps to migrate:**

- [x] Update `src/infrastructure/db/client.ts` to accept `DATABASE_URL` env var (Neon standard)
- [ ] **Create a Neon account** at https://neon.tech and create a project
- [ ] **Export data** from Prisma Postgres: `pg_dump "$PRISMA_POSTGRES_URL" > backup.sql`
- [ ] **Import into Neon**: `psql "$NEON_DATABASE_URL" < backup.sql`
- [ ] **Update Vercel env vars**: set `DATABASE_URL` to the Neon pooled connection string
  - Neon provides both pooled (port 5432) and direct (port 5433) URLs
  - Use the **pooled** URL for `DATABASE_URL`
- [ ] **Deploy and verify** — the schema auto-creates via `ensureSchema()` if tables don't exist
- [ ] **Remove old Prisma Postgres** env vars once confirmed working

**No code changes needed beyond what's in this PR** — the `pg` driver works identically with Neon.

### 2. Batch DB operations (code changes in this PR)

| Before | After | Reduction |
|--------|-------|-----------|
| `recordPrices()`: 1 INSERT per store per product (6/product) | `batchRecordPrices()`: 1 multi-row INSERT per chunk of 12 | ~72x per chunk |
| `markProductLastSeen()` + `updateProductLowestPrice()`: 2 queries per product | `batchUpdateProductPrices()`: 1 query per chunk | ~24x per chunk |
| `logScraperError()`: 1 INSERT per error | `batchLogScraperErrors()`: 1 multi-row INSERT per chunk | ~Nx per chunk |
| `getAlertsToNotify()`: 1 SELECT per product | `batchGetAlertsToNotify()`: 1 query per chunk | ~12x per chunk |
| `markAlertNotified()`: 1 UPDATE per alert | `batchMarkAlertsNotified()`: 1 UPDATE per chunk | ~Nx per chunk |
| `getProductLowestPrices()`: 2 separate queries | Single COALESCE + LATERAL JOIN query | 2x |

**Estimated daily operations: ~5,400 (down from ~146,000) — a 27x reduction.**

### 3. Query monitoring

- Added query counter to `sql()` and `rawQuery()` in `client.ts`
- `GET /api/admin/db-usage` endpoint to check current query count
- Cron response now includes `dbQueries` field for tracking

## Files changed

- `src/infrastructure/db/client.ts` — query counter, `rawQuery()`, Neon-compatible env
- `src/infrastructure/db/PriceHistoryRepository.ts` — batch operations, optimized queries
- `app/api/cron/refresh-prices/route.ts` — uses batched ops
- `app/api/admin/trigger/route.ts` — uses batched ops
- `app/api/admin/db-usage/route.ts` — new monitoring endpoint
