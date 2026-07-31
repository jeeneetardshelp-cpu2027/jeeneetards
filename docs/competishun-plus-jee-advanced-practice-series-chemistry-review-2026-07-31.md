# Competishun+ JEE Advanced Practice Series Chemistry review — 2026-07-31

## Scope

Read-only follow-up to the completed Rank Boosters split. No production write
was performed in this gate.

- Channel: Competishun+ (`UC6ieIswHA9WInRsa2r88hRw`)
- Playlist: `PLQsNiHo64JI92nFYMSfOhGrq7bct9haT3`
- Title: `JEE Advanced Practice Series`
- Existing Mathematics split: course `248`, source positions 1–5
- Proposed Chemistry split: source positions 6–10
- Attribution decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`
- Proposed tags: JEE / Chemistry / classes 11th, 12th, Dropper / practice /
  hinglish / advanced / Dropper

## Channel coverage triage

The official channel currently exposes 78 playlists. A video-level comparison
against the 3,083 live catalogue video IDs found 62 playlists fully covered and
16 with at least one missing source row.

The immediately preceding unresolved sources were not suitable lecture imports:

- `JEE 2027` and `JEE 2028` contain guidance/promotional videos.
- `Revision in Reels` contains 17 videos of only 12–52 seconds; they are Shorts,
  not full lectures.
- the `2021` archive contains 22 rank testimonials.
- the `2022` archive contains 342 videos, all under three minutes.
- the `2023` archive contains 245 videos under three minutes and two longer rank
  testimonials.
- `Ranker's Practice Series` has three mixed-subject videos whose titles and
  descriptions contain no reliable chapter cues; it remains deferred rather
  than guessed.

The five remaining Chemistry videos in `JEE Advanced Practice Series` are the
next clean, embeddable lecture set with usable subject/chapter evidence.

## Reviewed Chemistry mapping

| Source position | Video | Duration | Chapter | Evidence |
|---:|---|---:|---|---|
| 6 | `g-Fa0TIitRc` | 747 s | Redox Reactions | Title explicitly says redox titration. |
| 7 | `oWxR8SdYllY` | 647 s | Organic Compounds Containing Oxygen | Title and thumbnail explicitly say carbonyl compounds. |
| 8 | `L4dnuL2EAfY` | 552 s | Organic Reaction Mechanisms | Title/thumbnail say reactions of pi bonds; ORM is the precise existing reaction-focused chapter. |
| 9 | `25WiaWXrh_A` | 852 s | Mole Concept | Title explicitly says mole concept, titration, and equivalent concept. |
| 10 | `1yIPYj0vEdk` | 829 s | Electrochemistry | Title says potentiometric titration; the thumbnail shows electrode potentials and the Nernst equation. |

All five videos are public, embeddable, absent from production, and map to
existing Chemistry chapters. No chapter creation or video reuse is proposed.

Reviewed manifest:
`docs/manifests/competishun-plus-jee-advanced-practice-series-chemistry-reviewed.json`

## Dry-run result and split constraint

The normal anonymous production dry-run completed with no writes and reported:

- `0 ok`
- `1 review`
- `0 blocked`
- reason: the source playlist already exists

That result is expected: course `248` already owns the real YouTube playlist ID
for the Mathematics half. The Chemistry half therefore cannot be imported by
claiming that source ID again. If approved, it needs the established guarded
split convention used for Rank Boosters:

- create one Chemistry course with `youtube_playlist_id = null`;
- insert only the five reviewed, currently absent videos;
- preserve positions 6–10 as evidence while assigning contiguous lesson order
  1–5 in the new course;
- abort on any video reuse, baseline drift, or protected fingerprint mismatch;
- verify the protected original-83 fingerprint
  `6829fcb6eae22479db7b82b7b3da654d` after the transaction.

## Next gate

Owner review is required for the five mappings and the source-ID-null split.
After approval: take a fresh production preflight, prepare/hash the guarded
create-only SQL artifact, execute it once, verify exact deltas and both JEE
fingerprints, then stop.
