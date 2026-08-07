# Unacademy NEET eighteenth-batch readiness - 7 August 2026

## Status

**CONTENT IMPORT COMPLETED IN PRODUCTION** under owner decision
`8f19ac66-a1b4-4304-8a6f-468131f63732`. The three courses were imported
create-only, one at a time. No schema migration, faculty-link write,
quality-review write, deployment, or `release` push occurred.

## Proposed owner decision

Decision ID: `8f19ac66-a1b4-4304-8a6f-468131f63732`

Approve the reviewed Unacademy NEET eighteenth batch - Photosynthesis in Higher
Plants (Pradeep Singh), Ionic Equilibrium (Ashwani Tyagi), and Excretory Products
and Their Elimination (Dr. Sachin Kapur) - under decision
`8f19ac66-a1b4-4304-8a6f-468131f63732`, exactly as recorded in this readiness
document. Bind the exact playlist-specific teacher evidence, then import
create-only, one course at a time in the listed order, with a fresh PITR and
quiet-window baseline check plus anonymous dry-run before each, and protected
original-82 JEE fingerprint verification after each. Stop on source mutation,
reuse, drift, or any blocker; no `release` push.

This decision would cover only the three exact official playlists and retained
video IDs below. Faculty-link and quality-review transitions remain separate
later gates.

## Why these replacements are safe

The earlier deferred sources were not forced through. The official Unacademy
NEET channel was refreshed through the YouTube Data API and cleaner alternate
playlists were selected instead:

- the Photosynthesis source is a coherent L1-L3 lecture sequence followed by
  one quiz, which is excluded;
- Ionic Equilibrium is an uninterrupted L1-L8 lecture sequence with nothing to
  trim;
- Excretory Products is a coherent Lecture 1-7 sequence followed by three
  chapter quizzes and two broad Human Physiology mega quizzes, all excluded.

All 18 retained videos have positive durations, are embeddable, remain in
official YouTube source order, and are absent from production. The three source
playlist IDs are also absent from production. Every target chapter and verified
normalized teacher already exists, so no reference-data or teacher creation is
required.

## Fresh read-only production snapshot

Evidence captured at `2026-08-07T09:35:45.408388Z`:

- 410 playlists / 4,705 videos / 4,711 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 165 playlist-teacher links / 36 quality
  reviews;
- source collisions: 0;
- retained-video collisions: 0;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The PITR page was checked read-only and displayed active seven-day retention
with a latest restore point of `2026-08-07 14:21:49 IST`. A fresh PITR and exact
baseline must still be recorded again immediately before each separately
approved production write.

## Reviewed candidates

| Order | Course | Official playlist | Chapter / class | Teacher | Retained | Excluded |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | Photosynthesis | `PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-` | 119 - Photosynthesis in Higher Plants / class-11 | Pradeep Singh (33) | 3 | 1 quiz |
| 2 | Ionic Equilibrium | `PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z` | 38 - Ionic Equilibrium / class-11 | Ashwani Tyagi (32) | 8 | 0 |
| 3 | Excretory Products and Their Elimination | `PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5` | 111 - Excretory Products and Their Elimination / class-11 | Dr. Sachin Kapur (38) | 7 | 5 quizzes |

Completed create-only delta: **+3 playlists / +18 videos / +18 memberships /
+0 chapters**, with zero reuse. Final totals after all three clean imports:
**413 / 4,723 / 4,729 / 263**.

## Production execution evidence

PITR was confirmed active with seven-day retention immediately before the
batch. The Supabase dashboard advertised restore availability from
`01 Aug 2026, 00:02:34 IST` through `07 Aug 2026, 15:01:50 IST`.

The initial live preflight at `2026-08-07T10:00:47.200708Z` reproduced the
approved baseline exactly:

- 410 playlists / 4,705 videos / 4,711 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 165 playlist-teacher links / 36 quality
  reviews;
- zero source-playlist collisions and zero retained-video collisions;
- all three expected chapters and normalized verified teachers present; and
- protected original JEE unchanged at 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

Each source then passed a fresh anonymous production dry-run and an independent
quiet-window baseline immediately before its write:

| Order | Course ID | Dry-run | Created videos | Reused | Pre-write baseline | Post-write baseline |
| ---: | ---: | --- | ---: | ---: | --- | --- |
| 1 | 430 | 1 ok / 0 review / 0 blocked; 3 assignments + 1 quiz exclusion | 3 (`4796`-`4798`) | 0 | 410 / 4,705 / 4,711 at `10:02:07Z` | 411 / 4,708 / 4,714 at `10:02:32Z` |
| 2 | 431 | 1 ok / 0 review / 0 blocked; 8 assignments + 0 exclusions | 8 (`4799`-`4806`) | 0 | 411 / 4,708 / 4,714 at `10:03:08Z` | 412 / 4,716 / 4,722 at `10:03:32Z` |
| 3 | 432 | 1 ok / 0 review / 0 blocked; 7 assignments + 5 quiz exclusions | 7 (`4807`-`4813`) | 0 | 412 / 4,716 / 4,722 at `10:04:03Z` | 413 / 4,723 / 4,729 at `10:04:33Z` |

The decisive final postflight at `2026-08-07T10:04:33.957866Z` confirmed:

- all three approved source playlists exist exactly once;
- all 18 retained YouTube video IDs exist exactly once and no excluded quiz was
  imported;
- membership positions preserve the reviewed official source order;
- course 430 maps all three lessons to chapter 119, course 431 maps all eight
  lessons to chapter 38, and course 432 maps all seven lessons to chapter 111;
- all 18 videos have positive duration metadata and remain embeddable;
- every course and video carries only the `neet` learning goal and `class-11`
  scope;
- the protected original JEE boundary remains exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`; and
- rolling JEE remains exactly 212 / 2,848 /
  `9eea2b44f0b19c08cc0907c57e091342`.

Anonymous public-page verification passed for:

- `https://www.jeeneetard.com/course/430/chapter/119` - 3 lessons, with the
  official YouTube iframe for first lesson `5jycoZ1eYKE`;
- `https://www.jeeneetard.com/course/431/chapter/38` - 8 lessons; and
- `https://www.jeeneetard.com/course/432/chapter/111` - 7 lessons, with the
  final lesson showing `Lesson 7 of 7` and the official YouTube iframe for
  `gTlmFUV9mhA`.

The normalized `playlist_teachers` rows and quality-review transitions remain
absent for courses 430-432 by design. They are separate guarded gates and were
not authorized by this content-import decision.

## Immutable evidence

Source-snapshot SHA-256 values:

- Photosynthesis: `aa41f25276c318e363079fdb08d48394978b0f1199adda053efa450419045f15`;
- Ionic Equilibrium: `a0a46096f1b155b4dc31e577566588e663ec81eb8b1ad7d1ccb1dcdce611b032`;
- Excretory Products: `1a5f55f3102537d4ea004f59487f41a1280fba1b29edf75fc8db5b3649d66a5e`.

File SHA-256 values:

- candidate review: `4c05794b175b7180d2daaebf6a8b3f3e3832fdf1bad26841120a7de22377b994`;
- Photosynthesis manifest: `d6fa43ed57a911eb7d5dae4a01d4fb29f318af76a00d28f70b89ea801e37c615`;
- Ionic Equilibrium manifest: `efd359dffd698fde8bd293e6892bf4af2412f3c086723d2e119896ba6d4e0487`;
- Excretory Products manifest: `b976a8f658f3e3fd028c8c20a599bd685af769fe067cc64dddea713fd3534fd8`.

Any official playlist mutation invalidates its source hash and requires a fresh
review. Each manifest must be dry-run anonymously against production before its
write; a collision, count shortfall, missing teacher evidence, unresolved
chapter, blocked embed, or fingerprint mismatch defers that course.

## Explicit deferrals

- The earlier Live Daily 2.0 Photosynthesis source still has Biodiversity
  contamination and duplicate-L3 ambiguity. It remains excluded.
- Aldehydes and Ketones is mechanically clean but covers only part of the
  broader Organic Compounds Containing Oxygen chapter and remains deferred for
  scope review.
- Organisms and Populations remains incomplete, starting at Lecture 4.
- The older Ionic Equilibrium and Excretory sources retain their recorded
  blockers; only the exact alternate playlists above are proposed.
- General Principles and Processes of Isolation of Elements still has no clean
  exact-title replacement.

No schema migration, faculty-link write, quality-review write, deployment, or
`release` push occurred during this production content batch.
