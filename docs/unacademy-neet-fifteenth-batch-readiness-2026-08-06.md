# Unacademy NEET fifteenth-batch readiness — 6 August 2026

## Status and safety boundary

Owner decision `5b4b1d41-b7dc-4f12-80cf-b490e72edd96` was executed until the
first mandatory stop condition. The first course was imported create-only;
the batch then stopped before course 2 because its refreshed source snapshot
no longer matched the reviewed snapshot. No schema change, restore, clone,
deployment, or `release` push was performed. The official YouTube Data API was
refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried read-only for catalogue
counts, source IDs, retained video IDs, taxonomy, class scopes, verified
teachers, and both JEE integrity boundaries.

## Fresh read-only evidence

Captured at `2026-08-06T11:44:30.812Z`, after the fourteenth-batch quality gate:

- catalogue: 403 playlists / 4,655 videos / 4,661 memberships / 263 chapters;
- taxonomy: 92 chapter-class rows;
- faculty registry: 32 teachers / 50 aliases / 158 playlist-teacher links;
- editorial registry: 29 playlist quality reviews;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- Anoop Vashishtha (`36`) and Mahendra Singh (`34`) are verified teacher rows;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

## Reviewed lecture-only candidates

| Order | Course source | Target chapter / class | Retained | Excluded | Teacher |
| ---: | --- | --- | ---: | ---: | --- |
| 1 | Alcohols, Phenols & Ethers (`PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP`) | Chemistry 92 — Organic Compounds Containing Oxygen / class-12 | L1–L11 (11) | 1 different-chapter row | Anoop Vashishtha (36) |
| 2 | Fluid Mechanics (`PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw`) | Physics 26 — Mechanical Properties of Fluids / class-11 | L1–L11 (11) | 1 quiz | Mahendra Singh (34) |
| 3 | Kinematics 1D (`PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX`) | Physics 1 — Kinematics / class-11 | L1–L6 (6) | 3 quizzes | Mahendra Singh (34) |

All 28 retained lessons are public, embeddable, duration-complete, new to
production, and unique across the batch. The manifests preserve official source
positions. After reviewed exclusions, lesson numbers remain the natural lecture
sequence.

The two source-to-canonical mappings are explicit rather than inferred at
execution time:

- Alcohols, Phenols and Ethers is part of the existing NEET chapter
  `Organic Compounds Containing Oxygen` (id 92, class-12 scope).
- Fluid Mechanics is the source name for `Mechanical Properties of Fluids`
  (id 26, class-11 scope).
- Kinematics 1D is the straight-line portion of the existing `Kinematics`
  chapter (id 1, class-11 scope).

## Immutable review package

- candidate review:
  `docs/reviews/unacademy-neet-fifteenth-candidate-batch-2026-08-06.json`,
  SHA-256 `8719456cfad5e4caaf77c73cd09fc5381f0e27ef9a83a0c3ae61721014248c7c`;
- Alcohols, Phenols and Ethers manifest:
  `docs/manifests/unacademy-neet-alcohols-phenols-ethers-class-12-reviewed.json`,
  request `dcf21c62-bb4d-42c8-ad86-2bc978307aa7`,
  SHA-256 `f2725d0255c12d06f3d481729edc3bcd07a94bf8da1373c2b94edbe5f57fe1fa`;
- Fluid Mechanics manifest:
  `docs/manifests/unacademy-neet-fluid-mechanics-class-11-reviewed.json`,
  request `0f7c245d-4f5b-48b7-af2e-5745cc64ec9c`,
  SHA-256 `0a35ba41c0be551d48b4f521ffa5c324e283062e3c83222cd45a678ad4e839b4`;
- Kinematics 1D manifest:
  `docs/manifests/unacademy-neet-kinematics-1d-class-11-reviewed.json`,
  request `95f7b00e-0946-46b9-a7e6-b5b16d555c51`,
  SHA-256 `682356a8ecec18d73db0a65fa08adaccd0dce4dde376e45840ac3d08b4e82622`.

Pinned normalized source snapshots:

- Alcohols, Phenols and Ethers:
  `d2cb6cb00c8eb5c3d430a090779ae5c891a560aca92fe988bbc40cd011d8698c`;
- Fluid Mechanics:
  `d3d1be7d7eae2571d5dbfece4921e6c50bac95d500ccd6a55459d017a5cdc478`;
- Kinematics 1D:
  `29891a8f3814b43df38c3869887fc8279b66d5f9fcdf2724016f8fee8165a487`.

## Explicit deferrals

- Organisms and Populations starts at Lecture 4 and also lacks Lectures 9, 12,
  and 13.
- Aldehydes, Ketones and Carboxylic Acids lacks Lecture 1 and contains an
  unrelated Bonding Visualization row.
- Applications of Biotechnology, The Living World, and Reproductive Health are
  mechanically clean, but Seep Pahuja and Dr. Sachin Kapur still lack normalized
  verified production teacher records. They remain for a faculty-aware batch.
- Photosynthesis retains the previously recorded Biodiversity contamination and
  duplicate Lecture 3 ambiguity.
- Ionic Equilibrium, Excretory Products and Their Elimination, and General
  Principles and Processes of Isolation of Elements retain the fourteenth-batch
  blockers.

## Guarded production execution

The signed-in production dashboard confirmed active seven-day PITR with latest
restore point `6 August 2026, 17:22:58 IST`. The fresh quiet-window preflight at
`2026-08-06T12:06:40.488Z` exactly matched the reviewed baseline: 403 playlists,
4,655 videos, 4,661 memberships, 263 chapters, zero target source/video reuse,
and the protected JEE boundary.

Course 1's official source title and every reviewed row matched the pinned
normalized source snapshot
`d2cb6cb00c8eb5c3d430a090779ae5c891a560aca92fe988bbc40cd011d8698c`.
Its anonymous mapped dry-run returned 1 ok / 0 review / 0 blocked. Production
then created course `423` with 11 new videos, 11 memberships, zero reused
videos, and zero new chapters. All lessons are in natural L1-L11 order on
chapter 92; the course carries only the NEET goal and class-12 scope.

| Order | Course | Outcome | Catalogue delta | Postflight |
| ---: | --- | --- | --- | --- |
| 1 | Alcohols, Phenols & Ethers | imported as course `423` | +1 playlist / +11 videos / +11 memberships / +0 chapters; 0 reused | 404 / 4,666 / 4,672 / 263; protected JEE exact |
| 2 | Fluid Mechanics | **STOPPED before dry-run/write** | none | refreshed source snapshot mismatch |
| 3 | Kinematics 1D | not attempted after stop | none | no source refresh, dry-run, or write |

The course-2 quiet-window baseline was exactly 404 / 4,666 / 4,672 / 263 with
zero source or retained-video reuse. The source rows remained public,
embeddable, duration-complete, and in the reviewed positions, but the official
playlist title changed from the reviewed `Fluid Mechanics - Playlist ...` to
`Fluid Mechanics -  Playlist ...` (an additional space). The recomputed
normalized source hash was
`b7a1b79c07792331919693f1b38a1ef899715cd46b5615721a4fd28b7bcca0e3`,
not the approved
`d3d1be7d7eae2571d5dbfece4921e6c50bac95d500ccd6a55459d017a5cdc478`.
The source-mutation guard therefore stopped the batch before any course-2
dry-run or write, and course 3 was not attempted.

After course 1, the protected JEE boundary remained exactly 82 courses / 1,304
memberships / `30eee4a4a6842e5beeb7c97083d7f812`; rolling JEE remained 212
courses / 2,848 memberships / `9eea2b44f0b19c08cc0907c57e091342`.
Faculty links and quality review remain later, separately hash-gated
transitions.

## Execution rule retained

Any refreshed follow-up approval must continue to run each remaining course
separately in listed order. Before every write:

1. refresh PITR and the quiet-window baseline;
2. refresh the exact YouTube playlist and require its pinned source snapshot;
3. run the anonymous mapped dry-run;
4. require zero source and retained-video reuse;
5. import create-only, then verify the protected JEE fingerprint.

Stop on source mutation, reuse, baseline drift, dry-run findings, or protected
JEE mismatch. No `release` push is part of this batch.

## Historical owner decision

`Approve the reviewed Unacademy NEET fifteenth batch — Alcohols, Phenols and
Ethers (Anoop Vashishtha), Fluid Mechanics (Mahendra Singh), and Kinematics 1D
(Mahendra Singh) — under decision 5b4b1d41-b7dc-4f12-80cf-b490e72edd96.
Accept the reviewed mappings Alcohols, Phenols and Ethers -> Organic Compounds
Containing Oxygen, Fluid Mechanics -> Mechanical Properties of Fluids, and
Kinematics 1D -> Kinematics. Import create-only, one at a time in the listed
order, excluding only the recorded different-chapter and quiz rows, with a
fresh PITR/baseline check and anonymous dry-run before each, and protected
original-82 JEE fingerprint verification after each. Stop on source mutation,
reuse, drift, or any blocker; no release push.`
