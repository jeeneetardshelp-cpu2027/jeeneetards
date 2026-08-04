# Unacademy NEET fourth-batch readiness — 4 August 2026

## Status and safety boundary

Read-only preparation is complete. No Supabase write, migration, chapter
creation, clone, `release` push, or content import was performed. The official
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
| 1 | Human Health and Disease — Unacademy NEET | `PLsgHooHkqhhOBJpGejuKlJjjyqLGSUgax` | 112 — Human Health and Disease; class-12 | 17 | 1 | Seep Pahuja | `09e5b060b6f06091d7e402a24796321b40b074abb5c2538e758207206c2bb5a6` | `0a9d74aa64cbf95e6d21d82fd4e7ad964828ba0f7f157963b4772b0c01ec2ff4` |
| 2 | Body Fluids and Circulation — Unacademy NEET | `PLsgHooHkqhhPqQIxg5ou5zcgC6_72mepm` | 104 — Body Fluids and Circulation; class-11 | 7 | 7 | Dr. Sachin Kapur | `666bf311e7ae0df49046271152a9fc7f6c4549d8bce2f13a7a736010beafd191` | `74df70b349a6a2d2d02d9fc327a5a357f9a543af4b5ee174e6932272bd559a63` |
| 3 | Mole Concept — Unacademy NEET | `PLsgHooHkqhhPW2M3F7WjhzIUSjTFDJrek` | 54 — Mole Concept; class-11 | 9 | 3 | Ashwani Tyagi | `742012790ca870caa5a94c172e0877b4b29df7cc79989b80e5cb9d913422ea35` | `4a0b33694c2d66678b6271cf6c6b888e13d132e48a5e37a37e041041edcc3a7c` |

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

If approved, execute one course at a time in the table order. Bind the exact
playlist-specific teacher evidence to decision
`0bd393bd-1ad4-4ed7-8f23-74b59dee5a23`, then take a fresh PITR/baseline and
anonymous dry-run before each create-only transaction. Verify the protected JEE
boundary immediately after each import. Stop on source/video reuse, baseline
drift, chapter/class mismatch, any new quality blocker, or any protected
fingerprint change. No `release` push.

## Required approval phrase

`Approve the reviewed Unacademy NEET fourth batch — Human Health and Disease
(Seep Pahuja), Body Fluids and Circulation (Dr. Sachin Kapur), and Mole Concept
(Ashwani Tyagi) — under decision 0bd393bd-1ad4-4ed7-8f23-74b59dee5a23. Bind the
exact playlist-specific teacher evidence, then import create-only, one at a
time, with a fresh PITR/baseline check and anonymous dry-run before each, and
protected JEE fingerprint verification after each. Stop on reuse, drift, or any
blocker; no release push.`
