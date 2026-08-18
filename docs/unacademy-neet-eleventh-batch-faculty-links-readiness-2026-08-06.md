# Unacademy NEET eleventh-batch faculty-link readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL, content import, quality
review, schema migration, clone, restore, deployment, or `release` push was run.
Production application requires separate owner approval of the exact SHA-256.

## Reviewed scope

The package normalizes the playlist-specific teacher evidence already approved
under decision `d8125eb3-7281-43da-bfd4-61acd655121f`:

- course 414, Chemical Equilibrium -> Anoop Vashishtha (`teacher id 36`);
- course 415, Surface Chemistry -> Anoop Vashishtha (`teacher id 36`);
- course 416, P-Block Elements -> Anoop Vashishtha (`teacher id 36`).

The verified Anoop Vashishtha identity and exact Unacademy NEET, Chemistry, and
NEET learning-goal context already exist. The package inserts only the three
missing `playlist_teachers` rows. It does not create or alter teachers, aliases,
courses, videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Captured at `2026-08-05T19:56:55.890508+00:00`:

- catalogue: 397 playlists / 4,603 videos / 4,609 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 149 course links;
- quality reviews: 20;
- course lesson counts: 10 / 5 / 10 for courses 414-416, all bound exactly to
  chapters 30 / 32 / 93;
- all three retain their exact source IDs, channel 147, Chemistry subject,
  reviewed class, NEET goal, and `pending` / `pending` review state;
- teacher 36 is verified with the expected primary Unacademy NEET institute,
  Chemistry subject, and NEET learning-goal links;
- none of courses 414-416 has a normalized faculty link or quality review;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_eleventh_batch_faculty_links_2026-08-06.sql`;
- SHA-256: `447db5e38228b02d37c5a41e7e1a7304a86e4a73e9534b36d5464cc50ce550e2`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected delta: +3 `playlist_teachers` rows only;
- expected postflight: 152 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, all three course/source/chapter/
class/goal records, verified teacher context, absence of prior faculty links and
reviews, and the protected JEE fingerprint. It then verifies the exact three
new instructor links and every unchanged boundary before commit.

## Local validation

- production-shaped PGlite rehearsal passed and added exactly three links,
  reaching 152 course links with every other guarded count fixed;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left all three target links absent;
- focused package checks: 4 passed;
- full regression: 199 files / 1,753 tests passed;
- ESLint passed with zero warnings;
- production build passed (397 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply this exact artifact only after a fresh PITR check, exact-baseline
preflight, and separate owner approval matching its SHA-256. Stop on any
mismatch. Quality review remains a later, separate gate.
