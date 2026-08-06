# Unacademy NEET twelfth-batch quality-review readiness — 6 August 2026

## Status

Prepared and locally rehearsed only. No production SQL or `release` push was run.
Production application requires separate owner approval of the exact SHA-256.
The completed content import and faculty-link transaction are not rerun.

## Reviewed scope

The artifact applies the canonical content-quality transition to course `417`
under owner evidence decision `227d1fa5-a7b9-4af2-b6b7-305e90edb412`:

- preserve the verbatim YouTube playlist title in `source_title`;
- set the concise display title to `Atomic Structure`;
- retain Anoop Vashishtha as the sole ordered instructor (`teacher id 36`);
- approve the title and identify the faculty credit;
- retain `full-course`, `hinglish`, and `intermediate` metadata;
- create exactly one immutable `playlist_quality_reviews` audit row.

No course, video, membership, chapter, teacher, taxonomy, or faculty-link row is
created or deleted. The only direct table update captures the previously-null
source title; the canonical `review_playlist_quality` RPC performs the reviewed
status transition and audit write.

## Exact production baseline

The independent post-faculty verification at `2026-08-06T06:19:43.302351Z`
confirmed:

- catalogue: 398 playlists / 4,617 videos / 4,623 memberships / 263 chapters;
- chapter-class scopes: 92;
- faculty registry: 32 teachers / 50 aliases / 33 institute links / 33 subject
  links / 32 learning-goal links / 153 course links;
- quality reviews: 23;
- course 417 has the exact 14 Atomic Structure lessons, source ID, NEET goal,
  class-11 scope, Chemistry subject, and pending title/faculty statuses;
- course 417 has exactly one normalized instructor link to verified teacher 36
  and no existing quality review;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

The transaction refuses any changed count, course field, teacher link, source,
taxonomy reference, capability, audit state, or protected-JEE boundary.

## Immutable prepared artifact

- SQL: `docs/sql/unacademy_neet_twelfth_batch_quality_review_2026-08-06.sql`;
- SHA-256: `9a09e5b41d9267cbeb56fc2fe7b3c6f894c4b3a529e715f0099c7525e4322689`;
- target after separate approval: production project `kezelafqhgqrprpadmlf`;
- expected quality-review delta: 23 → 24;
- expected catalogue, faculty-link, and protected-JEE delta: zero.

Postflight verifies the concise title, preserved source title, approved and
identified statuses, exact teacher order, empty missing-fields result, and the
immutable before/after audit row before commit.

## Local validation

- production-shaped PGlite rehearsal: passed;
- rollback-on-drift rehearsal: passed;
- focused package checks: 1 file / 5 tests passed;
- full regression: 213 files / 1,827 tests passed;
- lint: passed with zero warnings;
- production build and frontend-release verification: passed;
- production dependency audit: 0 vulnerabilities;
- `git diff --check`: passed;
- no production SQL or `release` push occurred during preparation.

## Next gate

Apply the exact artifact only after a fresh PITR check, exact-baseline preflight,
and separate owner approval matching its SHA-256. Stop on any mismatch. Do not
rerun the completed faculty-link artifact, and do not push `release`.
