# Unacademy NEET eleventh-batch quality-review readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL or `release` push was run.
Production application requires a separate owner approval matching the exact
SHA-256 below, followed by another fresh PITR and exact-baseline check.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
under owner decision `d8125eb3-7281-43da-bfd4-61acd655121f` after their exact
faculty links were applied:

| Course | Canonical title | Instructor |
| ---: | --- | --- |
| 414 | Chemical Equilibrium | Anoop Vashishtha (36) |
| 415 | Surface Chemistry | Anoop Vashishtha (36) |
| 416 | P-Block Elements | Anoop Vashishtha (36) |

Each imported YouTube playlist title is preserved verbatim in `source_title`
before the shorter canonical display title is applied. The transition does not
alter chapters, lessons, memberships, goals, class scope, or final teacher
links.

## Fresh read-only production snapshot

Captured at `2026-08-05T20:30:56.729061+00:00` after the faculty-link gate:

- PITR active with seven-day retention; latest available restore point shown as
  `2026-08-06 01:32:24 +05:30`;
- catalogue: 397 playlists / 4,603 videos / 4,609 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 152 course links;
- quality reviews: 20, with zero reviews for courses 414-416;
- target lesson counts: 10 / 5 / 10, bound only to chapters 30 / 32 / 93;
- targets retain null `source_title`, `pending` title review, `pending` faculty
  credit, and exact `full-course` / `hinglish` / `intermediate` metadata;
- exact instructor links are present at position 1: 414 -> 36, 415 -> 36, and
  416 -> 36;
- course 414 carries `class-11`; courses 415 and 416 carry `class-12`; all three
  carry only the `neet` learning goal;
- `playlist_quality_missing` reports exactly `title-review`, `source-title`, and
  `faculty-credit` for every target;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

Production remained read-only during this snapshot and package preparation.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_eleventh_batch_quality_review_2026-08-06.sql`;
- SHA-256: `eae13bfeb83df0105da1c3fd4b87d3f9caa9330c86fec7fc428833e551ec82dc`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: preserve three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 20 -> 23;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review status changes use `review_playlist_quality`. Postflight verifies each
target and its immutable before/after audit row before commit.

## Local validation

- production-shaped PGlite rehearsal passed: all three reviews applied
  atomically, quality-review count changed from 20 to 23, and catalogue and
  faculty-link totals remained fixed;
- rollback-on-drift rehearsal passed: a 264th chapter rejected the transaction
  and left all three targets unreviewed;
- focused package validation: 1 file / 5 tests passed;
- full regression: 205 files / 1,786 tests passed with four workers; two
  pre-existing PGlite faculty-package tests that timed out under unrestricted
  contention also passed independently;
- ESLint passed with zero warnings;
- production build passed (397 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply the exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Do not
rerun the already-completed faculty-link artifact, and do not push `release`.
