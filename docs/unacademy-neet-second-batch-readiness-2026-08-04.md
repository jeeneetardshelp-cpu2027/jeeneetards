# Unacademy NEET second-batch readiness — 4 August 2026

## Status and safety boundary

Prepared read-only and awaiting exact owner approval. This pass used the
official YouTube Data API against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`) plus anonymous production catalogue reads. It did
not write Supabase data, create chapters or faculty records, run a migration,
create a clone, restore a backup, or push `release`.

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

| Order | Course | Source | Chapter | Class | Retained | Excluded | Attribution | Source snapshot SHA-256 |
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

## Proposed reviewed-evidence decision

Decision ID: `4555712a-b4ea-446c-8f57-04d2257562f9`.

This decision would bind only the three exact official playlists above to
Mahendra Singh, Anu Gupta, and Anoop Vashishtha respectively. It does not
approve other Unacademy playlists or infer attribution from unrelated videos.

## Required approval phrase

`Approve the reviewed Unacademy NEET second batch — Rotational Motion (Mahendra Singh), Current Electricity (Anu Gupta), and Electrochemistry (Anoop Vashishtha) — under decision 4555712a-b4ea-446c-8f57-04d2257562f9. Prepare the exact lecture-only manifests and import them create-only, one at a time, with a fresh PITR/baseline check and anonymous dry-run before each, and protected JEE fingerprint verification after each. Stop on reuse, drift, or any blocker; no release push.`
