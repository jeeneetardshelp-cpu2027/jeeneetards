# Competishun+ JEE batch 1

Date: 2026-07-29
Environment: production (`kezelafqhgqrprpadmlf`)
Channel: Competishun+ (`@competishun`, `UC6ieIswHA9WInRsa2r88hRw`)
Owner decision: `1c06eb34-fbdc-4d3b-a239-39f256f889e8`

## Scope and safeguards

The owner approved Competishun+ as a brand/channel attribution with no personal
teacher assignment. Seven clean chapter playlists were imported create-only,
one at a time. Every write was preceded by a fresh anonymous dry-run. Any
unexpected reuse, new blocker, or protected-catalogue mismatch was configured
to stop the batch.

Initial production totals were 159 playlists, 2,020 videos, 2,024 memberships,
and 218 chapters. None of the seven source playlists existed.

The first all-JEE fingerprint check stopped after Hydrogen because adding a
JEE-tagged course necessarily changes the all-JEE fingerprint. The owner then
approved the corrected guard:

- the original protected 83 JEE courses and 1,307 memberships must remain at
  fingerprint `d7aae3ce7635401ebeffe97e627048bc`;
- the growing all-JEE count and rolling fingerprint must be recorded
  separately.

The corrected protected-set guard passed after every subsequent import.

## Import results

| Course ID | Course | Class | Videos | Reused | Chapters created |
|---:|---|---|---:|---:|---:|
| 167 | Hydrogen | 11th | 2 | 0 | 0 |
| 168 | Ionic Equilibrium | 11th | 11 | 0 | 0 |
| 169 | Thermochemistry | 11th | 4 | 0 | 0 |
| 170 | Surface Chemistry | 12th | 4 | 0 | 0 |
| 171 | Chemical Kinetics | 12th | 6 | 0 | 0 |
| 172 | Chemical Equilibrium | 11th | 5 | 0 | 0 |
| 173 | Electrochemistry | 12th | 11 | 0 | 0 |

Batch delta:

- +7 playlists
- +43 videos
- +43 memberships
- 0 reused videos
- 0 chapters created

Final catalogue totals:

- 166 playlists
- 2,063 videos
- 2,067 memberships
- 218 chapters

## Integrity evidence

After the final import:

- original protected JEE courses: 83
- original protected memberships: 1,307
- protected fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`
- protected fingerprint match: true
- rolling JEE courses: 90
- rolling JEE memberships: 1,350
- rolling fingerprint:
  `0c161b12738e5a738d317497270500e1`

The official YouTube playlist order was preserved for every course, including
source playlists whose numbered lecture titles are stored in descending order.

## Runtime QA

- Hydrogen course 167 displayed two lessons under the existing Hydrogen
  chapter, with the official Competishun+ YouTube player available.
- Electrochemistry course 173 displayed all 11 lessons under the existing
  Electrochemistry chapter in exact source order.
- Both showed Competishun+ channel attribution.
- No browser console errors were recorded.

The three separately reviewed Mathematics playlists (Statistics, Complex
Numbers, and Probability) remain deferred because their source ordering requires
a separate owner decision.
