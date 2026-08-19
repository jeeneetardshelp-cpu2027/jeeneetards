# Unacademy NEET sixteenth-batch faculty-link readiness — 2026-08-07

Status: **APPLIED SUCCESSFULLY TO PRODUCTION** at `2026-08-07 01:05 IST`
under the separate exact-hash owner approval. No `release` push occurred.

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

## Production execution evidence

Before execution, the signed-in Supabase dashboard confirmed active seven-day
PITR with restore availability through `07 Aug 2026, 00:57:20 IST`. A fresh
read-only SQL connection returned the exact encoded baseline, zero target
faculty links/reviews, zero matching normalized teachers, and the protected JEE
boundary `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`.

The locally loaded file reproduced the approved SHA-256 exactly. The first Run
attempt was rejected at parse time because the SQL editor had retained the
earlier baseline query ahead of the artifact; no transaction began and no row
changed. The editor was cleared completely, the exact artifact was reloaded,
and the guarded transaction then committed successfully.

Independent postflight:

- catalogue unchanged: `409 / 4,699 / 4,705 / 263`
- teachers `32 -> 34`; aliases `50 -> 54`
- institute links `33 -> 35`; subject links `33 -> 35`; goal links `32 -> 34`
- course-teacher links `161 -> 164`; quality reviews unchanged at `32`
- course `426 -> seep-pahuja`; courses `427-428 -> sachin-kapur`
- target quality reviews: `0`; title/faculty review statuses remain pending
- protected JEE unchanged: `82 / 1,304 / 30eee4a4a6842e5beeb7c97083d7f812`
