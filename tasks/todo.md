# Release Preparation

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
