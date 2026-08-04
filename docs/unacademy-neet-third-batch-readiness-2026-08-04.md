# Unacademy NEET third-batch readiness — 4 August 2026

## Status and safety boundary

Read-only preparation and owner evidence approval are complete. This pass used
the official YouTube Data API against `@UnacademyNEET`
(`UCdQwYksctqqiRwqp3PiJMWA`) and anonymous production catalogue reads. It did
not run a production import or dry-run, create a chapter or teacher, apply a
migration, create a clone, push `release`, or rerun CI.

The owner approved decision ID `a6ed2229-85bd-4f4a-afea-fd7f3a166199` for the
exact three playlists and teacher evidence below. Each manifest now carries a
playlist-specific reviewed-evidence block covering every retained video.

## Fresh anonymous production snapshot

Captured at 4 August 2026 15:26 IST:

- catalogue: 370 playlists / 4,377 videos / 4,383 memberships / 247 chapters;
- chapter-class scopes: 92;
- proposed source-playlist collisions: 0;
- proposed retained-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- protected original JEE: 83 courses / 1,307 memberships / fingerprint
  `c742fabf93ff8dd33d6ecd5eb4793db0`.

This is discovery evidence only. Course `66` and its three Communication
Systems lessons were deliberately removed after this snapshot. On 4 August
2026 the owner therefore rebaselined the protected JEE boundary to 82 courses,
1,304 memberships, fingerprint `30eee4a4a6842e5beeb7c97083d7f812`.
Every write must take a fresh quiet-window baseline and PITR restore point
immediately before the course.

## Proposed lecture-only courses

| Order | Course | Source playlist | Chapter and class | Retained | Excluded | Attribution | Prepared manifest SHA-256 | Source snapshot SHA-256 |
| ---: | --- | --- | --- | ---: | ---: | --- | --- | --- |
| 1 | Plant Morphology — Unacademy NEET | `PLsgHooHkqhhOkppPbQFJ1cbTT_IRK2zY9` | 116 — Morphology of Flowering Plants, class-11 | 18 | 3 quizzes | Pradeep Singh | `cc977352bb977d04a26f18bb3d27f9eaba996a190929ab3b75c9607c7f930841` | `dc50dbbee0b7d509733329e3ceb485b1467a705e5d0958c4c7f14cb05a933383` |
| 2 | Plant Kingdom — Unacademy NEET | `PLsgHooHkqhhNrWNVOeHEpvWwoNIE4yD7s` | 121 — Plant Kingdom, class-11 | 11 | 6 quizzes | Pradeep Singh | `3ba7d3b374180d12be172f851c408677cd1a9c1b1ceaab8b0bb7c1f7238e5031` | `8fec2685bd22e62ce624faba14e80351b1ca5d630cc03fa87c55509badb0f0cd` |
| 3 | Ray Optics — Unacademy NEET | `PLsgHooHkqhhOk8KTfwoET_2kSfZ1TcYoV` | 20 — Ray Optics and Optical Instruments, class-12 | 10 | 1 PYQ + 1 revision + 4 quizzes | Mahendra Singh | `63e4dc0a09a3fd1111c64c56a20b5f145b231c4d92e608093fe0a9c47a7599a6` | `c00a9b21af5147ebcfe65464c814f10762d4cd50e338ec972d1093d9d545c1b2` |

All 39 retained videos are currently embeddable and have known positive
durations. Their total retained duration is 117,219 seconds (32 hours 33
minutes). The official channel-owned playlist titles name Pradeep Singh or
Mahendra Singh, and every retained video title names the same teacher as
`Pradeep Sir` / `Pradeep Singh` or `Mahendra Sir` / `Mahendra Singh Sir`.

The named teachers already have verified registry records from earlier exact
playlist decisions. This proposal does not reuse those decisions: the new owner
decision must bind these three source playlists independently.

## Row-level editorial decisions

### Plant Morphology

Keep numbered lectures L1–L15 at source positions 1–15 and L16–L18 at source
positions 19–21. Exclude the three Menti quizzes at source positions 16–18.
The rules-only drafter proposed `Plant Kingdom` for every row because of the
shared word “Plant”; all 18 retained rows were manually corrected to the
canonical chapter `Morphology of Flowering Plants`.

### Plant Kingdom

Keep lectures L1–L10 at source positions 1–10 and L11 at source position 13.
Exclude source positions 11–12 and 14–17 because they are Menti/mega-Menti quiz
sessions. Source order is preserved for all retained lectures.

### Ray Optics

Keep Ray Optics lectures L1–L8 at source positions 1–8, then Prism L1–L2 at
source positions 10–11. Exclude source position 9 (PYQ practice), position 12
(quick revision), and positions 13–16 (live quizzes). All retained rows map to
`Ray Optics and Optical Instruments`.

## Explicit deferral: Animal Kingdom

Playlist `PLsgHooHkqhhOcUymC3AOhf_uSoh_IIvcw` is not in this batch. Its source
order jumps from Lecture 2 to Lecture 4 because source position 3 is the
unrelated video `Phoenix 2.0: Biology Most Important Video for NEET 2025`.
An official-channel search did not find the missing Sachin Sir Lecture 3. The
course is therefore deferred rather than publishing an incomplete series or
mixing a different teacher's lecture into it.

## Projected additive delta

- playlists: +3;
- videos: +39;
- memberships: +39;
- chapters: +0;
- reused videos: 0.

The proposed execution order is Plant Morphology, Plant Kingdom, then Ray
Optics. Each approved course needs its teacher-evidence block bound to the
decision ID, a fresh anonymous production dry-run, its own create-only
transaction, and immediate verification of the owner-approved protected JEE
fingerprint. Stop on source/video reuse, baseline drift, chapter/class mismatch,
or any new blocker. No `release` push.

## Approval record

`Approve the reviewed Unacademy NEET third batch — Plant Morphology and Plant Kingdom (Pradeep Singh), and Ray Optics (Mahendra Singh) — under decision a6ed2229-85bd-4f4a-afea-fd7f3a166199. Bind the exact playlist-specific teacher evidence, then import create-only, one at a time, with a fresh PITR/baseline check and anonymous dry-run before each, and protected original-83 JEE fingerprint verification after each. Stop on reuse, drift, or any blocker; no release push.`

The owner supplied this approval and separately approved the protected-boundary
rebaseline to `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812` after the
intentional Communication Systems removal.
