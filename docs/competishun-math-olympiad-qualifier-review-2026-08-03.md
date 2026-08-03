# Competishun+ Mathematics Olympiad qualifier review — 3 August 2026

## Scope and safety boundary

This was a read-only refresh after the completed Jahn–Teller Distortion and
IOQC 2021–2022 imports. It compared the official Competishun+ uploads feed and
all current public channel playlists with anonymous production data.

No production write, SQL artifact, migration, restore, clone, `release` push,
or manual CI run was performed. This document and its JSON evidence are a
review package, not an import authorization.

## Refresh snapshot

At `2026-08-03T09:58:39.836Z`, exact anonymous pagination returned:

- 301 courses / 3,564 videos / 3,570 memberships / 241 chapters;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0` (exact match);
- rolling JEE: 174 courses / 2,361 memberships / fingerprint
  `cbf36bb736ac40c8e340ab75947d6202`.

These are time-scoped observations, not reusable write guards. Other
create-only writers had grown the catalogue after the preceding two-course
batch, so any future import must take a new quiet-window baseline.

The official YouTube API returned 78 public playlists and 1,966 public uploads.
Production contained 500 of those upload IDs; 1,466 were uncovered, including
108 public, embeddable videos of at least ten minutes. The five videos imported
in the preceding batch are now correctly counted as covered.

## Next coherent create-only candidate

The smallest strong next batch is one Mathematics Olympiad qualifier solutions
course. PRMO was the earlier qualifier and IOQM is its successor, so keeping the
four complete exam-solution lectures together is honest and avoids four
one-video course cards.

Proposed course: `PRMO & IOQM Solutions (2018–2022)`

| Order | Video | Duration | Reviewed scope |
| ---: | --- | ---: | --- |
| 1 | `dows6wBBk3A` | 64.1 min | PRMO 2018, questions 1–10 |
| 2 | `3YvuUlM2OHY` | 71.0 min | PRMO 2019, questions 1–15 |
| 3 | `2qm5UjRyIcs` | 158.6 min | Complete IOQM 2020 solutions |
| 4 | `X3BWR79DtyU` | 72.8 min | IOQM 2021–22 Part 1 solutions |

All four videos are public, HD, embeddable, owned by
`UC6ieIswHA9WInRsa2r88hRw`, absent from production, and absent from all 78
current public playlists. Their source order is reconstructed by exam year,
not YouTube publication time.

## Proposed catalogue mapping

- Goal: Olympiad
- Subject: Mathematics (existing id 3)
- Classes: Class 11, Class 12, Dropper
- Content type: PYQ
- Language: Hinglish
- Difficulty: Advanced
- YouTube playlist ID: null (the videos are upload-only)
- New chapter: `PRMO and IOQM Solutions`

The chapter does not exist and would need one separate create-only reference
write before the course. It must not be collapsed into existing chapter
`INMO Solutions`: INMO is a later-stage competition, not the PRMO/IOQM
qualifier.

Projected additive delta after both future gates: +1 chapter, +1 course, +4
videos, and +4 memberships.

## Attribution evidence

The PRMO 2018 description credits Rajat Jain Sir; the IOQM descriptions credit
Praveen Agrawal (PAL) Sir. Production has no exact teacher record for either
name, so this review does not invent a personal teacher.

The proposed fallback is Competishun+ channel attribution under decision
`1c06eb34-fbdc-4d3b-a239-39f256f889e8`, but that decision must be explicitly
reaffirmed for this new batch.

## Pinned evidence

Review JSON:
`docs/reviews/competishun-math-olympiad-qualifier-candidate-2026-08-03.json`

SHA-256: `74a36d79fbf709c5a9ade7c3fca74dfeccbfa8f5e410928e84e2fe8df36c6d3f`

The package pins official metadata, natural exam ordering, proposed mapping,
the exact read-only snapshot, collision results, and the decisions still
required from the owner.

## Deferred alternatives

- NMR Lecture 3 is a continuation of live course 239. Adding it would modify an
  existing course, so it is outside this create-only course gate.
- The uncovered INPhO uploads are real lectures, but one generic 2020 title
  still lacks exact question-range evidence and the series is incomplete.
- The RPS uploads still have code-only titles without reliable chapter cues.
- Revision in Reels remains short-form and should wait for a separate revision
  surface.

## Next gated sequence

If the owner approves this exact grouping and mapping:

1. record a fresh PITR restore point and pause all other production writers;
2. take a fresh exact anonymous baseline and recheck all four video IDs;
3. create only the new chapter, verify the protected JEE fingerprint, and stop;
4. after separate verification, prepare and hash a guarded source-ID-null course
   artifact;
5. dry-run, import once, verify the exact delta and both JEE fingerprints, then
   stop and report.

## Approved production outcome

The owner approved the reviewed grouping and Competishun+ attribution decision
`1c06eb34-fbdc-4d3b-a239-39f256f889e8`. Production PITR showed active 7-day
retention with latest restore availability at `03 Aug 2026, 17:02:35
UTC+05:30` before the course gate.

Gate 1 created chapter `PRMO and IOQM Solutions` as chapter `298` under
Mathematics, with exact Class 11 and Class 12 chapter scopes. The chapter
artifact is `docs/sql/competishun_prmo_ioqm_chapter_2026-08-03.sql`, SHA-256
`9eac1540f7b5c580ae548d812b96f05009b84e5b466d1bc3ef17d3becccef91a`.

Gate 2 used the stable quiet-window baseline `317 playlists / 3,728 videos /
3,734 memberships / 242 chapters / 92 chapter-class rows`. The final course
artifact is `docs/sql/competishun_prmo_ioqm_solutions_2026-08-03.sql`, SHA-256
`c017a5dcc6e68c5cd5b45fe45180bfb9f565dfa34cf7a82821e4d6df9caa6874`.
Its compact editor form was independently verified at SHA-256
`3ed85639d57f3973391f27ccbd4c7a3a11cc4c392929fe6351ed9ec3edc38401`
immediately before execution.

The first execution attempt exposed that `playlist_videos.id` is a
`GENERATED ALWAYS` identity column. The transaction rolled back completely;
the artifact was corrected to name the writable membership columns and was
repinned before retry. A subsequent dashboard client-side `query too small`
error did not reach PostgreSQL. Read-only checks after both events confirmed
zero persisted rows and the exact baseline. The corrected, hash-verified
transaction then committed successfully.

Postflight verified course `329`, `PRMO & IOQM Solutions (2018–2022)`, with a
null YouTube playlist source ID, four new videos, four memberships, and zero
chapter additions in Gate 2. All videos are assigned to chapter `298` in the
reviewed natural exam order, carry the Olympiad goal, and have Class 11, Class
12, and Dropper video/course scopes. Final totals were `318 playlists / 3,732
videos / 3,738 memberships / 242 chapters / 92 chapter-class rows`.

The protected original JEE slice remained exactly `83 courses / 1,307
memberships / c742fabf93ff8dd33d6ecd5eb4793db0`. The separate rolling JEE
catalogue remained `178 courses / 2,391 memberships /
0ed8376c5c5cea7d06b3beafbc59c45f`; this Olympiad import did not enter the JEE
scope. Anonymous curriculum verification returned chapter `298` with one
course under Olympiad → Class 11 → Mathematics and did not return it under the
equivalent JEE scope.
