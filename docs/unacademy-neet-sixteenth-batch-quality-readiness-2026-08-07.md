# Unacademy NEET sixteenth-batch quality-review readiness - 7 August 2026

## Status

Applied successfully to production at `2026-08-07 11:31 IST` under the separate
exact-hash owner approval. No `release` push occurred.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
in the Unacademy NEET sixteenth batch after their exact faculty links were
applied:

| Course ID | Canonical title | Instructor |
| ---: | --- | --- |
| 426 | Applications of Biotechnology | Seep Pahuja (`seep-pahuja`) |
| 427 | The Living World | Dr. Sachin Kapur (`sachin-kapur`) |
| 428 | Reproductive Health | Dr. Sachin Kapur (`sachin-kapur`) |

The package preserves each current YouTube source title before approving the
concise canonical course title. It retains the already-normalized instructor
links and does not add or remove catalogue, taxonomy, registry, or faculty-link
rows. The reviewed curriculum mappings remain unchanged: course 426 uses
Biotechnology and its Applications, course 427 uses The Living World, and
course 428 uses Reproductive Health.

## Exact production baseline

Fresh production evidence immediately after the approved faculty-link gate:

- 409 playlists / 4,699 videos / 4,705 memberships / 263 chapters;
- 92 chapter-class rows;
- 34 teachers / 54 aliases / 35 teacher-institute rows / 35 teacher-subject
  rows / 34 teacher-goal rows;
- 164 normalized course-teacher links and 32 quality reviews;
- courses 426-428 have exactly three approved instructor links, remain pending
  for title/faculty credit, and have no quality-review row;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_sixteenth_batch_quality_review_2026-08-07.sql`;
- SHA-256: `55470c5d03f5f4fdd0763a47d31dd898b24b6895c134d6e7fbf33e4955eea00d`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 32 -> 35;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, membership, chapter, class, learning-goal,
review-state, teacher-link, capability, or protected-fingerprint mismatch. Its
only direct table update captures the null source titles; canonical titles and
review status changes use `review_playlist_quality`. Postflight verifies each
target and its immutable before/after audit row before commit.

## Local validation

- production-shaped PGlite rehearsal passed for all three courses;
- rollback-on-drift rehearsal passed and left all three courses untouched;
- focused package validation: 1 file / 5 tests passed;
- full controlled-concurrency regression: 236 files / 1,926 tests passed;
- ESLint and `git diff --check` passed;
- no production SQL or `release` push occurred during preparation.

## Production execution evidence

Before execution, the signed-in Supabase dashboard confirmed active seven-day
PITR with restore availability through `07 Aug 2026, 11:01:39 IST` (earliest
retained point `01 Aug 2026, 00:02:34 IST`). The exact local artifact reproduced
the approved SHA-256 before it was loaded into a fresh SQL query.

The independent preflight matched every encoded guard:

- catalogue `409 / 4,699 / 4,705 / 263` and 92 chapter-class rows;
- 34 teachers / 54 aliases / 35 institute links / 35 subject links / 34 goal
  links / 164 course-teacher links / 32 quality reviews;
- target courses had the exact three faculty links, zero quality reviews, and
  only `title-review`, `source-title`, and `faculty-credit` missing;
- protected JEE remained `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`.

The guarded transaction committed and returned all three target rows. An
independent postflight then confirmed:

- catalogue, taxonomy, registry, and faculty-link totals unchanged;
- quality reviews `32 -> 35`, with exactly one new review for each of courses
  426-428;
- canonical titles are Applications of Biotechnology, The Living World, and
  Reproductive Health;
- all three courses are `approved / identified` with no missing quality fields;
- exact links remain `426 -> seep-pahuja` and `427-428 -> sachin-kapur`;
- protected JEE remains exactly
  `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`.

The completed artifact must not be rerun. No `release` push occurred.
