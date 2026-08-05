# Unacademy NEET eleventh-batch readiness — 6 August 2026

## Status and safety boundary

Prepared and locally reviewable only. No production write, schema migration,
restore, clone, deployment, or `release` push was performed. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue, source-ID, video-ID, taxonomy, class-scope, and verified-teacher
evidence.

The proposed owner decision is `d8125eb3-7281-43da-bfd4-61acd655121f`.
Production execution remains a separate gate and must be create-only, one
course at a time, after a fresh PITR, quiet-window baseline, source refresh,
anonymous dry-run, and protected-JEE verification.

## Fresh read-only evidence

Captured at `2026-08-05T19:19:47.697Z` after the tenth-batch quality gate:

- catalogue: 394 playlists / 4,578 videos / 4,584 memberships / 263 chapters;
- taxonomy: 92 chapter-class rows;
- faculty registry: 32 teachers;
- all three proposed source-playlist collisions: 0;
- all 25 retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- verified teacher: Anoop Vashishtha (`id 36`, slug `anoop-vashishtha`);
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The preceding signed-in exact postflight at
`2026-08-05T19:13:31.498174+00:00` independently confirmed the same catalogue,
taxonomy, faculty, and protected-JEE boundary. Production remained read-only
during this continuation.

## Reviewed lecture-only courses

| Order | Course | Source playlist | Chapter / class | Retained | Excluded | Attribution | Manifest SHA-256 | Source snapshot SHA-256 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | Chemical Equilibrium — Unacademy NEET | `PLsgHooHkqhhPqS8MzgJCKn9bJwGRsR3Jl` | 30 — Chemical Equilibrium / class-11 | 10 | 0 | Anoop Vashishtha (36) | `bbbf4dc07bf64c08cca9d5973e381ee4443c9187d87338318570e64fd3327b7a` | `e6feeab7ac984edcd316a4aee700dc23593c5a276d6e66f379371a1f9b0296ac` |
| 2 | Surface Chemistry — Unacademy NEET | `PLsgHooHkqhhP5Nu98FZfS--EqYQpo15KT` | 32 — Surface Chemistry / class-12 | 5 | 2 quizzes | Anoop Vashishtha (36) | `08549a06e9b0f03b2cad85ee7823bb304a4f3c1c37d42246d8cdfc4b813b863d` | `0d791b1b922a3208c8d0e899e93972026ea145a7a383bc985db3ac976c60b230` |
| 3 | P-Block Elements — Unacademy NEET | `PLsgHooHkqhhM_8IsqTEL1V6sDYskLuymO` | 93 — P-Block Elements / class-12 | 10 | 0 | Anoop Vashishtha (36) | `8953b553b5fd6799e1805ced1e197b056f208398d3be4be067de2217a5f1c606` | `1d440750d5566618c4ba4d5c63987f2df738752e1add2bdbb19cde95625b24fa` |

Every retained video is currently embeddable and has a known positive
duration. Chemical Equilibrium is an uninterrupted L1–L10 sequence. Surface
Chemistry retains L1–L5 and explicitly excludes the two Menti quizzes. P-Block
Elements is an uninterrupted L1–L10 sequence. The official playlist titles
name Anoop Vashishtha; every retained title names either Anoop Sir or Anoop
Vashishtha, matching the existing verified teacher record.

## Deferred candidates

- Coordination Compounds jumps from L10 to L12; Lecture 11 is absent.
- Atomic Structure has a complete L1–L14 lecture sequence but also 14 practice
  rows. Its larger source is held for a separate, focused review gate.
- Locomotion and Movement and Biological Classification each begin with an
  unrelated Phoenix 2.0 row and then start at Lecture 2.
- Previously recorded incomplete Breathing and Gas Exchange, Biomolecules,
  Respiration in Plants, Ionic Equilibrium, Human Reproduction, Neural Control
  and Coordination, and Animal Kingdom candidates remain deferred.

## Immutable evidence package

- candidate review:
  `docs/reviews/unacademy-neet-eleventh-candidate-batch-2026-08-06.json`,
  SHA-256 `359c962a51aaae458743bd46553446d0988aae0b1dc1fbf2e8964b95c9a1a400`;
- three manifests listed above, each preserving official source positions and
  natural lesson order;
- source-snapshot hashes cover the playlist ID, verbatim source title, retained
  video evidence, and excluded-row evidence.

## Local validation

- focused readiness validation: 1 file / 8 tests passed;
- full regression: 195 files / 1,736 tests passed;
- ESLint passed with zero warnings;
- production build passed (394 courses, 32 faculty, 48 deep Explore routes,
  and 13 static routes);
- frontend release safeguards passed;
- production dependency audit reported zero vulnerabilities;
- `git diff --check` passed.

Projected additive delta if separately approved: +3 playlists / +25 videos /
+25 memberships / +0 chapters, with zero reuse. The approved import must stop
on any source mutation, source/video reuse, dry-run finding, catalogue drift,
teacher/taxonomy mismatch, or protected-JEE mismatch. Faculty linking and
quality review remain separately hash-gated after content verification.

## Proposed approval record

`Approve the reviewed Unacademy NEET eleventh batch — Chemical Equilibrium,
Surface Chemistry, and P-Block Elements — with Anoop Vashishtha attribution
under decision d8125eb3-7281-43da-bfd4-61acd655121f. Import create-only, one at
a time, with a fresh PITR and quiet-window baseline check plus anonymous dry-run
before each, and protected original-82 JEE fingerprint verification after each.
Stop on source mutation, reuse, drift, or any blocker; no release push.`
