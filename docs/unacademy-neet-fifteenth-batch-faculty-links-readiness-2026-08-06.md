# Unacademy NEET fifteenth-batch faculty-link readiness - 6 August 2026

## Status

Prepared and locally rehearsed only. The artifact has not been applied to
production. Applying it requires separate owner approval of the exact SHA-256
below. During preparation, no production SQL or `release` push occurred.

Original batch decision: `5b4b1d41-b7dc-4f12-80cf-b490e72edd96`.
Refreshed remainder decision: `1412ca96-56dc-47ef-8bc0-18ce97f7dfb6`.

## Reviewed scope

The production catalogue contains the three newly imported courses with no
normalized faculty link and no quality-review row:

- course `423`, Alcohols, Phenols & Ethers, source
  `PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP`, eleven lessons in chapter `92`,
  attributed to verified Anoop Vashishtha (`id 36`);
- course `424`, Fluid Mechanics, source
  `PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw`, eleven lessons in chapter `26`,
  attributed to verified Mahendra Singh (`id 34`);
- course `425`, Kinematics 1D, source
  `PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX`, six lessons in chapter `1`,
  attributed to verified Mahendra Singh (`id 34`).

Both teachers already have the reviewed Unacademy NEET (`id 147`), relevant
subject, and NEET context. The artifact creates no teacher, alias, institute,
subject, or learning-goal row.

## Exact production baseline

Read-only capture after completion of courses 423-425:

- 406 playlists / 4,683 videos / 4,689 memberships / 263 chapters;
- 92 chapter-class rows;
- 32 teachers / 50 aliases / 33 teacher-institute rows / 33 teacher-subject
  rows / 32 teacher-goal rows;
- 158 normalized course-teacher links and 29 quality reviews;
- protected original JEE: 82 courses / 1,304 memberships / fingerprint
  `30eee4a4a6842e5beeb7c97083d7f812`.

## Prepared artifact

File:
`docs/sql/unacademy_neet_fifteenth_batch_faculty_links_2026-08-06.sql`

SHA-256: `ff4e0f24415700351319dd61520d9c2bf086dd94f73727a985b9cfc8568cae25`

The additive, guarded transaction:

- checks the exact catalogue, faculty-registry, and quality-review baseline;
- checks all three complete course identities, sources, chapters, goals,
  classes, pending review state, verified teachers, and teacher context;
- checks that none of the three courses already has a link or quality review;
- checks the protected JEE count and fingerprint before and after writing;
- inserts +3 `playlist_teachers` rows only, producing 161 course links;
- leaves course metadata, review status, quality reviews, and content unchanged;
- rolls the whole transaction back on any mismatch.

## Local rehearsal

The focused PGlite regression executes the complete transaction against the
exact production-shaped baseline, verifies all three links, and proves an exact
baseline mismatch aborts without leaving any link behind.

## Approval gate

To apply this exact immutable artifact, approve:

`Approve applying Unacademy NEET fifteenth-batch faculty-link artifact SHA-256 ff4e0f24415700351319dd61520d9c2bf086dd94f73727a985b9cfc8568cae25 to production, after a fresh PITR and exact-baseline check; stop on any mismatch; no release push.`
