# Unacademy NEET fourteenth-batch readiness — 6 August 2026

## Status and safety boundary

Refreshed for owner review after the first Friction dry-run stopped on a source
mutation. No production import completed; the attempt made zero production writes,
and the other two courses were not attempted. No schema
migration, restore, clone, deployment, or `release` push was performed.

The official YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`). Production was queried read-only for catalogue
counts, source IDs, retained video IDs, taxonomy, class scopes, verified
teachers, and both JEE integrity boundaries.

## Fresh read-only production evidence

Captured at `2026-08-06T08:23:16.306Z`, after the thirteenth-batch quality gate:

- catalogue: 400 playlists / 4,641 videos / 4,647 memberships / 263 chapters;
- taxonomy: 92 chapter-class rows;
- faculty registry: 32 teachers;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- all three target chapters carry the reviewed Class 11 scope;
- Mahendra Singh (`34`) and Pradeep Singh (`33`) are verified teacher records;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The same counts and protected fingerprint were rechecked after the stopped
dry-run and were unchanged.

## Source-mutation stop and refresh

The originally approved Friction manifest recorded six source rows: L1–L4, one
quiz, and one private/unavailable row. At execution time the playlist metadata
still advertised six items, but the current YouTube API response contained only
five rows because the private row was no longer returned. The mapped dry-run
therefore rejected the stale six-row manifest before any Supabase call that
could write.

The refreshed Friction package now pins the five current API rows:

- positions 1–4: the same public, embeddable L1–L4 lectures;
- position 5: the same Quiz 2 row, still excluded;
- no private/unavailable row is asserted or imported.

Current ordered source-row SHA-256:
`bd6db75e90429a5305be577494375193652225392fd3a39cf0fff23da4de659c`.
The normalized Friction review snapshot SHA-256 is
`c75a549c164a13a4efe1acbc6c3b471e6045c8411ad8484ba8353bca6ad02987`.

## Reviewed lecture-only candidates

| Order | Course source | Chapter | Retained | Excluded | Teacher evidence |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | Friction (`PLsgHooHkqhhM5-Ujy03Tn7YjofINdftRM`) | Physics 7 — Friction | L1–L4 | 1 quiz | Mahendra Singh (34), refreshed decision `b98191cb-c0be-4d3c-9e15-95905da4fffc` |
| 2 | The Unit of Life (`PLsgHooHkqhhM6fzJQ3Vhv7s6iOglsVJw2`) | Biology 107 — Cell: The Unit of Life | L1–L4 | 1 quiz | Pradeep Singh (33), original decision `b19eaa58-7931-4c84-8cea-8b6622230b4d` |
| 3 | Plant Anatomy (`PLsgHooHkqhhPkkXnKHj60aao7jClkwioE`) | Biology 97 — Anatomy of Flowering Plants | L1–L6 | 1 quiz | Pradeep Singh (33), original decision `b19eaa58-7931-4c84-8cea-8b6622230b4d` |

All 14 retained lessons are public, embeddable, duration-complete, new to
production, and unique across the batch. Their official source order is natural
lecture-number order.

## Immutable refreshed review package

- candidate review:
  `docs/reviews/unacademy-neet-fourteenth-candidate-batch-2026-08-06.json`,
  SHA-256 `6d270aeb645d18ba89584e157800b99cf178827813e4adb4cd5b654c342139d2`;
- refreshed Friction manifest:
  `docs/manifests/unacademy-neet-friction-class-11-reviewed.json`,
  request `24c74a76-22fa-4bcc-8d31-5fbd688a9045`,
  SHA-256 `c3fa06af520a485d62a3b58a72c23946c7bcc02bfcfa2a619308d467d8793648`;
- unchanged Cell manifest:
  `docs/manifests/unacademy-neet-cell-unit-life-class-11-reviewed.json`,
  SHA-256 `825bd87e9e4a24e9e3aececd488221f206ea6377a1c0e422639cdd2076ccd06d`;
- unchanged Plant Anatomy manifest:
  `docs/manifests/unacademy-neet-plant-anatomy-class-11-reviewed.json`,
  SHA-256 `7c17b451b19aed44a6090e6d15a59e4bdcfcf975ce2ab586fea1605e4606fd24`.

Pinned normalized source snapshots:

- Friction: `c75a549c164a13a4efe1acbc6c3b471e6045c8411ad8484ba8353bca6ad02987`;
- Cell: `9a8adfac37dfa99fe4f7110153850abd81819a0c62ed9c2fcc0a2f60dfa0281a`;
- Plant Anatomy: `0ff7411af44a7b562119b76703b1c1865c0ec26323ada775542528a117002b11`.

## Required execution gate

The refreshed package remains unapproved and unimported. After a matching owner
decision, run each course separately in the listed order. Before every write:

1. refresh PITR and the quiet-window baseline;
2. refresh the exact YouTube playlist and require its pinned source snapshot;
3. run the anonymous mapped dry-run;
4. require zero source and retained-video reuse;
5. import create-only, then verify the protected JEE fingerprint.

Stop on source mutation, reuse, baseline drift, dry-run findings, or protected
JEE mismatch. Faculty links and quality review remain later, separately
hash-gated transitions. No `release` push is part of this batch.

## Explicit deferrals

- Ionic Equilibrium is missing Lectures 5–6 from its public L1–L11 sequence.
- Excretory Products and Their Elimination contains quizzes plus an older,
  duplicate/out-of-order Lecture 2.
- General Principles and Processes of Isolation of Elements has no matching
  current production chapter; no new taxonomy was inferred.

## Proposed owner decision

`Approve the refreshed Unacademy NEET fourteenth batch — Friction (Mahendra
Singh), Cell: The Unit of Life (Pradeep Singh), and Anatomy of Flowering Plants
(Pradeep Singh) — under refreshed decision
b98191cb-c0be-4d3c-9e15-95905da4fffc. Use Friction request
24c74a76-22fa-4bcc-8d31-5fbd688a9045 and current ordered source-row SHA-256
bd6db75e90429a5305be577494375193652225392fd3a39cf0fff23da4de659c,
mapping L1–L4 and excluding only the current Quiz 2 row; the previously recorded
private row has disappeared and is not part of the refreshed source. Retain the
original decision b19eaa58-7931-4c84-8cea-8b6622230b4d for the unchanged Cell
and Plant Anatomy manifests. Import create-only, one at a time in the listed
order, with a fresh PITR/baseline check and anonymous dry-run before each, and
protected original-82 JEE fingerprint verification after each. Stop on source
mutation, reuse, drift, or any blocker; no release push.`
