# Unacademy NEET thirteenth-batch faculty-link readiness — 6 August 2026

## Status

Prepared and locally rehearsed only. The artifact has not been applied to
production. Applying it requires separate owner approval of the exact SHA-256
below. During preparation, no production SQL or `release` push occurred.

Owner evidence decision: `c927977e-bbc3-48e4-a12f-d80e243dfbd8`.

## Reviewed scope

The production catalogue contains the two newly imported courses with no
normalized faculty link and no quality-review row:

- course `418`, Thermodynamics, source
  `PLsgHooHkqhhMCPaz0b6MC-BhUeUgqhRFe`, 12 lessons in chapter `36`, attributed
  to verified teacher Anoop Vashishtha (`id 36`, `anoop-vashishtha`);
- course `419`, Coordination Compounds, source
  `PLsgHooHkqhhMbdtmdvS2bUG_lYX9Ev43f`, 12 lessons in chapter `87`, attributed
  to verified teacher Ashwani Tyagi (`id 32`, `ashwani-tyagi`).

Both teachers already have the reviewed Unacademy NEET (`id 147`), Chemistry
(`id 2`), and NEET (`id 2`) context. The artifact creates no teacher, alias,
institute, subject, or goal rows.

## Exact production baseline

Read-only capture at `2026-08-06T07:14:10.231Z`:

- 400 playlists / 4,641 videos / 4,647 memberships / 263 chapters;
- 92 chapter-class rows;
- 32 teachers / 50 aliases / 33 teacher-institute rows / 33 teacher-subject
  rows / 32 teacher-goal rows;
- 153 normalized course-teacher links and 24 quality reviews;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Prepared artifact

File:
`docs/sql/unacademy_neet_thirteenth_batch_faculty_links_2026-08-06.sql`

SHA-256: `53e91d17dace564c6b65faf1c7722f40aaad017635a0436a11602cc360a4b562`

The transaction is additive and guarded. It:

- checks the exact catalogue, faculty-registry, and quality-review baseline;
- checks both complete course identities, sources, chapters, goals, classes,
  pending review state, verified teachers, and teacher context;
- checks that neither course already has a faculty link or quality review;
- checks the protected JEE count and fingerprint before and after writing;
- inserts +2 `playlist_teachers` rows only, producing 155 course links;
- leaves course metadata, review status, quality reviews, and all content rows
  unchanged;
- rolls the whole transaction back on any mismatch.

## Local rehearsal

The focused PGlite regression executes the complete transaction against the
exact production-shaped baseline, verifies both links, and proves an exact
baseline mismatch aborts without leaving either link behind.

## Approval gate

To apply this exact immutable artifact, approve:

`Approve applying Unacademy NEET thirteenth-batch faculty-link artifact SHA-256 53e91d17dace564c6b65faf1c7722f40aaad017635a0436a11602cc360a4b562 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
