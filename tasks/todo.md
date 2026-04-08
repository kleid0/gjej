# CI Pipeline Setup

## Plan

- [x] Explore repo: Next.js 14, TypeScript, npm, deployed to Vercel
- [x] Create `.github/workflows/ci.yml` with 4 jobs

## Jobs

| Job | Command | Trigger |
|---|---|---|
| lint | `npm run lint` | push/PR to main |
| typecheck | `npx tsc --noEmit` | push/PR to main |
| build | `npm run build` | after lint + typecheck pass |
| audit | `npm audit --audit-level=high` | push/PR to main (non-blocking) |

## Notes

- Build job uses dummy `POSTGRES_URL` env vars — `@vercel/postgres` connects lazily (no actual DB call at build time)
- Audit is `continue-on-error: true` to avoid blocking on pre-existing advisories
- Test job stub included as comments — enable when a test suite is added
- Vercel preview deployments handled natively by Vercel GitHub integration (not duplicated here)

## Result

- Created `.github/workflows/ci.yml`
