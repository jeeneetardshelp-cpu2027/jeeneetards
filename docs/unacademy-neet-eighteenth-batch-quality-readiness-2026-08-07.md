# Unacademy NEET eighteenth-batch quality-review readiness - 7 August 2026

## Status

Applied successfully to production at `2026-08-07 17:12 IST` under the separate
exact-hash owner approval. No `release` push occurred.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
in the reviewed Unacademy NEET eighteenth batch after their exact faculty links
were applied:

| Course ID | Canonical title | Instructor | Curriculum chapter |
| ---: | --- | --- | --- |
| 430 | Photosynthesis in Higher Plants | Pradeep Singh (`pradeep-singh`, teacher 33) | Photosynthesis in Higher Plants (119) |
| 431 | Ionic Equilibrium | Ashwani Tyagi (`ashwani-tyagi`, teacher 32) | Ionic Equilibrium (38) |
| 432 | Excretory Products and Their Elimination | Dr. Sachin Kapur (`sachin-kapur`, teacher 38) | Excretory Products and Their Elimination (111) |

The package preserves each current YouTube source title before approving the
concise canonical course title. It retains the already-normalized instructor
links and does not add or remove catalogue, taxonomy, registry, or faculty-link
rows. Owner evidence decision: `8f19ac66-a1b4-4304-8a6f-468131f63732`.

## Fresh production evidence

Read-only evidence refreshed at `2026-08-07T11:11:27.566Z`:

- 413 playlists / 4,723 videos / 4,729 memberships / 263 chapters;
- 92 chapter-class rows;
- 34 teachers / 54 aliases / 35 teacher-institute rows / 35 teacher-subject
  rows / 34 teacher-goal rows;
- 168 normalized course-teacher links and 36 quality reviews;
- courses 430-432 have their exact 3 / 8 / 7 source-ordered memberships,
  approved verified instructor links, no quality-review row, and exactly
  `title-review`, `source-title`, and `faculty-credit` missing;
- the content-quality capability advertises source-title and review support,
  requires faculty identity for `identified`, and disables automatic identity
  resolution;
- protected original JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Approved artifact

- SQL: `docs/sql/unacademy_neet_eighteenth_batch_quality_review_2026-08-07.sql`;
- SHA-256: `b6e4421a027bd50e8639302f23f204635876a1f17f1855c2da7c400fa9f7a442`;
- target: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 36 -> 39;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review status changes use `review_playlist_quality`. Postflight verifies each
target and its immutable before/after audit row before commit.

## Validation

- production-shaped PGlite rehearsal passed for all three reviews;
- rollback-on-drift rehearsal passed and left all three courses untouched;
- focused package validation: 1 file / 5 tests passed;
- full controlled-concurrency regression: 279 files / 2,124 tests passed;
- ESLint, production build, and `git diff --check` passed;
- no production SQL was executed during preparation; the later approved
  production execution is recorded below. No `release` push occurred.

## Production execution evidence

Immediately before execution, the signed-in Supabase dashboard confirmed active
seven-day PITR with restore availability through `07 Aug 2026, 16:47:54 IST`
(earliest retained point `01 Aug 2026, 00:02:34 IST`). The exact local artifact
reproduced the owner-approved SHA-256 before it was loaded into a separate blank
SQL query.

The independent read-only preflight matched every encoded guard:

- catalogue `413 / 4,723 / 4,729 / 263` and 92 chapter-class rows;
- 34 teachers / 54 aliases / 35 institute links / 35 subject links / 34 goal
  links / 168 course-teacher links / 36 quality reviews;
- courses 430-432 had the exact 3 / 8 / 7 source-ordered lesson IDs, exact
  chapter mappings, exact instructor links, zero reviews, and only
  `title-review`, `source-title`, and `faculty-credit` missing;
- protected JEE was exactly
  `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`.

The guarded transaction committed and returned exactly the three target rows.
An independent postflight in another blank query confirmed:

- catalogue, taxonomy, registry, and faculty-link totals unchanged;
- quality reviews `36 -> 39`, exactly one audit row per target;
- canonical titles are Photosynthesis in Higher Plants, Ionic Equilibrium, and
  Excretory Products and Their Elimination;
- all three courses are `approved / identified` with no missing quality fields;
- exact instructor links remain `430 -> pradeep-singh`, `431 -> ashwani-tyagi`,
  and `432 -> sachin-kapur`;
- every preserved source title matches its audit before-state and every
  canonical title matches its audit after-state;
- protected JEE remains exactly
  `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`.

The completed artifact must not be rerun. No `release` push occurred.
