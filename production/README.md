# Production migration runbook — importer/taxonomy hardening

**Status: PREPARED, NOT AUTHORIZED.** Nothing here has been applied to
production. Do not run any of it without an explicit go-ahead.

Passed the disposable-staging gate on 2026-07-21: **87/87 integration tests,
exit 0, drift 0, cleanup clean**. See `staging_test_report.redacted.json`.

---

## 1. What is in this folder

| File | Purpose |
|---|---|
| `production_migration.sql` | The migration. One file, paste once. |
| `production_migration.sha256.txt` | Expected hash + what's bundled |
| `rollback.sql` | Reverses it. Read the "not undone" notes first. |
| `post_migration_evidence.sql` | 10 read-only checks to run immediately after |
| `pre_migration_drift_report.redacted.json` | Latest pre-migration drift snapshot |
| `staging_test_report.redacted.json` | The staging run's results, target redacted |

**SHA-256 of `production_migration.sql`:**

```
f158df644e7be45d924ff17d0ebb13435cef5e1ee67bc8fda3bddca7a9fdbbe6
```

```powershell
Get-FileHash -Algorithm SHA256 "C:\Users\hp\Desktop\edu-library\production\production_migration.sql"
```

## 2. What it contains — and what it deliberately does not

Bundled, in order:

0. `v6_prod_legacy_cleanup.sql` — drops the v1 one-argument `import_playlist`. Production ran `import_rpc.sql` but never v2, so without this the legacy unvalidated importer survives alongside the new one and a payload-only call can resolve to it.
1. `import_playlist_v4.sql` — functions + reference data. Creates **no** trigger.
2. `import_playlist_v6.sql` — v6 delta: category↔goal mapping, hardened validation, `migrate_class_levels()`.
3. `v6_2_grant_tightening.sql` — revokes EXECUTE from `authenticated` on service_role-only functions.
4. `v6_class_levels_migration.sql` — `select migrate_class_levels(true)`: audit → abort-on-ambiguity → backfill → verify → enable triggers.

**Excluded, and enforced by the builder** (`src/scripts/buildProductionMigration.js`
refuses to emit a file containing any of them): staging test helpers, drift
fixtures, blocking-drift functions, and the `app_environment` seed row.

`public.app_environment` **is** created, empty, on purpose. The integration
harness refuses to run against a database with no environment marker row, so an
empty table is what permanently keeps the test suite off production.

**The whole file is one implicit transaction.** Any error rolls the entire
migration back. There is no half-applied state.

## 3. Before the window

- [ ] **Back up the database and verify the backup restores.** Supabase Dashboard → Database → Backups. A backup you have not tried to restore is a hope, not a backup.
- [ ] **Record baseline counts** — run section 10 of `post_migration_evidence.sql` now and save the numbers. You cannot detect data loss without a before.
- [ ] **Re-run the drift report** (read-only, minutes before the window):
      ```
      DRIFT_TARGET=production DRIFT_ALLOW_PROD=1 npm run drift:report
      ```
      The snapshot in this folder is only as fresh as its timestamp. **If `would_abort` is true, stop** — the migration will refuse anyway, and you want to know before the window, not during it.
- [ ] **Verify the hash** above matches.
- [ ] **Have the frontend build ready.** The app sends `learning_goal_id` and reads `category_learning_goals` / `playlist_boards` / the goal junction. Database and frontend must ship together.

### Latest pre-migration drift snapshot

```
7 playlists — all "agree"
would_backfill: 0    would_abort: false
```

Every production playlist already agrees between array and junction, so the
migration will backfill nothing and abort nothing. **The audit-first design is
cheap insurance here, not a rescue.** Worth stating plainly: v3's destructive
one-liner would not, in fact, have destroyed anything on today's production
data. The exposure was latent, not actual.

## 4. The window

1. Put the site in maintenance / accept a short read-only period. The migration
   itself is seconds; the risk is a write landing mid-flight.
2. Paste `production_migration.sql` into the SQL Editor. **Run once.**
3. Expected: `Success. No rows returned.` The editor shows only the last
   statement's result and the file ends with the migration call, so a blank
   result panel is normal.
4. **If any error appears: stop.** The transaction has rolled back. Capture the
   first error and its `LINE nnn`, restore nothing, change nothing, and diagnose.

## 5. Immediately after — evidence

Run `post_migration_evidence.sql` **one query at a time** and save the output.

| Check | Pass condition |
|---|---|
| 1. audit | exactly one `run_id` |
| 2. **final drift** | **0** — this is the gate |
| 3. offenders | zero rows |
| 4. nothing lost | zero rows |
| 5. triggers | exactly 2 |
| 6. `anon` sensitive EXECUTE | `NONE` |
| 7. `authenticated` over-grant | `NONE` |
| 8. env marker | exists, **0 rows** |
| 9. taxonomy mapping | both `NONE` |
| 10. content counts | no count lower than baseline |

Any failure → roll back with `rollback.sql` and redeploy the previous frontend.

## 6. Smoke test — immediately, before announcing

Against the live site, as a real user would:

- [ ] `/` loads; search returns results
- [ ] `/browse` — sidebar shows learning goals; clicking one filters (URL becomes `?goal=<id>`)
- [ ] `/explore/jee/class-11/physics` — chapter list renders
- [ ] Open a chapter → courses appear → open a course → the player plays
- [ ] `/explore/school` — shows boards, or an honest error; **must not** silently show "Coming soon" for everything
- [ ] Admin: import one small playlist end to end — the Learning goal field is required and the import succeeds
- [ ] Browser console: no errors on any of the above

## 7. Rollback

`rollback.sql`, then redeploy the pre-v6 frontend **in the same window**.

The class-levels backfill is **not** reversed, deliberately: it only ever added
missing junction rows, never deleted a classification.
`class_levels_migration_audit` records exactly what was added, per `run_id`.

## 8. Key rotation — do not skip

Outstanding since v2 and **independent of this migration**:

- [ ] **Rotate the production `service_role` key.** It was pasted into chat and must be treated as compromised. Supabase Dashboard → Settings → API → rotate. Update any local `.env` afterwards.
- [ ] **Rotate the YouTube Data API key** (same reason), then restrict it in Google Cloud Console by HTTP referrer **and** by API (YouTube Data API v3 only). It ships in the frontend bundle, so restriction is the only real control.
- [ ] Confirm `.env` is still git-ignored and absent from every archive.

## 9. Known limitations carried into production

Neither blocks this migration; **both block bulk content upload**:

1. **Board-scoped heading counts and filter controls render before board ids resolve.** The result list is already guarded — it shows a skeleton, never a false empty state — but the count and filter bar briefly show unfiltered values.
2. **Browse aggregates the whole `video_learning_goals` junction in the browser** to build its tree. Correct and fast at current volume (40 videos); it will hit Supabase response limits as the library grows. Move to a database-side view/RPC **before** bulk import.

Also unchanged: `create_course()` takes no advisory lock, so two identical manual
submissions create two courses; and there is no per-user rate limit on any RPC.
