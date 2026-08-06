# Unacademy NEET twelfth-batch faculty-link readiness — 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL, content import, quality
review, schema migration, clone, restore, deployment, or `release` push was run.
Production application requires separate owner approval of the exact SHA-256.

## Reviewed scope

The package normalizes the playlist-specific teacher evidence already approved
under decision `227d1fa5-a7b9-4af2-b6b7-305e90edb412`:

- course 417, Atomic Structure → Anoop Vashishtha (`teacher id 36`).

The verified Anoop Vashishtha identity and exact Unacademy NEET, Chemistry, and
NEET learning-goal context already exist. The package inserts only the missing
`playlist_teachers` row. It does not create or alter teachers, aliases, courses,
videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Anonymous production evidence was captured at `2026-08-06T05:02:21.622Z`, and
the signed-in quality-review count was independently captured at
`2026-08-06T05:03:21.725167Z`:

- catalogue: 398 playlists / 4,617 videos / 4,623 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 152 course links;
- quality reviews: 23;
- course 417 has 14 lessons, all bound exactly to Atomic Structure chapter 37;
- course 417 retains source `PLsgHooHkqhhNW5IzFI54d-RGuxgvOpfn3`, channel 147,
  Chemistry subject, class-11 scope, NEET goal, and `pending` / `pending` review
  state;
- teacher 36 is verified with the expected primary Unacademy NEET institute,
  Chemistry subject, and NEET learning-goal links;
- course 417 has no normalized faculty link and no quality review;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_twelfth_batch_faculty_link_2026-08-06.sql`;
- SHA-256: `9b2adc2441f85d11408eceb6320d8609d4eccfcfb1e64abd2e9eb6a8ecdb8922`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected delta: +1 `playlist_teachers` row only;
- expected postflight: 153 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, course/source/chapter/class/goal
records, verified teacher context, absence of a prior faculty link and review,
and the protected JEE fingerprint. It then verifies the exact new instructor
link and every unchanged boundary before commit.

## Local validation

- production-shaped PGlite rehearsal passed and added exactly one link,
  reaching 153 course links with every other guarded count fixed;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left the course 417 link absent;
- focused package checks: 4 passed;
- full regression: 210 files / 1,812 tests passed;
- ESLint passed with zero warnings;
- production build passed (398 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply this exact artifact only after a fresh PITR check, exact-baseline
preflight, and separate owner approval matching its SHA-256. Stop on any
mismatch. Quality review remains a later, separate gate.
