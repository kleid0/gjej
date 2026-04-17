# Lessons Learned

Patterns and rules derived from user corrections to prevent repeated mistakes.

## 2026-04-10 - Tasks folder not maintained
**Mistake**: Did not maintain `tasks/todo.md` and `tasks/lessons.md` as required by CLAUDE.md. `lessons.md` didn't exist at all; `todo.md` only had a stale prior task.
**Rule**: At session start, review `tasks/lessons.md` for relevant patterns. For every task, write a plan to `tasks/todo.md` before starting. After any user correction, immediately add an entry to `tasks/lessons.md` describing the mistake and the rule to prevent it.

## 2026-04-17 - Didn't acknowledge CLAUDE.md workflow at session start
**Mistake**: Waited for the user to prompt a task rather than opening `tasks/todo.md` and `tasks/lessons.md` at session start and proposing next steps. User had to ask "why aren't you following CLAUDE.md".
**Rule**: On the first turn of any session in this repo, immediately read `tasks/lessons.md` and `tasks/todo.md`, surface the top open items, and either enter plan mode or confirm scope before doing anything else — even if the user hasn't named a task.
