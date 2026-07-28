# Faculty registry readiness — 28 July 2026

## Current decision

`facultyRegistry` is enabled for the source-verified JEE batch. Production now
contains four verified JEE teachers, eight verified aliases, and normalized
links for all 83 JEE courses.

NEET normalization remains incremental. Courses without reviewed normalized
links correctly expose no faculty facet; the UI must not infer identities from
their legacy free-text values.

## Production evidence

Server-side counts:

| Measure | Count |
| --- | ---: |
| Courses | 128 |
| Curated non-empty `playlists.teacher` values | 128 |
| Distinct teacher strings | 28 |
| Normalized `teachers` rows | 4 |
| Verified teachers | 4 |
| Teacher aliases | 8 |
| `playlist_teachers` links | 83 |
| Courses linked to normalized teachers | 83 |
| Unlinked JEE courses | 0 |
| Unlinked NEET courses | 45 |

Anonymous search, facets, and profiles resolve the reviewed JEE identities.
The protected JEE fingerprint remains
`d7aae3ce7635401ebeffe97e627048bc`.

The refreshed NEET-only inventory contains 45 courses and 24 distinct legacy
teacher strings. The prepared first NEET batch covers Diksha Sharma and Yashika
Singh across 16 courses; see
`docs/faculty_identity_review_neet_batch_1_2026-07-28.md`.

## Review blockers

Three source values explicitly represent more than one teacher and must be
split only after each person is reviewed:

- `Aditya Sir & Rohit Sir` — course 118
- `Sarvesh Sir, Pankaj Sir & Amit Sir` — course 119
- `Tarun Sir & Samapti Ma'am` — course 91

`Mohit Dadheech` and `Mohit Dadheech Sir` occur on separate courses. They are a
likely honorific variant, but must not be auto-merged without reviewed identity
evidence.

Initials and short names such as `ABJ Sir`, `ALK Sir`, `NS Sir`, `SKC Sir`,
`Aayudh Sir`, `Saleem Sir`, and `Siddharth Sir` are not sufficient by themselves
to establish a canonical legal/display identity. The existing free-text value
may remain visible while registry review is pending.

## Safe additive sequence

1. Export all 28 distinct strings with course IDs and source/channel context.
2. Review one identity decision at a time, recording the source URL, reviewer,
   review date, canonical display name, verified aliases, institute, subject,
   and learning goal.
3. Treat every multi-teacher string as a separate decision per person.
4. Dry-run an additive SQL/RPC package on the restored clone:
   - create teacher rows;
   - create reviewed aliases;
   - create context links;
   - create `playlist_teachers` links;
   - never rewrite `playlists.teacher`.
5. Verify on the clone:
   - exactly 128 courses remain;
   - JEE fingerprint remains
     `d7aae3ce7635401ebeffe97e627048bc`;
   - public search returns only reviewed identities and aliases;
   - ambiguous aliases return every tied candidate;
   - faculty facets never widen a chapter-scoped result;
   - every profile links only to its actual courses.
6. Apply to production only after a fresh PITR restore point and explicit owner
   approval, one reviewed batch at a time.
7. Keep each goal scoped to its reviewed links. Empty NEET facets remain hidden
   until a reviewed NEET batch is applied.

## Boundary

No automatic name expansion, fuzzy identity merge, or inference from a face,
thumbnail, initials, honorific, institute roster, or another course is
authorized. Missing evidence means defer.
