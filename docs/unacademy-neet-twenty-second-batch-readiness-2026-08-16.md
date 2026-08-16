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

The owner separately approved reviewed `course_title` support on 16 August.
The importer now validates the manifest title while continuing to bind source
ownership and every video decision to the official YouTube playlist. The fresh
dry-runs explicitly reported the approved import titles `Work, Energy and
Power`, `Solutions`, and `Periodic Table` rather than the longer promotional
source titles.

- Work, Energy and Power: 13 published / 13 usable / 11 assignments / 2
  exclusions; manifest SHA-256
  `5359ca045ea084d6d53c058aee2a849c353b9f8a632eedc0835247955c85f896`;
- Solutions: 10 published / 10 usable / 6 assignments / 4 exclusions;
  manifest SHA-256
  `168b1c1b67e09dff873df557d981e0e48525fd2ed4ffdc48d0b34b52eb0620a2`;
- Periodic Table: 5 published / 5 usable / 5 assignments / 0 exclusions;
  manifest SHA-256
  `38b76f705d97406203d7c722fda9cc230875e98ea645af55950be787fc537da0`.

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
`fdf0f8cb6a1584c31b82624611b8bb00d6f2f37659820eface75734655ceafeb`.

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
