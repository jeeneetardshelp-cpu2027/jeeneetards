# Unacademy NEET seventeenth-batch faculty-link readiness — 7 August 2026

## Status

Prepared and locally rehearsed only. No production SQL, content import, quality
review, schema migration, clone, restore, deployment, or `release` push was run.
Production application requires separate owner approval of the exact SHA-256.

## Reviewed scope

The package normalizes the playlist-specific teacher evidence already approved
under decision `ae4a8549-84d5-4784-91ed-2f56e4208d88`:

- course 429, Breathing and Exchange of Gases → Dr. Sachin Kapur (`teacher id 38`).

The verified Dr. Sachin Kapur identity and exact Unacademy NEET, Biology, and
NEET learning-goal context already exist. The package inserts only the missing
`playlist_teachers` row. It does not create or alter teachers, aliases, courses,
videos, chapters, memberships, taxonomy, or review statuses.

## Fresh read-only production snapshot

Service-role read-only evidence was captured at `2026-08-07T07:24:49.535Z`:

- catalogue: 410 playlists / 4,705 videos / 4,711 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 34 teachers / 54 aliases / 35 institute links / 35 subject
  links / 34 learning-goal links / 164 course links;
- quality reviews: 35;
- course 429 has six lessons in exact positions 1–6, all bound to Breathing and
  Exchange of Gases chapter 105;
- course 429 retains source `PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe`, channel 147,
  Biology subject, class-11 scope, NEET goal, and `pending` / `pending` review
  state;
- teacher 38 is verified with the expected primary Unacademy NEET institute,
  Biology subject, and NEET learning-goal links;
- course 429 has no normalized faculty link and no quality review;
- protected JEE remains 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction pins every value above and aborts before inserting anything on
any mismatch.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_seventeenth_batch_faculty_link_2026-08-07.sql`;
- SHA-256: `ce929bae2520cdc379acef0d25dffa2199e285fa14ad233968783abd1533d895`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected delta: +1 `playlist_teachers` row only;
- expected postflight: 165 course links, with every other catalogue, faculty,
  and quality-review count unchanged;
- expected protected-JEE delta: zero.

The SQL is insert-only and runs as one transaction. It verifies the production
marker, exact catalogue and registry counts, course/source/video/chapter/class/
goal records, verified teacher context, absence of a prior faculty link and
review, and the protected JEE fingerprint. It then verifies the exact new
instructor link and every unchanged boundary before commit.

## Local validation

- production-shaped PGlite rehearsal passed and added exactly one link,
  reaching 165 course links with every other guarded count fixed;
- rollback-on-drift rehearsal passed: an extra chapter rejected the transaction
  and left the course 429 link absent;
- focused package checks: 4 passed;
- full regression: 273 files / 2,093 tests passed;
- ESLint passed with zero warnings;
- production build passed; the missing Supabase environment in the isolated
  worktree preserved the last known complete sitemap as designed;
- frontend release safeguards passed using the primary workspace's ignored
  public browser values as process-scoped inputs; no secrets were copied;
- production dependency audit reported zero vulnerabilities;
- CI: pending;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply this exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Quality
review remains a later, separate gate.
