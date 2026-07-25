# Checklist for future Codex tasks

Use this checklist at the start and end of every task in this repository.

## Start

- Read `AGENTS.md` and the user’s exact target.
- Run `git status --short --branch`.
- Fetch `origin/main`; fast-forward only when the worktree is clean.
- Record the starting commit.
- Check recent commits, task notes, and existing reports before repeating work.
- Classify the task as read-only, frontend-write, disposable-staging-write, or
  production-write.

## Safety boundary

- Do not print `.env` values or include environment files in an archive.
- Use `npm run pack:review` for review archives.
- Do not use a service-role key in browser code.
- Do not run migrations merely because SQL files exist.
- Do not rerun completed staging or production migrations without a named
  reason and owner approval.
- Do not manually dispatch CI when a push already triggers it.
- Keep production checks read-only unless the owner authorizes an exact write.

## Database-changing work

- Confirm the target URL differs from production when using disposable staging.
- Require `TEST_ALLOW=1` and a live `app_environment` value of `staging` or
  `test`.
- Use unique fixture identifiers.
- Define cleanup before creating fixtures.
- Refuse cleanup when target identity or test results are uncertain.
- For production, complete
  [backup and restore readiness](backup_restore_readiness.md) first.
- Record expected counts and stop criteria before mass operations.

## Implementation

- Reproduce a defect before changing code.
- Make the smallest change that fixes the demonstrated behavior.
- Add a regression test that fails without the fix.
- Preserve unrelated worktree changes.
- Run focused checks first, then the repository’s complete relevant gates.
- For frontend work, run lint, tests, build, and
  `verify:frontend-release`.
- For responsive work, run `ui:audit` with catalogue network access.

## Commit and handoff

- Run `git diff --check` and review the complete diff.
- Confirm generated reports did not create unintended tracked changes.
- Commit only task files with a specific message.
- Push once, then monitor the automatically triggered CI run.
- Confirm local `HEAD` and `origin/main` match.
- Report the commit, files, checks, external writes, cleanup, and any manual
  browser step.
- Stop at the phase boundary instead of starting the next risky operation
  implicitly.

