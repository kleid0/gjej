# Claude Code Configuration — Gjej.al

## Project Overview

Albanian price comparison app (Next.js 14, TypeScript, Vercel Postgres). Scrapes prices from Foleja, Shpresa Group, Neptun, PC Store, Globe Albania, AlbaGame and displays them in a unified catalog.

**Stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Vercel Postgres · Resend · Recharts

## Behavioral Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing ones
- NEVER create documentation (*.md) or README files unless explicitly requested
- NEVER save files to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER hardcode API keys or credentials in source files

## File Organization

| Directory | Purpose |
|-----------|---------|
| `/app` | Next.js App Router — pages and API routes |
| `/app/api` | API endpoints (scrapers, cron, search, alerts) |
| `/src/domain` | Pure business logic — no external dependencies |
| `/src/application` | Use cases (ProductCatalog, PriceQuery, CatalogDiscovery) |
| `/src/infrastructure` | DB, scrapers, stores, enrichment, DI container |
| `/components` | Reusable React UI components |
| `/data` | File-based JSON cache (discovered-products.json) |
| `/config` | Config files |
| `/scripts` | Utility scripts |

## Architecture: Domain-Driven Design

```
domain/         ← pure entities, no imports from infra
application/    ← use cases, depends on domain only
infrastructure/ ← implements domain interfaces (DB, scrapers, stores)
app/            ← Next.js pages/routes, uses container.ts for DI
```

**Rules:**
- Never import infrastructure directly in UI components — go through `container.ts`
- Domain layer has zero external dependencies
- Use typed interfaces for all public APIs
- Keep files under 500 lines

## Build & Dev

```bash
npm run dev        # dev server at localhost:3000
npm run build      # production build — run before committing
npm run lint       # ESLint check
```

- ALWAYS verify `npm run build` succeeds before committing
- No test suite exists — verify behavior manually or by running build

## Database

**Vercel Postgres** via `@vercel/postgres` with raw SQL (no ORM).

**Tables:** `price_history`, `price_alerts`, `products`, `store_mappings`, `scraper_errors`, `discovery_log`

**File cache:** `/data/discovered-products.json` (~7.7 MB) — written by discovery cron, read for fast homepage loads.

```bash
# Env var needed locally
POSTGRES_URL=...
CRON_SECRET=...      # bearer token for cron endpoints
RESEND_API_KEY=...   # email alerts
```

## Scrapers

Each store uses its **platform-native API** — not HTML scraping:
- Foleja → Shopware API
- Shpresa, PC Store → WooCommerce API
- Neptun → custom API
- AlbaGame → Shopify API
- Globe → custom API

When modifying scrapers, preserve the platform-native approach. Don't switch to HTML/CSS selectors unless the API is gone.

## Cron Jobs (Vercel)

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| 3:00 AM UTC daily | `/api/cron/discover` | Discover new products |
| 6:00 AM UTC daily | `/api/cron/refresh-prices` | Refresh all prices |

Both require `Authorization: Bearer <CRON_SECRET>` header.
Both use concurrent batching (`CONCURRENCY=12`) to avoid Vercel ORM limits.

## Price Quality Rules

These are core business logic — don't break them:
- Flag prices **>40% below average** as suspicious (likely wrong product match)
- Flag prices **>60% above average** as overpriced (admin review)
- Mark prices **older than 24h** as stale
- Require **≥3 data points** before flagging

## Product Matching Rules

Multi-step validation in `PriceQuery` before fuzzy matching:
1. Generation mismatch (iPhone 17 ≠ iPhone 15)
2. Tier mismatch (Pro Max vs Pro vs base)
3. Storage conflict (256GB must match 256GB)
4. Accessory filtering (case/cable won't match phone)
5. Confidence threshold ≥60% query word overlap

Don't weaken these guards — they prevent bad price data showing up.

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/infrastructure/container.ts` | Dependency injection / service wiring |
| `src/infrastructure/scrapers/` | Store price scrapers |
| `src/infrastructure/stores/` | Store registry (STORES config) |
| `src/domain/catalog/Product.ts` | Core product entity |
| `src/domain/pricing/Price.ts` | ScrapedPrice, PriceRecord |
| `app/api/cron/refresh-prices/route.ts` | Daily price refresh job |
| `app/api/search/route.ts` | Product search endpoint |
| `components/PriceComparison.tsx` | Main price comparison table |
| `components/PriceHistoryGraph.tsx` | Recharts price history graph |
| `data/discovered-products.json` | File-based product catalog cache |

## UI / Styling

- Tailwind CSS with custom orange brand palette (`#f57c00` primary)
- Albanian language throughout: UI text, dates, numbers use `sq-AL` locale
- No i18n library — strings are hardcoded in Albanian

## Security

- Validate all user input at API boundaries
- Sanitize file paths to prevent directory traversal
- Cron endpoints protected by bearer token — keep it that way
- Never expose `POSTGRES_URL` or `CRON_SECRET` client-side
