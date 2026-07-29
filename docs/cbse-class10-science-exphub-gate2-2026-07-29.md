# ExpHub CBSE Class 10 Science import evidence

Course A was owner-approved and completed on production on 29 July 2026.
All other production writers remained paused. The import was additive and
create-only. No chapter or schema changes were made.

## Fresh baseline

- Catalogue: 149 playlists, 1,896 videos, 1,900 memberships, 169 chapters.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.
- Source playlist `PLxBrTGIVCrU6ubed6HFyvOx-E4gjwPkww` was absent.
- Source channel: `Exphub 9th &10th`
  (`UC4rZpoEdeFLF4x9walsyoSw`, reviewed handle `@exphub10th`).
- Subject `Science` was reused as ID 10; no chapters were created.

## Manifest review and dry-run

The 13 syllabus chapter one-shots were retained. The distinct Electricity
numericals lecture was also retained. The reviewed
`Heridity and Evolution Complete Chapter` lecture was mapped to `Heredity`,
because Evolution is outside the current syllabus.

Nine source videos were excluded:

- seven non-chapter short-trick, PYQ, activities, expected-question,
  last-minute-revision, diagram, or complete-revision videos;
- a redundant second full Life Processes lecture;
- a redundant second full Control and Coordination lecture.

The final manifest contains 15 assignments across the 13 existing Science
chapters and 9 explicit exclusions. Attribution uses the ExpHub brand/channel;
no personal teacher identity or faculty-registry record was invented.
Reviewed evidence decision:
`28ad3d0c-31c1-42c9-8f1d-623b4b4a134b`.

Manifest SHA-256:
`45b8101bf5724f9a6e622674e131f5a75df138a8d7e983ef4478ad69701df92a`.

The anonymous production dry-run passed with one playlist, zero review
findings, and zero blockers. It made no Supabase writes.

## Import and postflight

The mapped v12 import created course `157`, 15 videos, and 15 memberships.
It reused all chapters and created zero chapters.

- Final catalogue: 150 playlists, 1,911 videos, 1,915 memberships, 169 chapters.
- Course scope: exactly `school`, `cbse`, class `10th`, Science subject `10`.
- Course attribution: ExpHub / `Exphub 9th &10th`, channel ID 71.
- JEE remained exactly 83 courses and 1,307 memberships.
- JEE fingerprint remained
  `d7aae3ce7635401ebeffe97e627048bc`.

Anonymous production browse under School Boards -> CBSE -> Class 10 -> Science
showed all 13 chapters and the ExpHub course alongside the existing source.
Course `157` opened at Chemical Reactions and Equations and loaded the official
`youtube-nocookie.com` embed for `gQ-X9wV8TXQ`. No console errors were recorded.

Focused ingestion-safety validation passed: 27 tests.
