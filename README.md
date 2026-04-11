# Gjej.al — Krahasimi i Çmimeve në Shqipëri

Albanian price comparison platform. Aggregates product prices from major Albanian e-commerce stores (Foleja.al, Shpresa Group, Neptun, PC Store, Globe Albania) into one searchable interface.

## Features

- Search and compare prices across 6 Albanian stores
- Price history charts
- Email price alerts
- Trending products via Google Trends
- Daily automated price refresh via cron jobs
- Admin panel for manual triggers and DB monitoring

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL (Neon)
- **Email:** Resend
- **Hosting:** Vercel

## Local Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/kleid0/gjej
   cd gjej
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Fill in your values in .env.local
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `POSTGRES_URL` | Neon PostgreSQL connection string (pooled) |
| `POSTGRES_URL_NON_POOLING` | Neon direct connection string |
| `CRON_SECRET` | Bearer token securing cron and admin endpoints |
| `RESEND_API_KEY` | Resend API key for price alert emails |
| `NEXT_PUBLIC_SITE_URL` | Public URL of the site (e.g. `https://gjej.al`) |

## Database Setup

Run the one-time migration to create tables:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://gjej.al/api/admin/migrate
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run test     # Run tests
```

## Cron Jobs

Configured in `vercel.json`, running daily:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| 03:00 UTC | `/api/cron/discover` | Discover new products |
| 06:00 UTC | `/api/cron/refresh-prices` | Refresh all prices |
| 07:00 UTC | `/api/cron/trends` | Update trending scores |

## License

MIT
