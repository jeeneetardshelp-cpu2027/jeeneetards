# Unacademy NEET sixth-batch readiness — 4 August 2026

## Status and safety boundary

Production execution is complete for the two owner-approved create-only
imports under decision `1d0ea7b9-8cac-4f3b-968d-82b4307f264a`. Courses `400`
and `401` were created one at a time after separate signed-in PITR checks,
quiet-window baselines, collision probes, and anonymous dry-runs. No migration,
restore, update, delete, or `release` push occurred. The official YouTube Data
API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue counts, source IDs, retained video IDs, taxonomy, teacher identities,
chapter/class scopes, and both JEE fingerprints.

This review resolves the two mixed sources deferred from the fifth batch by
keeping only their numbered lecture sequences. All 17 retained videos were new
to production, unique across the batch, duration-complete, and embeddable. The
exact playlist-specific teacher evidence is bound in both reviewed manifests.

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

## Production execution evidence

### Course 400 — Hydrogen

- signed-in production PITR: active seven-day retention; latest restore point
  `04 Aug 2026, 17:28:26 IST`;
- exact preflight: 380 playlists / 4,481 videos / 4,487 memberships / 247
  chapters, with zero source or retained-video collision;
- anonymous mapped dry-run: 6 assignments, 3 explicit question-session
  exclusions, capability v12, one `ok`, zero review, zero blocked;
- realized delta: +1 playlist / +6 videos / +6 memberships / +0 chapters,
  with zero reuse;
- postflight: all six positions match the reviewed source order, every lesson
  maps to chapter 44 `Hydrogen`, every lesson is embeddable, and the course has
  exactly goal `neet`, class `11th`, and teacher label `Anoop Vashishtha`;
- `verify:course` passed 11/11 checks (average lesson 53m24s).

### Course 401 — Modern Physics

- signed-in production PITR: active seven-day retention; latest restore point
  `04 Aug 2026, 17:46:26 IST`;
- exact preflight: 381 playlists / 4,487 videos / 4,493 memberships / 247
  chapters, with zero source or retained-video collision;
- anonymous mapped dry-run: 11 assignments, 1 explicit practice exclusion,
  capability v12, one `ok`, zero review, zero blocked;
- realized delta: +1 playlist / +11 videos / +11 memberships / +0 chapters,
  with zero reuse;
- postflight: all 11 positions match the reviewed source order, every lesson
  maps to chapter 83 `Modern Physics`, every lesson is embeddable, and the
  course has exactly goal `neet`, class `12th`, and teacher label `Anu Gupta`;
- `verify:course` passed 11/11 checks (average lesson 66m21s).

Final catalogue totals are 382 playlists / 4,498 videos / 4,504 memberships /
247 chapters. After each write the protected original JEE boundary remained
exactly 82 courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812`; rolling JEE remained 212 courses / 2,848
memberships / `9eea2b44f0b19c08cc0907c57e091342`.

The mapped v12 path records the reviewed evidence in the immutable manifests
and writes the legacy playlist teacher label. It does not create normalized
`playlist_teachers` links; both new courses therefore have zero normalized
faculty links, pending a separately reviewed faculty-registry gate.

## Proposed lecture-only courses

| Order | Course | Source playlist | Chapter/class | Lectures | Excluded | Attribution | Manifest SHA-256 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- |
| 1 | Hydrogen — Unacademy NEET | `PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA` | 44 — Hydrogen; class-11 | 6 | 3 question sessions | Anoop Vashishtha (teacher 36; source says `Anoop V.`) | `38da2bc6041a2bed8ad0b3d5aaafeaf785c07a92d9f533529a441c4ba13df446` |
| 2 | Modern Physics — Unacademy NEET | `PLsgHooHkqhhMQWo55rneDci-gmYynS9Za` | 83 — Modern Physics; class-12 | 11 | 1 practice session | Anu Gupta (teacher 35) | `9958cc9ba7b733a879ee1e3639c71e1ed65fc292ffd4285e9d83ed11d408780e` |

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

## Realized additive delta

- playlists: +2;
- videos: +17;
- memberships: +17;
- chapters: +0;
- reused videos: 0.

The exact playlist-specific evidence is bound to decision
`1d0ea7b9-8cac-4f3b-968d-82b4307f264a`, including the reviewed `Anoop V.` to
Anoop Vashishtha identity. Every requested guard passed before and after both
transactions. No `release` push occurred.

## Approval record

`Approve the reviewed Unacademy NEET sixth batch — Hydrogen (Anoop Vashishtha,
source label Anoop V.) and Modern Physics (Anu Gupta) — under decision
1d0ea7b9-8cac-4f3b-968d-82b4307f264a. Bind the exact playlist-specific teacher
evidence, then import create-only, one at a time, with a fresh PITR and
quiet-window baseline check plus anonymous dry-run before each, and protected
JEE fingerprint verification after each. Stop on reuse, drift, or any blocker;
no release push.`
