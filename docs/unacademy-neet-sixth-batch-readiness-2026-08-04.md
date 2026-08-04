# Unacademy NEET sixth-batch readiness — 4 August 2026

## Status and safety boundary

Read-only preparation is complete. No Supabase row was created or changed, no
migration or restore ran, and no `release` push occurred. The official YouTube
Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue counts, source IDs, retained video IDs, taxonomy, teacher identities,
chapter/class scopes, and both JEE fingerprints.

This review resolves the two mixed sources deferred from the fifth batch by
keeping only their numbered lecture sequences. All 17 retained videos are new
to production, unique across the proposed batch, duration-complete, and
embeddable. Teacher evidence remains unbound until explicit owner approval.

## Fresh anonymous production snapshot

- catalogue: 380 playlists / 4,481 videos / 4,487 memberships / 247 chapters;
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

## Proposed lecture-only courses

| Order | Course | Source playlist | Chapter/class | Lectures | Excluded | Attribution | Manifest SHA-256 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- |
| 1 | Hydrogen — Unacademy NEET | `PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA` | 44 — Hydrogen; class-11 | 6 | 3 question sessions | Anoop Vashishtha (teacher 36; source says `Anoop V.`) | `2f18a04cb837fa73b8683c9a8bb88a34d66ea3c4fe0da7e301855fd936c1c405` |
| 2 | Modern Physics — Unacademy NEET | `PLsgHooHkqhhMQWo55rneDci-gmYynS9Za` | 83 — Modern Physics; class-12 | 11 | 1 practice session | Anu Gupta (teacher 35) | `9efc26ea9a25dbd933a7ddf2f9860b8737ab19a983488a6e8ac023323aa17deb` |

The exact source titles, positions, retained/excluded video IDs, durations,
embedding state, taxonomy IDs, class-scope evidence, teacher IDs, collision
counts, and snapshot fingerprints are pinned in
`docs/reviews/unacademy-neet-sixth-candidate-batch-2026-08-04.json`, SHA-256
`13a1fa8516cba60d4d9d9bbdb1ca1dd467c6d91fcdafb8e8e669e05830e97f26`.

## Editorial and attribution review

### Hydrogen

Keep source rows 1–6 in order as lectures L1–L6. Exclude rows 7–9 because they
are explicitly NCERT-question or NCERT Exemplar sessions; they belong in a
future practice surface, not a lecture-only course. The official channel-owned
playlist and all source titles use the abbreviated label `Anoop V.`. The
proposed binding is to the existing verified Anoop Vashishtha, teacher id 36,
and therefore requires an explicit playlist-specific owner decision.

Chapter 44 currently has no reviewed `chapter_class_levels` row. That is not an
import blocker: the deployed scope predicate deliberately uses the playlist's
class tag for chapters without a canonical row. The source explicitly says
Class 11, so this proposal uses `class-11` without adding or changing reference
data.

### Modern Physics

Keep source rows 1–11 in order as lectures L1–L11. Exclude row 12 because it is
explicitly a practice session. The official channel-owned playlist and every
retained title name Anu Gupta; the existing verified teacher is id 35. Chapter
83 has the reviewed canonical class-12 scope.

The retained lecture averages are approximately 53 minutes for Hydrogen and
66 minutes for Modern Physics. Neither numbered lecture sequence has a gap.

## Explicit deferrals

- Human Reproduction still lacks Lecture 4.
- Neural Control and Coordination still lacks Lecture 3.
- Animal Kingdom still lacks Lecture 3.

Incomplete numbered sequences must not be presented as complete courses, and
question/practice content must not be silently mixed into the lecture catalogue.

## Projected additive delta and execution gate

- playlists: +2;
- videos: +17;
- memberships: +17;
- chapters: +0;
- reused videos: 0.

If approved, bind exact playlist-specific teacher evidence to decision
`1d0ea7b9-8cac-4f3b-968d-82b4307f264a`, including the reviewed `Anoop V.` to
Anoop Vashishtha identity, then execute one course at a time in the listed
order. Refresh PITR, counts, collisions, and the anonymous dry-run before each
transaction. Stop on reuse, drift, teacher/taxonomy mismatch, any new quality
finding, or protected fingerprint change. No `release` push.

## Required approval phrase

`Approve the reviewed Unacademy NEET sixth batch — Hydrogen (Anoop Vashishtha,
source label Anoop V.) and Modern Physics (Anu Gupta) — under decision
1d0ea7b9-8cac-4f3b-968d-82b4307f264a. Bind the exact playlist-specific teacher
evidence, then import create-only, one at a time, with a fresh PITR and
quiet-window baseline check plus anonymous dry-run before each, and protected
JEE fingerprint verification after each. Stop on reuse, drift, or any blocker;
no release push.`
