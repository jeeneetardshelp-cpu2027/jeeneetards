# Unacademy NEET nineteenth-batch quality-review readiness - 8 August 2026

## Status

**PREPARED ONLY, NOT APPLIED.** Production remains unchanged after the completed
faculty-link gate. This package is waiting for separate owner approval naming
the exact SHA-256 below. No quality-review SQL, deployment, or `release` push
occurred.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
in the reviewed Unacademy NEET nineteenth batch:

| Course ID | Canonical title | Instructor | Curriculum chapter |
| ---: | --- | --- | --- |
| 433 | The d and f Block Elements | Anoop Vashishtha (`anoop-vashishtha`, teacher 36) | The d and f Block Elements (45) |
| 434 | Amines | Anoop Vashishtha (`anoop-vashishtha`, teacher 36) | Amines (48) |
| 435 | Thermochemistry | Ashwani Tyagi (`ashwani-tyagi`, teacher 32) | Thermochemistry (29) |

The package preserves each current YouTube source title before approving the
concise canonical course title. It retains the already-normalized instructor
links and does not add or remove catalogue, taxonomy, registry, or faculty-link
rows. Owner evidence decision:
`e6539ac8-512b-4e76-8bd1-774c1a3c4bdc`.

## Fresh read-only production evidence

Evidence refreshed at `2026-08-08T06:16:17.139347Z`:

- catalogue: 416 playlists / 4,731 videos / 4,737 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 34 teachers / 54 aliases / 35 institute links / 35 subject
  links / 34 learning-goal links / 171 course links;
- quality reviews: 39;
- the content-quality capability advertises source-title and review support,
  requires faculty identity for `identified`, and disables automatic identity
  resolution;
- courses 433-435 have their exact 2 / 3 / 3 source-ordered memberships, exact
  chapter and class mappings, their approved verified instructor links, and no
  quality-review rows;
- all three courses are still `pending / pending`, have null source titles, and
  are missing exactly `title-review`, `source-title`, and `faculty-credit`;
- protected original JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

PITR was checked read-only immediately before the snapshot. Seven-day retention
was active, with restore availability from `02 Aug 2026, 00:01:09 IST` through
`08 Aug 2026, 11:44:01 IST`. A fresh PITR and exact-baseline check are still
required immediately before any separately approved production execution.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_nineteenth_batch_quality_review_2026-08-08.sql`;
- SHA-256: `d7e2b9255925f1288bb1c4841b79b15d46a67baf81ca734826d1b17df0bfb0ab`;
- target: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 39 -> 42;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review-state changes use `review_playlist_quality`. Postflight verifies every
target and its immutable before/after audit row before commit.

## Validation

- production-shaped PGlite rehearsal passed for all three reviews, producing
  exactly 42 total quality reviews with catalogue and faculty-link totals
  unchanged;
- rollback-on-drift rehearsal passed: one extra chapter rejected the transaction
  and left all three target courses untouched;
- focused package validation: 1 file / 4 tests passed, including the exact hash
  and prepared-only gate;
- full controlled-concurrency regression: 288 files / 2,172 tests passed with
  `--maxWorkers=4`;
- ESLint passed with zero warnings, the production build passed, and the sitemap
  safety path preserved the last complete sitemap because Supabase build
  credentials were intentionally absent;
- no production SQL or `release` push occurred during preparation.

## Required approval wording

`Approve applying Unacademy NEET nineteenth-batch quality-review artifact
SHA-256 d7e2b9255925f1288bb1c4841b79b15d46a67baf81ca734826d1b17df0bfb0ab to
production, after a fresh PITR and exact-baseline check; stop on any mismatch;
no release push.`

## Next gate

Stop here. Do not run this SQL without the exact-hash approval above. The
completed faculty-link artifact must not be rerun.
