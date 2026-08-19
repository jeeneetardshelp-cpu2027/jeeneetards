# Unacademy NEET twenty-first-batch readiness - 8 August 2026

## Status

**OWNER APPROVAL REQUIRED - NO PRODUCTION WRITE.** This preparation performed
read-only YouTube/API discovery, anonymous production queries, and anonymous
v12 dry-runs only. No Supabase write, schema migration, deployment, or
`release` push occurred.

## Proposed owner decision

Decision ID: `9443dd70-a2c6-4747-9a5e-a9022f7012cf`

Approve the reviewed Unacademy NEET twenty-first batch - Kinetic Theory of
Gases (Shubham Kumar) and Electromagnetic Waves (Samip Velani) - under decision
`9443dd70-a2c6-4747-9a5e-a9022f7012cf`, exactly as recorded in this readiness
document. Accept the official Unacademy evidence resolving the exact
playlist-specific educator identities. Import create-only, one course at a
time in the listed order, with a fresh PITR and quiet-window baseline check
plus anonymous dry-run before each, and protected original-82 JEE fingerprint
verification after each. Stop on source mutation, reuse, drift, or any blocker;
no `release` push.

This decision would cover only the two official playlists and six video IDs
below. Normalized faculty creation/linking and quality-review transitions remain
separate later gates.

## Read-only source and attribution evidence

The official channel refresh still exposes 736 public playlists. Both selected
sources are coherent and complete for their published scope:

- Kinetic Theory of Gases contains two embeddable lessons. Both descriptions
  link to more courses by Shubham Kumar, and the matching official Unacademy
  course identifies [Shubham Kumar](https://unacademy.com/lesson/assumptions-of-kinetic-theory-definition-of-an-ideal-gas-in-hindi/2TBU4FK8).
  The second title, `Numerical on Ideal Gas Equation`, was manually confirmed
  to the same Kinetic Theory chapter after the rules-only drafter left it
  unmatched.
- Electromagnetic Waves contains four embeddable, chapter-specific lessons.
  Every description names `Samip`; the matching official Unacademy course
  identifies [Samip Velani](https://unacademy.com/course/electromagnetic-waves-for-class-12/5WOQB7FD).

All six videos have positive durations, preserve official source order, and
have zero production reuse. Neither source playlist is present in production.

## Production read-only preflight

The fresh anonymous snapshot at `2026-08-08T12:00:00.053Z` returned:

- 419 playlists / 4,740 videos / 4,746 memberships / 263 chapters;
- 92 chapter-class rows / 35 teachers / 174 playlist-teacher links / 45
  quality reviews;
- Kinetic Theory of Gases chapter 275 scoped to Class 11;
- Electromagnetic Waves chapter 15 scoped to Class 12;
- no Shubham Kumar or Samip Velani normalized teacher record;
- source collisions: 0;
- retained-video collisions: 0;
- protected original JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`; and
- rolling JEE: 212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`.

This preparation did not require a PITR write-gate check. A fresh signed-in
PITR check and exact quiet-window baseline are mandatory immediately before
any separately approved import.

## Anonymous dry-run evidence

Both exact reviewed manifests passed independent anonymous production dry-runs
during preparation. Each returned **1 ok / 0 review / 0 blocked**, advertised
v12, resolved its chapter as `reuse`, and performed no Supabase write:

- Kinetic Theory of Gases: 2 published / 2 usable / 2 assignments / 0
  exclusions; manifest SHA-256
  `758e1ae5dbeded33afad84250c19faf1b20e12e51dc0ced5f6c6eba3f82b91cb`;
- Electromagnetic Waves: 4 published / 4 usable / 4 assignments / 0
  exclusions; manifest SHA-256
  `ef112fbc83d88f2a94b8ff996a26969ed41205f618bb10704bd254867235554c`.

The importer must refresh YouTube and repeat the anonymous dry-run immediately
before each separately approved write.

## Read-only refresh - 10 August 2026

A fresh, preparation-only revalidation completed at
`2026-08-10T07:38:01.829Z`. It made no Supabase write:

- Kinetic Theory of Gases still publishes 2/2 usable videos, retains source
  SHA-256 `cc773d0df0234f01c034a7d18ada457435b00c735a0967108c539b4efebd9056`,
  and returned **1 ok / 0 review / 0 blocked**, v12, chapter reuse, and no
  existing source playlist.
- Electromagnetic Waves still publishes 4/4 usable videos, retains source
  SHA-256 `d046ae1cd01328f9e33537660e4d714e2b045dc2cd0aaffa699ad2e6faec3367`,
  and returned **1 ok / 0 review / 0 blocked**, v12, chapter reuse, and no
  existing source playlist.
- Protected original JEE remained **82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`**.
- Rolling JEE remained **212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`**.

This refresh does not convert the readiness package into production approval.

## Reviewed candidates

| Order | Course | Official playlist | Chapter / class | Teacher | Retained |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Kinetic Theory of Gases | `PLsgHooHkqhhMZ0ocHynO-84oB0VVcuyoG` | 275 - Kinetic Theory of Gases / class-11 | Shubham Kumar (owner review) | 2 |
| 2 | Electromagnetic Waves | `PLsgHooHkqhhPkYyUO_zMJpEQZ5MST56fK` | 15 - Electromagnetic Waves / class-12 | Samip Velani (owner review) | 4 |

Proposed additive delta: **+2 playlists / +6 videos / +6 memberships / +0
chapters**, with zero reuse. Expected totals after both imports, if the fresh
baseline remains exact: **421 / 4,746 / 4,752 / 263**.

## Immutable evidence

Source-snapshot SHA-256 values:

- Kinetic Theory of Gases: `cc773d0df0234f01c034a7d18ada457435b00c735a0967108c539b4efebd9056`;
- Electromagnetic Waves: `d046ae1cd01328f9e33537660e4d714e2b045dc2cd0aaffa699ad2e6faec3367`.

Candidate-review file SHA-256:
`f9daa66102d7b3cd497d362eea7ead76855293e4f1db52a33122a22c3f7c3932`.

Any playlist mutation invalidates its source hash and requires a fresh review.
A collision, count shortfall, missing teacher evidence, unresolved chapter,
blocked embed, or fingerprint mismatch defers that course.

## Explicit deferrals and current-syllabus scope review

- `PLsgHooHkqhhO3MEbwFNOEjKd5LRkzW3dE` provides five usable Mineral
  Nutrition lectures by Pradeep Singh with zero reuse, but production lacks the
  `Mineral Nutrition` chapter.
- `PLsgHooHkqhhNzYonED_O0YBpbcsEzNQyv` provides three Transport in Plants
  lectures by Pradeep Singh with zero reuse, but production lacks the
  `Transport in Plants` chapter.
- A fresh scope review on 10 August 2026 found that the official
  [NEET UG 2026 syllabus](https://cdnbbsr.s3waas.gov.in/s37bc1ec1d9c3426357e69acd5bf320061/uploads/2026/01/202601081066816297.pdf)
  lists only Photosynthesis, Respiration, and Plant Growth and Development in
  Plant Physiology. The official
  [CBSE Biology 2026-27 curriculum](https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Biology_SecP2_2026-27.pdf)
  likewise starts the current Plant Physiology sequence at Photosynthesis and
  does not include either deferred chapter.
- Therefore neither source belongs in the current canonical NEET syllabus.
  Do **not** create the two chapter records and do **not** import these eight
  videos under the present NEET taxonomy. Their exact playlist and video IDs
  remain pinned in the candidate review for a future, separately designed and
  owner-approved supplementary/archive taxonomy.
- Plant Growth and Development is already covered by production course 413;
  do not duplicate it.
- Hydrocarbons remains incomplete because Lecture 4 is absent.

No normalized faculty mutation, quality-review transition, schema migration,
deployment, or `release` push occurred.
