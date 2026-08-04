# Unacademy NEET fifth-batch readiness — 4 August 2026

## Status and safety boundary

Production execution is complete under owner decision
`461233dd-54d1-413f-9625-2ffe5f164226`. Preparation created no Supabase row;
the later approved execution created only the three reviewed courses and their
new video/membership rows. No migration, chapter creation, restore, clone, or
`release` push was performed. The official
YouTube Data API was refreshed against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`), and production was queried anonymously for
catalogue counts, source IDs, video IDs, chapter/class scopes, and both JEE
fingerprints.

This review selects three complete, lecture-only sequences from the channel's
736 public playlists. At preparation time, all 18 retained videos were new to
production, unique across the proposed batch, duration-complete, and
embeddable. The approved manifests now contain the exact playlist-specific
`teacher_evidence` used by the production importer.

## Fresh anonymous production snapshot

- catalogue: 377 playlists / 4,463 videos / 4,469 memberships / 247 chapters;
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

| Order | Course | Source playlist | Chapter/class | Lectures | Attribution | Manifest SHA-256 |
| ---: | --- | --- | --- | ---: | --- | --- |
| 1 | Ecosystem — Unacademy NEET | `PLsgHooHkqhhNu-Uw9RzbSyF1wsdL0Q25z` | 109 — Ecosystem; class-12 | 6 | Pradeep Singh (teacher 33) | `84a1eb1ad9775b08ac05051dba64b6f9afadae068b949f975a0e7c6d12df3389` |
| 2 | Gravitation — Unacademy NEET | `PLsgHooHkqhhN0mEZWnzPfkn8UcmdYg-Mx` | 81 — Gravitation; class-11 | 5 | Mahendra Singh (teacher 34) | `10bf003796e3d15a806fbf71b1b5e24622785153be17e59f62b5337d36a81cec` |
| 3 | Wave Optics — Unacademy NEET | `PLsgHooHkqhhMil-qxm3tGjv6Q7uJ1s1WI` | 16 — Wave Optics; class-12 | 7 | Anu Gupta (teacher 35) | `88e09b7d35f6cabcf98661ea8bd253b5aa00409ff20786fa793f558e1b72585c` |

The exact source titles, positions, video IDs, durations, embedding state,
teacher IDs, taxonomy IDs, collision counts, and snapshot fingerprints are
pinned in
`docs/reviews/unacademy-neet-fifth-candidate-batch-2026-08-04.json`, SHA-256
`bbc753073dc1e65a574cdf5805b700645725bc6042fd777ef0b87979c89a2204`.

## Editorial and attribution review

### Ecosystem

Keep all six rows in source order as lessons L1–L6. The official channel-owned
playlist and every retained title name Pradeep Singh. The existing verified
teacher is id 33. Chapter 109 is scoped to class-12 by the reviewed CBSE
2026–27 Biology source.

### Gravitation

Keep all five rows in source order as lessons L1–L5. The official playlist and
every retained title use the consistent abbreviated label `Mahendra S.`. The
proposed binding is to the already verified Mahendra Singh, teacher id 34,
whose Unacademy NEET attribution was reviewed in the earlier Rotational Motion
batch. Because the present source uses an abbreviation, this exact
playlist-to-person binding must be explicitly included in the new owner
decision. Chapter 81 is scoped to class-11 by the reviewed CBSE 2026–27 Physics
source.

### Wave Optics

Keep all seven rows in source order as lessons L1–L7. The official
channel-owned playlist and every retained title name Anu Gupta. The existing
verified teacher is id 35. Chapter 16 is scoped to class-12 by the reviewed
CBSE 2026–27 Physics source.

None of the three sources contains a quiz, recap, practice row, or numbering
gap. Average lecture durations are approximately 58, 66, and 61 minutes.

## Explicit deferrals

- Human Reproduction still lacks Lecture 4.
- Neural Control and Coordination still lacks Lecture 3.
- Animal Kingdom still lacks Lecture 3.
- Hydrogen is coherent only after separating its three NCERT-question
  sessions; prepare it as a later reviewed lecture/practice split.
- Modern Physics is coherent only after excluding its final practice session;
  prepare it as a later reviewed lecture/practice split.

Incomplete numbered sequences must not be presented as complete courses, and
practice content must not be silently mixed into the lecture catalogue.

## Additive delta and execution gate

- playlists: +3;
- videos: +18;
- memberships: +18;
- chapters: +0;
- reused videos: 0.

The approved execution followed the listed order. Exact playlist-specific
teacher evidence was bound to decision
`461233dd-54d1-413f-9625-2ffe5f164226`, including the owner-reviewed
`Mahendra S.` abbreviation for verified teacher Mahendra Singh. Each course
then received a refreshed seven-day PITR check, exact quiet-window counts,
source/video collision checks, an anonymous `ok` dry-run, and one create-only
transaction.

## Production execution — complete

| Order | Course ID | Latest PITR restore (IST) | Pre-write P/V/M/C | Result |
| ---: | ---: | --- | --- | --- |
| 1 | 397 | 4 Aug 2026 17:08:25 | 377 / 4,463 / 4,469 / 247 | +6 videos, +6 memberships, 0 reuse |
| 2 | 398 | 4 Aug 2026 17:08:25 | 378 / 4,469 / 4,475 / 247 | +5 videos, +5 memberships, 0 reuse |
| 3 | 399 | 4 Aug 2026 17:20:26 | 379 / 4,474 / 4,480 / 247 | +7 videos, +7 memberships, 0 reuse |

All three anonymous dry-runs reported one `ok` plan, zero review findings, and
zero blockers. Every pre-write probe found zero source/video collision. Each
postflight course verification passed 10/10 checks: exact `neet` goal and
class, correct subject and single canonical chapter, no JEE/NEET bleed, all
videos embeddable, and rolling JEE still exactly 212 courses.

Final totals are 380 playlists / 4,481 videos / 4,487 memberships / 247
chapters. The batch delta is exactly +3 / +18 / +18 / +0, with zero reuse. The
protected JEE boundary remained 82 courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812` after every write. Rolling JEE remained 212
courses / 2,848 memberships / fingerprint
`9eea2b44f0b19c08cc0907c57e091342`. No restore, clone, migration, or
update/delete occurred. No `release` push occurred.

## Approval record

`Approve the reviewed Unacademy NEET fifth batch — Ecosystem (Pradeep Singh),
Gravitation (Mahendra Singh), and Wave Optics (Anu Gupta) — under decision
461233dd-54d1-413f-9625-2ffe5f164226. Bind the exact playlist-specific teacher
evidence, including Mahendra S. as the reviewed abbreviation for verified
Mahendra Singh, then import create-only, one at a time, with a fresh PITR and
quiet-window baseline check plus anonymous dry-run before each, and protected
JEE fingerprint verification after each. Stop on reuse, drift, or any blocker;
no release push.`
