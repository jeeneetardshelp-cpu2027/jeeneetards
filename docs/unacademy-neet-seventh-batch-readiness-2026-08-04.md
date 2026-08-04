# Unacademy NEET seventh-batch readiness — 4 August 2026

## Status and safety boundary

Production execution is complete for the three owner-approved create-only
imports under decision `cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`. Courses `402`,
`403`, and `404` were created one at a time after separate signed-in PITR
checks, quiet-window baselines, collision probes, and anonymous dry-runs. No
migration, restore, update, delete, or `release` push occurred. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue counts, source IDs, retained video IDs, taxonomy, teacher identities,
chapter/class scopes, and both JEE fingerprints.

The three-course batch contains 16 complete, numbered Biology lectures. Every
video was new to production, unique within the batch, duration-complete, and
embeddable. Exact playlist-specific teacher evidence is bound in all three
reviewed manifests.

## Fresh anonymous production snapshot

- catalogue: 382 playlists / 4,498 videos / 4,504 memberships / 247 chapters;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

This is discovery evidence, not a future write baseline. Every approved import
must start with a signed-in seven-day PITR check, fresh quiet-window counts,
source/video collision checks, a fresh anonymous dry-run, and immediate
protected-JEE verification.

## Production execution evidence

### Course 402 — Biodiversity and Conservation

- signed-in production PITR: active seven-day retention; latest restore point
  `04 Aug 2026, 17:52:26 IST`;
- exact preflight: 382 playlists / 4,498 videos / 4,504 memberships / 247
  chapters, with zero source or retained-video collision;
- anonymous mapped dry-run: 5 assignments, zero exclusions, capability v12,
  one `ok`, zero review, zero blocked;
- realized delta: +1 playlist / +5 videos / +5 memberships / +0 chapters,
  with zero reuse;
- postflight: the reviewed L5/L4 source reversal became natural L4/L5 course
  positions, every lesson maps to chapter 99, and `verify:course` passed 11/11
  checks (average lesson 52m38s).

### Course 403 — Cell Cycle and Cell Division

- signed-in production PITR: active seven-day retention; latest restore point
  `04 Aug 2026, 18:34:28 IST`;
- exact preflight: 383 playlists / 4,503 videos / 4,509 memberships / 247
  chapters, with zero source or retained-video collision;
- anonymous mapped dry-run: 7 assignments, zero exclusions, capability v12,
  one `ok`, zero review, zero blocked;
- realized delta: +1 playlist / +7 videos / +7 memberships / +0 chapters,
  with zero reuse;
- postflight: L1–L7 order is exact, every lesson maps to chapter 106, and
  `verify:course` passed 11/11 checks (average lesson 55m10s).

### Course 404 — Microbes in Human Welfare

- signed-in production PITR: active seven-day retention; latest restore point
  `04 Aug 2026, 18:36:29 IST`;
- exact preflight: 384 playlists / 4,510 videos / 4,516 memberships / 247
  chapters, with zero source or retained-video collision;
- anonymous mapped dry-run: 4 assignments, zero exclusions, capability v12,
  one `ok`, zero review, zero blocked;
- realized delta: +1 playlist / +4 videos / +4 memberships / +0 chapters,
  with zero reuse;
- postflight: L1–L4 order is exact, every lesson maps to chapter 115, and
  `verify:course` passed 11/11 checks (average lesson 55m52s).

Every new course has exactly the `neet` learning goal, the reviewed class tag,
Biology subject, Pradeep Singh legacy teacher label, and only embeddable
lessons. Final catalogue totals are 385 playlists / 4,514 videos / 4,520
memberships / 247 chapters. After every write the protected original JEE
boundary remained exactly 82 courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812`; rolling JEE remained 212 courses / 2,848
memberships / `9eea2b44f0b19c08cc0907c57e091342`.

The mapped v12 path records the reviewed evidence in the immutable manifests
and writes the legacy playlist teacher label. It does not create normalized
`playlist_teachers` links; all three courses therefore have zero normalized
faculty links, pending a separately reviewed faculty-registry gate.

## Proposed clean lecture courses

| Order | Course | Source playlist | Chapter/class | Lectures | Editorial handling | Attribution | Manifest SHA-256 |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | Biodiversity and Conservation — Unacademy NEET | `PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63` | 99 — Biodiversity and Conservation; class-12 | 5 | reorder source L5/L4 into natural L1–L5 lesson order | Pradeep Singh (teacher 33) | `7e246b59b15a6d667bca8567018d6e53e2cdfb71424c9a2b2bfd67f6fe462b14` |
| 2 | Cell Cycle and Cell Division — Unacademy NEET | `PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F` | 106 — Cell Cycle and Cell Division; class-11 | 7 | keep complete L1–L7 sequence | Pradeep Singh (teacher 33; source says `Pradeep Sir`) | `32a015c6c55bba3f2f256ebfd9cb321811370fb35128c65ab246a4f673cfe078` |
| 3 | Microbes in Human Welfare — Unacademy NEET | `PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw` | 115 — Microbes in Human Welfare; class-12 | 4 | keep complete L1–L4 sequence | Pradeep Singh (teacher 33) | `df09998311f2e220d01347d111a27e72026897b6f472d3f9182cf3ec82f4c622` |

The exact source titles, source positions, natural lesson numbers, video IDs,
durations, embedding state, taxonomy IDs, class scopes, teacher ID, collision
counts, and snapshot fingerprints are pinned in
`docs/reviews/unacademy-neet-seventh-candidate-batch-2026-08-04.json`, SHA-256
`bba2fed3d160261d9a34b7177665b1e3d2ba8f26e2e7410972cf74ae10cd3e20`.

## Editorial and attribution review

### Biodiversity and Conservation

The official playlist contains the complete numbered sequence, but YouTube
source rows 4 and 5 are L5 then L4. The manifest preserves both exact source
positions while setting natural lesson numbers 5 and 4, so students receive
L1–L5 in lecture order. Every title names Pradeep Singh. Average duration is
52m38s.

### Cell Cycle and Cell Division

All seven source rows form the uninterrupted L1–L7 sequence and every title
uses `Pradeep Sir`. The proposed playlist-specific binding is to existing
verified Pradeep Singh, teacher id 33; this abbreviation requires explicit
owner review. Average duration is 55m10s.

### Microbes in Human Welfare

All four source rows form the uninterrupted L1–L4 sequence and every title
names Pradeep Singh. Average duration is 55m52s.

All three chapters have reviewed canonical class rows matching their proposed
playlist class tags. No chapter or schema write is required.

## Explicit deferrals

- Photosynthesis contains an unrelated Biodiversity L3 row and two different
  rows labeled Photosynthesis L3; safe correction cannot be inferred from
  metadata alone.
- Human Reproduction still lacks Lecture 4.
- Neural Control and Coordination still lacks Lecture 3.
- Animal Kingdom still lacks Lecture 3.

Incomplete or contaminated sequences must not be presented as complete
courses without a separate content review.

## Realized additive delta

- playlists: +3;
- videos: +16;
- memberships: +16;
- chapters: +0;
- reused videos: 0.

The exact playlist-specific Pradeep Singh evidence is bound to decision
`cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`, including the reviewed `Pradeep Sir`
abbreviation. Every requested guard passed before and after all three
transactions. No `release` push occurred.

## Approval record

`Approve the reviewed Unacademy NEET seventh batch — Biodiversity and
Conservation, Cell Cycle and Cell Division, and Microbes in Human Welfare —
under decision cf45d7d5-43ef-4311-abd7-5297ec2ea3b6, including Pradeep Sir as
Pradeep Singh. Bind the exact playlist-specific teacher evidence, then import
create-only, one at a time, with a fresh PITR and quiet-window baseline check
plus anonymous dry-run before each, and protected JEE fingerprint verification
after each. Stop on reuse, drift, or any blocker; no release push.`
