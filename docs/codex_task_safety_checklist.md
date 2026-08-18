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
- Treat every checked-in SQL file, manifest, review file, and generated package
  as evidence or a candidate input, not as an unfinished instruction. A general
  `continue` does not authorize executing it.
- Do not reapply chapter/class scopes v13 or v14. Production v14 was applied
  once and independently verified on 2 August 2026; its reviewed source SHA-256
  is `6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459`.
- `docs/sql/complete_institute_guard_2026-08-02.sql` and
  `docs/sql/search_lecture_subtitle_2026-08-02.sql` are prepared but not applied.
  Do not execute either without a separate current gate and explicit approval.
- Do not rerun the completed JEE faculty batch-1 migration or push faculty
  commit `0318c91093cabb13c9a73af7a7b2309a16909f76` to `release`; both are
  already live and verified.
- Treat all `faculty_registry_neet_*_prepared.sql` files as unexecuted
  artifacts. A general `continue` instruction does not authorize a clone or
  database write.
- Do not manually dispatch CI when a push already triggers it.
- Do not add a one-off staging verifier or migration to `test:all`, CI, or a
  schedule, and do not rerun one automatically or manually without an explicit
  approved target and reason.
- Keep production checks read-only unless the owner authorizes an exact write.
- Allow only one production writer at a time. Pause imports, faculty jobs, and
  any other process touching catalogue tables for the entire write window.

## Database-changing work

- Confirm the target URL differs from production when using disposable staging.
- Require `TEST_ALLOW=1` and a live `app_environment` value of `staging` or
  `test`.
- For the v12 disposable-staging verifier, additionally require
  `V12_TEST_ALLOW=1` and the exact
  `--confirm-disposable-v12-staging` command-line confirmation. Never infer
  either from earlier approval.
- Confirm the test service and anonymous keys belong to the test URL and are
  not production credentials.
- Use unique fixture identifiers.
- Before the first write, check every planned fixture identifier and protected
  audit request ID for collisions; abort rather than reuse or delete a match.
- Define cleanup before creating fixtures.
- Refuse cleanup when target identity or test results are uncertain.
- Immediately before cleanup, re-read the live `app_environment` marker. If it
  is unreadable or no longer `staging`/`test`, perform no deletes and preserve
  the exact fixture ledger for recovery.
- Before the first cleanup delete, synchronize on every run-owned request lock.
  An HTTP timeout alone does not prove that its database transaction stopped;
  if bounded quiescence fails, preserve all fixtures for recovery.
- Clean only run-owned ordinary fixtures first, clean the protected import
  audit last through its bounded staging-only helper, and require zero residue.
- Roll back a task-specific staging helper only after protected-audit cleanup
  and zero residue, and before rolling back any base staging helper it depends
  on.
- For production, complete
  [backup and restore readiness](backup_restore_readiness.md) first.
- For NEET faculty normalization, follow the hash-pinned order and stop gates
  in [the rollout plan](faculty_registry_neet_rollout_plan_2026-07-28.md).
  Both historical NEET restore clones were deleted after their evidence was
  accepted. Do not create another billable clone without a new, explicitly
  scoped owner approval and a fresh PITR restore point.
- Never normalize NEET courses 118 or 119 without new exact-video evidence,
  identity review, a separately tested additive artifact, and explicit
  approval.
- Record expected counts and stop criteria before mass operations.
- Before every content import, confirm the source playlist ID, request/audit ID,
  and exact video IDs are not already present. An approved manifest may be
  historical evidence for a completed import; abort on any unexpected reuse.
- For a real staging content import, require matching write-free staging and
  production plans, exact playlist ownership, complete teacher attribution,
  zero source-ID collisions, and an approved curriculum/class mapping.
- Compare the live source and staged course position by position: YouTube ID,
  title, duration, embed status, chapter, subject, and total count. Confirm
  first, middle, and last playback plus Browse/search at desktop and mobile
  widths before treating the staging checkpoint as qualified.
- Recheck anonymous production totals and exact playlist/chapter absence after
  a staging-only write. A successful staging import never authorizes promotion.

## Implementation

- Reproduce a defect before changing code.
- Make the smallest change that fixes the demonstrated behavior.
- Add a regression test that fails without the fix.
- Preserve unrelated worktree changes.
- Run focused checks first, then the repository’s complete relevant gates.
- For frontend work, run lint, tests, build, and
  `verify:frontend-release`.
- For responsive work, run `ui:audit` with catalogue network access.
- Never treat one unbounded Supabase response as complete catalogue evidence.
  Full-set audits must request an exact count, use a deterministic total order
  with a stable unique key, page until that count is met, and advance by rows
  actually received when the server cap is lower than the requested page.
- Never infer that duplicate or overlap candidates are absent from a truncated
  membership query. Use `npm run audit:production-catalog`, which now fails
  closed if its complete membership count differs from summed course counts.

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
