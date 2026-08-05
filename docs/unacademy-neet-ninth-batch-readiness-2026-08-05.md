# Unacademy NEET ninth-batch production record - 5 August 2026

## Outcome and safety boundary

The owner-approved three-course batch under decision
`b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6` completed successfully, one at a time.
The exact playlist-specific teacher evidence was bound in three immutable
lecture-only manifests before writing. They became production courses `408`,
`409`, and `410`, with 27 new videos and memberships, zero reuse, and zero new
chapters. No existing course was updated or deleted. No schema change, restore,
clone, deployment, or `release` push occurred.

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

## Guarded production execution

| Order | Course | PITR checkpoint (IST) | Exact preflight | Dry-run | Delta | Verification |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `408` Sexual Reproduction in Flowering Plants | 05 Aug 2026 15:31:30 | 388 / 4,539 / 4,545 / 247; protected JEE exact | 12 mapped, 3 excluded; 1 ok / 0 review / 0 blocked | +1 / +12 / +12 / +0; 0 reused | 11/11 checks; chapter 125; avg 54m11s |
| 2 | `409` Alternating Current | 05 Aug 2026 15:35:30 | 389 / 4,551 / 4,557 / 247; protected JEE exact | 6 mapped, 1 excluded; 1 ok / 0 review / 0 blocked | +1 / +6 / +6 / +0; 0 reused | 11/11 checks; chapter 14; avg 56m11s |
| 3 | `410` Chemical Kinetics | 05 Aug 2026 15:37:30 | 390 / 4,557 / 4,563 / 247; protected JEE exact | 9 mapped, 5 excluded; 1 ok / 0 review / 0 blocked | +1 / +9 / +9 / +0; 0 reused | 11/11 checks; chapter 35; avg 58m49s |

The signed-in production dashboard showed active seven-day PITR at every gate.
Each anonymous dry-run reported exact source mapping, v12 capability, no
existing playlist, and no write-blocking finding before its corresponding
create-only import.

## Final production verification

- final catalogue: 391 playlists / 4,566 videos / 4,572 memberships / 247 chapters;
- exact batch delta: +3 playlists / +27 videos / +27 memberships / +0 chapters;
- all 27 batch membership video IDs are unique; importer reuse count was zero
  for every course;
- courses `408`, `409`, and `410` carry exactly the `neet` goal, class `12th`,
  and their reviewed Biology, Physics, and Chemistry subjects;
- every retained video is embeddable and mapped to the single reviewed chapter;
- protected JEE after every write: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`;
- rolling JEE after every write: 212 courses / 2,848 memberships / fingerprint
  `9eea2b44f0b19c08cc0907c57e091342`.

The importer writes the reviewed legacy teacher label but does not create
normalized `playlist_teachers` rows or approve quality reviews. Courses
`408`-`410` therefore await separate, hash-reviewed faculty-link and quality
review gates.

## Approved evidence package

- candidate review:
  `docs/reviews/unacademy-neet-ninth-candidate-batch-2026-08-05.json`;
- candidate-review SHA-256:
  `b5d6212f49c5fd3cd499e4f02ebe1b0cda53e3ab41d7ead5a2a2818060d1805b`;
- proposed owner decision ID:
  `b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6`;
- approved manifests, in execution order:
  - `docs/manifests/unacademy-neet-sexual-reproduction-flowering-plants-class-12-reviewed.json`
    - SHA-256 `ab72202c44b715ac7f2281035f4f755743686c21945ce42dbc5b57d33c5eb913`;
  - `docs/manifests/unacademy-neet-alternating-current-class-12-reviewed.json`
    - SHA-256 `5a82097859bb77eba78c28d59fd7a390f5a6de8cc0e0d3514a38e78b77521ccc`;
  - `docs/manifests/unacademy-neet-chemical-kinetics-class-12-reviewed.json`
    - SHA-256 `69ec046c66d0a65271c44c123f47e39e048f61af100b0e6398c7987ab2b43eff`;
- completed additive delta: +3 playlists / +27 videos / +27 memberships / +0
  chapters, with zero reuse.

The review JSON pins every retained/excluded source position, video ID, title,
duration, embedding state, taxonomy ID, class scope, teacher ID, source
snapshot hash, and collision result. The manifests preserve the reviewed source
positions, renumber only the retained lectures naturally, exclude all nine
quiz rows, and bind the exact owner-reviewed teacher evidence.

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

## Approval record

`Approve the reviewed Unacademy NEET ninth batch under decision
b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6, exactly as recorded in the readiness
document.`
