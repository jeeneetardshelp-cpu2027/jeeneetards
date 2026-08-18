# Unacademy NEET thirteenth-batch quality-review readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL or `release` push was run.
Production application requires a separate owner approval matching the exact
SHA-256 below, followed by another fresh PITR and exact-baseline check.

## Reviewed scope

This package completes the separate quality gate for the two courses imported
in the reviewed Unacademy NEET thirteenth batch after their exact faculty links
were applied:

| Course | Canonical title | Instructor |
| ---: | --- | --- |
| 418 | Thermodynamics | Anoop Vashishtha (36) |
| 419 | Coordination Compounds | Ashwani Tyagi (32) |

Each imported YouTube playlist title is preserved verbatim in `source_title`
before the shorter canonical display title is applied. The transition does not
alter chapters, lessons, memberships, goals, class scope, or final teacher
links.

## Fresh read-only production snapshot

Captured at `2026-08-06T07:39:58.540Z` after the faculty-link gate:

- catalogue: 400 playlists / 4,641 videos / 4,647 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 155 course links;
- quality reviews: 24, with zero reviews for courses 418-419;
- both targets have 12 distinct lessons in positions 1-12, bound only to
  chapters 36 and 87 respectively;
- both targets retain null `source_title`, `pending` title review, `pending`
  faculty credit, and exact `full-course` / `hinglish` / `intermediate`
  metadata;
- exact instructor links are present at position 1: 418 -> 36 and 419 -> 32;
- course 418 carries `class-11`, course 419 carries `class-12`, and both carry
  only the `neet` learning goal;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

Production remained read-only during this snapshot and package preparation.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_thirteenth_batch_quality_review_2026-08-06.sql`;
- SHA-256: `6af3c714f816a6fd898a32ec3068d77059c285c054b7256089a928ce4aaeabb8`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: preserve two source titles, approve two canonical
  titles, identify the already-linked faculty, and append two immutable
  quality-review rows;
- expected quality-review count: 24 -> 26;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review status changes use `review_playlist_quality`. Postflight verifies each
target and its immutable before/after audit row before commit.

## Local validation

- production-shaped PGlite rehearsal passed for both courses;
- rollback-on-drift rehearsal passed and left both courses untouched;
- focused package validation: 1 file / 5 tests passed;
- full regression: 215 files / 1,825 tests passed;
- ESLint passed with zero warnings;
- production build passed (400 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- `git diff --check` passed;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply the exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Do not
rerun the already-completed faculty-link artifact, and do not push `release`.
