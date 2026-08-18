# Unacademy NEET sixth/seventh-batch faculty-link readiness — 4 August 2026

## Status

Applied successfully to production on 4 August 2026 using the separately
approved exact-hash artifact. The transaction ran after a fresh PITR check and
an exact read-only baseline match. No schema migration, clone, restore, content
import, quality-review transition, or `release` push was performed.

## Reviewed scope

The package normalizes the already-reviewed legacy teacher credits on five
existing Unacademy NEET courses:

- course 400, Hydrogen — Anoop Vashishtha (`teacher id 36`), decision
  `1d0ea7b9-8cac-4f3b-968d-82b4307f264a`;
- course 401, Modern Physics — Anu Gupta (`teacher id 35`), decision
  `1d0ea7b9-8cac-4f3b-968d-82b4307f264a`;
- course 402, Biodiversity and Conservation — Pradeep Singh (`teacher id 33`),
  decision `cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`;
- course 403, Cell Cycle and Cell Division — Pradeep Singh (`teacher id 33`),
  including the reviewed source label `Pradeep Sir`, same seventh-batch
  decision;
- course 404, Microbes in Human Welfare — Pradeep Singh (`teacher id 33`), same
  seventh-batch decision.

The three verified identities and their Unacademy NEET, subject, and NEET-goal
links already exist. The package therefore inserts only the five missing
`playlist_teachers` rows. It does not create or alter teachers, aliases,
courses, videos, chapters, memberships, or review statuses.

## Fresh read-only production snapshot

- catalogue: 385 playlists / 4,514 videos / 4,520 memberships / 247 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 135 course links;
- reviewed course lesson counts: 6 / 11 / 5 / 7 / 4 for courses 400–404;
- all five retain their exact official playlist IDs, channel 147, subject,
  class, NEET goal, and `pending` / `pending` review state;
- teacher IDs 33 / 35 / 36 are verified and retain their exact reviewed
  context links;
- none of courses 400–404 currently has a normalized faculty link;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The artifact pinned every value above and would abort before inserting anything
on any mismatch.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_sixth_seventh_batch_faculty_links_2026-08-04.sql`
- SHA-256: `895cecede28139d452181e5b92172bec41344a5062a0b84ee912c8a60fb91e53`
- target if separately approved: production project
  `kezelafqhgqrprpadmlf`;
- expected additive delta: +5 course-teacher links only;
- expected postflight: 140 course links, with every other catalogue and faculty
  count unchanged;
- expected protected-JEE delta: zero.

The transaction is insert-only, uses an exact course/teacher/context preflight,
adds one instructor at position 1 to each reviewed course, checks the exact
five-link postcondition, and re-verifies the protected JEE boundary before
committing.

## Local validation

- production-shaped PGlite rehearsal: 5/5 tests passed;
- full regression suite: 155 files / 1,562 tests passed;
- full ESLint: passed with zero warnings;
- production build: passed (385 courses, 32 faculty, 48 deep Explore routes,
  and 12 static routes);
- production dependency audit: zero vulnerabilities.

No automatic dependency fix or `release` push was run.

## Production result

- PITR was active with seven-day retention; the latest restore point immediately
  before the write was `04 Aug 2026, 18:52:29 IST`;
- the exact preflight matched 385 playlists / 4,514 videos / 4,520 memberships /
  247 chapters / 92 chapter-class scopes;
- faculty registry counts before the write were 32 teachers / 50 aliases / 33
  institute links / 33 subject links / 32 learning-goal links / 135 course
  links;
- the transaction added exactly five `playlist_teachers` links, producing 140
  total course links:
  - 400 → Anoop Vashishtha (`teacher id 36`);
  - 401 → Anu Gupta (`teacher id 35`);
  - 402 / 403 / 404 → Pradeep Singh (`teacher id 33`);
- all five links use role `instructor`, position 1;
- playlists, videos, memberships, chapters, chapter-class scopes, teachers,
  aliases, and teacher context-link counts were unchanged;
- all five courses remain `pending` / `pending`, leaving quality review for a
  separate gate;
- protected original JEE remained 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The first editor submission before the write reran the read-only preflight and
made no change. After the successful transaction, one verification attempt
reused the artifact editor; the artifact's exact preflight rejected it because
the link total was already 140, and that transaction rolled back. A fresh blank
read-only query then confirmed the postflight totals and fingerprint above.

## Approval used

`Approve applying Unacademy NEET sixth/seventh-batch faculty-link artifact SHA-256 895cecede28139d452181e5b92172bec41344a5062a0b84ee912c8a60fb91e53 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
