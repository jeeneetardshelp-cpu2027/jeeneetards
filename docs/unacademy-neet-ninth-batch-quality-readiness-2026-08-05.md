# Unacademy NEET ninth-batch quality-review readiness - 5 August 2026

## Status

Prepared and locally validated only. This package has **not** been applied to
production. Applying it requires separate owner approval of the exact SHA-256,
a fresh PITR check, and a fresh exact-baseline preflight. No content import,
faculty-registry change, schema migration, clone, restore, or `release` push is
in scope.

## Reviewed scope

The package completes the separate quality gate for the three courses imported
under owner decision `b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6` after their exact
faculty links were applied:

| Course | Canonical title | Instructor |
| ---: | --- | --- |
| 408 | Sexual Reproduction in Flowering Plants | Pradeep Singh (33) |
| 409 | Alternating Current | Mahendra Singh (34) |
| 410 | Chemical Kinetics | Anoop Vashishtha (36) |

Each long imported YouTube playlist title is preserved verbatim in
`source_title` before the canonical display title is applied. The transition
does not alter chapters, lessons, memberships, goals, class scope, or the final
teacher links.

## Fresh read-only production snapshot

Refreshed again after the first approved quality-review artifact stopped before
execution because two more unrelated Mathematics chapters appeared. Production
now includes `321` (`Linear Programming`), `322` (`Sets`), and `323` (`Linear
Inequalities`); all three are explicitly pinned by the refreshed package:

- catalogue: 391 playlists / 4,566 videos / 4,572 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 146 course links;
- quality reviews: 14, with zero reviews for courses 408-410;
- target lesson counts: 12 / 6 / 9, all bound to chapters 125 / 14 / 35;
- all three retain null `source_title`, `pending` title review, `pending`
  faculty credit, and exact `full-course` / `hinglish` / `intermediate`
  metadata;
- exact instructor links are present at position 1: 408 -> 33, 409 -> 34,
  410 -> 36;
- all three carry only the `neet` goal and `class-12` scope;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

Production remained read-only during this snapshot and package preparation.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_ninth_batch_quality_review_2026-08-05.sql`;
- SHA-256: `fc98767ea7c14d7678fe7718ae037e460848b1de07668ae0a5a307955256fb63`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, identify the already-linked faculty, and append three immutable
  quality-review rows;
- expected quality-review count: 14 -> 17;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one transaction. It aborts on any catalogue, taxonomy, target-course,
source-ID, membership, chapter, class, learning-goal, review-state,
teacher-link, capability, or protected-fingerprint mismatch. Its only direct
table update captures the null source titles; the canonical title and review
status changes use `review_playlist_quality`. Postflight checks every target
result and each immutable before/after review row before commit.

## Local validation

- production-shaped PGlite rehearsal passed against the refreshed 263-chapter
  baseline. It preserved all catalogue and teacher-link totals and changed
  quality reviews 14 -> 17;
- target result: three canonical titles, three exact source titles,
  approved/identified statuses, exact instructor IDs, and empty missing-field
  arrays;
- refreshed rollback-on-drift rehearsal passed: a 264th chapter rejected the
  transaction and left all three courses unreviewed;
- refreshed focused package validation: 1 file / 5 tests passed;
- refreshed full regression suite after rebasing the independent NCERT Class 11
  Mathematics materials commit: 184 files / 1,688 tests passed;
- ESLint passed with zero warnings;
- production build passed (391 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- production dependency audit reported zero vulnerabilities;
- no production SQL or `release` push occurred while preparing this package.

## Required production approval

`Approve applying refreshed Unacademy NEET ninth-batch quality-review artifact
SHA-256 fc98767ea7c14d7678fe7718ae037e460848b1de07668ae0a5a307955256fb63
to production, after a fresh PITR and exact-baseline check; stop on any
mismatch; no release push.`
