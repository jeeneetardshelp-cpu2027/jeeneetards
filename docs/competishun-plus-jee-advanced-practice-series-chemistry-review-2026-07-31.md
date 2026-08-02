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

## Owner approval and guarded artifact

The owner approved the reviewed five-video mapping and the create-only,
source-ID-null split under attribution decision
`1c06eb34-fbdc-4d3b-a239-39f256f889e8`.

Fresh production preflight immediately before artifact preparation:

- catalogue: 291 playlists / 3,083 videos / 3,089 memberships / 241 chapters;
- source owner: exactly course 248, Mathematics;
- target Chemistry title: absent;
- selected video rows: 0;
- all five reviewed chapter references: exact;
- protected original JEE: 83 courses / 1,350 memberships /
  `6829fcb6eae22479db7b82b7b3da654d`;
- rolling JEE: 166 courses / 1,889 memberships /
  `7b1e9be740b8f68f092ead95f19120ec`.

Guarded artifact:

- `docs/sql/competishun_jee_advanced_practice_chemistry_2026-07-31.sql`
- SHA-256: `f9e279dc34fc34f5c8eddb360ebcd4cbc6023cc61acbb61a3501cc29d76ff075`
- insert-only transaction; zero `UPDATE`, `DELETE`, `DROP`, `ALTER`, or
  `TRUNCATE` statements;
- exact baseline, source owner, title, chapter, video-reuse, post-total, null
  source-ID, and protected-fingerprint guards.

## Production result

The committed artifact was copied back from the authenticated production SQL
editor and matched the recorded SHA-256 exactly before execution. The guarded
transaction completed with `Success. No rows returned`.

- course created: `302`, `JEE Advanced Practice Series — Chemistry`;
- source ID: null;
- delta: +1 course / +5 videos / +5 memberships / +0 chapters;
- all five videos: `embedding_status = allowed` and exactly one membership;
- final catalogue: 292 playlists / 3,088 videos / 3,094 memberships /
  241 chapters;
- sole real source owner remains Mathematics course 248;
- protected original JEE: 83 courses / 1,350 memberships /
  `6829fcb6eae22479db7b82b7b3da654d`;
- rolling JEE: 167 courses / 1,894 memberships /
  `69e0b86fe613faf73f005b95dec38397`.

No update, delete, schema migration, video reuse, chapter creation, or
`release` push was performed.
