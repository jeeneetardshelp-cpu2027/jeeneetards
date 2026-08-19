# Unacademy NEET second-batch readiness — 4 August 2026

## Status and safety boundary

Imported to production under owner decision
`4555712a-b4ea-446c-8f57-04d2257562f9`. The discovery pass used the
official YouTube Data API against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`) plus anonymous production catalogue reads. It did
not create chapters or faculty records, run a migration, create a clone,
restore a backup, or push `release`. The later approved production execution
created only the three reviewed courses and their new video/membership rows.

The three candidates below are the smallest clean continuation after the first
Unacademy batch. Every source row was reviewed. Lecture, revision, PYQ, DPP,
and quiz modes remain separated rather than being mixed into one student-facing
course.

## Fresh production snapshot

- catalogue: 353 playlists / 4,159 videos / 4,165 memberships / 245 chapters;
- chapter-class scopes: 92;
- retained source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.

This snapshot is discovery evidence only. Any approved production import must
take a new quiet-window baseline and fresh PITR restore point immediately before
each write.

## Reviewed courses

| Order | Course | Source | Chapter | Class | Retained | Excluded | Attribution | Discovery snapshot SHA-256 |
| ---: | --- | --- | --- | --- | ---: | ---: | --- | --- |
| 1 | Rotational Motion — Unacademy NEET | `PLsgHooHkqhhM1W_NWZnLgqMDysIuHrMXu` | 27 — Rotational Motion | class-11 | 14 | 9 | Mahendra Singh | `01ed86eb253894b13ffa4130cef3484d49f27832b6899d9daf9ae8ab41f4e395` |
| 2 | Current Electricity — Unacademy NEET | `PLsgHooHkqhhNmUjrOF64b49WSKp93PsKZ` | 10 — Current Electricity | class-12 | 11 | 8 | Anu Gupta | `8ea78243cb5196d3005586d7ef1dc592e912ad2402282e6defe19a775116c014` |
| 3 | Electrochemistry — Unacademy NEET | `PLsgHooHkqhhPx8PUmYV2q6n6IbpGnCDlg` | 88 — Electrochemistry | class-12 | 9 | 7 | Anoop Vashishtha | `dfd52dcde4d689cb3943843b9696f3f1794e9a9b82d7321bc7a99fe2c8dd2a6a` |

All 34 retained videos are currently embeddable and have known positive
durations. Their official source titles consistently identify the named
teacher as `Mahendra Sir`, `Anu Gupta Sir`, or `Anoop Sir`; each channel-owned
playlist title gives the corresponding full name. No matching verified teacher
record currently exists, so faculty-registry linking and the canonical quality
review remain separate later gates.

## Row-level editorial decisions

### Rotational Motion

Keep source positions 1–10 and 12–15 as lessons 1–14 in that order. Source
position 11 is explicitly `L 11 | PYQs` and is excluded as practice. Source
positions 16–23 are eight live-quiz/assertion-and-reason rows and are excluded.
Only retained rows name Mahendra Sir; the excluded quiz block also contains
Indrajeet Sir, so it must not influence the course attribution.

### Current Electricity

Keep lectures L1–L9 at source positions 1–9, then L10–L11 at source positions
16–17, assigning contiguous lesson numbers 1–11. Exclude source positions
10–15 (six DPP quizzes) and 18–19 (two mega DPP/Menti quizzes). Every retained
row names Anu Gupta Sir.

### Electrochemistry

Keep lectures L1–L9 at source positions 1–9. Exclude source positions 10–15
(six Menti quizzes) and position 16 (a broad Physical Chemistry mega quiz).
Every retained row names Anoop Sir, while the official playlist title supplies
the reviewed full name Anoop Vashishtha.

## Projected additive delta

- playlists: +3;
- videos: +34;
- memberships: +34;
- chapters: +0;
- reused videos: 0.

The intended order is Rotational Motion, Current Electricity, then
Electrochemistry. Each must receive a fresh anonymous v12 dry-run and its own
create-only transaction. After every course, stop on source/video reuse,
baseline drift, chapter/class mismatch, or any protected-JEE fingerprint
change.

## Production execution — complete

The approved order was followed exactly. Each write received a separately
refreshed seven-day PITR restore point, a fresh quiet-window catalogue and
protected-JEE baseline, and an anonymous `ok` dry-run. The baseline was read a
second time after each dry-run and before its write; all three remained exact.

| Order | Course ID | PITR latest restore (IST) | Pre-write catalogue P/V/M/C | Manifest SHA-256 | Importer source-position SHA-256 | Result |
| ---: | ---: | --- | --- | --- | --- | --- |
| 1 | 374 | 4 Aug 2026 11:22:11 | 355 / 4,188 / 4,194 / 250 | `6a158c2a8e01c35de4c22bb5e556ae3f82c8d55c7760c0195ba74eb33ab4d9bf` | `3ea2a83ff9db08250f59dc15d56cbf4c4c143eb9c59ffc489de3c2700297cec0` | +14 videos, +14 memberships, 0 reuse |
| 2 | 375 | 4 Aug 2026 11:28:12 | 356 / 4,202 / 4,208 / 250 | `37437107c1a55b518f0134753982ed13597f77a37759b6dab5b7e7393d769d77` | `9c9bbc8f8c892eea4fe8db12b5e8524d6a0160565ededcb71896f7a87b629ea9` | +11 videos, +11 memberships, 0 reuse |
| 3 | 376 | 4 Aug 2026 11:30:12 | 357 / 4,213 / 4,219 / 250 | `f8d2590d05aa382f6d3f6c842f4dbb39be28673e025de53df78e18c1b3034923` | `f60f005374cd88abdaa90a1868a76568aa390257b8e4d2b272efd660e6ec4f51` | +9 videos, +9 memberships, 0 reuse |

Postflight totals are 358 playlists / 4,222 videos / 4,228 memberships / 250
chapters. Courses 374, 375, and 376 contain exactly 14, 11, and 9 memberships
respectively; all lessons resolve to canonical chapters 27, 10, and 88. Their
learning-goal slug is `neet`; their class slugs are `class-11`, `class-12`, and
`class-12`. The protected original JEE catalogue remains 83 courses / 1,307
memberships / fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0` after every
write and at final postflight.

## Reviewed-evidence decision

Decision ID: `4555712a-b4ea-446c-8f57-04d2257562f9`.

This decision binds only the three exact official playlists above to
Mahendra Singh, Anu Gupta, and Anoop Vashishtha respectively. It does not
approve other Unacademy playlists or infer attribution from unrelated videos.

## Required approval phrase

`Approve the reviewed Unacademy NEET second batch — Rotational Motion (Mahendra Singh), Current Electricity (Anu Gupta), and Electrochemistry (Anoop Vashishtha) — under decision 4555712a-b4ea-446c-8f57-04d2257562f9. Prepare the exact lecture-only manifests and import them create-only, one at a time, with a fresh PITR/baseline check and anonymous dry-run before each, and protected JEE fingerprint verification after each. Stop on reuse, drift, or any blocker; no release push.`
