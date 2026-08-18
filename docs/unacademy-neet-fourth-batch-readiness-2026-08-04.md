# Unacademy NEET fourth-batch readiness — 4 August 2026

## Status and safety boundary

Production execution is complete under owner decision
`0bd393bd-1ad4-4ed7-8f23-74b59dee5a23`. Preparation created no Supabase row;
the later approved execution created only the three reviewed courses and their
new video/membership rows. No migration, chapter creation, clone, or `release`
push was performed. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue, source-ID, video-ID, chapter-scope, and protected-JEE evidence.

The proposed continuation contains only three complete lecture sequences:
Human Health and Disease, Body Fluids and Circulation, and Mole Concept. Quiz
and practice rows are explicitly excluded. Human Reproduction, Neural Control
and Coordination, and Animal Kingdom remain deferred because their numbered
lecture sequences have unresolved gaps.

## Fresh anonymous production snapshot

- catalogue: 374 playlists / 4,430 videos / 4,436 memberships / 247 chapters;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

This is preparation evidence, not a write baseline. Every approved production
import must record a fresh PITR restore point, refresh the quiet-window counts,
and repeat its anonymous dry-run immediately before writing.

## Proposed lecture-only courses

| Order | Course | Source playlist | Chapter and class | Retained | Excluded | Attribution | Prepared manifest SHA-256 | Source snapshot SHA-256 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | Human Health and Disease — Unacademy NEET | `PLsgHooHkqhhOBJpGejuKlJjjyqLGSUgax` | 112 — Human Health and Disease; class-12 | 17 | 1 | Seep Pahuja | `8009aab3febb9864003631c8ec228e31ff8f91f81346c390a0948bcd2f0b67a5` | `0a9d74aa64cbf95e6d21d82fd4e7ad964828ba0f7f157963b4772b0c01ec2ff4` |
| 2 | Body Fluids and Circulation — Unacademy NEET | `PLsgHooHkqhhPqQIxg5ou5zcgC6_72mepm` | 104 — Body Fluids and Circulation; class-11 | 7 | 7 | Dr. Sachin Kapur | `90a85e8b13e76a6581e8dda5f3c0bd8c5891095d7ae84d12b7cfeecdf0e9dab1` | `74df70b349a6a2d2d02d9fc327a5a357f9a543af4b5ee174e6932272bd559a63` |
| 3 | Mole Concept — Unacademy NEET | `PLsgHooHkqhhPW2M3F7WjhzIUSjTFDJrek` | 54 — Mole Concept; class-11 | 9 | 3 | Ashwani Tyagi | `bf7fd69806cc83083b15df2c7d589932ebd33af75d589e7cab9a36d3ff6ea9fd` | `4a0b33694c2d66678b6271cf6c6b888e13d132e48a5e37a37e041041edcc3a7c` |

All 33 retained videos are currently embeddable and have known positive
durations. Average retained lecture durations are approximately 58, 58, and 59
minutes respectively. The channel-owned playlist titles supply the full names
Seep Pahuja, Dr. Sachin Kapur, and Ashwani Tyagi; retained titles consistently
name Seep Ma'am/Pahuja, Dr. Sachin Kapur, or Ashwani Tyagi. Ashwani Tyagi already
has verified teacher record 32; Seep Pahuja and Dr. Sachin Kapur do not yet have
matching teacher records. Faculty-registry creation/linking remains a separate
additive gate after content verification.

## Row-level editorial decisions

### Human Health and Disease

Keep lectures L1–L11 at source positions 1–11. The playlist places L12 at
source position 18; retain it as lesson 12, then retain source positions 12–16
as lessons L13–L17. Exclude source position 17, the Menti quiz. The reviewed
`lesson_number` sequence restores the natural lecture order without changing
the official source-position evidence.

### Body Fluids and Circulation

Keep lectures L1–L7 at source positions 1–7. Exclude source positions 8–9 as
chapter quizzes and positions 10–14 as broad Human Physiology mega quizzes.
Every retained row names Dr. Sachin Kapur.

### Mole Concept

The current official playlist contains 12 rows, not the 18 reported in the
initial 3 August discovery snapshot. The refreshed source is internally clean:
keep lectures L1–L9 at source positions 1–9 and exclude the three live quizzes
at positions 10–12. The refreshed 12-row snapshot and its hash above are the
only evidence proposed for a future write.

## Explicit deferrals

- Human Reproduction (`PLsgHooHkqhhNzLZWpX60ubt5MSUSlqto2`) is still missing
  Lecture 4; source position 4 is the unrelated `Phoenix 2.0` video.
- Neural Control and Coordination
  (`PLsgHooHkqhhPcPQexnd9rNG2l5h6AbZEl`) is still missing Lecture 3; source
  position 3 is the same unrelated `Phoenix 2.0` video.
- Animal Kingdom (`PLsgHooHkqhhOcUymC3AOhf_uSoh_IIvcw`) remains deferred for
  its previously recorded missing Lecture 3. An incomplete sequence must not be
  published as a complete course.

## Projected additive delta and execution gate

- playlists: +3;
- videos: +33;
- memberships: +33;
- chapters: +0;
- reused videos: 0.

The approved execution followed the table order. Exact playlist-specific
teacher evidence was bound to decision
`0bd393bd-1ad4-4ed7-8f23-74b59dee5a23`. Each course then received a refreshed
seven-day PITR check, stable quiet-window baseline, anonymous `ok` dry-run, and
one create-only transaction.

## Production execution — complete

| Order | Course ID | Latest PITR restore (IST) | Pre-write P/V/M/C | Result |
| ---: | ---: | --- | --- | --- |
| 1 | 394 | 4 Aug 2026 16:42:24 | 374 / 4,430 / 4,436 / 247 | +17 videos, +17 memberships, 0 reuse |
| 2 | 395 | 4 Aug 2026 16:52:25 | 375 / 4,447 / 4,453 / 247 | +7 videos, +7 memberships, 0 reuse |
| 3 | 396 | 4 Aug 2026 16:52:25 | 376 / 4,454 / 4,460 / 247 | +9 videos, +9 memberships, 0 reuse |

All three anonymous dry-runs reported one `ok` plan, zero review findings, zero
blockers, zero source collision, and zero retained-video reuse. Postflight
course verification passed 9/9 checks for every course: exact `neet` goal,
class, subject, single canonical chapter, ordered membership count, no JEE/NEET
bleed, and all retained videos embeddable.

Final totals are 377 playlists / 4,463 videos / 4,469 memberships / 247
chapters. The batch delta is exactly +3 / +33 / +33 / +0, with zero reuse. The
protected JEE boundary remained 82 courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812` after every write. Rolling JEE remained 212
courses / 2,848 memberships / fingerprint
`9eea2b44f0b19c08cc0907c57e091342`. No `release` push occurred.

## Approval record

`Approve the reviewed Unacademy NEET fourth batch — Human Health and Disease
(Seep Pahuja), Body Fluids and Circulation (Dr. Sachin Kapur), and Mole Concept
(Ashwani Tyagi) — under decision 0bd393bd-1ad4-4ed7-8f23-74b59dee5a23. Bind the
exact playlist-specific teacher evidence, then import create-only, one at a
time, with a fresh PITR/baseline check and anonymous dry-run before each, and
protected JEE fingerprint verification after each. Stop on reuse, drift, or any
blocker; no release push.`
