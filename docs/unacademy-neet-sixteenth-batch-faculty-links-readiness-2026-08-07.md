# Unacademy NEET sixteenth-batch faculty-link readiness — 2026-08-07

Status: **PREPARED AND LOCALLY REHEARSED ONLY**. The SQL was not applied to
production. No `release` push occurred.

## Exact artifact

- SQL: `docs/sql/unacademy_neet_sixteenth_batch_faculty_links_2026-08-07.sql`
- SHA-256: `d53ac966b5db06f6653403ef053a8b4dd85e49326ddbbe6a69fdf89d8cb66214`
- Evidence decision: `f7992243-3b5b-4c39-bac9-433dd766a70a`

## Additive scope

The package creates two verified normalized teachers, four reviewed aliases,
two institute links, two Biology links, two NEET-goal links, and three course
links:

- course 426 → Seep Pahuja (`seep-pahuja`)
- course 427 → Dr. Sachin Kapur (`sachin-kapur`)
- course 428 → Dr. Sachin Kapur (`sachin-kapur`)

The normalization trigger removes the `Dr.` honorific from the comparison key,
so Dr. Sachin Kapur is pinned as display name `Dr. Sachin Kapur`, canonical
name `sachin kapur`, and URL slug `sachin-kapur`. Reviewed short aliases are
`Seep Ma'am` → `seep` and `Sachin Sir` → `sachin`.

Projected postflight: **34 teachers / 54 aliases / 35 institute links / 35
subject links / 34 goal links / 164 course links / 32 quality reviews**.
Catalogue rows remain **409 / 4,699 / 4,705 / 263**.

## Guards and separation

The transaction aborts unless the exact current production baseline, exact
course identities, exact NEET/class/chapter mappings, empty target faculty and
quality-review state, and the protected JEE boundary all match. It contains no
update, delete, alter, drop, or truncate statement. Title/faculty review status
remains pending and quality review remains a separate later gate.

This hash needs a separate owner approval before production execution.
