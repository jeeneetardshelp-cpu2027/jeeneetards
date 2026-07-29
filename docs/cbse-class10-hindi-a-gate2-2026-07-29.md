# CBSE Class 10 Hindi A — Gate 2 evidence (2026-07-29)

Gate 2 was owner-approved and completed on production on 29 July 2026. All
other production writers remained paused. The import was additive,
create-only, and reused the 17 Gate 1 chapters.

## Fresh baseline

- `main` and `origin/main` were synchronized at
  `74a9f3abe522cb11815dfe3442becfd88c1b5be3`.
- Catalogue: 153 playlists, 1,957 videos, 1,961 memberships, 218 chapters.
- Source playlist `PLf1QWmNs-KXFYrkQ2tcmrnGKwFNlJFbJG` was absent.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Review decisions and dry-run

The playlist advertised 92 entries and returned 80 usable source videos. Every
usable row received exactly one reviewed decision:

- retained: 17 literature chapter explanations, one per Hindi A chapter;
- excluded: 63 grammar, writing, supplementary, duplicate, or non-chapter
  videos.

Where both a summary/animation and a fuller explanation existed, the fuller
explanation was retained. The retained source positions were:
`2, 5, 8, 11, 13, 16, 17, 19, 22, 25, 28, 31, 32, 33, 36, 39, 41`.

The mandatory Pad Parichay protection was applied explicitly:

- positions 52, 53, 54, and 55 were all excluded as Hindi grammar;
- none was assigned to `सूरदास के पद`;
- only the actual Surdas explanation `AMRpWtOdOKk` was assigned to that
  chapter.

Other exclusions covered Vachya, Vakya/Rachna ke Aadhar Par, Alankar, Apathit,
grammar practice, Swavrit/Patra/Email/Vigyapan/Sandesh Lekhan, MCQs, PYQs,
sample papers, syllabus/strategy/tips, time management, marathons, and one-shot
overviews.

Attribution uses the Hindi Adhyapak brand/channel; no personal teacher identity
was invented. Reviewed evidence decision:
`95ce1d83-a12d-43b8-9c29-d2175c8349a6`.

- Manifest SHA-256:
  `3451d6b6df8f48a8f8af5178831a62afcaf4d65c2a5d4312f04b6036ef8a158d`
- Source snapshot SHA-256:
  `b50d876822d694ad03f96f78c76b10ea94b9c8bc578d65a1c956bef3ba495d81`
- Anonymous production dry-run: one playlist, 17 assignments, 63 exclusions,
  all chapters resolved/reused, v12 supported, zero review findings, zero
  blockers, and no Supabase writes.

## Import and postflight

Mapped v12 created course `161`:

- +1 playlist
- +17 videos
- +17 memberships
- 0 videos reused
- 0 chapters created; all 17 existing Hindi A chapters reused

Final catalogue:

- playlists: 154
- videos: 1,974
- memberships: 1,978
- chapters: 218

The course has:

- category: School Boards (id 4)
- learning goal: School Boards / `school` (id 4)
- board: CBSE (id 1)
- class: `10th`
- subject: Hindi A (id 13)
- attribution: Hindi Adhyapak
- language: Hindi
- content type: full course
- 17 lessons across 17 distinct chapters
- all 17 retained videos marked embeddable

A row-level title check found no grammar, writing, MCQ, PYQ, one-shot, or
sample-paper bleed. All four Pad Parichay video IDs were absent.

JEE remained exactly 83 courses and 1,307 memberships. Its fingerprint remained
`d7aae3ce7635401ebeffe97e627048bc`.

## Anonymous runtime QA

The scoped catalogue at School Boards / CBSE / Class 10 / Hindi A showed:

- all 17 exact Devanagari chapter filters;
- exactly one Hindi A course;
- the course card with 17 lectures and Hindi Adhyapak attribution.

Course `161`, chapter `258` loaded the official YouTube embed for the actual
Surdas explanation `AMRpWtOdOKk`. The player started successfully and recorded
no console errors.

Gate 2 is complete. No release push or additional content import was performed.
