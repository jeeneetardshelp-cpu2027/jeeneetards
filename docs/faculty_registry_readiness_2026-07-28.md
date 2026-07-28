# Faculty registry readiness — 28 July 2026

## Decision

Keep `facultyRegistry` disabled. The v7 tables and anonymous RPCs exist in
production, but the registry contains no publishable data.

This was a read-only audit. No production rows were created, updated, or
deleted.

## Production evidence

Server-side counts:

| Measure | Count |
| --- | ---: |
| Courses | 128 |
| Curated non-empty `playlists.teacher` values | 128 |
| Distinct teacher strings | 28 |
| Normalized `teachers` rows | 0 |
| Verified teachers | 0 |
| Teacher aliases | 0 |
| `playlist_teachers` links | 0 |
| Courses linked to normalized teachers | 0 |
| Unlinked JEE courses | 83 |
| Unlinked NEET courses | 45 |

Anonymous `search_teachers('ABJ')` returns no rows. This confirms why merely
detecting the RPC is not sufficient to release faculty search, filtering, or
profiles.

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
7. Enable `facultyRegistry` only when public coverage and runtime QA meet the
   agreed release threshold. Until then the readiness verifier must continue to
   report it as false.

## Boundary

No automatic name expansion, fuzzy identity merge, or inference from a face,
thumbnail, initials, honorific, institute roster, or another course is
authorized. Missing evidence means defer.
