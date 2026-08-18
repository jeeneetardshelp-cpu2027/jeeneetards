# Unacademy NEET sixteenth-batch readiness — 2026-08-07

Status: **CONTENT IMPORT COMPLETED IN PRODUCTION** under owner decision
`f7992243-3b5b-4c39-bac9-433dd766a70a`. The three courses were imported
create-only, one at a time. No schema migration and no `release` push occurred.

## Proposed owner decision

Decision ID: `f7992243-3b5b-4c39-bac9-433dd766a70a`

Approve the exact official-playlist evidence for **Seep Pahuja** and
**Dr. Sachin Kapur** and the three reviewed lecture-only manifests below. The
decision authorizes the later create-only content imports one at a time, but it
does not itself authorize a normalized faculty-registry SQL write. That remains
a separately generated, hash-pinned production gate.

## Fresh read-only production preflight

Captured `2026-08-06T18:56:32.090Z` through the anonymous production API:

| Evidence | Result |
|---|---:|
| Playlists / videos / memberships / chapters | 406 / 4,683 / 4,689 / 263 |
| Chapter-class rows | 92 |
| Teachers / playlist-teacher links | 32 / 161 |
| Quality reviews | 32 (last exact guarded postflight, immediately before this pass) |
| Exact source-playlist collisions | 0 |
| Retained production-video collisions | 0 |
| Cross-candidate retained-video collisions | 0 |
| Protected original JEE boundary | 82 / 1,304 / `30eee4a4a6842e5beeb7c97083d7f812` |
| Rolling JEE boundary | 212 / 2,848 / `9eea2b44f0b19c08cc0907c57e091342` |

The required Biology chapters and scopes already exist:

- `102` — Biotechnology and its Applications — class-12
- `127` — The Living World — class-11
- `123` — Reproductive Health — class-12

Neither `Seep Pahuja` nor `Dr. Sachin Kapur` has a normalized row in the live
`teachers` table. The prior assumption that those records had since been added
was incorrect; this package records the missing normalization as an explicit
gate instead of silently reusing or inventing an identity.

## Reviewed candidates

| Order | Course source | Chapter / class | Retained | Excluded | Attribution |
|---:|---|---|---:|---:|---|
| 1 | Applications Of Biotechnology (`PLsgHooHkqhhP1V_qdWDRNO0MczNtM6Q1m`) | Biotechnology and its Applications / class-12 | 4 | 0 | Seep Pahuja |
| 2 | The Living World (`PLsgHooHkqhhNWiiYtSlpdjPEVYhHqtCkR`) | The Living World / class-11 | 5 | 2 | Dr. Sachin Kapur |
| 3 | Reproductive Health (`PLsgHooHkqhhPZfPFIHshnh3J0Nsod2uDw`) | Reproductive Health / class-12 | 7 | 5 | Dr. Sachin Kapur |

All 16 retained rows have non-zero durations and are embeddable. The five The
Living World lectures are currently unlisted but embeddable; they remain valid
official YouTube embeds. The Living World DPP and mixed Biological
Classification quiz are excluded. Reproductive Health keeps L1-L7 and excludes
all five quiz, DPP, or mixed-chapter practice rows.

Teacher evidence is playlist-specific:

- Applications of Biotechnology: the official playlist title and all four
  retained titles name Seep Pahuja.
- The Living World: the official playlist title names Dr Sachin Kapur; every
  retained lecture names Sachin Sir. The row naming Pradeep Singh is an excluded
  mixed-chapter quiz, so Pradeep Singh is not assigned to this course.
- Reproductive Health: the official playlist title names Dr Sachin Kapur and
  every retained lecture names Sachin Sir.

Projected additive delta after all three later imports: **+3 playlists, +16
videos, +16 memberships, +0 chapters, 0 reuse**. Projected catalogue totals:
409 / 4,699 / 4,705 / 263.

## Immutable evidence

Source-snapshot SHA-256 values:

- Applications of Biotechnology: `e6bc2be51f4e5d22e1b40290534495ba4664cf5c8a5ba0bd901bc57249352ef7`
- The Living World: `36d5336c2188aee54b7d1189341e51a7672fd356290d153651e452e2818a8d22`
- Reproductive Health: `937d3c46bf998cacbf5963ff117ab17ab1a5e90ab0f5850e52aa478856fe1d7b`

File SHA-256 values:

- Candidate review: `dc8d1f9c92b15eec1908c3b0b94c2460838806624556f55426b9b4633f45e1c9`
- Applications manifest: `7b12a743516a93321116af75ecb695e042b217d64c9d8783a35ba19d4652a68e`
- The Living World manifest: `37ab6380c7391f4349aa73f623a0f44573493f82bcd1cd2bfc87582dbf1fe9a0`
- Reproductive Health manifest: `5e6b696ce1d3c88f6765197317290cea18dd9a24c1d208cbe70dcb6c94ad7206`

## Production execution evidence

PITR was confirmed active with seven-day retention before the writes. At the
gate, the Supabase dashboard advertised restore availability through
`07 Aug 2026, 00:33:21 IST` (earliest retained point
`31 Jul 2026, 00:33:21 IST`). Each official playlist was refreshed from the
YouTube Data API and reproduced its approved source hash exactly. Each fresh
anonymous dry-run returned `ok`, zero blockers, and no existing source course.

| Order | Course ID | Course | Added videos / memberships | Reused | Chapters created |
|---:|---:|---|---:|---:|---:|
| 1 | 426 | Applications of Biotechnology | 4 / 4 | 0 | 0 |
| 2 | 427 | The Living World | 5 / 5 | 0 | 0 |
| 3 | 428 | Reproductive Health | 7 / 7 | 0 | 0 |

Final production catalogue: **409 playlists / 4,699 videos / 4,705
memberships / 263 chapters**. Exact batch delta: **+3 / +16 / +16 / +0**.
All 16 memberships preserve the approved source order, point to their exact
reviewed chapter, and carry embeddable videos. Each course has the exact `neet`
goal and its reviewed class scope.

The protected original-JEE boundary remained exact after every import and at
the decisive postflight: **82 courses / 1,304 memberships /
`30eee4a4a6842e5beeb7c97083d7f812`**. The rolling JEE boundary also remained
unchanged at **212 / 2,848 / `9eea2b44f0b19c08cc0907c57e091342`**.

Normalized faculty links remain absent for courses 426-428, deliberately.
Their separate guarded package is recorded in
`unacademy-neet-sixteenth-batch-faculty-links-readiness-2026-08-07.md` and must
receive an exact-hash owner approval before any production faculty write.
