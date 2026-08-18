# Unacademy NEET twentieth-batch faculty-link readiness - 8 August 2026

## Status

**APPLIED SUCCESSFULLY TO PRODUCTION ON 8 AUGUST 2026.** The revised exact-hash
artifact committed after fresh PITR and exact-baseline verification. No
quality-review transition, deployment, or `release` push occurred.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twentieth_batch_faculty_links_2026-08-08.sql`
- SHA-256: `9ae58b0c2ebdb0cd276dfe36cf45e2daae67c7ac409ea4ec0c8857182f543852`
- Evidence decision: `8de024c6-7317-4901-a91e-5006a5efcd7e`

Approved execution wording:

> Approve applying Unacademy NEET twentieth-batch faculty-link artifact
> SHA-256 `9ae58b0c2ebdb0cd276dfe36cf45e2daae67c7ac409ea4ec0c8857182f543852`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

## Aborted first attempt

The owner-approved first artifact, SHA-256
`47c61d0354124e33241cd17e3e4d8cffc1c57abbcd07b716b46a050c7520200c`, was
attempted once after a fresh production preflight at
`2026-08-08T09:37:04.878452Z`. Its guard raised
`refusing Unacademy twentieth-batch faculty package: reviewed course differs`
before any insert. The transaction rolled back and read-only post-abort counts
confirmed zero faculty-package changes.

The only mismatch was course 438's exact stored title: production contains two
ordinary spaces after `Class 12 |`, while the first artifact expected one. All
other guarded course clauses passed. This revision changes only that expected
title literal and its test fixture; it does not change any proposed write.

## Production execution evidence

- exact approved artifact SHA-256 was reverified immediately before execution:
  `9ae58b0c2ebdb0cd276dfe36cf45e2daae67c7ac409ea4ec0c8857182f543852`;
- PITR was active with seven-day retention, with restore availability from
  `02 Aug 2026, 00:01:09 IST` through `08 Aug 2026, 15:10:06 IST`;
- fresh read-only preflight at `2026-08-08T10:26:57.386740Z` matched every
  exact guard: catalogue `419 / 4,740 / 4,746 / 263`, chapter-class scopes `92`,
  registry `34 / 54 / 35 / 35 / 34 / 171`, quality reviews `42`, production
  marker `0`, and all target teacher/alias/faculty/review counts `0`;
- the SQL editor value was copied back before execution and matched the approved
  artifact exactly after newline normalization;
- the guarded transaction committed and returned exactly courses 436-438;
- independent read-only postflight at `2026-08-08T10:28:34.391104Z` confirmed
  registry `35 / 56 / 36 / 36 / 35 / 174` with catalogue, chapter-class scopes,
  and the 42 quality reviews unchanged;
- new verified teacher `39` is `indrajeet-singh-sangtani`, with normalized
  aliases `indrajeet` and `indrajeet singh sangtani` and the exact Unacademy
  NEET / Physics / NEET context links;
- target faculty links are exactly `436:anoop-vashishtha:1`,
  `437:anoop-vashishtha:1`, and `438:indrajeet-singh-sangtani:1`;
- courses 436-438 remain `pending / pending`, and target quality reviews remain
  `0`; and
- protected JEE remains exactly `82 / 1,304 /
  30eee4a4a6842e5beeb7c97083d7f812`.

## Additive scope

The transaction creates one verified normalized teacher, two reviewed aliases,
three context links, and three course-teacher links:

- course 436 -> existing verified `anoop-vashishtha` (teacher 36);
- course 437 -> existing verified `anoop-vashishtha` (teacher 36); and
- course 438 -> new verified `indrajeet-singh-sangtani`, with aliases
  `Indrajeet Singh Sangtani` and the source label `Indrajeet Sir`, primary
  Unacademy NEET institute, Physics subject, and NEET learning goal.

Expected deltas are teachers `34 -> 35`, aliases `54 -> 56`, teacher-institute
links `35 -> 36`, teacher-subject links `35 -> 36`, teacher-goal links
`34 -> 35`, and course-teacher links `171 -> 174`. Catalogue content and the 42
quality reviews must remain unchanged.

## Exact guards

The artifact aborts and rolls back unless production remains exactly:

- 419 playlists / 4,740 videos / 4,746 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 54 aliases / 35 institute links / 35
  subject links / 34 goal links / 171 course-teacher links / 42 quality reviews;
- courses 436-438 with the exact reviewed titles, source IDs, nine ordered video
  IDs, target chapters, class scopes, and NEET-only goal;
- existing verified Anoop Vashishtha identity and context;
- no existing Indrajeet identity/aliases, target faculty links, or target
  quality reviews; and
- protected JEE exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`.

The SQL is insert-only and atomic. It does not update course review state.
Quality review remains a separate later gate.
