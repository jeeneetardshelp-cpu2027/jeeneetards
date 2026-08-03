# Competishun+ channel completion audit — 3 August 2026

## Scope and safety boundary

This was a read-only comparison of the current public Competishun+ YouTube
channel (`UC6ieIswHA9WInRsa2r88hRw`) with the anonymous production catalogue
and the reviewed manifests already checked into this repository.

No Supabase write, import, migration, restore, clone, `release` push, or manual
CI run was performed. A general `continue` instruction did not select or
authorize a production content batch.

## Current production baseline

Anonymous exact-pagination checks returned:

- 292 courses;
- 3,088 videos;
- 3,094 course memberships;
- 241 chapters.

The protected original JEE slice remains exact:

- 83 courses;
- 1,307 memberships;
- fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0`;
- match: `true`.

The separate rolling JEE catalogue is now 167 courses / 1,894 memberships with
observed fingerprint `4606d06923f3adc1ac1becd6b95ddf0d`. That rolling value
is evidence for this snapshot, not a permanent protected baseline.

## Reviewed-manifest coverage

The repository contains 65 Competishun+ manifest files with assignments. Every
assigned YouTube video ID in all 65 files is already present in production.
There is therefore no checked-in Competishun+ manifest that can be safely
reimported as new content.

Six manifest files did not directly match a live course's stored YouTube
playlist ID. A video-level membership check proved that they are nevertheless
fully live, including the intentional course splits for Conic Sections and
Matrices/Determinants. They must not be treated as missing.

## Current public-playlist coverage

The official YouTube Data API returned 78 current public channel playlists:

- 59 playlist IDs directly match a live course source ID;
- 58 playlist IDs have a local Competishun+ manifest;
- 11 playlists are neither a direct live source ID nor locally manifested.

The 11 untracked playlists do not contain a missing full-course lecture batch:

- old 2021, 2022, and 2023 annual playlists now expose no usable public videos;
- JEE 2024, JEE 2025, JEE 2027, JEE 2028, JoSAA 2022, and KVPY contain
  strategy, registration, counselling, or reaction material rather than
  curriculum lectures;
- `Revision in Reels | JEE Mathematics` contains 17 short-form videos and must
  remain separate from the lecture catalogue;
- `Ranker's Practice Series` exposes three videos in its public playlist, but
  the channel uploads contain nine `RPS-*` videos in total. Their code-only
  titles and empty/generic descriptions do not provide safe chapter evidence,
  so all nine are deferred pending video-level content review.

## Channel-wide upload coverage

The uploads feed contained 1,965 current public entries. Production already
contains 494 of those YouTube IDs; 1,471 are not in the catalogue.

Most uncovered uploads are not missing lectures:

- 1,358 are shorter than 10 minutes;
- many longer uploads are strategy, counselling, results, college reviews,
  registrations, or ask-me-anything streams;
- duration alone is therefore not a safe import signal.

A title-and-duration pass found a smaller academic set: Olympiad solutions,
advanced problem sessions, and topic deep-dives. These are not all ready to
import; they require coherent grouping, exact chapter evidence, and a fresh
reuse check at the eventual write gate.

## Smallest clean candidate batch

The following two source-ID-null courses are the smallest coherent candidates
from the uncovered academic uploads. All five YouTube IDs are currently absent
from production, both proposed course titles are absent, the Competishun+
channel exists as institute/channel id 81, and all videos are in none of the 78
current public playlists.

### Candidate 1 — Jahn–Teller Distortion

Proposed scope: JEE / Chemistry / Class 12 / advanced deep-dive.

Canonical chapter: `Coordination Compounds` (chapter id 87, subject Chemistry,
current class scope `class-12`).

| Order | YouTube ID | Duration | Reviewed title cue |
| ---: | --- | ---: | --- |
| 1 | `NW0wDF6acgQ` | 36.9 min | Jahn–Teller distortion, part 1; Coordination |
| 2 | `BJlj2EAGLw8` | 49.0 min | Jahn–Teller distortion, part 2; Coordination compounds |

### Candidate 2 — IOQC 2021–2022 Solutions

Proposed scope: Olympiad / Chemistry / advanced PYQ solutions.

Canonical chapter: `IOQC Solutions` (chapter id 295, subject Chemistry).

| Order | YouTube ID | Duration | Reviewed title cue |
| ---: | --- | ---: | --- |
| 1 | `lAwzadMpkSE` | 54.9 min | IOQC 2021–2022 part 1 solution |
| 2 | `0DopkpuIfC0` | 32.1 min | IOQC 2021–2022 part 2, problem 1 |
| 3 | `xnnuW1XaSEg` | 36.9 min | IOQC 2021–2022 part 2, problem 2 |

These are readiness candidates, not an import authorization. Before preparing
or executing production SQL, the owner should approve the exact grouping,
course titles, goal/class tags, and reuse of attribution decision
`1c06eb34-fbdc-4d3b-a239-39f256f889e8` for these upload-only sources.

## Explicit deferrals

- `BS7D7WAPwVg`, NMR Lecture 3, is a clear continuation of live course 239,
  whose first two NMR lectures are already present. It should not become a
  fragmented one-lesson course. A separate gate must decide whether a
  create-only video and membership may extend that existing course.
- Five uncovered INPhO uploads map broadly to `INPhO Solutions`, but the video
  titled only `INPhO 2020 Solutions` needs exact question-range review before
  ordering the series.
- Four PRMO/IOQM solution uploads are real academic content, but they need a
  truthful Math Olympiad qualifier chapter/course grouping instead of being
  folded into the existing `INMO Solutions` label.
- The nine RPS uploads need visual/manual chapter identification. Their titles
  (`RPS-M-*`, `RPS-C-*`, and `RPS-OC-*`) are not sufficient mapping evidence.
- Short-form `Revision in Reels` content should only be considered after the
  product has a distinct short-form/revision surface; it must not be mixed into
  full lecture courses.

## Next gated sequence

If the two-course candidate batch is approved later:

1. record a fresh PITR restore point and confirm all other production writers
   are paused;
2. re-enumerate the five YouTube IDs and metadata from the official API;
3. run a fresh anonymous collision/delta preflight for the first course only;
4. use a hash-reviewed, create-only, source-ID-null artifact with exact baseline
   and protected-fingerprint guards;
5. verify the exact course/video/membership delta and protected original-83
   fingerprint after the first course, then stop and report before the second;
6. repeat independently for the second course.
