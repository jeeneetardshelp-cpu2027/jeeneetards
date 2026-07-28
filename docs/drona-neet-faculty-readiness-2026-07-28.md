# Drona NEET faculty-link readiness — 28 July 2026

This package is prepared only. It has not been applied to a restore clone or
production.

## Scope

The read-only NEET integrity pass found 60 NEET courses and 552 memberships.
Courses 136–150 have complete visible teacher labels but no normalized
`playlist_teachers` links because they were imported after the completed NEET
faculty batches.

The owner previously accepted the reviewed external faculty identities for the
15 Drona playlists. The exact course mapping is:

| Course IDs | Reviewed identity | Subject |
| --- | --- | --- |
| 136, 141, 145, 147, 150 | Tanuj Bansal | Physics |
| 137, 139, 142, 149 | Dr. Roopali | Biology |
| 138, 144, 148 | Agrim Jain | Biology |
| 140, 143 | Ashima Gupta | Chemistry |
| 146 | Sudhanshu Kumar | Chemistry |

Sudhanshu Kumar already exists as a verified teacher. The other four exact
identities do not currently exist.

## Current production baseline

- 147 courses, including exactly 60 NEET courses;
- 25 teachers;
- 39 teacher aliases;
- 127 playlist-teacher links;
- 25 teacher-institute links;
- 25 teacher-subject links;
- 25 teacher-learning-goal links;
- zero faculty links on courses 136–150;
- protected JEE fingerprint
  `d7aae3ce7635401ebeffe97e627048bc`.

## Prepared delta

`src/migrations/faculty_registry_neet_drona_prepared.sql` creates only:

- four verified teachers;
- four Competition Wallah affiliations;
- four subject links;
- four NEET learning-goal links;
- 15 course-faculty links.

It creates no speculative aliases and does not rewrite legacy playlist teacher
text. Courses 118–119 remain excluded because the safety checklist requires new
exact-video evidence and a separate identity review for those mixed-teacher
playlists.

Expected postflight totals are 29 teachers, 39 aliases, 142 playlist-teacher
links, and 29 links in each normalized teacher dimension. Course, video,
membership, and chapter totals must remain unchanged.

## Required next gate

Before production:

1. rehearse this exact hash-pinned artifact on a fresh current-production
   restore clone;
2. verify all four new anonymous faculty profiles and the existing Sudhanshu
   profile return the exact reviewed courses;
3. verify NEET-only scoping, representative browse/player behavior, and the
   protected JEE fingerprint;
4. obtain a new exact production PITR restore point and explicit owner approval
   naming the artifact SHA-256.

Stop on any baseline mismatch. This document does not authorize a production
write.
