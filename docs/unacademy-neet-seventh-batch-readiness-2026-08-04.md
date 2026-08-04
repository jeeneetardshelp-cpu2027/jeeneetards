# Unacademy NEET seventh-batch readiness — 4 August 2026

## Status and safety boundary

Read-only preparation is complete. No Supabase row was created or changed, no
migration or restore ran, and no `release` push occurred. The official YouTube
Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue counts, source IDs, retained video IDs, taxonomy, teacher identities,
chapter/class scopes, and both JEE fingerprints.

The proposed three-course batch contains 16 complete, numbered Biology
lectures. Every video is new to production, unique within the batch,
duration-complete, and embeddable. Exact playlist-specific teacher evidence is
not yet bound; production import remains blocked pending explicit owner review.

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

## Proposed clean lecture courses

| Order | Course | Source playlist | Chapter/class | Lectures | Editorial handling | Attribution | Manifest SHA-256 |
| ---: | --- | --- | --- | ---: | --- | --- | --- |
| 1 | Biodiversity and Conservation — Unacademy NEET | `PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63` | 99 — Biodiversity and Conservation; class-12 | 5 | reorder source L5/L4 into natural L1–L5 lesson order | Pradeep Singh (teacher 33) | `a980124726b9242075ce4f91d642943efb0814ce663ec3a8c4cad93ef139813b` |
| 2 | Cell Cycle and Cell Division — Unacademy NEET | `PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F` | 106 — Cell Cycle and Cell Division; class-11 | 7 | keep complete L1–L7 sequence | Pradeep Singh (teacher 33; source says `Pradeep Sir`) | `cf62f0ee5e90152038d13e09b8e9923b78fd4cde4a64909d559dbf17961702ee` |
| 3 | Microbes in Human Welfare — Unacademy NEET | `PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw` | 115 — Microbes in Human Welfare; class-12 | 4 | keep complete L1–L4 sequence | Pradeep Singh (teacher 33) | `8504035c22590941032b6993a54b58499a5f03b6bf7b9a40d3cf87ed4c4688b4` |

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

## Projected additive delta and execution gate

- playlists: +3;
- videos: +16;
- memberships: +16;
- chapters: +0;
- reused videos: 0.

If approved, bind exact playlist-specific Pradeep Singh evidence to decision
`cf45d7d5-43ef-4311-abd7-5297ec2ea3b6`, including the reviewed `Pradeep Sir`
abbreviation. Execute create-only, one course at a time, in the listed order.
Refresh PITR, counts, collisions, and the anonymous dry-run before each
transaction. Stop on reuse, drift, teacher/taxonomy mismatch, any new quality
finding, or protected fingerprint change. No `release` push.

## Required approval phrase

`Approve the reviewed Unacademy NEET seventh batch — Biodiversity and
Conservation, Cell Cycle and Cell Division, and Microbes in Human Welfare —
under decision cf45d7d5-43ef-4311-abd7-5297ec2ea3b6, including Pradeep Sir as
Pradeep Singh. Bind the exact playlist-specific teacher evidence, then import
create-only, one at a time, with a fresh PITR and quiet-window baseline check
plus anonymous dry-run before each, and protected JEE fingerprint verification
after each. Stop on reuse, drift, or any blocker; no release push.`
