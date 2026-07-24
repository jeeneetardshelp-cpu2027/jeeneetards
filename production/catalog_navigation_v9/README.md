# Catalogue navigation v9 — production runbook

**Status: PREPARED AND REVIEWED, NOT AUTHORIZED OR APPLIED.**

This folder is isolated from the older importer/taxonomy production migration.
Applying v9 cannot accidentally deploy those unrelated changes.

## Files and hashes

| File | Purpose | SHA-256 |
|---|---|---|
| `production_delta.sql` | Preflight + exact staging-verified core + postflight | `4fbdda12e12ba8d62f842e1d7703dbd8471da9b0a8d55ea0c5f9f97384a3c79a` |
| `rollback.sql` | Removes only the two v9 functions | `6059b0f6795f1ac710c80678cf8f25bcaf74128d8ee5910b29323f443e921a73` |
| `evidence.sql` | Read-only post-deployment checks | `6013bc6c370ed87fc72209b3f642eb7e3f05035a1bb39d9604228fc3eee6cb82` |
| `wrapper_staging_test_report.json` | Production-wrapper rollback rehearsal evidence | `576dadcf2009a45b333635badcd8b9f0de671063da6733d562e69091b78f748d` |

Core source hash: `1609de029bc1d94e07ec021fff6499f3203e669bbca0887d1013453ff7425140`  
Verified staging artifact hash: `3e2ca97d6a4b701e5e95afea5c64325a05beb9025423eb8304b56196dc97db98`  
Staging evidence: run `50bee2`, **10 passed, 0 failed**, cleanup clean.
Production-wrapper rehearsal: **passed on disposable staging**, ended in
`ROLLBACK`, and restored the environment marker, both functions and both
indexes. Production was not contacted.

## Exact scope

- Adds `idx_plg_goal_playlist` and `idx_pcl_class_playlist` if absent.
- Adds `get_browse_curriculum(text,text,text)`.
- Adds `browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)`.
- Grants function execution to `anon`, `authenticated` and `service_role`.
- Writes no content rows and changes no table definition.

The functions are `STABLE SECURITY INVOKER` with an empty `search_path`.
Anonymous callers remain constrained by the existing table grants and RLS.

## Before applying

1. Create and verify a restorable Supabase backup.
2. Run evidence section 5 and save the baseline row counts.
3. Verify the three hashes against `production_delta.sha256.txt`.
4. Use a short maintenance window. Creating an index takes a table lock; the
   current database is small, but this should still be deliberate.
5. Stop if either v9 function already exists. The preflight refuses to replace
   an unknown implementation.

## Apply

Paste `production_delta.sql` into the production Supabase SQL Editor and run
it once. Any preflight, DDL or postflight failure aborts the transaction. Do
not edit the generated file, and do not continue after an error.

Deploy database first, frontend second. The existing frontend ignores these
functions; the new frontend safely falls back while they are absent.

## Evidence and rollback

Run each numbered section of `evidence.sql` separately. Save the outputs.
The anonymous section must return normally, PUBLIC must have no EXECUTE grant,
both indexes must exist, and content counts must equal the saved baseline.

If evidence or the browser smoke test fails, run `rollback.sql`. The frontend
then falls back automatically. Rollback deliberately retains the two additive
indexes because they contain no independent data and dropping them would take
another table lock.

## Honest limitations

- v9 facet counts do not accept faculty or board filters. The UI suppresses
  counts whenever either is active rather than showing misleading numbers.
- Search faceting uses a leading-wildcard title match. It is suitable for the
  current catalogue and expected thousands of courses, but must be load-tested
  before growth into the tens or hundreds of thousands.
- Staging's permanent content was empty after fixture cleanup, so the visual UI
  audit showed honest zeroes. Non-zero isolation and Dropper deduplication were
  proved by run-scoped PostgreSQL fixtures in run 50bee2.

## Smoke test

- Open `/explore`; goal choices load without login.
- Follow JEE → Class 11 → Physics and confirm only populated branches appear.
- Open `/browse?goal=jee&class=11&subject=physics`; counts render beside filters.
- Change a filter; URL, chips, results and counts agree.
- Repeat at 360 px and in dark mode; check the browser console.
