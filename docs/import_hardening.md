# Importer hardening — v6.2 (VERIFIED ON STAGING)

Status: **Applied and verified on a disposable staging project. NOT applied to production.**

| Artefact | File |
|---|---|
| v4 functions (unchanged base) | `src/migrations/import_playlist_v4.sql` |
| **v6 delta** | `src/migrations/import_playlist_v6.sql` |
| Migration invocation | `src/migrations/v6_class_levels_migration.sql` |
| Drift fixtures (staging) | `src/migrations/staging_drift_fixtures.sql` |
| Blocking fixtures | now seeded by `seed_blocking_drift_fixture()` (see item 4) |
| Dry-run drift report | `src/scripts/driftReport.js` → `npm run drift:report` |
| **Redacted production report** | `docs/drift-report.redacted.json` |
| Staging-only test helpers | `src/migrations/staging_test_helpers.sql` |
| Integration suite | `src/scripts/verifyImport.js` → `npm run test:integration` |
| Component tests | `src/Explore.boards.test.jsx` → `npm test` |

## What changed in v6

| # | Finding | Fix |
|---|---|---|
| 1 | MB3 took its baseline **before** the fixture that adds a junction row | Baselines now read after `seed_blocking_drift_fixture()`. Worth stating plainly: this test would have **failed loudly** (N+1 vs N), not passed silently — the baseline was wrong, but it was not hiding anything. |
| 2 | `useCurriculumTree()` still built navigation from `videos.category_id` while results used the goal junction | The whole Browse tree is now built from `video_learning_goals` (see below). |
| 3 | `useBoardPlaylistIds()` returned a bare `null` for both "loading" and "failed" | Returns `{ ids, loading, error }`; `ChapterResults` renders the skeleton while unresolved and an error line on failure — never the empty state. |
| 4 | Board-filtered empty state named only the class | Names both: *"No CBSE playlists are tagged for Class 10 yet"*, and the sub-line reads "none is classified for CBSE + Class 10". |
| 5 | Test-only SQL lived in the production migration | Moved to `staging_test_helpers.sql`, which the production path never applies. |
| 6 | Supabase `{error}` responses became empty content | `useBoards`, `useBoardPlaylistIds` and the tree query all distinguish failure from emptiness. |
| 7 | Board isolation was proven only at the database | Added `src/Explore.boards.test.jsx` (jsdom + @testing-library/react): renders the real component at a board URL and asserts CBSE shows / ICSE does not. |
| 8 | No assertion that goals and categories are fully mapped | **X6/X7** list any unmapped slug by name. |

### Item 2 in detail — Browse is now goal-native end to end

`useCurriculumTree()` queries `video_learning_goals` joined to videos, and
`buildTree` keys on `learning_goal_id`. The tree's top-level node **is** a
learning goal, so `useVideos({ goalId })` filters the junction directly and the
category→goal translation added in v5 is **deleted** — there is only one axis
left to disagree about. A lecture tagged JEE *and* NEET now contributes a
subject/chapter branch under **both**, which a single-valued `category_id` could
never express (test **X5**).

Ripples: Browse's URL param is `?goal=` (was `?cat=`); `Dashboard.jsx` and
`Home.jsx` follow. The two `/browse?cat=${v.categoryId}` deep links built from
search rows now link by subject/chapter only — a search row carries a category,
not a goal, and inventing one would be a guess.

**Verified in the browser against production data:** `/browse` renders a "JEE"
sidebar node built from the junction, and `?goal=1` returns "JEE — 40 lessons".
The `/explore/jee/class-11/physics` cascade is unaffected.

Also verified live: `/explore/school` now renders **"Couldn't load boards."**
because production has no `playlist_boards` table yet. v5 rendered that same
broken state as "CBSE — Coming soon", i.e. it told the student the board was
empty when the query had actually failed. That is item 6 fixing itself in situ.

## Item-by-item (v5 baseline, still current unless noted)

### 1. Category vs learning goal — read migration, not just a mapping

Both were done, because the mapping alone was not enough.

**Mapping:** `category_learning_goals` is added, seeded (`jee↔jee`, `neet↔neet`,
`olympiad↔olympiad`, `school-boards↔school`) and validated on every import and
manual create. A NEET category with a JEE goal is now rejected outright (test
**X1**).

**Read migration (completed in v6):** BOTH the Browse tree and the Browse
results are built from `video_learning_goals`. v5 moved only the results and
left the navigation tree on `category_id`; v6 finishes the job and removes the
category→goal translation entirely.

The mapping alone could not fix this, and finding out why changed the design.
`videos.category_id` is **single-valued**. A Physics lecture that genuinely
serves both JEE and NEET can only be filed under one category, so any rule that
forces a video's goals to match its category makes that legitimate case
unrepresentable. I had first written exactly such a check into
`set_video_taxonomy`, and it contradicted the shared-lecture case my own suite
already asserted. **It is removed.** Category↔goal is enforced where filing
intent is declared (import / `create_course`); agreement between screens comes
from both reading the goal junction.

Tests: **X3** runs Browse's query and Explore's query for every category and
requires identical video sets. **X4** imports one lecture into a JEE course and
a NEET course and requires it to be reachable from both.

### 2. Boards are now a student-facing stage

- Route: `/explore/school/:board/:cls/:subject/:chapter`. Board is a URL
  segment, so a board-scoped page is linkable and survives a refresh. Segments
  after `:goal` shift by one for the school goal; `Explore` maps them.
- New Board step, breadcrumb entry, and per-board course counts. A board with no
  courses reads "Coming soon"; a board list that FAILED to load says so instead
  (v5 conflated the two).
- `ChapterResults` filters through `playlist_boards`. Untagged courses are **not**
  shown under a board — same rule as class filtering: a filter that lets unknowns
  through is not a filter.
- Result counts, the filter bar and the empty state all read the board-filtered
  list, so the numbers on screen match what is shown.

Tests: **B1/B2** CBSE and ICSE isolation in both directions; **B3** a
board-scoped course carries exactly one board tag.

### 3. Redacted drift report

`docs/drift-report.redacted.json` — project ref and course titles removed; ids,
label sets, verdicts and counts verbatim. 7 production playlists, all `agree`.

### 4. Blocking migration tests, automated

The migration logic moved into `public.migrate_class_levels(p_enable_triggers)`
so its abort paths are callable from the suite. One function call is one
transaction, so an abort rolls back audit rows, backfill and trigger creation
together.

Blocking states cannot be created through normal writes once the triggers exist,
so `seed_blocking_drift_fixture()` creates them with the trigger briefly
disabled. It calls `__assert_not_production()` first and **refuses to run unless
the database self-identifies as staging/test**.

Tests: **MB1** abort raised; **MB2** zero audit rows persisted; **MB3** zero
backfill; **MB4** triggers unchanged; **MB5** succeeds once blocking rows are
removed; **MB6** each run keeps its own `run_id`.

### 5. `video_ids` validation — the v4 check was inert

v4 used `jsonb_typeof(e) <> 'number' or (e->>0) !~ '^[0-9]+$'`. `->>0` addresses
an **array element**; applied to a JSON scalar it returns NULL, so the regex arm
was always NULL and never rejected anything. Only the type arm did any work —
**0, -1, 1.5 and 1e30 all passed**. Corrected to `(e#>>'{}')` with
`^[1-9][0-9]{0,17}$` (positive, whole, within bigint range).

Tests **E1–E9**: zero, negative, decimal, overflow, numeric string, null,
object, nested array, boolean.

### 6. Duplicates rejected before deletion

`set_video_taxonomy` rejects duplicate goal ids and duplicate class ids *before*
its `DELETE` runs. Tests **G1/G2** assert the rejection, **G3** asserts nothing
was deleted.

### 7. Audit table lifecycle and permissions

- **Per-run evidence preserved.** Every run stamps a `run_id`; nothing deletes
  prior rows (v4 wiped the table each run, which destroyed the evidence).
- **Removal is explicit**: `purge_migration_audit(p_keep_runs int default 3)`,
  admin/service-role only, returns how many rows it removed.
- **Permissions**: RLS on, `revoke all ... from anon`, select policy requires
  `is_admin()`. service_role bypasses RLS for export. Test **A5** asserts anon
  reads nothing.
- Retention: keep the last 3 runs; export with
  `select * from public.class_levels_migration_audit order by migrated_at` before
  purging if a record is needed beyond that.

### 8. v6 returned for review; no production DDL run.

## Migration order

`npm run build:bootstrap` emits 1–5 as one paste-able file:

1. existing schema + migrations through `import_playlist_v2.sql`
2. `import_playlist_v4.sql` — functions only, no trigger, no data change
3. `import_playlist_v6.sql` — v6 delta (also functions/reference only)
4. `staging_test_helpers.sql` then `staging_drift_fixtures.sql` — **staging
   only**, and only here: this is the last window in which the array can drift
5. `v6_class_levels_migration.sql` — `select migrate_class_levels(true)`
6. seed `app_environment` = `staging`, then `npm run test:integration`

Production path: dry-run report → review → steps 2, 3, 5. Never the fixtures,
never the `app_environment` row.

## Rollback

```sql
drop trigger if exists trg_force_class_levels on public.playlists;
drop trigger if exists trg_sync_pl_class_array on public.playlist_class_levels;
drop function if exists public.migrate_class_levels(boolean);
drop function if exists public.create_course(jsonb);
drop function if exists public.clear_video_taxonomy(bigint);
drop function if exists public.set_video_taxonomy(bigint, bigint[], bigint[]);
drop function if exists public.validate_import_payload(jsonb, text, boolean);
-- then re-run import_playlist_v2.sql to restore the previous function body.
```

The backfill is not rolled back, and should not be — it only ever *added*
missing junction rows, and `class_levels_migration_audit` records exactly what
was added.

**Roll the frontend back with it.** The app now sends `learning_goal_id` and
Browse reads `category_learning_goals`; a database rolled back to v2 leaves both
broken.

## Test results — REAL, from a disposable staging project

Bootstrap applied once to a fresh Supabase project (ref `wwswev…`), never to
production.

```
87 passed, 0 failed        exit code 0
```

| Evidence | Result |
|---|---|
| Bootstrap SHA-256 | `8bbc24c5…72502` (v6.2; the earlier 81-test run used `ce56f243…22aad`) |
| Migration audit | 2 run_ids preserved — `22e6be0f…` (agree 1, **array-only 2**, both-empty 1, junction-only 1) and `0bf167ea…` (agree 18, both-empty 1) |
| Final drift | **0** |
| Cleanup | test playlists/channels, CC and DA leftovers all 0; permanent fixtures 5/5 |
| `anon` EXECUTE on sensitive functions | **NONE** |
| `npm test` | 11/11 |
| `npm run build` | clean |

**The result that mattered: `array-only: 2`.** Those two fixtures were backfilled
into the junction rather than overwritten with `{}`. v3's one-line "repair" would
have deleted both classifications, and v3's own test asserted that deletion was
correct. Postgres has now settled it on real data rather than on argument.

### Two defects the staging run itself exposed

1. **Harness crash on guard failure.** `process.exit()` fired mid-request and
   aborted Node with a libuv assertion and exit code 127. Worse, the `finally`
   block would then have run `cleanup()` — issuing DELETEs against a database
   that had just failed verification. The guard now throws, cleanup is skipped
   explicitly, and the exit code is set cleanly. Verified: **2** on guard
   refusal, **0** on a clean pass.

2. **`authenticated` over-granted — fixed in v6.2.** Supabase ships
   `alter default privileges in schema public grant all on functions to
   postgres, anon, authenticated, service_role`, so every function created here
   received EXECUTE for `authenticated` automatically. Revoking `public, anon`
   did not remove it, leaving six service_role-only functions callable by any
   logged-in user. Defence in depth held — each re-checks `is_admin()` — but the
   grant contradicted the stated intent, and **nothing tested that path**:
   A1–A5 only covered `anon`, which is stopped at the GRANT layer and never
   enters a function body at all.

   Fixed by `src/migrations/v6_2_grant_tightening.sql` plus tests **AU0–AU5**,
   which create a real confirmed non-admin user, sign in as them, and assert
   every privileged entry point refuses. The three layers are now demonstrated
   separately:

   | Test | Rejected by | Message |
   |---|---|---|
   | AU3 | GRANT layer | `permission denied for function migrate_class_levels` |
   | AU1 / AU2 / AU4 | function body `is_admin()` | `not authorized` |
   | AU5 | RLS policy | 0 rows |

## Known limitations

- Browse aggregates the whole `video_learning_goals` junction client-side to
  build its tree. Correct, and fine at current data volumes, but it should move
  to a database-side aggregate (RPC or view) before any bulk import.
- Board-scoped heading counts and filter controls render before the board ids
  resolve; the result list is already guarded, but those two should be deferred
  as well.
- A direct write to `playlists.class_levels` is silently ignored once triggers
  exist, not rejected.
- `create_course()` takes no advisory lock; two identical manual submissions can
  create two courses.
- No per-user rate limit on any RPC.
- Boards attach to playlists, not to individual videos.

## Secrets / packaging

- Excludes `.env`, `.env.*` (except the two `.example` templates),
  `node_modules`, `dist`, `.git`, `.claude/` (it held the production project
  ref), `archive/`, generated `staging_bootstrap.sql`, and the **unredacted**
  `drift-report.json`. `package-lock.json` and the redacted report are included.
- **The service-role and YouTube keys shared earlier remain compromised and
  still need rotating.** The YouTube key also needs HTTP-referrer + API
  restrictions in Google Cloud.
