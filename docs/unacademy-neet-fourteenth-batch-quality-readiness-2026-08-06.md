# Unacademy NEET fourteenth-batch quality-review readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL or `release` push was run.
Production application requires a separate owner approval matching the
exact SHA-256 below, followed by another fresh PITR and exact-baseline check.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
in the refreshed Unacademy NEET fourteenth batch after their exact faculty links
were applied:

| Course ID | Canonical title | Instructor |
| ---: | --- | --- |
| 420 | Friction | Mahendra Singh (`34`) |
| 421 | Cell: The Unit of Life | Pradeep Singh (`33`) |
| 422 | Anatomy of Flowering Plants | Pradeep Singh (`33`) |

The package preserves each current YouTube source title before approving the
canonical chapter title. It retains the already-normalized instructor links and
does not add or remove catalogue, taxonomy, registry, or faculty-link rows.

## Exact production baseline

Fresh production evidence immediately after the approved faculty-link gate:

- 403 playlists / 4,655 videos / 4,661 memberships / 263 chapters;
- 92 chapter-class rows;
- 32 teachers / 50 aliases / 33 teacher-institute rows / 33 teacher-subject
  rows / 32 teacher-goal rows;
- 158 normalized course-teacher links and 26 quality reviews;
- courses 420-422 have exactly three approved instructor links, remain pending
  for title/faculty credit, and have no quality-review row;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_fourteenth_batch_quality_review_2026-08-06.sql`;
- SHA-256: `20640b0bff00fda560c1563cd295ff9798da0528d63efc69b3983dadea8f5965`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 26 -> 29;
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
- full controlled-concurrency regression: 225 files / 1,870 tests passed;
- ESLint passed with zero warnings;
- production build passed; the sitemap builder preserved the last known
  complete sitemap because this worktree has no Supabase `.env`;
- frontend static/security safeguards passed; only the four local `.env`
  configuration checks were unavailable in this worktree;
- production dependency audit reported zero vulnerabilities;
- `git diff --check` passed;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply the exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Do not
rerun the completed faculty-link artifact, and do not push `release`.

Approve with:

`Approve applying Unacademy NEET fourteenth-batch quality-review artifact SHA-256 20640b0bff00fda560c1563cd295ff9798da0528d63efc69b3983dadea8f5965 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
