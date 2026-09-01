# The two test projects

The suite is split into two vitest projects, configured in `vite.config.js`.
Nothing was deleted: every test file belongs to exactly one project, and
`npx vitest run` with no arguments still runs both.

| Project | What is in it | Environment | Command |
| --- | --- | --- | --- |
| `app` | Components, hooks, pure logic, the release and contract guards | jsdom | `npm test` |
| `sql` | The one-off ingestion, seed, SQL-package and SQL-rehearsal checks | Node | `npm run test:sql` |
| both | Everything, plus the import integration check | — | `npm run test:all` |

## Why

Measured on 1 September 2026, on this machine, with other work running:

| Run | Files | Wall clock |
| --- | --- | --- |
| Everything, one jsdom project (before) | 381 | 5m15s |
| `npm test` — the `app` project (after) | 221 | 2m28s |
| `npm run test:sql` — the `sql` project | 168 | 5m20s |

Two things were costing time. About fifty-six of the `sql` files boot an
in-memory WASM Postgres (`@electric-sql/pglite`) to replay SQL that has already
been applied to production, and every file in the suite — including the ones
that only read a `.sql` file and hash it — paid for a jsdom boot, because
`environment: "jsdom"` was set for the whole suite. In the old full run, jsdom
setup alone added up to 1165s of aggregate worker time. In the `sql` project it
is now 0.1s.

## How membership is decided

By filename glob, in `vite.config.js`, in a single list called
`SQL_VERIFICATION_TESTS`. That one list is the `sql` project's `include` and the
`app` project's `exclude`, so the two projects are exhaustive and disjoint by
construction — a file cannot fall through the gap. `src/testProjects.test.js`
guards that property, along with the scripts and the CI wiring.

To check what is where:

```powershell
npx vitest list --filesOnly --project app
npx vitest list --filesOnly --project sql
npx vitest list --filesOnly
```

The counts of the first two must add up to the third.

A new one-off verification test lands in the `sql` project automatically if it
is named like its neighbours (`...Seed.test.js`, `...Package.test.js`,
`...Sql.test.js`, `...SqlRehearsal.test.js`, and so on). Anything else stays in
the fast `app` project, which is the safe direction: a slow test in the fast
project only costs time, while an app test in the `sql` project would fail
loudly for want of a DOM.

## Timeouts

The `app` project keeps the 15s per-test budget and the reasoning behind it
(see `src/testTimeoutBudget.test.js`). The `sql` project uses 120s: with all 168
of its files running at once, four pglite rehearsals exceeded 15s while every
one of them passed in isolation. That is contention, not a hang, and 120s still
bounds a real hang.

## CI

`.github/workflows/ci.yml` runs the `app` project on every push and pull
request. The `sql` project runs in its own job, which:

- always runs on a pull request, so a schema change cannot be merged without it;
- runs on a direct push to `main` only when the push touched `docs/`,
  `supabase/`, `src/migrations/`, `src/scripts/`, a top-level `src/*.js`,
  `package.json`, `package-lock.json`, `vite.config.js` or the workflow itself;
- can be started by hand with **Run workflow** if a push skipped it.

The path list errs towards running. Skipping is only a saving, so a wrong skip
would be a hole and a wrong run only costs a few minutes.
