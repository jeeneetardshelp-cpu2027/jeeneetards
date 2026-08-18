# Unacademy NEET ninth-batch faculty-link readiness - 5 August 2026

## Status

Applied successfully to production once under the owner's exact-hash approval.
The guarded transaction passed its internal postflight and added exactly the
three approved faculty links. No content import, quality-review transition,
migration, clone, restore, or `release` push was in scope. The artifact must not
be rerun.

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

## Immutable applied artifact

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
- no production SQL, clone, restore, or `release` push occurred during package
  preparation and rehearsal.

## Production application evidence

- owner approval matched the immutable SHA-256 above;
- fresh PITR verification showed seven-day retention active, with the latest
  restore point available at `2026-08-05 16:31:33 +05:30` before the write;
- fresh preflight passed at 391 playlists / 4,566 videos / 4,572 memberships /
  260 chapters / 92 chapter-class scopes / 32 teachers / 143 course links / 14
  quality reviews;
- the single transaction added exactly courses 408 -> teacher 33, 409 ->
  teacher 34, and 410 -> teacher 36, reaching 146 course links;
- its internal postflight completed before commit with every exact guard and
  the protected JEE fingerprint unchanged;
- the immediate independent read-only postflight found one unrelated concurrent
  additive chapter (`321`, `Linear Programming`, Mathematics), so the live
  chapter count had become 261; this faculty-link artifact cannot create or
  modify chapters, and every other guarded count and target row matched;
- production writes were stopped on that mismatch; no rollback or second run
  was attempted;
- the later quiet read-only baseline remained 391 / 4,566 / 4,572 / 261, with
  146 faculty links, 14 quality reviews, all three exact target links, and
  protected JEE still `30eee4a4a6842e5beeb7c97083d7f812`;
- no `release` push was made, and the applied artifact must not be rerun.

## Next gate

Quality review remains separate. It requires its own freshly guarded artifact,
immutable SHA-256, owner approval, PITR check, and exact-baseline preflight.
