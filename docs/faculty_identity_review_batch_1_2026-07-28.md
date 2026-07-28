# Faculty identity review — batch 1 — 28 July 2026

## Status

Source-verified, rehearsed successfully on the isolated restore clone, and
applied successfully to production after separate owner approval.

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

## Isolated clone rehearsal result

Target:
`youtube-neet-restore-rehearsal-20260727`
(`napkhqkdsqmnunxwnurr`), not production.

Artifact:
`src/migrations/faculty_registry_jee_batch1_clone_rehearsal.sql`

SHA-256:
`3e2c481904a900e1f6053722b9aa39ed3e947a71a564283e2867330386bf4da4`

The clone preflight recorded:

```text
total courses:       85
total memberships:   1,328
chapters:             123
JEE courses:           83
JEE memberships:    1,307
teachers:               0
aliases:                0
playlist links:         0
JEE fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

The first exact artifact execution succeeded. Postflight recorded:

```text
reviewed teachers:          4
verified aliases:           8
institute links:            4
subject links:              4
JEE learning-goal links:    4
JEE playlist links:        83
NEET playlist links:        0
JEE courses:               83
JEE memberships:        1,307
JEE fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

The exact artifact was executed a second time and succeeded with the same
postflight counts, proving idempotency.

With the database role set to `anon`, `search_teachers` resolved all four short
aliases and all four full names to their expected slugs. The returned course
counts were `33`, `23`, `4`, and `23`; `get_faculty_facets` returned four JEE
faculty entries; and `get_faculty_profile` returned the same per-teacher course
counts.

No production SQL was run during the clone rehearsal and no `main` or `release`
push was made.

## Production result

The owner separately approved the exact hash-verified artifact. Before the
write, the production PITR dashboard showed active 7-day retention and the
latest restore point:

```text
28 Jul 2026, 13:21:28 UTC+05:30
```

Production preflight recorded 128 courses, 1,721 memberships, 124 chapters,
83 JEE courses, 1,307 JEE memberships, zero normalized teachers/aliases/course
links, and the protected JEE fingerprint
`d7aae3ce7635401ebeffe97e627048bc`.

The exact rehearsed artifact
(`3e2c481904a900e1f6053722b9aa39ed3e947a71a564283e2867330386bf4da4`)
then succeeded. Production postflight matched the clone:

```text
reviewed teachers:          4
verified aliases:           8
institute links:            4
subject links:              4
JEE learning-goal links:    4
JEE playlist links:        83
NEET playlist links:        0
JEE courses:               83
JEE memberships:        1,307
JEE fingerprint: d7aae3ce7635401ebeffe97e627048bc
```

Anonymous-role searches resolved all eight reviewed full-name/short-alias
queries. JEE facets returned four teachers and profiles returned exact course
counts `33`, `23`, `4`, and `23`. The public production JEE browse and
representative course 39 loaded successfully with its eight lessons and no
console warnings or errors.

The normalized faculty feature remains controlled by its existing frontend
readiness gate. No `main` or `release` push accompanied this data-only change.
