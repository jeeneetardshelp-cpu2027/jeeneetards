# Unacademy NEET fourteenth-batch faculty-link readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. The artifact has not been applied to
production. Applying it requires separate owner approval of the exact SHA-256
below. During preparation, no production SQL or `release` push occurred.

Refreshed batch decision: `b98191cb-c0be-4d3c-9e15-95905da4fffc`.
The unchanged Cell and Anatomy teacher evidence remains bound to original
decision `b19eaa58-7931-4c84-8cea-8b6622230b4d`.

## Reviewed scope

The production catalogue contains the three newly imported courses with no
normalized faculty link and no quality-review row:

- course `420`, Friction, source `PLsgHooHkqhhM5-Ujy03Tn7YjofINdftRM`, four
  lessons in chapter `7`, attributed to verified Mahendra Singh (`id 34`);
- course `421`, Cell: The Unit of Life, source
  `PLsgHooHkqhhM6fzJQ3Vhv7s6iOglsVJw2`, four lessons in chapter `107`,
  attributed to verified Pradeep Singh (`id 33`);
- course `422`, Anatomy of Flowering Plants, source
  `PLsgHooHkqhhPkkXnKHj60aao7jClkwioE`, six lessons in chapter `97`,
  attributed to verified Pradeep Singh (`id 33`).

Both teachers already have the reviewed Unacademy NEET (`id 147`), relevant
subject, and NEET context. The artifact creates no teacher, alias, institute,
subject, or learning-goal row.

## Exact production baseline

Read-only capture at `2026-08-06T10:26:21.217Z`:

- 403 playlists / 4,655 videos / 4,661 memberships / 263 chapters;
- 92 chapter-class rows;
- 32 teachers / 50 aliases / 33 teacher-institute rows / 33 teacher-subject
  rows / 32 teacher-goal rows;
- 155 normalized course-teacher links and 26 quality reviews;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Prepared artifact

File:
`docs/sql/unacademy_neet_fourteenth_batch_faculty_links_2026-08-06.sql`

SHA-256: `fed469e8036e346ccfb45cae8e8c01cd66f1c32addcbd40eae4c1a641f5d16c1`

The additive, guarded transaction:

- checks the exact catalogue, faculty-registry, and quality-review baseline;
- checks all three complete course identities, sources, chapters, goals,
  classes, pending review state, verified teachers, and teacher context;
- checks that none of the three courses already has a link or quality review;
- checks the protected JEE count and fingerprint before and after writing;
- inserts +3 `playlist_teachers` rows only, producing 158 course links;
- leaves course metadata, review status, quality reviews, and content unchanged;
- rolls the whole transaction back on any mismatch.

## Local rehearsal

The focused PGlite regression executes the complete transaction against the
exact production-shaped baseline, verifies all three links, and proves an exact
baseline mismatch aborts without leaving any link behind.

## Approval gate

To apply this exact immutable artifact, approve:

`Approve applying Unacademy NEET fourteenth-batch faculty-link artifact SHA-256 fed469e8036e346ccfb45cae8e8c01cd66f1c32addcbd40eae4c1a641f5d16c1 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
