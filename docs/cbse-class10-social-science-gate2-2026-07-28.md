# CBSE Class 10 Social Science — Gate 2 evidence

Gate 2 was owner-approved and completed on production on 28 July 2026. The
four reviewed playlists were drafted, dry-run, and imported create-only in the
required order. No schema migration or `release` deployment was performed.

## Recovery and baseline

- PITR remained active with seven-day retention.
- Latest restore point observed before the final import:
  `28 Jul 2026, 18:46:30 UTC+05:30`.
- Gate 2 baseline: 143 courses, 1,855 videos, 1,859 memberships, and 146
  chapters.
- Protected JEE baseline: 83 courses, 1,307 memberships, fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.

## Import results

All four courses use subject `Social Science` (ID 5), class `10th`, learning
goal `school`, and board `cbse`. Every mapped chapter was reused.

| Order | Course | Course ID | Videos | Memberships | Chapters created |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Geography Class 10th — Digraj Singh Rajput | 151 | +5 | +5 | 0 |
| 2 | History Class 10th — Digraj Singh Rajput | 152 | +5 | +5 | 0 |
| 3 | Class 10 Civics One Shot — Digraj Singh Rajput | 153 | +4 | +4 | 0 |
| 4 | Class 10 Economics Rapid Revision — Digraj Singh Rajput | 154 | +4 | +4 | 0 |

The History source contained seven videos. Five chapter lectures were imported.
Two non-chapter entries were explicitly excluded by exact source position and
video ID:

- `FBs0wVgD2kU`: duplicate live-session revision;
- `--9xF8A6jNE`: full-syllabus marathon.

The exclusion contract is fail-closed: assignments plus reasoned exclusions
must exhaustively partition the source snapshot, and excluded videos cannot be
repeated or imported.

## Postflight

- Final catalogue: 147 courses, 1,873 videos, 1,877 memberships, and 146
  chapters.
- Gate 2 delta: +4 courses, +18 videos, +18 memberships, 0 chapters.
- School goal coverage: four courses; Social Science coverage: four courses.
- Each imported course has only the `school` goal and only the `cbse` board, so
  none can appear in JEE- or NEET-scoped results.
- JEE remained exactly 83 courses and 1,307 memberships.
- Protected JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc` after every import.

## Browser verification

Production anonymous browse showed each course under
School Boards → CBSE → Class 10 → Social Science. Representative chapter routes
showed one matching course with the expected total lecture count.

The first and last mapped YouTube embeds loaded for all four courses:

- Geography: course 151, chapters 138 and 134;
- History: course 152, chapters 129 and 132;
- Civics: course 153, chapters 145 and 141;
- Economics: course 154, chapters 149 and 146.

Gate 2 passed. The board-classification frontend flip and any `release` push
remain separate and were not started.
