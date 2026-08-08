# Unacademy NEET twentieth-batch readiness - 8 August 2026

## Status

**PREPARED ONLY - OWNER APPROVAL REQUIRED.** This pass used the official
YouTube Data API and read-only production queries. No production write, schema
migration, faculty-link write, quality-review write, deployment, or `release`
push occurred.

## Proposed owner decision

Decision ID: `8de024c6-7317-4901-a91e-5006a5efcd7e`

Approve the reviewed Unacademy NEET twentieth batch - Metallurgy (Anoop
Vashishtha), The s-Block Elements (Anoop Vashishtha), and Semiconductor
Electronics (Indrajeet Singh Sangtani) - under decision
`8de024c6-7317-4901-a91e-5006a5efcd7e`, exactly as recorded in this readiness
document. Accept official Unacademy educator evidence resolving the source
label `Indrajeet Sir` to **Indrajeet Singh Sangtani** for the exact
Semiconductors playlist. Import create-only, one course at a time in the listed
order, with a fresh PITR and quiet-window baseline check plus anonymous dry-run
before each, and protected original-82 JEE fingerprint verification after each.
Exclude the two recorded S-Block NCERT-question practice sessions. Stop on
source mutation, reuse, drift, or any blocker; no `release` push.

This decision would cover only the three official playlists and nine retained
video IDs below. Normalized faculty creation/linking and quality-review
transitions remain separate later gates.

## Read-only source evidence

The official channel refresh still exposes 736 public playlists. The selected
sources are coherent chapter sequences:

- Metallurgy is a complete L1-L3 sequence;
- S-Block is a complete L1-L3 concept sequence followed by two NCERT-question
  practice sessions, which are excluded from this lecture-only course; and
- Semiconductors is an uninterrupted L1-L3 sequence covering fundamentals,
  diodes, and transistor theory.

All nine retained videos have positive durations, are embeddable, preserve
official source order, and have zero production reuse. The two excluded
S-Block practice videos also have zero production reuse and remain outside the
manifest assignments.

The official playlist and every retained Semiconductors title name
`Indrajeet Sir`. An official Unacademy educator page identifies this NEET
Physics educator as **Indrajeet Singh Sangtani**. That external identity
resolution is proposed for owner review; it has not been written to production.

## Production read-only preflight

The fresh production snapshot at `2026-08-08T07:03:47.173Z` returned:

- 416 playlists / 4,731 videos / 4,737 memberships / 263 chapters;
- 92 chapter-class rows / 34 teachers / 171 playlist-teacher links / 42
  quality reviews;
- required chapters present: Metallurgy (55), The s-Block Elements (46), and
  Semiconductor Electronics (17);
- verified Anoop Vashishtha teacher (36) present; no normalized Indrajeet Singh
  Sangtani teacher record present;
- source collisions: 0;
- retained-video collisions: 0;
- excluded-video collisions: 0;
- protected original JEE: 82 courses / 1,304 memberships /
  `30eee4a4a6842e5beeb7c97083d7f812`; and
- rolling JEE: 212 courses / 2,848 memberships /
  `9eea2b44f0b19c08cc0907c57e091342`.

This preparation did not require a PITR write-gate check. A fresh signed-in
PITR check and exact quiet-window baseline are mandatory immediately before
any separately approved import.

## Anonymous dry-run evidence

All three exact reviewed manifests passed independent anonymous production
dry-runs during preparation. Each returned **1 ok / 0 review / 0 blocked** and
performed no Supabase write:

- Metallurgy: 3 published, 3 usable, 3 assignments, 0 exclusions;
- S-Block: 5 published, 5 usable, 3 assignments, 2 NCERT-question practice
  exclusions; and
- Semiconductors: 3 published, 3 usable, 3 assignments, 0 exclusions.

These are readiness checks only. The importer must refresh YouTube and repeat
the anonymous dry-run immediately before each separately approved write.

## Reviewed candidates

| Order | Course | Official playlist | Chapter / class | Teacher | Retained | Excluded |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | Metallurgy | `PLsgHooHkqhhMzQKgCZ2vyX2bh3ejb1eIQ` | 55 - Metallurgy / class-12 | Anoop Vashishtha (36) | 3 | 0 |
| 2 | The s-Block Elements | `PLsgHooHkqhhMRv85qlHflI5j8SoA8yZ0n` | 46 - The s-Block Elements / class-11 | Anoop Vashishtha (36) | 3 | 2 NCERT-question practice |
| 3 | Semiconductor Electronics | `PLsgHooHkqhhNhMBc1PNiIav8Kv_O7NPIT` | 17 - Semiconductor Electronics / class-12 | Indrajeet Singh Sangtani (owner review) | 3 | 0 |

Expected create-only delta if all three later pass their fresh write gates:
**+3 playlists / +9 videos / +9 memberships / +0 chapters**, with zero reuse.

## Immutable evidence

Source-snapshot SHA-256 values:

- Metallurgy: `50f4f4c5731cb423e0830b600ceb6dad4568b8b650000b122e5cb70aba846aed`;
- S-Block: `c474ede883cfe5ddac403a97f1d8c5e998a4eb0cd3e6f5164d61d26c62ef21da`;
- Semiconductors: `4ec4677ad6ba42efae0d0924fc3e130bd4e0c61888912e045e250ec815c51522`.

File SHA-256 values:

- candidate review: `7ae7dc00fa0d28282e34d6db3eb4f1516ecec3dcdb6833c942b35b4bfb306e51`;
- Metallurgy manifest: `d7dc7e486c25a19dcb96a93106af8346092b6726507197b8e5a88f9bc4ab0569`;
- S-Block manifest: `66cf23d039943031074911311dff4b0db442110fff76ce202af972b57e8bcf24`;
- Semiconductors manifest: `f9fce11fa5685dae106910cdd42dcc64c6f1f5f3b0795a8be769bbcca8081193`.

Any playlist mutation invalidates its source hash and requires a fresh review.
Each manifest must pass a fresh anonymous production dry-run immediately
before its write. A collision, count shortfall, missing teacher evidence,
unresolved chapter, blocked embed, or fingerprint mismatch defers that course.

## Explicit deferrals

- Kinetic Theory of Gases is mechanically clean but does not identify its
  teacher in the playlist or video titles.
- Electromagnetic Waves remains mechanically clean but names its teacher only
  as `Samip`.
- Plant Growth and Development is mechanically clean but the playlist and
  video titles do not identify the educator.
- Hydrocarbons remains incomplete because Lecture 4 is absent.
- Mineral Nutrition and Transport in Plants still lack production chapter
  records; no reference-data write is proposed.

No production write, normalized faculty mutation, quality-review transition,
deployment, or `release` push is authorized by this preparation package.
