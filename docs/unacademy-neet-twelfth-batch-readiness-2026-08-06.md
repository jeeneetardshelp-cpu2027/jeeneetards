# Unacademy NEET twelfth-batch readiness — 6 August 2026

## Status and safety boundary

Prepared and locally reviewable only. No production write, schema migration,
restore, clone, deployment, or `release` push was performed. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue, source-ID, retained-video-ID, taxonomy, class-scope, and
verified-teacher evidence.

The proposed owner decision is `227d1fa5-a7b9-4af2-b6b7-305e90edb412`.
Production execution remains a separate gate and must be create-only after a
fresh PITR check, quiet-window baseline, source refresh, anonymous dry-run, and
protected-JEE verification.

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
  SHA-256 `93a6c17283ab501ff9bf2053cc413b2d44858b2de4e4cd80144fc0cd8f935c83`;
- reviewed manifest:
  `docs/manifests/unacademy-neet-atomic-structure-class-11-reviewed.json`,
  SHA-256 `3feeeb716a3b0d20c1b8547e14071be1e870d0418ece217ca388479801b4dc31`;
- source snapshot SHA-256:
  `3fd093312496690ded29287715a040c4d83886bc9e8fce9b2e99e7a73e6a3d56`.

## Deferred candidates

- Coordination Compounds still lacks Lecture 11.
- Locomotion and Movement and Biological Classification each begin with an
  unrelated Phoenix 2.0 row and then start at Lecture 2.
- Breathing and Gas Exchange, Biomolecules, Respiration in Plants, Ionic
  Equilibrium, Human Reproduction, Neural Control and Coordination, and Animal
  Kingdom remain incomplete.

## Local validation

- focused readiness validation: 1 file / 8 tests passed;
- full regression: 207 files / 1,799 tests passed;
- ESLint passed with zero warnings;
- production build passed (397 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- `git diff --check` passed.

Projected additive delta if separately approved: +1 playlist / +14 videos /
+14 memberships / +0 chapters, with zero reuse. The import must stop on any
source mutation, source/video reuse, dry-run finding, catalogue drift,
teacher/taxonomy mismatch, or protected-JEE mismatch. Faculty linking and
quality review remain separately hash-gated after content verification.

## Proposed approval record

`Approve the reviewed Unacademy NEET twelfth batch — Atomic Structure — with
Anoop Vashishtha attribution under decision
227d1fa5-a7b9-4af2-b6b7-305e90edb412. Import create-only after a fresh PITR and
quiet-window baseline check plus anonymous dry-run, and verify the protected
original-82 JEE fingerprint afterward. Exclude all 10 chapter quizzes and 4
broad Physical Chemistry mega-quizzes. Stop on source mutation, reuse, drift,
or any blocker; no release push.`
