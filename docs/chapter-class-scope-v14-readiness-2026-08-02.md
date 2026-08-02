# Chapter/class scope v14 readiness — 2026-08-02

Status: **review-only draft and rollback package prepared; no database
application or release deployment**.

## Evidence boundary

The production catalogue was audited anonymously after the five-row v13 launch.
The remaining class overlap is caused mostly by courses carrying both Class 11
and Class 12 audience tags. Current official CBSE 2026–27 senior-secondary
syllabi were compared with the exact production chapter slugs and their linked
course/video usage.

The updated v14 slice contains 85 single-class mappings:

| Subject | Class 11 | Class 12 | Total |
|---|---:|---:|---:|
| Physics | 13 | 9 | 22 |
| Chemistry | 15 | 9 | 24 |
| Mathematics | 4 | 3 | 7 |
| Biology | 19 | 13 | 32 |
| **Total** | **51** | **34** | **85** |

Read-only simulation projects the following overlap reduction:

| Browse scope | Current overlaps | After reviewed rows |
|---|---:|---:|
| JEE Physics | 0 | 0 |
| JEE Chemistry | 11 | 0 |
| JEE Mathematics | 8 | 1 |
| NEET Physics | 22 | 0 |
| NEET Chemistry | 24 | 3 |
| NEET Biology | 32 | 0 |

## Deliberate deferrals

- `probability` (chapter 66) is intentionally reused by School Class 10 and JEE.
  The v13 table is chapter-wide rather than goal/board-specific, and once a
  canonical row exists the browse functions do not use playlist class as a
  second discriminator. Mapping this shared bucket to several grades could
  create course-level bleed. It needs taxonomy separation or a contextual scope
  model first.
- `p-block-elements` combines material historically divided between classes.
- `surface-chemistry` is not a current CBSE 2026–27 theory unit.
- `qualitative-analysis` spans practical scopes and needs content-level review.

## Prepared artifact

`src/migrations/chapter_class_scopes_v14_draft.sql`:

- deliberately aborts before preflight or data statements;
- requires the exact five-row v13 baseline;
- contains only 85 additive inserts into `chapter_class_levels`;
- records current official CBSE source URLs and a 2026-08-02 review date;
- excludes all four deferred chapters;
- expects 90 total canonical rows after a future approved application;
- does not alter catalogue data or replace browse functions.

The original 82 mappings were approved for rollback-package preparation only.
Three additional Class XI Physics rows—`units-and-measurements`, `friction`, and
`kinetic-theory-of-gases`—were added to the review draft after the independently
reviewed Physics mistag repair made those existing chapters reachable. The
pinned CBSE Physics syllabus explicitly places all three in Class XI. Production
application remains a separate gate requiring a fresh PITR restore point and
exact pre/postflight evidence.

## Rollback-only clone package prepared

The reviewed source SHA-256 is pinned as
`6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459`.
`npm run build:chapter-class-v14-rehearsal` deterministically generates:

- `production/chapter_class_scopes_v14_clone_rehearsal/read_only_preflight.sql`
  — SHA-256
  `7c6d67195df8fdb06299ac5781e2121593c59a8a9328585d8a63df9c1e593e1a`;
- `production/chapter_class_scopes_v14_clone_rehearsal/rollback_rehearsal.sql`
  — SHA-256
  `dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0`;
- a clone-only README and checksum manifest.

The package makes no database connection while building. Its SQL is restricted
to a fresh isolated restore clone, has exactly one change transaction, contains
no `commit`, and ends with `rollback`. It verifies the five-row v13 baseline,
catalogue counts, protected original-83 JEE fingerprint, projected JEE/NEET/
School browse deltas, and restoration of the original state after rollback.
It contains no persistent-clone or production apply artifact.

## No-cost local snapshot simulation

Because a fresh cloud restore clone was explicitly excluded, the rollback
artifact was also exercised against a locally reconstructed production
snapshot using PostgreSQL-in-WASM. Run:

`npm run rehearse:chapter-class-v14-local`

The command is fail-closed:

- it accepts only the pinned production hostname and the public anonymous key;
- every production request is an explicit HTTP `GET`;
- it checks guarded table counts both before and after the paginated snapshot;
- it refuses changes to the pinned v13 browse draft or v14 rollback artifact;
- it creates a new in-memory PGlite database with no filesystem data path;
- it loads only the catalogue columns needed by the guarded SQL;
- it runs the hash-verified rollback-only artifact and then closes the database.

The 2026-08-02 run captured exactly 292 playlists, 3,088 videos, 3,094
memberships, 241 chapters, 9 subjects, 4 class levels, and 5 canonical scope
rows. The local transaction reached 90 scope rows and produced the reviewed
overlap projection: JEE Chemistry 0, JEE Mathematics 1, NEET Physics 0, NEET
Chemistry 3, and NEET Biology 0. The final guard confirmed rollback to the
original five v13 rows.

The first local run also caught a legitimate concurrent baseline change before
any v14 production artifact existed: the reviewed course-13 attribution repair
moved 43 Competishun+ memberships from protected course 13 to course 298. The
catalogue totals remained unchanged, while the protected original-83 slice
changed from 1,350 memberships / fingerprint
`6829fcb6eae22479db7b82b7b3da654d` to 1,307 memberships / fingerprint
`c742fabf93ff8dd33d6ecd5eb4793db0`. Read-only verification found course 13 at
24 lessons, course 298 at 69, contiguous positions, and zero course/video
channel mismatches. The v14 package was regenerated against that intentional
post-repair baseline rather than weakening its drift guard.

This is stronger evidence than a static SQL parse, but it is deliberately
described as a **local snapshot simulation**, not a Supabase restore-clone
rehearsal. It does not reproduce managed-project configuration, extensions,
RLS execution roles, or the production transaction environment. A production
application therefore remains a separate owner gate with a fresh PITR restore
point and exact pre/postflight evidence.
