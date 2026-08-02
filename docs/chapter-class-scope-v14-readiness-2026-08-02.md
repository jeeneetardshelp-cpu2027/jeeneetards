# Chapter/class scope v14 readiness — 2026-08-02

Status: **review-only draft and rollback package prepared; no database
application or release deployment**.

## Evidence boundary

The production catalogue was audited anonymously after the five-row v13 launch.
The remaining class overlap is caused mostly by courses carrying both Class 11
and Class 12 audience tags. Current official CBSE 2026–27 senior-secondary
syllabi were compared with the exact production chapter slugs and their linked
course/video usage.

The proposed v14 slice contains 82 single-class mappings:

| Subject | Class 11 | Class 12 | Total |
|---|---:|---:|---:|
| Physics | 10 | 9 | 19 |
| Chemistry | 15 | 9 | 24 |
| Mathematics | 4 | 3 | 7 |
| Biology | 19 | 13 | 32 |
| **Total** | **48** | **34** | **82** |

Read-only simulation projects the following overlap reduction:

| Browse scope | Current overlaps | After reviewed rows |
|---|---:|---:|
| JEE Physics | 0 | 0 |
| JEE Chemistry | 11 | 0 |
| JEE Mathematics | 8 | 1 |
| NEET Physics | 19 | 0 |
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
- contains only 82 additive inserts into `chapter_class_levels`;
- records current official CBSE source URLs and a 2026-08-02 review date;
- excludes all four deferred chapters;
- expects 87 total canonical rows after a future approved application;
- does not alter catalogue data or replace browse functions.

The 82 mappings were approved for rollback-package preparation only. Production
application remains a separate gate requiring a fresh PITR restore point and
exact pre/postflight evidence.

## Rollback-only clone package prepared

The reviewed source SHA-256 is pinned as
`95492b1abd8de69e700b3a7a1f55454a2cf08aa2cf15dd33e1502836cf250f0a`.
`npm run build:chapter-class-v14-rehearsal` deterministically generates:

- `production/chapter_class_scopes_v14_clone_rehearsal/read_only_preflight.sql`
  — SHA-256
  `7c6d67195df8fdb06299ac5781e2121593c59a8a9328585d8a63df9c1e593e1a`;
- `production/chapter_class_scopes_v14_clone_rehearsal/rollback_rehearsal.sql`
  — SHA-256
  `718fbce4b4e3707233f55ebe7527f604f8958265304277e597360d24d9ee7be7`;
- a clone-only README and checksum manifest.

The package makes no database connection while building. Its SQL is restricted
to a fresh isolated restore clone, has exactly one change transaction, contains
no `commit`, and ends with `rollback`. It verifies the five-row v13 baseline,
catalogue counts, protected original-83 JEE fingerprint, projected JEE/NEET/
School browse deltas, and restoration of the original state after rollback.
It contains no persistent-clone or production apply artifact.
