# Unacademy NEET nineteenth-batch faculty-link readiness - 7 August 2026

## Status

**PREPARED ONLY, NOT APPLIED.** Production remains unchanged. This package is
waiting for separate owner approval naming the exact SHA-256 below. No content
import, quality review, schema migration, clone, restore, deployment, or
`release` push occurred.

## Reviewed scope

The package binds the exact playlist-specific teacher evidence already approved
under decision `e6539ac8-512b-4e76-8bd1-774c1a3c4bdc`:

- course 433, D and F Block Elements -> Anoop Vashishtha (`teacher id 36`);
- course 434, Amines -> Anoop Vashishtha (`teacher id 36`);
- course 435, Thermochemistry -> Ashwani Tyagi (`teacher id 32`).

Both verified identities and their exact Unacademy NEET, Chemistry, and NEET
learning-goal contexts already exist. The package inserts only the three missing
`playlist_teachers` rows. It does not create or alter teachers, aliases, courses,
videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Evidence captured at `2026-08-07T14:02:53.787684Z`:

- catalogue: 416 playlists / 4,731 videos / 4,737 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 34 teachers / 54 aliases / 35 institute links / 35 subject
  links / 34 learning-goal links / 168 course links;
- quality reviews: 39;
- course 433 has two lessons in positions 1-2, both in The d and f Block
  Elements chapter 45, with the exact reviewed YouTube source order;
- course 434 has three lessons in positions 1-3, all in Amines chapter 48, with
  the exact reviewed YouTube source order;
- course 435 has three lessons in positions 1-3, all in Thermochemistry chapter
  29, with the exact reviewed YouTube source order;
- each course retains channel 147, Chemistry, the reviewed class scope, NEET
  goal, and `pending` / `pending` review state;
- teachers 32 and 36 are verified and retain the expected primary Unacademy
  NEET institute, Chemistry subject, and NEET learning-goal links;
- courses 433-435 have no normalized faculty link and no quality review;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

PITR was checked read-only immediately before the snapshot. Seven-day retention
was active, with restore availability from `01 Aug 2026, 00:02:34 IST` through
`07 Aug 2026, 19:11:58 IST`. A fresh PITR and exact-baseline check are still
required immediately before any separately approved production execution.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_nineteenth_batch_faculty_links_2026-08-07.sql`;
- SHA-256: `97d5d23937bb7b979aa989aa94e0cf9b3f661b0782a5f168b1a5fc40101825c1`;
- intended target: production project `kezelafqhgqrprpadmlf`;
- intended delta: +3 `playlist_teachers` rows only, from 168 to 171;
- required protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, all three course/source/video/
chapter/class/goal records, both verified teacher contexts, absence of prior
faculty links and reviews, and the protected JEE fingerprint. It then verifies
the exact three new instructor links and every unchanged boundary before commit.

## Validation

- production-shaped PGlite rehearsal passed, inserting exactly three links and
  reaching 171 course links with every other guarded count unchanged;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left all three target course links absent;
- focused package checks: 4 passed;
- full regression on the rebased current `main`: 286 files / 2,163 tests
  passed with `--maxWorkers=4`;
- ESLint passed with zero warnings;
- no production SQL or `release` push occurred during preparation.

## Required approval wording

`Approve applying Unacademy NEET nineteenth-batch faculty-link artifact SHA-256
97d5d23937bb7b979aa989aa94e0cf9b3f661b0782a5f168b1a5fc40101825c1 to
production, after a fresh PITR and exact-baseline check; stop on any mismatch;
no release push.`

## Next gate

Stop here. Do not run this SQL without the exact-hash approval above. Quality
review remains a later, separately prepared and hash-approved production gate.
