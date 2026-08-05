# Unacademy NEET ninth-batch candidate review - 5 August 2026

## Status and safety boundary

Read-only candidate review is complete. No manifest currently claims owner
approval, and no production dry-run or write is authorized by this document.
No Supabase row, schema object, migration, restore, clone, deployment, or
`release` branch was changed.

The official YouTube Data API refreshed all 736 playlists owned by
`@UnacademyNEET` (`UCdQwYksctqqiRwqp3PiJMWA`). Anonymous production reads
excluded every stored source playlist and video ID. A chapter-title pass found
117 mechanically plausible unused playlists; row-level review narrowed the
next batch to three complete lecture sequences with verified existing teachers.

## Fresh read-only baseline

Captured at `2026-08-05 15:16:22 +05:30`:

- catalogue: 388 playlists / 4,539 videos / 4,545 memberships / 247 chapters;
- proposed source-playlist collisions: 0;
- retained production-video collisions: 0;
- cross-candidate retained-video collisions: 0;
- all 27 retained videos are embeddable with known positive durations;
- all three canonical chapters have an explicit `class-12` scope;
- teachers Pradeep Singh (33), Mahendra Singh (34), and Anoop Vashishtha (36)
  are present and verified;
- protected JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

This is discovery evidence, not a write baseline. Any later approved import
must repeat the PITR, quiet-window baseline, source/video collision, anonymous
dry-run, and protected-JEE checks immediately before each course.

## Proposed ninth batch

| Order | Course | Playlist | Chapter | Teacher | Keep | Drop |
| ---: | --- | --- | --- | --- | ---: | ---: |
| 1 | Sexual Reproduction in Flowering Plants - Unacademy NEET | `PLsgHooHkqhhNIEDFQnuZzTGUq9Nl2BANa` | 125 - Sexual Reproduction in Flowering Plants | Pradeep Singh (33) | 12 | 3 quizzes |
| 2 | Alternating Current - Unacademy NEET | `PLsgHooHkqhhNaF6JnP38ojTYkuAZ5YFvd` | 14 - Alternating Current | Mahendra Singh (34) | 6 | 1 quiz with a different instructor |
| 3 | Chemical Kinetics - Unacademy NEET | `PLsgHooHkqhhNWeJHJ0f68rVPOY81tbaJa` | 35 - Chemical Kinetics | Anoop Vashishtha (36) | 9 | 4 chapter quizzes + 1 broad mega quiz |

### Sexual Reproduction in Flowering Plants

Keep the complete L1-L12 sequence. Preserve natural lecture numbering while
retaining source positions 1-10, 12, and 15. Drop source positions 11, 13, and
14 because they are Menti or mega-quiz sessions. The channel-owned playlist
title names Pradeep Singh, and every retained lecture names Pradeep Sir.

### Alternating Current

Keep the complete L1-L6 sequence at source positions 1-6. Drop source position
7 because it is a quiz taught by Indrajeet Sir, not part of Mahendra Singh's
lecture sequence. The playlist title names Mahendra Singh and every retained
lecture names Mahendra Sir.

### Chemical Kinetics

Keep the complete L1-L9 sequence at source positions 1-9. Drop source positions
10-13 as quizzes and source position 14 as a broad Physical Chemistry mega
quiz. The playlist title names Anoop Vashishtha and every retained lecture names
Anoop Sir.

## Exact evidence package

- candidate review:
  `docs/reviews/unacademy-neet-ninth-candidate-batch-2026-08-05.json`;
- candidate-review SHA-256:
  `b5d6212f49c5fd3cd499e4f02ebe1b0cda53e3ab41d7ead5a2a2818060d1805b`;
- proposed owner decision ID:
  `b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6`;
- projected additive delta after a later approved execution: +3 playlists / +27
  videos / +27 memberships / +0 chapters, with zero reuse.

The review JSON pins every retained/excluded source position, video ID, title,
duration, embedding state, taxonomy ID, class scope, teacher ID, source
snapshot hash, and collision result. Import manifests are deliberately not
created yet: doing so would falsely claim that the proposed owner evidence
decision has already been approved.

## Explicit deferrals

- Breathing and Exchange of Gases has a clean L1-L6 sequence after quiz removal,
  but Dr. Sachin Kapur does not yet have a normalized production teacher record.
- Biomolecules remains incomplete because Lecture 3 is replaced by an unrelated
  Phoenix 2.0 row.
- Respiration in Plants mixes two separately numbered incomplete sequences.
- Coordination Compounds is missing Lecture 11; Ionic Equilibrium is missing
  Lectures 5 and 6.
- The older Human Reproduction, Neural Control and Coordination, and Animal
  Kingdom playlists still contain the previously recorded sequence gaps.

## Required owner approval

`Approve the reviewed Unacademy NEET ninth batch - Sexual Reproduction in
Flowering Plants (Pradeep Singh), Alternating Current (Mahendra Singh), and
Chemical Kinetics (Anoop Vashishtha) - under decision
b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6. Bind the exact playlist-specific teacher
evidence, prepare the lecture-only manifests, then import create-only, one at a
time, with a fresh PITR and quiet-window baseline plus anonymous dry-run before
each, and protected JEE fingerprint verification after each. Stop on reuse,
drift, or any blocker; no release push.`
