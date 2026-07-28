# Faculty identity review — batch 1 — 28 July 2026

## Status

Source-verified; pending owner approval. This file records identity evidence
only. It does not authorize a clone or production write.

## Source

Official Competishun faculty page:

`https://competishun.com/pragyaan/`

The page names all four teachers, prints each short alias beside the full name,
and states the teaching subject. It was reviewed on 28 July 2026.

## Reviewed mappings

| Existing course value | Proposed display name | Verified aliases | Subject | Courses |
| --- | --- | --- | --- | ---: |
| `ABJ Sir` | Amit Bijarnia | `ABJ Sir`, `Amit Bijarnia Sir` | Physics | 33 |
| `ALK Sir` | Alok Kumar | `ALK Sir`, `Alok Kumar Sir` | Physical and Inorganic Chemistry | 23 |
| `NS Sir` | Neeraj Saini | `NS Sir`, `Neeraj Saini Sir` | Organic Chemistry | 4 |
| `Mohit Tyagi` | Mohit Tyagi | `MT Sir`, `Mohit Tyagi Sir` | Mathematics | 23 |

The official page explicitly shows:

- `Amit Bijarnia` with alias `ABJ Sir`;
- `Alok Kumar` with alias `ALK Sir`;
- `Neeraj Saini` with alias `NS Sir`;
- `Mohit Tyagi` with alias `MT Sir`.

No inference from initials, faces, thumbnails, or third-party faculty lists is
used.

## Catalogue coverage

The four reviewed existing values cover exactly 83 production courses:

- `ABJ Sir`: course IDs 5–38, excluding 10–12, plus 66 and 90;
- `ALK Sir`: 39–49, 51–56, 59–62, 64–65;
- `NS Sir`: 50, 57, 58, 63;
- `Mohit Tyagi`: 67–89.

This is the complete current JEE catalogue. The protected JEE baseline remains:

```text
courses:     83
memberships: 1,307
fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

## Proposed additive clone rehearsal

After owner approval, assemble an idempotent package that:

1. creates four verified `teachers` rows;
2. creates only the aliases listed above with status `verified` and source
   `manual`;
3. attaches Competishun institute, subject, and JEE learning-goal context;
4. creates `playlist_teachers` links for the exact 83 course IDs;
5. does not update `playlists.teacher` or any existing course/video row.

Clone postflight must prove:

- 83 JEE courses and 1,307 memberships remain unchanged;
- the JEE fingerprint remains unchanged;
- every JEE course has exactly one expected normalized teacher link;
- `search_teachers` resolves each full name and short alias;
- faculty facets remain chapter-scoped;
- each faculty profile lists only the expected courses;
- no NEET course is linked by this batch.

Production remains out of scope until the clone rehearsal passes and a fresh
PITR restore point plus a separate owner approval are recorded.
