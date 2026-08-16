# Unacademy NEET twenty-second-batch readiness - 16 August 2026

## Status

**OWNER APPROVAL REQUIRED - NO PRODUCTION WRITE.** This preparation performed
read-only YouTube/API discovery, anonymous production queries, and anonymous
v12 dry-runs only. No Supabase write, schema migration, deployment, or
`release` push occurred.

## Proposed owner decision

Decision ID: `fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c`

Approve the reviewed Unacademy NEET twenty-second batch - Work, Energy and Power
(Mahendra Singh), Solutions (Anoop Vashishtha), and Periodic Table (Anoop
Vashishtha) - under decision
`fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c`, exactly as recorded in this readiness
document. Import create-only, one course at a time in the listed order, with a
fresh PITR and quiet-window exact-baseline check plus anonymous dry-run before
each, and protected original-82 JEE fingerprint verification after each. Stop
on source mutation, reuse, drift, or any blocker; no `release` push.

This decision would cover only the three official playlists and 22 retained
video IDs below. Faculty links and quality-review transitions remain separate
later gates.

## Read-only source and attribution evidence

The official Unacademy NEET channel refresh still exposes 736 public playlists.
All selected sources are coherent and complete for their retained lecture
scope:

- Work, Energy and Power contains Lectures 1-11 by Mahendra Singh. Two trailing
  DPP quizzes are explicitly excluded.
- Solutions contains Lectures 1-6 by Anoop Vashishtha. A Menti quiz, two paper
  discussions, and a broader Physical Chemistry mega quiz are excluded.
- Periodic Table contains five lectures by Anoop Vashishtha. The source publishes
  L5 before L4, so the manifest preserves source positions while assigning
  lesson numbers 1, 2, 3, 5, 4; the course therefore renders in natural L1-L5
  order without falsifying source provenance.

Mahendra Singh is the existing verified teacher id 34, and Anoop Vashishtha is
the existing verified teacher id 36. The proposed decision binds those exact
playlist-specific attributions without creating or changing teacher records.

All 28 source videos have positive durations and are embeddable. The three
source playlist IDs, 22 retained video IDs, and course titles have zero
production collisions.

## Production read-only preflight

The fresh anonymous snapshot at `2026-08-16T05:04:34.289Z` returned:

- 421 playlists / 4,746 videos / 4,752 memberships / 263 chapters;
- 92 chapter-class rows / 37 teachers / 176 playlist-teacher links / 47 quality
  reviews;
- chapter 21 (Work, Energy and Power) scoped to Class 11;
- chapter 33 (Solutions) scoped to Class 12;
- chapter 41 (Periodic Table) scoped to Class 11;
- source collisions: 0;
- retained-video collisions: 0;
- title collisions: 0; and
- protected original JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

This preparation did not require a PITR write-gate check. A fresh signed-in
PITR check and exact quiet-window baseline are mandatory immediately before
any separately approved import.

## Anonymous dry-run evidence

All three exact reviewed manifests passed independent anonymous production
dry-runs. Each returned **1 ok / 0 review / 0 blocked**, advertised capability
v12, resolved its chapter as `reuse`, and performed no Supabase write:

- Work, Energy and Power: 13 published / 13 usable / 11 assignments / 2
  exclusions; manifest SHA-256
  `688701da0839e53508f99156e684e218e9eca34d93b4e36feaa67caf9b0ab8cc`;
- Solutions: 10 published / 10 usable / 6 assignments / 4 exclusions;
  manifest SHA-256
  `b68eea8c856a2c4c03381a854a4e68adbb1f3142aac7616db92f7bb42e93f304`;
- Periodic Table: 5 published / 5 usable / 5 assignments / 0 exclusions;
  manifest SHA-256
  `8013d99663e0dfebb28f1479c69d4e8959e66923e31b6e91c396fd68fec3619f`.

The importer must refresh each YouTube source and repeat the anonymous dry-run
immediately before any separately approved write.

## Reviewed candidates

| Order | Course | Official playlist | Chapter / class | Teacher | Retained / excluded |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Work, Energy and Power | `PLsgHooHkqhhOHzoncmAMTU9UgJiN1gtcp` | 21 - Work, Energy and Power / class-11 | Mahendra Singh (id 34) | 11 / 2 |
| 2 | Solutions | `PLsgHooHkqhhOkrbz6-7e8cnZ5bvtre4pk` | 33 - Solutions / class-12 | Anoop Vashishtha (id 36) | 6 / 4 |
| 3 | Periodic Table | `PLsgHooHkqhhO9QF6HRyQYvV20hrDtCdKL` | 41 - Periodic Table / class-11 | Anoop Vashishtha (id 36) | 5 / 0 |

Proposed additive delta: **+3 playlists / +22 videos / +22 memberships / +0
chapters**, with zero reuse. Expected totals after all three imports, only if
the fresh baseline remains exact: **424 / 4,768 / 4,774 / 263**.

## Immutable evidence

Source-snapshot SHA-256 values:

- Work, Energy and Power:
  `98de0d309f7a62c295239e01315ff8d13e50fed5bb3f7327a8f4d76bf23fc908`;
- Solutions:
  `f99e2fe3494ca581b987d1d2310dc696686eb3a74e2872c5d4b22645cf4e6948`;
- Periodic Table:
  `94e242c2e5c4c876568cfdeec12cabc06831331e757538ef749e3e7a224a0431`.

Candidate-review file SHA-256:
`1b5eccd53cd455689e192de604a4aeb0ca09ee1b4273ac745160d83ed96ead22`.

Any playlist mutation invalidates its source hash and requires a fresh review.
A collision, count shortfall, missing teacher evidence, unresolved chapter,
blocked embed, or fingerprint mismatch defers that course.

## Explicit deferrals

- Solid State provides a clean eight-lecture Anoop Vashishtha sequence with
  zero source or video reuse. A 16 August curriculum refresh confirmed that
  `Solid State` is absent from both the official
  [NEET UG 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf)
  and the official
  [CBSE 2026-27 Class 12 Chemistry theory syllabus](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf).
  The missing `chapter_class_levels` row is therefore an intentional canonical
  scope exclusion, not reference-data drift. Do **not** create that row and do
  **not** import playlist `PLsgHooHkqhhPosUFvFYWQvl8WobRKF3t3` into the current
  NEET catalogue. Preserve it for a separately designed and owner-approved
  supplementary/archive taxonomy.
- Electrostatics and Units and Measurements still substitute a generic Phoenix
  2.0 row for Lecture 1 and remain incomplete.
- Gaseous State still lacks Lectures 3 and 8.
- Human Reproduction, Animal Kingdom, Biological Classification, Locomotion
  and Movement, and Biomolecules retain their recorded missing-lecture or
  Phoenix-contamination blockers.

No faculty mutation, quality-review transition, schema migration, deployment,
or `release` push occurred.
