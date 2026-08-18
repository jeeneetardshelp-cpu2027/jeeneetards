# Unacademy NEET tenth-batch quality-review readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL or `release` push was run.
Production application requires a separate owner approval matching the exact
SHA-256 below, followed by another fresh PITR and exact-baseline check.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
under owner decision `0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1` after their exact
faculty links were applied:

| Course | Canonical title | Instructor |
| ---: | --- | --- |
| 411 | Thermal Properties of Matter | Mahendra Singh (34) |
| 412 | Electromagnetic Induction | Anu Gupta (35) |
| 413 | Plant Growth and Development | Pradeep Singh (33) |

Each imported YouTube playlist title is preserved verbatim in `source_title`
before the shorter canonical display title is applied. The transition does not
alter chapters, lessons, memberships, goals, class scope, or final teacher
links.

## Fresh read-only production snapshot

Captured at `2026-08-05T18:51:52.231737+00:00` after the faculty-link gate:

- PITR active with seven-day retention; latest available restore point shown as
  `2026-08-06 00:20:20 +05:30`;
- catalogue: 394 playlists / 4,578 videos / 4,584 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 149 course links;
- quality reviews: 17, with zero reviews for courses 411-413;
- target lesson counts: 4 / 3 / 5, bound only to chapters 25 / 13 / 120;
- targets retain null `source_title`, `pending` title review, `pending` faculty
  credit, and exact `full-course` / `hinglish` / `intermediate` metadata;
- exact instructor links are present at position 1: 411 -> 34, 412 -> 35,
  and 413 -> 33;
- courses 411 and 413 carry `class-11`; course 412 carries `class-12`; all three
  carry only the `neet` learning goal;
- `playlist_quality_missing` reports exactly `title-review`, `source-title`, and
  `faculty-credit` for every target;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

Production remained read-only during this snapshot and package preparation.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_tenth_batch_quality_review_2026-08-06.sql`;
- SHA-256: `04268e32a69d5d5bd9868c0653caf739a45c7f053fab45add83c3872d057205c`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: preserve three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 17 -> 20;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review status changes use `review_playlist_quality`. Postflight verifies each
target and its immutable before/after audit row before commit.

## Local validation

- production-shaped PGlite rehearsal passed and reviewed all three courses
  atomically, preserving every catalogue and faculty-link total while changing
  quality reviews from 17 to 20;
- target result: three canonical titles, three verbatim source titles,
  approved/identified statuses, exact instructor IDs, and empty missing-field
  arrays;
- rollback-on-drift rehearsal passed: a 264th chapter rejected the transaction
  and left all three courses unreviewed;
- focused package validation: 1 file / 5 tests passed;
- full regression: 194 files / 1,728 tests passed;
- ESLint passed with zero warnings;
- production build passed (394 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply the exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Do not
rerun the already-completed faculty-link artifact, and do not push `release`.
