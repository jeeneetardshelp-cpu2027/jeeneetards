# Unacademy NEET channel discovery — 3 August 2026

## Scope and safety boundary

This was a read-only discovery pass over the official Unacademy NEET YouTube
channel, `@UnacademyNEET` (`UCdQwYksctqqiRwqp3PiJMWA`), using the official
YouTube Data API and anonymous production catalogue reads.

No Supabase write, chapter creation, import, migration, clone, `release` push,
or CI rerun occurred during discovery. The owner subsequently approved the
exact three-course sequential import under decision
`6579f542-da9b-499f-bd46-3aa796ea4f27`; later sections record that gated work.

## Channel snapshot

- YouTube reported 12,491 channel uploads, about 2.92 million subscribers, and
  about 770 million views at discovery time.
- The channel exposed 736 public playlists with 9,079 playlist memberships.
- The playlist catalogue is very broad: 543 titles contain `NEET`, with 176
  Biology-related, 127 Physics-related, and 150 Chemistry-related playlists.
- The channel also contains PYQs, quizzes, strategy, recap, marathon, and
  promotional material. Therefore neither all uploads nor all playlists are a
  safe import queue.

## Production comparison

The fresh anonymous production baseline was:

- 318 courses;
- 3,732 videos;
- 3,738 memberships;
- 242 chapters.

The protected original JEE slice remains exact at 83 courses / 1,307
memberships with fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0`. The separate
rolling JEE catalogue is 178 courses / 2,391 memberships with observed
fingerprint `0ed8376c5c5cea7d06b3beafbc59c45f`.

None of the channel's 736 public playlist IDs is currently stored as a
production course source ID. Production also has no institute/channel record
matching `Unacademy NEET`, `@UnacademyNEET`, or the official channel ID. This
does not mean all 12,491 uploads are missing curriculum lectures; it only means
the source channel has not yet been onboarded as a course source.

## Fifteen high-confidence deep-dive playlists

The first curriculum-focused scan selected 15 single-chapter playlists. Across
these candidates, every video is embeddable, every duration is known, none of
the video IDs is in production, and none is shared between the 15 candidates.

| Subject | Chapter | Videos | Average | Production reuse | Cross-candidate reuse |
| --- | --- | ---: | ---: | ---: | ---: |
| Physics | Rotational Motion | 23 | 47 min | 0 | 0 |
| Chemistry | Chemical Bonding and Molecular Structure | 23 | 56 min | 0 | 0 |
| Biology | Human Reproduction | 22 | 53 min | 0 | 0 |
| Biology | Animal Kingdom | 21 | 42 min | 0 | 0 |
| Biology | Morphology of Flowering Plants | 21 | 48 min | 0 | 0 |
| Biology | Human Health and Disease | 18 | 58 min | 0 | 0 |
| Biology | Evolution | 16 | 51 min | 0 | 0 |
| Physics | Current Electricity | 19 | 59 min | 0 | 0 |
| Chemistry | Electrochemistry | 16 | 57 min | 0 | 0 |
| Chemistry | Mole Concept | 18 | 56 min | 0 | 0 |
| Biology | Plant Kingdom | 17 | 50 min | 0 | 0 |
| Biology | Principles of Inheritance and Variation | 15 | 49 min | 0 | 0 |
| Biology | Neural Control and Coordination | 17 | 46 min | 0 | 0 |
| Biology | Body Fluids and Circulation | 14 | 55 min | 0 | 0 |
| Physics | Ray Optics and Optical Instruments | 16 | 47 min | 0 | 0 |

Mechanical cleanliness is not final editorial approval. Most of these official
playlists combine core lectures with quizzes, DPPs, PYQs, or quick recaps. The
student-facing lecture catalogue should keep those modes separate.

## Smallest clean first batch

Three playlists form the cleanest reviewed lecture-only batch:

| Course | Retained lectures | Dropped | Teacher evidence |
| --- | ---: | ---: | --- |
| Chemical Bonding — Unacademy NEET | 15 | 4 recaps + 4 quizzes | Official playlist title names Ashwani Tyagi; every retained title names Ashwani Sir |
| Evolution — Unacademy NEET | 15 | 1 DPP | Official playlist title and retained titles name Pradeep Singh |
| Principles of Inheritance and Variation — Unacademy NEET | 14 | 1 Menti quiz | Official playlist title and retained titles name Pradeep Singh |

All 44 retained videos were unique, new to production, embeddable, duration
complete, and mapped to existing chapters with reviewed class scopes at the
write gate. The three proposed course titles had no exact production collision.
Other separately completed imports advanced the live catalogue after discovery;
the quiet-window baseline used for this batch was therefore refreshed before
the first write.

The exact source positions, video IDs, durations, title evidence, dropped rows,
canonical chapters, and baselines are pinned in
`docs/reviews/unacademy-neet-first-candidate-batch-2026-08-03.json`, SHA-256
`e52912308e05a5da3047e65cbf08a97bf3d6eb32e2732c6710462cdcfca24f82`.

## Anonymous dry-run result

All three fresh production dry-runs passed independently immediately before
their guarded writes:

- Chemical Bonding: `ok`, 15 assignments, 8 exclusions, zero findings;
- Evolution: `ok`, 15 assignments, 1 exclusion, zero findings;
- Principles of Inheritance and Variation: `ok`, 14 assignments, 1 exclusion,
  zero findings.

Each dry-run used the anonymous key and performed no Supabase write. The exact
manifest and source-snapshot hashes are pinned in the review JSON. The owner
approved the three-course grouping and the Ashwani Tyagi / Pradeep Singh
attribution under decision `6579f542-da9b-499f-bd46-3aa796ea4f27`.

## Production completion

The signed-in PITR page showed active seven-day retention and latest restore
availability at `03 Aug 2026, 18:18:37 UTC+05:30`. The exact quiet-window
baseline was 329 courses / 3,864 videos / 3,870 memberships / 245 chapters / 92
chapter-class rows. Source-course and retained-video collisions were both zero.

The three create-only imports completed one at a time:

| Course ID | Course | Added videos | Added memberships | Reused videos | Chapter |
| ---: | --- | ---: | ---: | ---: | --- |
| 341 | Chemical Bonding | 15 | 15 | 0 | 86 — Chemical Bonding and Molecular Structure |
| 342 | Evolution | 15 | 15 | 0 | 110 — Evolution |
| 343 | Principles of Inheritance and Variation | 14 | 14 | 0 | 122 — Principles of Inheritance and Variation |

Final verification returned 332 courses / 3,908 videos / 3,914 memberships /
245 chapters / 92 chapter-class rows. All 44 lessons match the reviewed order,
course metadata, NEET goal, class scope, teacher display attribution, and
canonical chapter assignment. No retained video is linked to another course.
All three public course pages rendered their reviewed lesson count and first
lesson through YouTube's official embedded player.
The protected original JEE slice remains exactly 83 courses / 1,307 memberships
with fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0`; rolling JEE remains 186
courses / 2,490 memberships / `5ddd338d726ba28d3afad543b57e0e85`.

## Explicit deferrals

- Human Reproduction contains a generic `Phoenix 2.0` row at source position 4;
  it needs visual/content review before deciding whether it is the missing
  lecture 4 or unrelated material.
- Human Health and Disease places lecture 12 after lecture 17, so a future
  manifest must use reviewed natural lecture order rather than raw playlist
  order.
- Mole Concept contains two rows that appear to belong to broader basic or
  organic chemistry topics and needs row-level review.
- Rotational Motion, Current Electricity, Electrochemistry, and several Biology
  playlists are coherent after trimming, but should follow only after the first
  batch proves the source and attribution workflow.
- Broad complete-subject and crash-course playlists remain deferred because
  they require per-video chapter mapping rather than single-chapter assignment.

## Next gated sequence

The remaining Unacademy NEET candidates are still deferred. A later batch must
repeat the same row-level review, fresh PITR/baseline evidence, anonymous
dry-run, zero-reuse guard, one-course transaction order, and protected-JEE
verification. This completed three-course approval does not authorize importing
the other channel playlists.
