# Pre-public security checklist

Run this before flipping `kleid0/gjej` from private → public so the GHA-minute
quota stops being a constraint.

## 1. Repo / history scrub (already done)

Automated greps run against the working tree and `git log --all -p` came up
clean for:

- AWS keys (`AKIA…`), GitHub PATs (`ghp_…`, `github_pat_…`), OpenAI keys
  (`sk-…`), Slack tokens (`xox[baprs]-…`), PEM private-key blocks.
- Hardcoded literals adjacent to suspicious var names (`CRON_SECRET`,
  `GITHUB_TOKEN`, `RESEND_API_KEY`, `POSTGRES_URL`, `DATABASE_URL`,
  `API_KEY`, `SECRET`, `PASSWORD`, `TOKEN`).
- Real Postgres connection strings (anything not `dummy` / `localhost` /
  `user:password` / docs link).
- `.env` files ever added to history (only `.env.example` exists, with
  placeholder values).
- Real `re_…` Resend keys.

Re-run before merging this PR if any new commits have landed in the
meantime:

```bash
git log --all -p \
  | grep -iE 'AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{30,}|ghp_[a-zA-Z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|xox[baprs]-|re_[A-Za-z0-9]{20,}|-----BEGIN .* PRIVATE KEY-----'
```

If anything turns up, **don't go public yet** — rewrite history with
`git filter-repo` to strip the secret AND rotate the credential at its
source. (Once a secret has been pushed to a public repo, assume it's
compromised even if you delete the commit.)

## 2. Confirm secrets all live outside the code

Sanity-check that every value in `.env.example` has a real-world home in
either Vercel project env vars, GitHub repo Secrets, or both:

| Variable                  | Vercel env | GitHub Secret | Notes                              |
| ------------------------- | ---------- | ------------- | ---------------------------------- |
| `POSTGRES_URL` / pooled   | ✅          | —             | Only the cron writes; reads use JSON files. |
| `POSTGRES_URL_NON_POOLING`| ✅          | —             | Same as above.                     |
| `CRON_SECRET`             | ✅          | ✅             | GHA workflow uses the GitHub Secret to call `/api/cron/refresh-prices`. |
| `RESEND_API_KEY`          | ✅          | —             | Email send-out only.               |
| `ADMIN_EMAIL`             | ✅          | —             | Public-ish but no reason to leak.  |
| `NEXT_PUBLIC_SITE_URL`    | ✅          | —             | Already public (NEXT_PUBLIC_*).    |
| `GITHUB_TOKEN`            | ✅          | (auto-injected in GHA) | Vercel side commits data files; GHA side uses the runner token. |

If the table doesn't match the current Vercel / Settings → Secrets state,
update it before merging.

## 3. .gitignore coverage

Already covers everything that should never ship publicly:

```
node_modules/
.next/
.env
.env.local
.env*.local
*.tsbuildinfo
*.log
.DS_Store
data/prices.json
data/enrichment/
.claude/
.claude-flow/
.swarm/
.mcp.json
.vercel
scripts/
```

Note `scripts/` is gitignored — confirm there's nothing currently inside
that's actually meant to be public (helper scripts intended to ship would
need to be moved out of that directory or the ignore line refined).

## 4. Vercel project hardening

Even on a public repo, these stay correct because they're Vercel-side:

- [ ] Production env vars marked as such (not exposed to preview/dev) for
      anything sensitive: `CRON_SECRET`, `POSTGRES_URL*`, `RESEND_API_KEY`.
- [ ] **Preview deployments get their own throwaway DB** (or no DB) — a
      forked PR shouldn't be able to scrape your prod Postgres.
- [ ] Build & Development Settings → "Ignored Build Step" is set OR the
      `vercel.json` `ignoreCommand` (added in PR #57) is in effect, so
      data-only commits don't churn deployments on every cron run.

## 5. Repo settings on GitHub

Once you flip the visibility:

- [ ] **Branch protection on `main`**: require PR review before merge,
      require status checks to pass, no force-pushes. Stops drive-by
      contributors from merging straight to main.
- [ ] **Disable "Allow forking" if you'd rather not see forks** — this is
      cosmetic only; anyone can still clone a public repo.
- [ ] **Secret scanning**: GitHub turns this on automatically for public
      repos. Confirm it's enabled under Settings → Code security and
      analysis. (It will retroactively scan history.)
- [ ] **Dependabot alerts**: also auto-enabled on public; verify and
      decide whether to opt into Dependabot updates / security updates.
- [ ] **Push protection**: enable under "Secret scanning" so future
      accidental pushes of secrets get blocked at git push time.

## 6. Licensing

This PR adds `LICENSE` (PolyForm Noncommercial 1.0.0) and updates
`package.json` `license` to `PolyForm-Noncommercial-1.0.0`. That gives:

- ✅ Personal / hobby / education / research use is allowed.
- ❌ Commercial use (running a competing comparison site, selling the
     code, embedding in a paid product) is forbidden.

It is **not** OSI-approved (the OSI definition requires no use
restrictions). That trade-off is intentional — keeping the public-facing
code visible while preventing competitors from forking-and-deploying.

## 7. The flip itself

GitHub UI: Settings → General → "Danger Zone" → "Change repository
visibility" → Public. Confirm by typing the repo slug.

After flipping:

- [ ] Re-run a CI check (e.g. push a no-op commit) to confirm GHA jobs
      are now using the unlimited public-repo budget.
- [ ] Bump `.github/triggers/refresh-prices.txt` to kick off the
      catalogue walk again — this time with no minute pressure.
