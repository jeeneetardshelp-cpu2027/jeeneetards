# Unacademy NEET twentieth-batch quality-review readiness - 8 August 2026

## Status

**APPLIED TO PRODUCTION ON 8 AUGUST 2026.** The owner approved the exact
SHA-256 below. The guarded transaction completed the three reviewed quality
transitions. No deployment or `release` push occurred.

## Reviewed scope

This package completes the separate quality gate for the three courses imported
under owner decision `8de024c6-7317-4901-a91e-5006a5efcd7e`:

| Course ID | Canonical title | Instructor | Curriculum chapter |
| ---: | --- | --- | --- |
| 436 | Metallurgy | Anoop Vashishtha (`anoop-vashishtha`, teacher 36) | Metallurgy (55) |
| 437 | The s-Block Elements | Anoop Vashishtha (`anoop-vashishtha`, teacher 36) | The s-Block Elements (46) |
| 438 | Semiconductor Electronics | Indrajeet Singh Sangtani (`indrajeet-singh-sangtani`, teacher 39) | Semiconductor Electronics (17) |

The package preserves each exact current YouTube source title before approving
the concise canonical title. It retains the normalized instructor links from
the completed faculty-link gate and does not create or delete catalogue,
taxonomy, registry, or faculty-link rows.

## Fresh production boundary before execution

The completed twentieth-batch faculty-link postflight at
`2026-08-08T10:28:34.391104Z` established the expected boundary. A fresh
read-only preflight at `2026-08-08T11:09:08.905312Z` reproduced it exactly:

- catalogue: 419 playlists / 4,740 videos / 4,746 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 35 teachers / 56 aliases / 36 institute links / 36 subject
  links / 35 learning-goal links / 174 course links;
- quality reviews: 42;
- courses 436-438 each have one reviewed instructor link, no quality-review
  row, null `source_title`, and `pending / pending` review state;
- the three courses are missing exactly `title-review`, `source-title`, and
  `faculty-credit`; and
- protected original JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

PITR was rechecked immediately before the write. Seven-day retention was
active, with restore availability from `02 Aug 2026, 00:01:09 IST` through
`08 Aug 2026, 15:58:08 IST`; the latter is this gate's rollback point.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_twentieth_batch_quality_review_2026-08-08.sql`;
- SHA-256: `6ea0f50eb369bdc7f2daee25d20631729c76e527b2f70d07616bc775e4efa023`;
- target: production project `kezelafqhgqrprpadmlf`;
- expected transition: capture three source titles, approve three canonical
  titles, retain the already-linked instructors, and append three immutable
  quality-review rows;
- expected quality-review count: 42 -> 45;
- expected catalogue, taxonomy, registry, teacher-link, and protected-JEE
  delta: zero.

The SQL is one guarded transaction. It aborts on any catalogue, taxonomy,
target-course, source-ID, video order, membership, chapter, class,
learning-goal, review-state, teacher-link, capability, or protected-fingerprint
mismatch. Its only direct update captures the null source titles; canonical
titles and review-state changes use `review_playlist_quality`. Postflight
verifies each target and its immutable before/after audit row before commit.

## Validation

- production-shaped PGlite rehearsal passed for all three reviews, producing
  exactly 45 total quality reviews with catalogue and faculty-link totals
  unchanged;
- rollback-on-drift rehearsal passed: one extra chapter rejected the transaction
  and left all three target courses untouched;
- focused twentieth-batch validation passed: 3 files / 16 tests;
- full controlled-concurrency regression passed: 293 files / 2,202 tests;
- ESLint passed with zero warnings and the production build passed; the sitemap
  safety path preserved the last complete sitemap because build credentials
  were intentionally absent;
- no production SQL was run during preparation.

## Production execution evidence

- the approved SQL artifact was re-read from disk immediately before execution:
  20,164 UTF-8 bytes and exact SHA-256
  `6ea0f50eb369bdc7f2daee25d20631729c76e527b2f70d07616bc775e4efa023`;
- the first editor readback exposed stale preflight text ahead of the artifact;
  nothing was executed, the entire editor was cleared, and the exact 400-line
  artifact was reloaded with its approved header, final postflight query, and
  `commit;` terminator verified before execution;
- the guarded transaction committed and returned exactly courses 436-438 with
  canonical titles, preserved source titles, and `approved` title status;
- all three immutable review rows were written at
  `2026-08-08T11:10:27.901115Z`;
- independent read-only postflight at `2026-08-08T11:11:14.834137Z` confirmed
  quality reviews `42 -> 45`, exactly one review row per target, and exact
  pending-to-approved / pending-to-identified before-and-after states;
- courses 436-438 retain their exact instructor links (36, 36, and 39), have
  no missing quality fields, and preserve their exact YouTube source titles;
- catalogue, taxonomy, registry, and faculty-link totals remained unchanged at
  `419 / 4,740 / 4,746 / 263`, 92 chapter-class scopes, and
  `35 / 56 / 36 / 36 / 35 / 174` faculty-registry totals;
- protected JEE remained exactly `82 / 1,304 /
  30eee4a4a6842e5beeb7c97083d7f812`; and
- no `release` push occurred.

## Consumed approval wording

`Approve applying Unacademy NEET twentieth-batch quality-review artifact
SHA-256 6ea0f50eb369bdc7f2daee25d20631729c76e527b2f70d07616bc775e4efa023 to
production, after a fresh PITR and exact-baseline check; stop on any mismatch;
no release push.`

## Next gate

Stop here. The completed faculty-link and quality-review artifacts must not be
rerun. Any later content, faculty, quality, schema, deployment, or `release`
work remains a separate gate.
