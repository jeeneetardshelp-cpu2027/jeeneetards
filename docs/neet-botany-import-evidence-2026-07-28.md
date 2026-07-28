# NEET Botany production import evidence — 28 July 2026

Project: `kezelafqhgqrprpadmlf`

## Recovery gate

The signed-in Supabase production dashboard showed:

```text
PITR retention: 7 days
Earliest restore point: 22 Jul 2026 00:02:47 UTC+05:30
Latest restore point:   28 Jul 2026 01:47:03 UTC+05:30
```

The latest point was recorded before the chapter write. No restore was started.

## Canonical chapter

The exact checked-in plan
`docs/sql/add_molecular_basis_chapter_production_2026-07-28.sql` ran against its
verified 112-course / 1,621-video / 1,625-membership / 123-chapter baseline.
It created one Biology chapter:

```text
id: 128
name: Molecular Basis of Inheritance
slug: molecular-basis-of-inheritance
post-count: 124 chapters
```

An initial malformed SQL Editor paste failed at parse time before its
transaction began. The editor was cleared, its text was checked against the
file after line-ending normalization, and the exact plan then completed once.
No partial row was created by the failed attempt.

## Per-manifest gates

| Course ID | Playlist | Dry-run | Delta | Chapter mappings |
| ---: | --- | --- | --- | ---: |
| 120 | `PLJyab0VQDBGVPk0chK-lvZ11lY4cYr5z1` | 10 published, 10 usable; quality passed; no duplicate IDs or lesson numbers | +1 course, +10 videos, +10 memberships | 10 reused |
| 121 | `PLJyab0VQDBGWLDzyNceHh103c8KT2dHUe` | 15 published, 15 usable; quality passed; no duplicate IDs or lesson numbers | +1 course, +15 videos, +15 memberships | 15 reused |

Both imports used mapped v12 in create-only mode. Teacher evidence was accepted
for Vipin Sharma Sir and Harshit Thakuria Sir. No import-created chapter,
update, or delete occurred.

## Postflight

```text
courses: 114
unique videos: 1,646
memberships: 1,650
chapters: 124
JEE courses: 83
NEET courses: 31
JEE fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

Metadata, teacher, and duplicate-candidate audits were all clean. Anonymous
local browser QA loaded the first and last YouTube embeds for course 120
(lessons 1 and 10) and course 121 (lessons 1 and 15). The new Molecular Basis
chapter appeared in both course scopes, and the browser console had no warnings
or errors.

MISSION 30 Zoology and MISSION 30 Inorganic Chemistry remain deferred because
their teacher evidence is not accepted by the importer. This gate did not
bypass those blockers.
