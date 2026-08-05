# Unacademy NEET tenth-batch faculty-link readiness - 5 August 2026

## Status

Prepared and locally rehearsed only. No production SQL, content import, quality
review, schema migration, clone, restore, deployment, or `release` push was run.
Production application requires separate owner approval of the exact SHA-256.

## Reviewed scope

The package normalizes the playlist-specific teacher evidence already approved
under decision `0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1`:

- course 411, Thermal Properties of Matter -> Mahendra Singh (`teacher id 34`);
- course 412, Electromagnetic Induction -> Anu Gupta (`teacher id 35`);
- course 413, Plant Growth and Development -> Pradeep Singh (`teacher id 33`).

The verified teacher identities and their exact Unacademy NEET, subject, and
NEET learning-goal context already exist. The package inserts only the three
missing `playlist_teachers` rows. It does not create or alter teachers, aliases,
courses, videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Captured at `2026-08-05T13:48:37.105015+00:00`:

- catalogue: 394 playlists / 4,578 videos / 4,584 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 146 course links;
- quality reviews: 17;
- course lesson counts: 4 / 3 / 5 for courses 411-413, all bound exactly to
  chapters 25 / 13 / 120;
- all three retain their exact source IDs, channel 147, subject, class, NEET
  goal, and `pending` / `pending` review state;
- teachers 33, 34, and 35 are verified with the expected primary institute,
  subject, and NEET context links;
- none of courses 411-413 has a normalized faculty link or quality review;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_tenth_batch_faculty_links_2026-08-05.sql`;
- SHA-256: `e2b74d1abc1cccadecc95d8bf1ccfc94b8d18b8db7e7c5ae4cd8d2ce16831577`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected delta: +3 `playlist_teachers` rows only;
- expected postflight: 149 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, all three course/source/chapter/
class/goal records, verified teacher context, absence of prior faculty links and
reviews, and the protected JEE fingerprint. It then verifies the exact three
new instructor links and every unchanged boundary before commit.

## Local validation

- production-shaped PGlite rehearsal passed and added exactly three links,
  reaching 149 course links with all other guarded counts fixed;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left all three target links absent;
- focused package checks: 4 passed;
- full regression: 192 files / 1,719 tests passed;
- ESLint passed with zero warnings;
- production build passed (394 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply this exact artifact only after a fresh PITR check, exact-baseline
preflight, and separate owner approval matching its SHA-256. Stop on any
mismatch. Quality review remains a later, separate gate.
