# Unacademy NEET eighth-batch faculty-link readiness - 5 August 2026

## Status

Prepared and locally rehearsed only. The SQL has not been applied to production
and must not be applied without a separate owner approval naming its exact
SHA-256. No content import, quality-review transition, migration, restore,
clone, or `release` push is included.

## Reviewed scope

The package normalizes the already-approved playlist-specific teacher evidence
for three existing courses created under decision
`809b153c-b5ff-48e0-a869-02faa49b0e8f`:

- course 405, Redox Reactions -> Anoop Vashishtha (`teacher id 36`);
- course 406, Cell Organelles -> Pradeep Singh (`teacher id 33`), including the
  reviewed source labels `Pradeep Sir` and `Pradeep S`;
- course 407, Molecular Basis of Inheritance -> Pradeep Singh (`teacher id 33`),
  including the reviewed source label `Pradeep Sir`.

Both verified teacher identities and their Unacademy NEET, subject, and NEET
goal links already exist. The package inserts only three missing
`playlist_teachers` rows. It does not create or alter teachers, aliases,
courses, videos, chapters, memberships, or review statuses.

## Fresh read-only production snapshot

- catalogue: 388 playlists / 4,539 videos / 4,545 memberships / 247 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 140 course links;
- quality reviews: 11;
- course lesson counts: 7 / 9 / 9 for courses 405-407;
- all three retain their exact source IDs, channel 147, subject, class, NEET
  goal, and `pending` / `pending` review state;
- teachers 33 and 36 are verified and retain their exact context links;
- none of courses 405-407 currently has a normalized faculty link or quality
  review;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Prepared artifact

- SQL: `docs/sql/unacademy_neet_eighth_batch_faculty_links_2026-08-05.sql`;
- SHA-256: `e886e190f0adaa2cc9779551de383b972b20616ab170f21fe0a16b7496964a3f`;
- target only if separately approved: production project
  `kezelafqhgqrprpadmlf`;
- expected delta: +3 `playlist_teachers` rows only;
- expected postflight: 143 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only, verifies an empty production environment marker, exact
catalogue and registry counts, all three course/source/class/goal records,
teacher context, absence of prior faculty links and quality reviews, and the
protected JEE fingerprint. It then inserts one instructor at position 1 per
course, verifies the exact three links and unchanged review state, and
re-verifies the JEE boundary before commit.

## Local validation

- production-shaped PGlite rehearsal: prepared transaction executed and added
  exactly 3 links;
- static regression checks: insert-only scope, exact baseline/postflight, and
  immutable hash pinned;
- full regression suite: 163 files / 1,597 tests passed;
- ESLint: passed with zero warnings;
- production build: passed (388 courses, 32 faculty, 48 deep Explore routes,
  and 12 static routes);
- production dependency audit: zero vulnerabilities;
- production was queried read-only only;
- no automatic production execution or `release` push occurred.

## Required approval wording

`Approve applying Unacademy NEET eighth-batch faculty-link artifact SHA-256
e886e190f0adaa2cc9779551de383b972b20616ab170f21fe0a16b7496964a3f to
production, after a fresh PITR and exact-baseline check; stop on any mismatch;
no release push.`
