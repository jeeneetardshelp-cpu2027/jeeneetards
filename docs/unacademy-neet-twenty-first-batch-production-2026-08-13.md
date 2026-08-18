# Unacademy NEET twenty-first-batch production import - 13 August 2026

## Outcome

Owner decision `9443dd70-a2c6-4747-9a5e-a9022f7012cf` was executed against
production project `kezelafqhgqrprpadmlf`. The two approved courses were
imported create-only, one at a time. No chapter, normalized faculty,
quality-review, schema, deployment, or `release` change was made.

## Recovery and initial baseline

- Signed-in Supabase PITR showed changes logged every two minutes with seven-day
  retention.
- Recoverable window: `07 Aug 2026, 00:01:22` through
  `13 Aug 2026, 00:09:37` IST.
- Recorded rollback target: `13 Aug 2026, 00:09:37` IST.
- Fresh initial catalogue: 419 playlists / 4,740 videos / 4,746 memberships /
  263 chapters / 92 chapter-class rows.
- Both source-playlist collisions and all six retained-video collisions were
  empty.
- Protected original JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.
- Rolling JEE: 212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`.

## Course 1 - Kinetic Theory of Gases

- Source: `PLsgHooHkqhhMZ0ocHynO-84oB0VVcuyoG`.
- Fresh source SHA-256:
  `cc773d0df0234f01c034a7d18ada457435b00c735a0967108c539b4efebd9056`.
- Fresh anonymous dry-run: 2 published / 2 usable, 1 ok / 0 review /
  0 blocked, source absent, zero retained-video collisions, v12 available.
- Result: course 439, +1 playlist / +2 videos / +2 memberships / +0 chapters,
  zero reuse.
- Scope: NEET only, Physics, Class 11, teacher `Shubham Kumar`.
- Both lessons preserve source order and resolve to existing chapter 275,
  `Kinetic Theory of Gases`.
- Post-import catalogue: 420 / 4,742 / 4,748 / 263.
- Protected and rolling JEE fingerprints remained exact.

## Course 2 - Electromagnetic Waves

- Source: `PLsgHooHkqhhPkYyUO_zMJpEQZ5MST56fK`.
- Fresh post-course-1 baseline: 420 playlists / 4,742 videos / 4,748
  memberships / 263 chapters / 92 chapter-class rows.
- Fresh source SHA-256:
  `d046ae1cd01328f9e33537660e4d714e2b045dc2cd0aaffa699ad2e6faec3367`.
- Fresh anonymous dry-run: 4 published / 4 usable, 1 ok / 0 review /
  0 blocked, source absent, zero retained-video collisions, v12 available.
- Result: course 440, +1 playlist / +4 videos / +4 memberships / +0 chapters,
  zero reuse.
- Scope: NEET only, Physics, Class 12, teacher `Samip Velani`.
- All four lessons preserve source order and resolve to existing chapter 15,
  `Electromagnetic Waves`.

## Final postflight

- Final catalogue: **421 playlists / 4,746 videos / 4,752 memberships /
  263 chapters / 92 chapter-class rows**.
- Batch delta: **+2 playlists / +6 videos / +6 memberships / +0 chapters**.
- All six new video IDs have exactly one membership, in the corresponding new
  course; no video was reused.
- NEET catalogue count: 267 courses. Both new courses carry only the `neet`
  learning goal and their reviewed class scope.
- Protected original JEE remained **82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`** after each write.
- Rolling JEE remained **212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`**.
- Normalized faculty links and quality-review transitions remain separate,
  unexecuted gates. No `release` push occurred.
