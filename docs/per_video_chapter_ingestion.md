# Per-video chapter ingestion

## Current status

The v12 implementation is installed and rehearsal-passed on the disposable
staging database. It is **not deployed to production**, and no real
mixed-chapter playlist has been imported. The staging database advertises the
complete version-12 capability contract. A separate anonymous, read-only
production probe returned `PGRST202` for that capability.

The explicitly confirmed staging verifier passed on 26 July 2026. Its
temporary staging-only helper and failure trigger were removed after cleanup;
the base staging helpers remain installed. The redacted evidence is outside
the repository at
`../outputs/v12-import/v12-staging-ff29d6.json`.
Its SHA-256 and the separately observed recovery/final-state checks are
preserved in `docs/v12_staging_rehearsal_evidence.json`.

This workflow exists for a narrow case: one publisher-owned YouTube playlist
contains lessons from more than one canonical chapter, but should remain one
course with one source playlist identity. It does not split one source into
several courses.

Production remains blocked by the backup/restore gate in
`docs/backup_restore_readiness.md`.

## Disposable-staging evidence

- The read-only preflight passed every prerequisite encoded for v12 and
  returned the exact environment marker `staging`.
- The only schema migration applied was
  `per_video_chapter_import_v12.sql`; the staging-only helper SQL was
  temporarily installed and later rolled back. The read-only postflight
  passed its capability, RLS, grant, and sequence checks with zero
  pre-existing mapped-import audit rows.
- The confirmed verifier passed 25 assertions with 0 failures. It exercised
  permission boundaries, successful mapping, exact replay, conflicting
  replay/create-only guards, structural drift, injected rollback, and both
  shared and conflicting concurrency.
- Cleanup acquired every run-owned request lock, removed ordinary fixtures
  first, deleted the 4 expected protected audit rows last, and reported zero
  playlists, videos, channels, chapters, audits, profiles, and auth users.
- One earlier runner was interrupted by a local shell timeout after creating
  two chapters, two channels, and one test account/profile. Its exact six-hex
  ledger was recovered separately: all 9 request locks were acquired,
  protected-audit cleanup ran last, and all residue counts were verified as
  zero before the successful run began.
- The v12 staging-test helper rollback passed. Final read-only checks showed
  capability version 12, no staging-test capability, no failure trigger, zero
  mapped-import audits, and zero `TESTV12` residue.
- The verifier reported `production_touched=false` and
  `migrations_applied_by_harness=false`. No production SQL or data write was
  attempted.

## Student-facing contract

- `/course/:playlistId` is full-course mode and may show lessons from several
  chapters.
- `/course/:playlistId/chapter/:chapterId` is chapter-scoped mode. It validates
  that the course contains the requested chapter, starts/resumes within that
  chapter, constrains previous/next and course metrics to it, and rejects a
  cross-chapter `?v=` value.
- Browse can list the same course under each chapter represented by its videos.

## Reviewed manifest contract

Mapped imports are non-interactive and require a checked-in JSON manifest
inside this repository:

```json
{
  "version": 1,
  "request_id": "018f7e3b-39b0-4f3e-8ee4-7a8d4d5a6b7c",
  "youtube_playlist_id": "PL_example",
  "assignments": [
    {
      "position": 1,
      "youtube_video_id": "abcdefghijk",
      "chapter": "Functions"
    },
    {
      "position": 2,
      "youtube_video_id": "lmnopqrstuv",
      "chapter": "Inverse Trigonometric Functions"
    }
  ]
}
```

The importer refuses the manifest unless:

- its playlist ID exactly matches the selected source;
- every current usable source video appears exactly once, in exact source
  position and video-ID order;
- every source position is a real nonnegative YouTube position; missing,
  duplicate, or non-increasing positions are rejected instead of synthesized;
- every assignment has a nonblank canonical chapter;
- at least two chapters are represented;
- the manifest's resolved real path remains inside the repository, including
  through symlinks or junctions;
- every mechanical/review finding is resolved except the generic existing-video
  overlap warning, which the atomic RPC replaces with exact subject/chapter
  equality checks; a dry-run with that warning remains `review`, never `ok`,
  until the RPC performs that verification;
- every mapped video has positive duration evidence and is embeddable;
- every named chapter already exists in the selected database;
- the database advertises v12 per-video chapter capability.

`request_id` is durable operation identity. Reuse the same ID only to retry the
exact same reviewed request. A different payload with that ID is rejected.
The payload also stores the raw manifest SHA-256, the assignment count, and a
source SHA-256 over UTF-8 `one_based_position<TAB>video_id` rows separated by
line feeds and terminated by one final line feed.

Anonymous dry-run cannot read the protected audit table. If the source course
already exists, it reports an unverified replay candidate as `review`; write
mode then permits only an exact request replay whose live structural state has
not drifted. It does not treat that review result as permission to overwrite.

## Database guarantees

`src/migrations/per_video_chapter_import_v12.sql` is an additive delta. It
does not replace the legacy `import_playlist(jsonb,text)` function.

The mapped RPC:

- is create-only and accepts `merge` mode only;
- forbids a top-level chapter when child `chapter_id` values are present;
- requires every video to have a positive chapter ID;
- verifies all chapters belong to the declared subject before writing;
- rejects an existing course with the same source playlist ID for every new
  request;
- permits reuse only when an existing video already has the exact reviewed
  subject and chapter;
- serializes request retries and shared video IDs;
- calls the existing importer and assigns chapters inside one transaction;
- records the request, before/after snapshots, and result in an RLS-protected
  audit row;
- compares only import-owned structural state for replay, so ratings,
  popularity, and verification refreshes do not create false drift;
- returns the stored result without writing for an identical, drift-free
  request retry.

The capability RPC is deliberately public and read-only; it returns only fixed
feature flags. Import/audit entry points and snapshots remain guarded.

The supplied rollback SQL is **code rollback only**. It removes v12 entry
points while retaining audit evidence and catalogue data. Data rollback
requires a separately reviewed operation or a verified restore; do not treat
the rollback file as a substitute for a backup.

## Deployment sequence

Do not combine this with any completed migration or rerun an old production
bundle.

The exact disposable-staging order is below. It was completed for the recorded
checkpoint and must not be rerun without a new, explicitly approved
disposable target and reason:

1. Run `per_video_chapter_import_v12_preflight.sql` read-only against the
   disposable staging database. Review every result and stop on any false,
   missing, or non-staging value.
2. Apply only `per_video_chapter_import_v12.sql` to that disposable staging
   database. Do not rerun a cumulative or previously completed migration.
3. Run `per_video_chapter_import_v12_postflight.sql` read-only and stop on any
   capability, grant, RLS, or object mismatch.
4. Confirm that the base staging-only
   `src/migrations/staging_test_helpers.sql` has already been applied and that
   its server-side environment guard is available.
5. Apply only
   `src/migrations/per_video_chapter_import_v12_staging_test_helpers.sql`.
   This helper is staging/test-only and is not part of a production package.
6. Confirm that `TEST_SUPABASE_URL` is distinct from the production URL, that
   `TEST_SERVICE_KEY` and `TEST_ANON_KEY` belong only to the disposable target,
   and that no production key is supplied. Set both `TEST_ALLOW=1` and
   `V12_TEST_ALLOW=1`, then run exactly:

   ```text
   npm run verify:v12-import-staging -- --confirm-disposable-v12-staging
   ```

7. Review the redacted report written outside the repository under
   `../outputs/v12-import/`. Require every assertion to pass,
   `requests_quiesced` to be true, cleanup to complete, and every reported
   residue count to be zero. A failed, missing, or unreviewed report is not
   staging evidence.
8. After zero residue is confirmed, optionally apply
   `per_video_chapter_import_v12_staging_test_helpers_rollback.sql`. Roll back
   this v12 helper before any rollback of the base `staging_test_helpers.sql`.
9. Stop at this boundary. A mapped source dry-run, one real staging checkpoint,
   browser verification, or production packaging is a separate reviewed task;
   none follows automatically from the synthetic verifier.

`verify:v12-import-staging` is deliberately excluded from `test:all` and CI.
Do not schedule it, add it to a general test command, or run it automatically.
It is an explicitly confirmed disposable-staging operation.

Production remains blocked by `docs/backup_restore_readiness.md`. The green
disposable-staging report does not authorize production SQL or data writes.
Do not add v12 to, or rerun, the legacy cumulative production migration.

## Functions source checkpoint

Playlist `PL_A4M5IAkMad5zB0Dh6gUw1eYK8dN7hP7` remains deferred.

- 187 source positions and 187 unique video IDs were snapshotted.
- Historical ordered position/video-ID audit SHA-256:
  `214db3c5b0c42fadc9c88bc49e6958bf94ae2214f65ba3466c25f6b81afc540d`.
- 141 lessons are clearly Functions.
- Positions 40–46 (7 lessons) are clearly Inverse Trigonometric Functions.
- 39 lessons cross Functions, Trigonometry, Quadratic Equations, Straight
  Lines, Logarithms, Differential Calculus, AOD, Binomial/P&C, or
  Sequences/Series boundaries and require an explicit editorial decision.
- The deterministic quality gate also reports repeated lesson number `57`
  across source positions 57–61. No finding waiver exists; this must be
  resolved as source/classifier evidence before any mapped write.

No Functions manifest is checked in because exact assignment of those 39
lessons cannot be inferred safely from the titles/descriptions or the differing
JEE Main and Advanced syllabus groupings. Re-fetch and calculate the importer's
exact trailing-newline source digest before authoring a future manifest; do not
assume the historical checkpoint hash uses the same byte convention.
