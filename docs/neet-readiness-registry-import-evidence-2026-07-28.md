# NEET readiness-registry production import evidence — 28 July 2026

## Safety gate

- Target: production `kezelafqhgqrprpadmlf`
- PITR retention: 7 days
- Rollback point: 28 Jul 2026 01:13:03 UTC+05:30
  (27 Jul 2026 19:43:03 UTC)
- Import boundary: mapped v12, create-only, one playlist at a time
- No migrations, updates, deletes, or release push

## Results

| Course ID | Playlist | Videos | Memberships | Chapters |
| ---: | --- | ---: | ---: | ---: |
| 108 | MISSION 30 Organic Chemistry | 8 | 8 | 0 |
| 109 | MISSION 30 Physical Chemistry | 7 | 7 | 0 |
| 110 | MISSION 30 Class 12 Physics | 11 | 11 | 0 |
| 111 | MISSION 30 Class 11 Physics | 10 | 10 | 0 |
| 112 | SKC Organic Chemistry One-shot | 10 | 10 | 0 |
| 113 | Pankaj Organic Chemistry Class 11 | 8 | 8 | 0 |
| 114 | Aayudh Mechanics One-shot | 14 | 14 | 0 |
| 115 | Good Morning Physics | 25 | 25 | 0 |
| 116 | Physical Chemistry Mindmap | 10 | 10 | 0 |
| 117 | Physics Mindmap | 33 | 33 | 0 |
| 118 | Vardaan Physics | 5 | 5 | 0 |
| 119 | Vardaan Chemistry | 5 | 5 | 0 |
| **Total** | | **146** | **146** | **0** |

Every dry-run reported the exact published and usable count, no existing
playlist, no duplicate video IDs, no missing durations, no non-embeddable
videos, quality status `ok`, and only reused chapters. Every import created one
course and the exact expected videos and memberships.

After every individual write, the JEE catalogue remained exactly 83 courses and
1,307 memberships with fingerprint
`d7aae3ce7635401ebeffe97e627048bc`.

## Final verification

- Production catalogue: 112 courses and 1,625 memberships.
- Goal split: 83 JEE and 29 NEET.
- Chapters remain 123; this batch created zero.
- Catalogue audit: zero missing metadata, zero title-review findings, zero
  missing teachers, and zero duplicate-course candidates.
- Anonymous browser: NEET Class 11 showed 6 Physics, 7 Chemistry, and 8 Biology
  courses; JEE and NEET scopes remained separated.
- New NEET course 117 loaded lesson 1 and lesson 33 of 33 in the YouTube embed.
- Existing JEE course 17 loaded lesson 1 and lesson 16 of 16 in the embed.
- Browser console contained no errors.
