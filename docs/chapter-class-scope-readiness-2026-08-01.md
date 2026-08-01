# Chapter/class scope readiness — 2026-08-01

Status: **rollback-only restore-clone rehearsal passed; production remains
untouched and no release deployment was made**.

## Reproduced production defect

The anonymous `get_browse_curriculum` RPC currently exposes 31 JEE Physics
chapters: 17 under Class 11 and 18 under Class 12. Four appear under both:

- Kinematics
- Newton's Laws of Motion (NLM)
- Work, Energy and Power
- Ray Optics and Optical Instruments

`Modern Physics` appears only under Class 11. This is also academically wrong.
The current RPC determines chapter class from the containing playlist, creating
a cross-product whenever a playlist carries more than one class.

Changing the RPC to `video_class_levels` is not a safe fix. Production evidence:

| Chapter | Videos | Videos with class rows | Class rows observed |
|---|---:|---:|---|
| Ray Optics and Optical Instruments | 14 | 12 | class-11, class-12, dropper |
| Modern Physics | 10 | 7 | class-11, class-12, dropper |

The video junction currently mixes academic class with course audience and is
incomplete, so it cannot be treated as canonical.

## Proposed model

`chapter_class_levels(chapter_id, class_level_id)` becomes the canonical
academic scope. It is independent of:

- the classes covered by a multi-class playlist;
- whether a course is marketed to droppers;
- the class tags inherited by an individual imported video.

The first reviewed slice contains five JEE Physics corrections:

| Chapter | Canonical class |
|---|---|
| Kinematics | Class 11 |
| Newton's Laws of Motion (NLM) | Class 11 |
| Work, Energy and Power | Class 11 |
| Ray Optics and Optical Instruments | Class 12 |
| Modern Physics | Class 12 |

Evidence: the official CBSE 2025–26 Class XI–XII Physics syllabus places
motion, laws of motion, and work/energy in Class XI, and ray optics in Class
XII. NCERT Physics Part II for Class XII contains the modern-physics units.

## Prepared artifacts

- `src/migrations/chapter_class_scopes_v13_draft.sql` — additive table and five
  provenance-bearing rows. It contains a deliberate abort before all DDL.
- `src/migrations/chapter_class_scopes_v13_browse_draft.sql` — replaces the two
  existing browse RPCs only after a deliberate abort is removed in a separately
  approved clone package. Reviewed chapter rows override playlist class tags;
  unreviewed chapters retain the current fallback.
- `npm run audit:chapter-classes` — anonymous, read-only repeatable evidence.

The user instructed continuation after reviewing the five mappings. That moves
them into clone-rehearsal scope only; it is not production-write approval.

## Browse-delta boundary

- Academic Class 10/11/12 chapter navigation and chapter facets use canonical
  rows when available.
- A selected reviewed chapter is counted from its academic scope, not from the
  broad class labels on a multi-class playlist.
- Chapters without a reviewed row keep today's playlist-class behaviour so a
  five-row pilot cannot hide the rest of the catalogue.
- Dropper retains today's `dropper OR class-11 OR class-12` course-audience
  behaviour. Correctly separating target cohort is intentionally outside this
  narrow defect fix.

## Required gates before any production change

1. Build a hash-verified clone package that removes both deliberate aborts but
   changes no source artifact.
2. Record a current read-only clone baseline: catalogue counts, protected JEE
   fingerprint, curriculum/facet output, function definitions and grants.
3. Rehearse the additive table/rows and browse delta in one clone transaction.
4. Verify Class 11 no longer exposes Ray Optics/Modern Physics, Class 12 no
   longer exposes Kinematics/NLM/Work-Energy, counts remain internally
   consistent, and JEE/NEET/School remain isolated.
5. Verify direct `/browse` results and lecture results agree with the canonical
   chapter scope before preparing any frontend query adjustment.
6. Roll the clone back or delete it after evidence is captured.
7. Record a fresh PITR restore point before any independently approved
   production application.

## Rollback-only clone package prepared

`npm run build:chapter-class-rehearsal` now deterministically creates:

- `production/chapter_class_scopes_v13_clone_rehearsal/read_only_preflight.sql`
- `production/chapter_class_scopes_v13_clone_rehearsal/rollback_rehearsal.sql`
- a local operator README and SHA-256 manifest.

The builder pins the exact two reviewed source hashes, removes only their
deliberate review guards in generated output, and never connects to a database.
The generated rehearsal refuses a clone unless it matches the reviewed
`292 / 3,088 / 3,094 / 241 / 9 / 4` catalogue snapshot and the protected
original-83 JEE fingerprint
`6829fcb6eae22479db7b82b7b3da654d`. It contains no `COMMIT`, verifies catalogue
counts, function definitions, grants, and the protected fingerprint after
`ROLLBACK`, and is explicitly forbidden on production.

## Restore-clone rehearsal evidence

The owner approved a fresh isolated restore clone and the Supabase dashboard
confirmed the following boundary before any SQL ran:

- production source: `youtube` (`kezelafqhgqrprpadmlf`), read-only for this gate;
- clone: `youtube-chapter-scope-v13-20260801`
  (`nusprumijjthmrthaitp`), AWS Tokyo, Small compute;
- PITR restore point: `01 Aug 2026, 15:53:01 IST`, within the active seven-day
  retention window;
- dashboard estimate: `$14.83/month` while the clone remains active.

The clone became Healthy before the SQL editor was used. The packaged read-only
preflight returned exactly:

- `292` playlists, `3,088` videos, `3,094` memberships, `241` chapters,
  `9` subjects, and `4` class levels;
- no preexisting `chapter_class_levels` table;
- both expected browse RPCs present;
- protected original JEE baseline: `83` courses, `1,350` memberships, and
  fingerprint `6829fcb6eae22479db7b82b7b3da654d`.

The first rollback-harness run exposed a verification-only defect: PostgreSQL
cleared custom session settings when the transaction rolled back, so the
post-rollback guard received empty baseline strings. The change transaction
still rolled back and a read-only check confirmed the scope table was absent.
The builder was corrected to pin the reviewed snapshot's function-definition
and ACL hashes directly, avoiding rollback-sensitive session settings:

- curriculum definition: `b71d62cc849eec7a72d1607ce205186e`;
- facet definition: `48f982ef788b570def824aa770ae892b`;
- both ACLs: `37a7ab878ddb3c8de2877e90e7224b7e`.

The rebuilt package passed its focused seven-test suite. The exact corrected
rehearsal artifact, SHA-256
`5eeca8cc9a5aafe9c0ab9c7dad411a38a66fe54b279150e182d225e2fe23b926`, then
completed with `rollback verified; no persistent database change`. Its guarded
postflight verified all five reviewed mappings, class-specific navigation and
facets, unchanged catalogue counts, and the protected fingerprint. Its
post-rollback guard verified that the new table was absent and both browse
function definitions and grants were restored exactly.

An independent read-only post-check again returned the exact catalogue and
protected-JEE baseline above. No SQL was run against production. The clone is
being retained for owner review and remains billable until separately approved
for deletion. Because rollback-only changes are never externally visible, a
separately approved persistent clone gate is still required for browser QA.
