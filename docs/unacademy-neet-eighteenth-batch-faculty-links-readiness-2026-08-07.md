# Unacademy NEET eighteenth-batch faculty-link readiness — 7 August 2026

## Status

Prepared and locally rehearsed only. Production has not been changed by this
package. A separate owner approval naming the exact SHA-256 below is required
before the SQL may run. No `release` push is part of this gate.

## Reviewed scope

The package binds the playlist-specific teacher evidence already approved under
decision `8f19ac66-a1b4-4304-8a6f-468131f63732`:

- course 430, Photosynthesis → Pradeep Singh (`teacher id 33`);
- course 431, Ionic Equilibrium → Ashwani Tyagi (`teacher id 32`);
- course 432, Excretory Products and Their Elimination → Dr. Sachin Kapur
  (`teacher id 38`).

All three verified identities and their exact Unacademy NEET, subject, and NEET
learning-goal contexts already exist. The package inserts only the three missing
`playlist_teachers` rows. It does not create or alter teachers, aliases, courses,
videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Service-role read-only evidence was captured at `2026-08-07T10:26:50.265Z`:

- catalogue: 413 playlists / 4,723 videos / 4,729 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 34 teachers / 54 aliases / 35 institute links / 35 subject
  links / 34 learning-goal links / 165 course links;
- quality reviews: 36;
- course 430 has three lessons in positions 1–3, all in Photosynthesis chapter
  119, with the exact reviewed YouTube source order;
- course 431 has eight lessons in positions 1–8, all in Ionic Equilibrium
  chapter 38, with the exact reviewed YouTube source order;
- course 432 has seven lessons in positions 1–7, all in Excretory Products and
  Their Elimination chapter 111, with the exact reviewed YouTube source order;
- each course retains channel 147, the expected subject, class-11 scope, NEET
  goal, and `pending` / `pending` review state;
- teachers 32, 33, and 38 are verified and retain the expected primary
  Unacademy NEET institute, subject, and NEET learning-goal links;
- courses 430–432 have no normalized faculty link and no quality review;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_eighteenth_batch_faculty_links_2026-08-07.sql`;
- SHA-256: `19ca7904e2816364992a5be9c3a67ec88e2f241048ede9d95a4f230b00d96355`;
- intended target: production project `kezelafqhgqrprpadmlf`;
- expected delta: +3 `playlist_teachers` rows only, from 165 to 168;
- expected protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, all three course/source/video/
chapter/class/goal records, verified teacher contexts, absence of prior faculty
links and reviews, and the protected JEE fingerprint. It then verifies the exact
three new instructor links and every unchanged boundary before commit.

## Validation

- production-shaped PGlite rehearsal passed, inserting exactly three links and
  reaching 168 course links with every other guarded count unchanged;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left all three course links absent;
- focused package checks: 4 passed;
- full regression: 278 files / 2,119 tests passed with `--maxWorkers=4`;
- ESLint passed with zero warnings;
- production build passed; the missing Supabase environment in the isolated
  worktree preserved the last known complete sitemap as designed;
- GitHub Actions CI passed for preparation commit
  `d3a84a37ff202c858b6fc5655ab5b0dc8bb7d7b8`
  ([run 31171230556](https://github.com/jeeneetardshelp-cpu2027/jeeneetards/actions/runs/31171230556));
- no production SQL or `release` push occurred during preparation.

## Required next approval

After the final SQL hash and validation evidence are pinned here, production
application remains blocked until the owner separately approves that exact
SHA-256 with a fresh PITR and exact-baseline check.
