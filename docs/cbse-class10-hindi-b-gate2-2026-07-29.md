# CBSE Class 10 Hindi B — Gate 2 evidence (2026-07-29)

Gate 2 was owner-approved and completed on production on 29 July 2026. All
other production writers remained paused. The import was additive,
create-only, and reused the 16 Gate 1 chapters.

## Fresh baseline

- `main` and `origin/main` were synchronized at
  `211f250e1801f6fa59f2f8b46853c0e0033bf6e1`, after the Unicode mapper commit.
- Catalogue: 152 playlists, 1,941 videos, 1,945 memberships, 201 chapters.
- Source playlist `PLf1QWmNs-KXH4jie9NRD8v8r9vU4xubfN` was absent.
- Protected JEE catalogue: 83 courses and 1,307 memberships.
- Protected JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

## Review decisions and dry-run

The 26-video source was reduced to exactly one explanation video for each of
the 16 reviewed Hindi B chapters:

- Dropped seven MCQ videos.
- Dropped the Hindi B PYQ analysis.
- Dropped the syllabus one-shot overview.
- For `डायरी का एक पन्ना`, dropped the shorter summary and retained the fuller
  explanation (`X9hgIVhfaTg`).
- Confirmed the medium-confidence transliteration match for
  `पतझर में टूटी पत्तियाँ`.

Attribution uses the Hindi Adhyapak brand/channel; no personal teacher identity
was invented. Reviewed evidence decision:
`7454bef8-5451-45b1-8bce-a58169431b75`.

- Manifest SHA-256:
  `1af38da94ae028e4bb97633425e957ec12e37641f9eb506de73e66d35257d172`
- Source snapshot SHA-256:
  `0788bbd0774d61b18227e3869a818284a13866443e55f1541812a27d0b21a7dd`
- Anonymous production dry-run: one playlist, 16 assignments, 10 exclusions,
  all chapters resolved/reused, v12 supported, zero review findings, zero
  blockers, and no Supabase writes.

## Import and postflight

Mapped v12 created course `160`:

- +1 playlist
- +16 videos
- +16 memberships
- 0 videos reused
- 0 chapters created; all 16 existing Hindi B chapters reused

Final catalogue:

- playlists: 153
- videos: 1,957
- memberships: 1,961
- chapters: 201

The course has:

- category: School Boards (id 4)
- learning goal: School Boards / `school` (id 4)
- board: CBSE (id 1)
- class: `10th`
- subject: Hindi B (id 12)
- attribution: Hindi Adhyapak
- language: Hindi
- content type: full course
- 16 lessons across 16 distinct chapters
- all 16 retained videos marked embeddable

JEE remained exactly 83 courses and 1,307 memberships. Its fingerprint remained
`d7aae3ce7635401ebeffe97e627048bc`.

## Anonymous runtime QA

The scoped catalogue at School Boards / CBSE / Class 10 / Hindi B showed:

- all 16 exact Devanagari chapter filters;
- exactly one Hindi B course;
- the course card with 16 lectures and Hindi Adhyapak attribution.

Course `160`, chapter `242` loaded the official YouTube embed for
`KK8oftpIkT0`. The player started successfully and recorded no console errors.

Gate 2 is complete. No release push or additional content import was performed.
