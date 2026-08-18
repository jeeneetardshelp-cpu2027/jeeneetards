# Unacademy NEET nineteenth-batch readiness - 7 August 2026

## Status

**CONTENT IMPORT COMPLETED IN PRODUCTION** under owner decision
`e6539ac8-512b-4e76-8bd1-774c1a3c4bdc`. The three courses were imported
create-only, one at a time. No schema migration, faculty-link write,
quality-review write, deployment, or `release` push occurred.

## Proposed owner decision

Decision ID: `e6539ac8-512b-4e76-8bd1-774c1a3c4bdc`

Approve the reviewed Unacademy NEET nineteenth batch - The d and f Block
Elements (Anoop Vashishtha), Amines (Anoop Vashishtha), and Thermochemistry
(Ashwani Tyagi) - under decision `e6539ac8-512b-4e76-8bd1-774c1a3c4bdc`,
exactly as recorded in this readiness document. Bind the exact
playlist-specific teacher evidence, then import create-only, one course at a
time in the listed order, with a fresh PITR and quiet-window baseline check
plus anonymous dry-run before each, and protected original-82 JEE fingerprint
verification after each. Exclude the recorded Thermochemistry quiz. Stop on
source mutation, reuse, drift, or any blocker; no `release` push.

This decision covers only the three official playlists and eight retained
video IDs below. Faculty-link and quality-review transitions remain separate
later gates.

## Read-only evidence

The official channel was refreshed through the YouTube Data API. It still
exposes 736 public playlists. The three selected sources are coherent,
chapter-specific sequences:

- D/F Block is an L1-L2 sequence with no supplementary rows;
- Amines is an uninterrupted L1-L3 sequence;
- Thermochemistry is an L1-L3 sequence followed by one quiz, which is excluded.

All eight retained videos have positive durations, are embeddable, preserve
official source order, and are absent from every reviewed local manifest.

The fresh production read-only preflight at
`2026-08-07T12:19:45.547690Z` confirmed:

- 413 playlists / 4,723 videos / 4,729 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 168 playlist-teacher links / 39 quality
  reviews;
- all three existing Chemistry chapters are present: Thermochemistry (29), The
  d and f Block Elements (45), and Amines (48);
- verified normalized teachers Ashwani Tyagi (32) and Anoop Vashishtha (36)
  are present;
- source collisions: 0;
- retained-video collisions: 0;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The PITR page was checked read-only and displayed active seven-day retention,
with restore availability from `01 Aug 2026, 00:02:34 IST` through
`07 Aug 2026, 17:17:54 IST`. A fresh PITR and exact baseline must be recorded
again immediately before every separately approved production write.

## Anonymous dry-run evidence

All three exact reviewed manifests passed independent anonymous production
dry-runs after the preflight. Each reported **1 ok / 0 review / 0 blocked** and
made no Supabase writes:

- D/F Block: 2 published, 2 usable, 2 assignments, 0 exclusions;
- Amines: 3 published, 3 usable, 3 assignments, 0 exclusions;
- Thermochemistry: 4 published, 4 usable, 3 assignments, 1 quiz exclusion.

The importer resolved every target chapter, accepted the exact reviewed
teacher-evidence decision token, found no existing source course, and found no
retained-video reuse. These dry-runs are readiness evidence only; every course
must be dry-run again immediately before any separately approved write.

## Reviewed candidates

| Order | Course | Official playlist | Chapter / class | Teacher | Retained | Excluded |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | D and F Block Elements | `PLsgHooHkqhhNKfP8VeJvlmz5qO-RgNqzQ` | 45 - The d and f Block Elements / class-12 | Anoop Vashishtha (36) | 2 | 0 |
| 2 | Amines | `PLsgHooHkqhhNPE4mZf-DoUlsANEdkP0ik` | 48 - Amines / class-12 | Anoop Vashishtha (36) | 3 | 0 |
| 3 | Thermochemistry | `PLsgHooHkqhhMSvDuuO5dL3-iba7hfWB6F` | 29 - Thermochemistry / class-11 | Ashwani Tyagi (32) | 3 | 1 quiz |

Completed create-only delta: **+3 playlists / +8 videos / +8 memberships /
+0 chapters**, with zero reuse. Final totals after all three clean imports:
**416 / 4,731 / 4,737 / 263**.

## Production execution evidence

PITR was freshly confirmed active with seven-day retention immediately before
the batch. The Supabase dashboard advertised restore availability from
`01 Aug 2026, 00:02:34 IST` through `07 Aug 2026, 19:01:58 IST`.

The fresh live preflight at `2026-08-07T13:33:08.938552Z` reproduced the
approved boundary exactly:

- 413 playlists / 4,723 videos / 4,729 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 168 playlist-teacher links / 39 quality
  reviews;
- zero source-playlist collisions, zero retained-video collisions, and zero
  collision for the excluded quiz;
- all three expected chapters and both normalized verified teachers present;
  and
- protected original JEE unchanged at 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`.

Each exact manifest then passed a fresh anonymous production dry-run before its
independent create-only write:

| Order | Course ID | Dry-run | Created videos | Reused | Pre-write totals | Post-write totals |
| ---: | ---: | --- | ---: | ---: | --- | --- |
| 1 | 433 | 1 ok / 0 review / 0 blocked; 2 assignments | 2 (`4814`-`4815`) | 0 | 413 / 4,723 / 4,729 | 414 / 4,725 / 4,731 at `13:34:02Z` |
| 2 | 434 | 1 ok / 0 review / 0 blocked; 3 assignments | 3 (`4816`-`4818`) | 0 | 414 / 4,725 / 4,731 | 415 / 4,728 / 4,734 at `13:34:48Z` |
| 3 | 435 | 1 ok / 0 review / 0 blocked; 3 assignments + 1 quiz exclusion | 3 (`4819`-`4821`) | 0 | 415 / 4,728 / 4,734 | 416 / 4,731 / 4,737 at `13:35:35Z` |

The decisive read-only postflight at `2026-08-07T13:37:52.223523Z` and final
boundary check at `2026-08-07T13:38:16.994248Z` confirmed:

- all three approved source playlists exist exactly once;
- all eight retained YouTube video IDs exist exactly once and the excluded
  quiz `cv6mAJ4wd3Q` remains absent;
- membership positions preserve official source order: 1-2, 1-3, and 1-3;
- course 433 maps both lessons to chapter 45, course 434 maps all three lessons
  to chapter 48, and course 435 maps all three lessons to chapter 29;
- all eight videos have positive durations and remain embeddable;
- each course carries only the `neet` learning goal and its reviewed
  `class-12`, `class-12`, or `class-11` scope;
- the protected original JEE boundary remains exactly 82 / 1,304 /
  `30eee4a4a6842e5beeb7c97083d7f812`; and
- rolling JEE remains exactly 212 / 2,848 /
  `9eea2b44f0b19c08cc0907c57e091342`.

Anonymous public browse and player verification passed for all three courses:

- `https://www.jeeneetard.com/course/433/chapter/45` - 2 lessons; the official
  YouTube iframes loaded for first lesson `0BwLckcTdUA` and final lesson
  `3ZlCJ1keY6s`;
- `https://www.jeeneetard.com/course/434/chapter/48` - 3 lessons; the official
  YouTube iframes loaded for first lesson `MQ-3hQrodgU` and final lesson
  `5YTW3Cn198A`; and
- `https://www.jeeneetard.com/course/435/chapter/29` - 3 lessons; the official
  YouTube iframes loaded for first lesson `xpTqTM1fk1c` and final lesson
  `7_lzRbhRJYA`.

The canonical anonymous NEET browse filters for Class 12 Chemistry / The d and
f Block Elements, Class 12 Chemistry / Amines, and Class 11 Chemistry /
Thermochemistry each showed the new course. No empty or error state appeared.

The normalized `playlist_teachers` rows and quality-review transitions remain
absent for courses 433-435 by design. They are separate guarded gates and were
not authorized by this content-import decision.

## Immutable evidence

Source-snapshot SHA-256 values:

- D/F Block: `d3008abb6a01734f64e4f88a3db238c3eb1ff64d435b8c5df1d6a5ac02858e0c`;
- Amines: `68dfee31cef6498318536690e93cbf40a453cdebf69c64fd01157597fe8f98dd`;
- Thermochemistry: `2772c0e61d19e0723ef351364b684f924b42823f5effc89be718407b619abb22`.

File SHA-256 values:

- candidate review: `8d2a04ee6f4a6fee2a4f79ce69f4e22ca73f0a98b1c92c63b7d5f923e9523e2f`;
- D/F Block manifest: `cbdc34897cf7a56e9c27a7c66210b4304ef0ad1da77ac92e7861c8b12e68539d`;
- Amines manifest: `c2844302eb7c25713df9b6fc01acb22631537d163673baab2669f9b20fe8f9b4`;
- Thermochemistry manifest: `44b286b6596302af5410da6087844430e237f631817208a46d2f7ca2916164c8`.

Any playlist mutation invalidates its source hash and requires a fresh review.
Each manifest must pass a fresh anonymous production dry-run before its write.
A collision, count shortfall, missing teacher evidence, unresolved chapter,
blocked embed, or fingerprint mismatch defers that course.

## Explicit deferrals

- Hydrocarbons is missing Lecture 4 and remains incomplete.
- Carboxylic Acids covers only part of the broader Carboxylic Acids and
  Derivatives chapter and remains deferred for scope review.
- Mineral Nutrition and Transport in Plants have no current production chapter
  rows; no reference-data write is proposed.
- Electromagnetic Waves has clean videos but requires a separate identity review
  for the teacher named only as `Samip`.

No schema migration, faculty-link write, quality-review write, deployment, or
`release` push occurred during this production content batch.
