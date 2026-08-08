# Unacademy NEET twentieth-batch faculty-link readiness - 8 August 2026

## Status

**PREPARED ONLY - SEPARATE HASH APPROVAL REQUIRED.** No production SQL was run.
No quality-review transition, deployment, or `release` push occurred.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_twentieth_batch_faculty_links_2026-08-08.sql`
- SHA-256: `47c61d0354124e33241cd17e3e4d8cffc1c57abbcd07b716b46a050c7520200c`
- Evidence decision: `8de024c6-7317-4901-a91e-5006a5efcd7e`

Proposed approval wording:

> Approve applying Unacademy NEET twentieth-batch faculty-link artifact
> SHA-256 `47c61d0354124e33241cd17e3e4d8cffc1c57abbcd07b716b46a050c7520200c`
> to production, after a fresh PITR and exact-baseline check; stop on any
> mismatch; no release push.

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
