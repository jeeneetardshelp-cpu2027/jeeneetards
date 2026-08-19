# Unacademy NEET twelfth-batch readiness — 6 August 2026

## Status and safety boundary

Production import completed under owner decision
`227d1fa5-a7b9-4af2-b6b7-305e90edb412`. No schema migration, restore, clone,
deployment, or `release` push was performed. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue, source-ID, retained-video-ID, taxonomy, class-scope, and
verified-teacher evidence.

The course was imported create-only after a fresh signed-in PITR check,
quiet-window baseline, exact source refresh, anonymous dry-run, and protected
JEE verification. Faculty linking and quality review remain separate gates.

## Fresh read-only evidence

Captured at `2026-08-06T04:16:06.372Z` after the eleventh-batch quality gate:

- catalogue: 397 playlists / 4,603 videos / 4,609 memberships / 263 chapters;
- taxonomy: 92 chapter-class rows;
- faculty registry: 32 teachers;
- proposed source-playlist collisions: 0;
- all 14 retained production-video collisions: 0;
- canonical target: Chemistry (`id 2`) / Atomic Structure (`id 37`) /
  class-11 (`id 2`);
- verified teacher: Anoop Vashishtha (`id 36`, slug
  `anoop-vashishtha`);
- official institute/channel: Unacademy NEET (`id 147`);
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

## Reviewed lecture-only course

The official 28-row playlist contains two clean sections:

- source positions 1–14 are the uninterrupted Atomic Structure L1–L14 lecture
  sequence;
- positions 15–24 are Menti quizzes, and positions 25–28 are broad Physical
  Chemistry mega-quizzes. All 14 are explicitly excluded from the course.

Every retained lecture is embeddable, has a known positive duration, and names
`Anoop Sir`; the official playlist title names Anoop Vashishtha. The retained
course preserves the official L1–L14 order and maps every lesson to existing
chapter 37. No chapter or teacher creation is needed.

Immutable evidence package:

- candidate review:
  `docs/reviews/unacademy-neet-twelfth-candidate-batch-2026-08-06.json`,
  SHA-256 `dd7767eb6192b541e943c58d41e6669a774d1841134325d5ab32ad25a13ee36e`;
- reviewed manifest:
  `docs/manifests/unacademy-neet-atomic-structure-class-11-reviewed.json`,
  SHA-256 `3feeeb716a3b0d20c1b8547e14071be1e870d0418ece217ca388479801b4dc31`;
- source snapshot SHA-256:
  `3fd093312496690ded29287715a040c4d83886bc9e8fce9b2e99e7a73e6a3d56`.

## Guarded production execution

At `2026-08-06T04:42:09.771Z`, the official source still contained the exact
reviewed 28 rows and matched source snapshot SHA-256
`3fd093312496690ded29287715a040c4d83886bc9e8fce9b2e99e7a73e6a3d56`.
The anonymous production baseline was exactly 397 playlists / 4,603 videos /
4,609 memberships / 263 chapters / 92 chapter-class rows / 32 teachers, with
zero source or retained-video collisions.

The signed-in production dashboard showed active seven-day PITR, with restore
coverage from `2026-07-31 00:02:22` through `2026-08-06 09:58:42` IST. The
anonymous mapped dry-run passed with 1 ok / 0 review / 0 blocked, 14 assignments,
and the 14 reviewed quiz/mega-quiz exclusions. The final guarded preflight at
`2026-08-06T04:43:06.466Z` matched the same quiet-window baseline and both JEE
boundaries before the create-only write.

## Final production verification

- course `417` was created with 14 new videos / 14 memberships / zero reuse /
  zero new chapters;
- final catalogue: 398 playlists / 4,617 videos / 4,623 memberships / 263 chapters;
- all lessons preserve official positions 1–14 and map only to Atomic Structure
  (`chapter 37`), Chemistry, class-11, and the `neet` learning goal;
- Anoop Vashishtha attribution uses the existing verified teacher `36` and
  Unacademy NEET institute/channel `147`;
- protected JEE remained exactly 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE remained 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`;
- the public course page lists all 14 lessons, and the first lesson loads in the
  privacy-enhanced YouTube player without an embedding error.

This reviewed single-chapter import uses the legacy `import_playlist` RPC. That
path does not write `playlist_import_audit` rows or support request replay. The
client-side guard refused existing source IDs and unexpected reuse, while the
fresh quiet-window gates and exact postflight retained the create-only evidence.

## Deferred candidates

- Coordination Compounds still lacks Lecture 11.
- Locomotion and Movement and Biological Classification each begin with an
  unrelated Phoenix 2.0 row and then start at Lecture 2.
- Breathing and Gas Exchange, Biomolecules, Respiration in Plants, Ionic
  Equilibrium, Human Reproduction, Neural Control and Coordination, and Animal
  Kingdom remain incomplete.

## Local validation

- focused readiness validation: 1 file / 9 tests passed;
- full regression: 209 files / 1,808 tests passed;
- ESLint passed with zero warnings;
- production build passed (398 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- `git diff --check` passed.

The completed additive delta is +1 playlist / +14 videos / +14 memberships /
+0 chapters, with zero reuse. Faculty linking and quality review remain
separately hash-gated after content verification.

## Proposed approval record

`Approve the reviewed Unacademy NEET twelfth batch — Atomic Structure — with
Anoop Vashishtha attribution under decision
227d1fa5-a7b9-4af2-b6b7-305e90edb412. Import create-only after a fresh PITR and
quiet-window baseline check plus anonymous dry-run, and verify the protected
original-82 JEE fingerprint afterward. Exclude all 10 chapter quizzes and 4
broad Physical Chemistry mega-quizzes. Stop on source mutation, reuse, drift,
or any blocker; no release push.`
