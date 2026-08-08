# Unacademy NEET twentieth-batch faculty-link readiness - 8 August 2026

## Status

**REVISED PREPARED ONLY - NEW HASH APPROVAL REQUIRED.** The first approved
artifact was attempted once, failed closed before its first insert, and rolled
back. Production remains unchanged. No quality-review transition, deployment,
or `release` push occurred.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twentieth_batch_faculty_links_2026-08-08.sql`
- SHA-256: `9ae58b0c2ebdb0cd276dfe36cf45e2daae67c7ac409ea4ec0c8857182f543852`
- Evidence decision: `8de024c6-7317-4901-a91e-5006a5efcd7e`

Proposed approval wording:

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
