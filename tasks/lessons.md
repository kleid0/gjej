# Lessons Learned

Patterns and rules derived from user corrections to prevent repeated mistakes.

## 2026-04-10 - Tasks folder not maintained
**Mistake**: Did not maintain `tasks/todo.md` and `tasks/lessons.md` as required by CLAUDE.md. `lessons.md` didn't exist at all; `todo.md` only had a stale prior task.
**Rule**: At session start, review `tasks/lessons.md` for relevant patterns. For every task, write a plan to `tasks/todo.md` before starting. After any user correction, immediately add an entry to `tasks/lessons.md` describing the mistake and the rule to prevent it.

## 2026-04-17 - Didn't acknowledge CLAUDE.md workflow at session start
**Mistake**: Waited for the user to prompt a task rather than opening `tasks/todo.md` and `tasks/lessons.md` at session start and proposing next steps. User had to ask "why aren't you following CLAUDE.md".
**Rule**: On the first turn of any session in this repo, immediately read `tasks/lessons.md` and `tasks/todo.md`, surface the top open items, and either enter plan mode or confirm scope before doing anything else — even if the user hasn't named a task.

## 2026-04-19 - Assumed the custom domain was live
**Mistake**: Hardcoded `https://gjej.al` as the default `base_url` in the store-coverage workflow and in repeated curl attempts, without ever verifying the domain actually pointed at production. It resolved to a stale cPanel IP with a cert that expired in 2018. Burned three workflow runs and two PRs chasing a phantom TLS problem before the user pointed out there is no real domain — the site lives at `gjej.vercel.app`.
**Rule**: Before wiring automation against a hostname, confirm it's actually the production URL. Check `vercel.json` / Vercel project domains / `next.config.js` / README / prior working fetches — don't infer the URL from the repo name or a `canonical` metadata tag. When a fetch fails with a TLS/DNS error, resolve the name and inspect the cert *first*; a weird cert (wrong CN, wildly expired, wrong issuer) means wrong host, not broken curl flags. Also: pick the shortest-radius experiment first — one `curl -v https://host` locally would have revealed this before any workflow existed.
