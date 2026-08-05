# Unacademy NEET ninth-batch faculty-link readiness - 5 August 2026

## Status

Prepared and locally validated only. This package has **not** been applied to
production. Applying it requires separate owner approval of the exact SHA-256,
a fresh PITR check, and a fresh exact-baseline preflight. No content import,
quality-review transition, migration, clone, restore, or `release` push is in
scope.

## Reviewed scope

The package normalizes the playlist-specific teacher evidence already approved
under decision `b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6`:

- course 408, Sexual Reproduction in Flowering Plants -> Pradeep Singh
  (`teacher id 33`);
- course 409, Alternating Current -> Mahendra Singh (`teacher id 34`);
- course 410, Chemical Kinetics -> Anoop Vashishtha (`teacher id 36`).

All three verified teacher identities and their exact Unacademy NEET, subject,
and NEET learning-goal context already exist. The package inserts only the
three missing `playlist_teachers` rows. It does not create or alter teachers,
aliases, courses, videos, chapters, memberships, or review statuses.

## Fresh read-only production snapshot

Refreshed 5 August 2026 after the first approved artifact stopped on its exact
chapter-count guard. The only drift was the separately reviewed and applied
NCERT Class 10 Science materials package from commit `b6bac61`, which created
the 13 expected Science reference chapters (IDs 308-320). No Unacademy faculty
row was written by the stopped attempt.

Current production baseline:

- catalogue: 391 playlists / 4,566 videos / 4,572 memberships / 260 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 143 course links;
- quality reviews: 14;
- course lesson counts: 12 / 6 / 9 for courses 408-410;
- all three retain their exact source IDs, channel 147, subject, class-12, NEET
  goal, and `pending` / `pending` review state;
- teachers 33, 34, and 36 are verified with the exact expected context links;
- none of courses 408-410 has a normalized faculty link or quality review;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch. The protected JEE boundary was freshly rechecked after the NCERT
addition and remains an exact match.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_ninth_batch_faculty_links_2026-08-05.sql`;
- SHA-256: `fdfa5ccd18f05b72b93a270d99d28391d1dd5ba725907ec49d41127042aabfcc`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected delta: +3 `playlist_teachers` rows only;
- expected postflight: 146 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only, verifies the production marker, exact catalogue and
registry counts, all three course/source/class/goal records, teacher context,
absence of prior faculty links and reviews, and the protected JEE fingerprint.
After inserting one instructor at position 1 per course, it checks the exact
three links, unchanged review state, and protected boundary before commit.

## Local validation

- production-shaped PGlite rehearsal: transaction executed and added exactly
  three links, reaching 146 course links with all other guarded counts fixed;
- focused package checks: 5 passed;
- full regression suite: 179 files / 1,664 tests passed;
- ESLint: passed with zero warnings;
- production build: passed (391 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- production dependency audit: zero vulnerabilities;
- independent protected-JEE verification passed before preparation;
- no production SQL, clone, restore, or `release` push occurred.

## Required production approval

`Approve applying Unacademy NEET ninth-batch faculty-link artifact SHA-256
fdfa5ccd18f05b72b93a270d99d28391d1dd5ba725907ec49d41127042aabfcc to
production, after a fresh PITR and exact-baseline check; stop on any mismatch;
no release push.`
