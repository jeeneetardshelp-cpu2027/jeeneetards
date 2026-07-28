# Backup and restore readiness

This is a release control for database-changing work. It does not attest that a
backup exists or that a restore exercise has passed.

## Current production status — 27 July 2026

- Project name: `youtube`.
- Project reference: `kezelafqhgqrprpadmlf`.
- The signed-in Supabase dashboard identifies the owning organization as
  `bijarnia` on the Pro plan and the `main` branch as Production.
- Automatic daily database backups are active. The latest backup shown before
  the planned launch is a Physical backup created
  `26 Jul 2026 18:34:45 (+0000)`.
- The dashboard states that projects are backed up daily around midnight in the
  project's region and that database backups exclude Storage API objects.
- On 27 July 2026 at approximately `15:08 (+05:30)`, owner Amit authorized and
  enabled the seven-day Point-in-Time Recovery add-on after upgrading production
  compute from Nano to Small. The signed-in `Point in time` page confirms that
  database changes are logged every two minutes with a recovery retention period
  of up to seven days. At verification time it reported a restore range from
  `20 Jul 2026 16:05:50` through `27 Jul 2026 15:07:41` in the dashboard's
  selected `UTC+05:30` timezone.
- The compute restart completed successfully. Anonymous production smoke
  verification subsequently showed the JEE catalogue restored with 83 courses,
  NEET still marked `Coming soon`, and no browser console warnings or errors.
- PITR activation satisfies the protection-control half of the destructive
  migration gate. The v3-through-v11 lineage remains blocked until a restore to
  an isolated project has been completed, verified, and recorded below.
- On 27 July 2026, owner Amit accepted the active daily automatic backup as
  sufficient specifically for create-only, additive chapter and reviewed
  content imports. The confirmed restore path is the Supabase Pro daily-backup
  restore for this production project.
- This limited waiver does not cover schema migrations, in-place corrections,
  updates, deletes, or any destructive operation. Those remain blocked until
  PITR (or an equivalent control) and a restore-readiness rehearsal are
  recorded.
- On 27 July 2026, owner Amit refined the waiver to also cover additive,
  create-only schema migrations that add objects without altering or dropping
  existing objects or performing migration-time updates/deletes. The owner
  specifically authorized `per_video_chapter_import_v12.sql` under the active
  daily backup.
- Destructive or in-place migrations remain outside the waiver and still
  require PITR (or an equivalent control) plus a restore-readiness rehearsal.
- Additive chapter creation and reviewed, one-manifest-at-a-time imports may
  proceed with a dry-run before every write and post-import verification.
  Staging validation and production read-only checks may also continue.
- Staging-only checkpoints now exist for General Organic Chemistry: Part 2
  (course/chapter `1244` / `152`), Indefinite Integration (`1245` / `153`),
  and Limits (`1251` / `158`). None is production-approved, and none may be
  promoted merely because its content and staging checks passed.

Recheck the dashboard and replace this section with completed evidence before
the next production write. Do not infer backup coverage from earlier green CI,
successful migrations, or previous imports.

## Before a production write

The owner must record:

1. Supabase project name and project reference shown in the dashboard.
2. Backup type and creation time.
3. Retention or expiry time.
4. Restore destination and restore procedure.
5. Date and result of the most recent restore exercise.
6. Person authorized to approve rollback.

Do not begin a migration, destructive correction, or mass import if any item is
unknown.

## Minimum evidence

- The backup predates the planned write.
- The backup includes Postgres data and schema objects needed by the catalogue,
  authentication profiles, RLS policies, triggers, and RPC functions.
- A restore can target an isolated project without overwriting the active
  project.
- The operator has the matching migration or import input, commit hash, command,
  and sanitized preflight report.
- Rollback criteria are numerical and decided before execution.

Examples of useful stop criteria for ingestion include unexpected insert
counts, missing metadata above an agreed percentage, duplicate video overlap,
unknown taxonomy labels, authorization errors, or cleanup mismatch.

## Restore rehearsal

Use an isolated Supabase project:

1. Restore the selected backup.
2. run read-only row-count and capability checks;
3. open the student browse flow with the restored project;
4. inspect representative courses, lesson links, taxonomy, and permissions;
5. record the elapsed restore time and any manual steps;
6. discard the isolated restore only after the evidence has been saved.

Never use production as the destination for a rehearsal.

### NEET isolated restore rehearsal — passed

```text
Date: 2026-07-27
Operator: Codex under owner Amit's approval
Source production project: youtube / kezelafqhgqrprpadmlf
Restore point: 27 Jul 2026 15:11:42 (UTC+05:30)
Isolated project: youtube-neet-restore-rehearsal-20260727
Isolated project reference: napkhqkdsqmnunxwnurr
Region: ap-northeast-1
Compute: Small
```

The restore created a new project without modifying production. Initial
read-only integrity checks passed:

- 83 playlists;
- 1,307 playlist-video memberships;
- 123 chapter rows with maximum chapter ID 127;
- 4 subjects;
- 1 auth user and 1 matching public profile;
- 49 public-schema RLS policies;
- anonymous-role reads returned the same 83 playlists, 1,307 memberships, and
  123 chapters;
- the legacy `import_playlist(jsonb,text)` lineage and v12 capability were both
  absent, matching the production preflight.
- a production-mode frontend build pointed only at the isolated project loaded
  the restored catalogue successfully;
- the anonymous home page showed JEE live with 83 courses and NEET still
  hidden as `Coming soon`;
- the representative student path JEE -> Class 11 -> Physics -> Kinematics
  returned 4 courses;
- opening Rectilinear Motion (Kinematics) loaded its embedded YouTube player,
  10-lesson list, lesson navigation, and restored course metadata.

The isolated project remains retained for evidence review. This record now
clears the restore-rehearsal half of the destructive migration gate.

The migration rehearsal used a read-only capability matrix first. The restored
project was mixed-version: v6, v7, v8, and content-quality v10 were missing,
while catalogue navigation v9, playlist-order v10, content reports v10, and
catalog management v11 were already present. Already-present layers were not
rerun.

The missing lineage was then applied to the isolated project in dependency
order:

1. the hash-verified v6 production bundle
   (`f158df644e7be45d924ff17d0ebb13435cef5e1ee67bc8fda3bddca7a9fdbbe6`);
2. `teachers_v7.sql`, `teachers_v7_import.sql`,
   `teachers_v7_admin_ui.sql`, and `universal_search.sql`;
3. `comparison_metadata_v8.sql`;
4. `content_quality_v10.sql`;
5. the read-only v12 preflight;
6. `per_video_chapter_import_v12.sql`
   (`e1d755dcc9aacc4c1a7488b98961f4e33d7dff12647bad28c8b3d9ea290482a2`);
7. the read-only v12 postflight.

Every step succeeded. The v6 migration reported all 83 courses in agreement,
zero backfills, zero remaining drift, and enabled synchronization triggers.
The v12 preflight returned true for every prerequisite. Its postflight passed
and advertised capability version 12 with create-only, request-replay,
all-or-none mapping, audit snapshot, and per-video chapter support.

Final row counts remained 83 playlists, 1,307 playlist-video memberships, and
123 chapters. The v12 audit table contained zero records, confirming that the
rehearsal installed capabilities but imported no content. A post-migration
frontend regression again showed JEE live with 83 courses, NEET hidden as
`Coming soon`, and the Rectilinear Motion course with its YouTube player and
10-lesson list.

The isolated project is retained pending the production decision and can be
discarded after this evidence is accepted. This rehearsal does not itself
authorize production migration or content import; production still requires a
fresh capability preflight, exact artifact hashes, explicit owner approval,
one migration/import at a time, and stop-on-mismatch handling.

### NEET Gate R3 clone import rehearsal — passed

```text
Date: 2026-07-27
Target: youtube-neet-restore-rehearsal-20260727 / napkhqkdsqmnunxwnurr
Scope: isolated clone only
Production writes: zero
Release pushes: zero
```

The owner dropped Path B to avoid a second billable clone and directed Gate R3
to use the existing migrated clone. The accidentally created fresh Path B clone
was permanently deleted before this gate; it held no unique data.

Both mapped v12 anonymous dry-runs passed:

- `neet-vardaan-biology.json`: 6 published / 6 usable videos, 6 exact
  assignments, 5 resolved chapters, zero duplicate video IDs, zero duplicate
  lesson numbers, zero missing durations, zero non-embeddable videos, teacher
  evidence present, and no blocking or review findings.
- `neet-ummeed-2025-class-11-physics.json`: 15 published / 15 usable videos,
  15 exact assignments, 12 resolved chapters, zero duplicate video IDs, zero
  duplicate lesson numbers, zero missing durations, zero non-embeddable videos,
  teacher evidence present, and no blocking or review findings.

The importer then executed both create-only mapped v12 writes, one manifest at
a time, with explicit production-mode confirmation pointed at the clone:

- Vardaan Biology created course `91`, 6 videos, and 6 memberships; it reused
  the pre-created chapter reference rows and created no chapters.
- UMMEED Class 11 Physics created course `92`, 15 videos, and 15 memberships;
  it reused the pre-created chapter reference rows and created no chapters.

The before/after catalogue evidence was:

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Courses | 83 | 85 | +2 |
| Playlist-video memberships | 1,307 | 1,328 | +21 |
| Unique videos | 1,303 | 1,324 | +21 |
| Chapters | 123 | 123 | 0 |
| JEE courses | 83 | 83 | 0 |
| JEE memberships | 1,307 | 1,307 | 0 |
| NEET courses | 0 | 2 | +2 |
| NEET memberships | 0 | 21 | +21 |

The ordered JEE course-and-membership SHA-256 fingerprint was
`85d5f2e462f07bcc72b1223bc200c0d9413137182f1a98f341ac18fd8993832e`
both before and after the imports.

Anonymous clone browser verification showed:

- JEE browse: exactly 83 courses; Competition Wallah/NEET content contributed
  zero results to the JEE-scoped facets.
- NEET Class 11 browse: one Physics and one Biology course; a NEET-scoped
  chapter view showed zero JEE courses.
- Vardaan Biology course `91` displayed all 6 lessons across the 5 mapped
  chapters. Its first and last official YouTube embeds loaded with the expected
  video IDs (`LyvqUtWgtZ0` and `AD1XA8T5S_0`).
- Representative JEE course `39` displayed its original 8 lessons. Its first
  and last official YouTube embeds loaded successfully.

Gate R3 is complete on the clone. This evidence does not authorize any
production migration or NEET production import.

### Production v6-through-v12 migration — passed

```text
Date: 2026-07-27
Operator: Codex under owner Amit's explicit approval
Production project: youtube / kezelafqhgqrprpadmlf
PITR rollback target: 27 Jul 2026 16:42:24 (UTC+05:30)
PITR retention: 7 days; changes logged every 2 minutes
Content imported: none
Release branch changed: no
```

The production capability matrix matched the isolated restore rehearsal before
the first write:

- missing: v6 importer/validator, v7 faculty, v8 comparison metadata, and
  content-quality v10;
- present: catalogue navigation v9 and catalogue management v11;
- baseline: 83 playlists, 1,307 playlist-video memberships, and 123 chapters;
- baseline JEE fingerprint:
  `d7aae3ce7635401ebeffe97e627048bc`.

The migrations were applied and verified one artifact at a time:

1. `production/production_migration.sql`
   (`f158df644e7be45d924ff17d0ebb13435cef5e1ee67bc8fda3bddca7a9fdbbe6`)
   reported 83 courses in agreement, zero backfills, zero drift after the
   migration, and enabled synchronization triggers.
2. `teachers_v7.sql`
   (`0f190ff2763096dcdacc29fd11ea2a4c8667e903c52c18fd54366ace788bebff`),
   `teachers_v7_import.sql`
   (`49e923bbb5b373b0e502d39e12e77d0051b98879446a2971967a7af5f9f6015c`),
   `teachers_v7_admin_ui.sql`
   (`701e0f5a496c0702c66f6c0bd9b2e8307a58f3cdf1cc0c4e5a3234722a8a1e91`),
   and `universal_search.sql`
   (`11a2672fb393e83dfcc94fc111a7f8b80c1df992c0225408171171532106212a`)
   installed the faculty, import, admin-review, and universal-search
   capabilities. Counts remained 83 / 1,307.
3. `comparison_metadata_v8.sql`
   (`5140aacf135c90cb39c430e061c2c2099a97c946ba64e605db80bb1ca450a0ec`)
   installed the comparison tables and RPC. Counts remained 83 / 1,307.
4. `content_quality_v10.sql`
   (`d3feb81f5e4e0695e8d1519bbe3e993d08ed9ca2585e7245b818c7e9e18b2bca`)
   installed the quality-review capability and left zero missing source
   titles. Counts remained 83 / 1,307 / 123.
5. The v12 read-only preflight
   (`a0fd6453b9918dae7cb88beafdd1c2833f6538d99b64cbb9ab33b7c3474ca46b`)
   returned true for all nine prerequisites.
6. `per_video_chapter_import_v12.sql`
   (`e1d755dcc9aacc4c1a7488b98961f4e33d7dff12647bad28c8b3d9ea290482a2`)
   installed successfully.
7. The v12 postflight
   (`c66c14bb320bacea0997ab6323743dfd1d55961cfc2811a9c689f10c2547bd7b`)
   passed. The advertised capability is version 12 with create-only,
   request-replay, all-or-none mapping, audit snapshot, and per-video chapter
   support.

Final production evidence:

- exactly 83 playlists, 1,307 memberships, and 123 chapters;
- JEE fingerprint still
  `d7aae3ce7635401ebeffe97e627048bc`;
- zero rows in `playlist_import_audit`, proving no mapped content import ran;
- anonymous production home showed JEE live with 83 courses and NEET still
  `Coming soon`;
- representative JEE course `39` retained all 8 lessons and loaded the first
  and last official YouTube embeds;
- production home and course reload checks emitted no browser console events or
  page errors.

No NEET course was imported and the frontend release state was not changed.
Content imports and the NEET-live frontend switch remain separately gated.

## Change record template

```text
Date:
Operator:
Production project reference:
Commit:
Change or import command:
Backup timestamp:
Restore rehearsal date:
Expected rows affected:
Actual rows affected:
Stop criteria:
Rollback decision:
Evidence location:
```

Keep secrets out of the record. Store project keys only in the ignored
environment files intended for them.

## NEET launch change record — chapter reference data

```text
Date: 2026-07-27
Operator: Codex, authorized by owner Amit
Production project reference: kezelafqhgqrprpadmlf
Commit: operational data write; working source based on main 3dc1b34
Change: create-only NEET manifest chapter reference data
Backup timestamp: 26 Jul 2026 18:34:45 (+0000)
Restore path: Supabase Pro daily-backup restore for the production project
Plan SHA-256: 8a218485eb8215be05bc3a73585c786f3d089a6fbf0a4aec926e6486dbd4090a
Expected rows affected: 48 chapter inserts; 28 exact chapter reuses
Actual rows affected: 48 chapter inserts (IDs 80 through 127); 28 exact reuses
Postflight: all 76 unique chapter names required by the 14 manifests resolve exactly
Stop criteria: unexpected project ref, manifest count, plan hash, create/reuse
  counts, name/slug conflict, insert count, or unresolved postflight chapter
Rollback decision: not triggered
```

The per-video-chapter v12 capability was still absent from production after this
write (`PGRST202`). The owner subsequently halted the NEET launch before any
course import or v12 installation.

### v12 production preflight — blocked

The authorized migration was **not applied**. Its existing read-only production
preflight failed closed on 27 July 2026 because required base objects are
missing:

```text
per_video_chapter_import_v12.sql SHA-256:
e1d755dcc9aacc4c1a7488b98961f4e33d7dff12647bad28c8b3d9ea290482a2

Missing:
- public.import_playlist(jsonb,text)
- public.validate_import_payload(jsonb,text,boolean)
- public.playlist_boards
- public.app_environment

Present:
- public.catalog_playlist_snapshot(bigint)
- public.catalog_video_taxonomy_snapshot(bigint)
- public.playlists
- public.videos
- public.playlist_videos
```

The missing objects belong to earlier importer/environment prerequisites. They
must not be inferred, bypassed, or recreated as part of v12. Installing those
earlier prerequisites is a separate production migration decision and remains
outside the specific authorization to install `per_video_chapter_import_v12.sql`.

## NEET launch deferred — owner decision 27 July 2026

Production will launch JEE-only. The NEET import is formally halted:

- Do not install `per_video_chapter_import_v12.sql`.
- Do not apply the v3 through v11 import/catalogue lineage to production.
- Do not run further NEET production or staging dry-runs, chapter writes,
  content imports, or related production migrations until the owner formally
  reopens the project.
- Keep the 48 additive chapter rows created above (IDs 80 through 127). They are
  approved reference data, require no rollback, remain reusable for a future
  NEET launch, and do not expose empty chapters in the current browse UI.

The deferral is required because production is missing the earlier
import/catalogue layer. Closing that gap is an in-place migration: it rewrites
class-level relationships across the 83 live JEE courses, introduces
`NOT NULL` columns and `CHECK` constraints, and redefines
`public.import_playlist`. Those operations are outside the additive waiver and
require PITR (or equivalent protection) plus a rehearsed isolated restore.

The only approved future reopening sequence is:

1. enable PITR or establish an equivalent protection control;
2. complete and record an isolated restore rehearsal;
3. apply and verify the v3 through v11 lineage in order;
4. install and verify v12;
5. revalidate and import the reviewed NEET manifests one at a time.

## RAFTAAR Biology production gate — 28 July 2026

The owner approved the three candidates in the exact order recorded in
`neet-content-readiness-registry-2026-07-28.json`:

1. Chemical Coordination and Integration
2. Neural Control and Coordination
3. Anatomy of Flowering Plants

Immediately before the gated imports, the Supabase production dashboard for
project `kezelafqhgqrprpadmlf` showed:

```text
PITR retention: 7 days
Earliest restore point: 21 Jul 2026 00:41:01 UTC+05:30
Latest restore point:   28 Jul 2026 00:41:01 UTC+05:30
Latest point in UTC:    27 Jul 2026 19:11:01 UTC
```

The latest point is the recorded rollback target for this three-playlist gate.
The dashboard restore action was not started. Every playlist remains subject
to its own fresh anonymous dry-run, create-only import, exact delta checks, and
JEE fingerprint verification before proceeding to the next.

## Remaining readiness-registry production gate — 28 July 2026

After courses 105 through 107 passed postflight, the owner granted standing
authorization for all 12 remaining registry candidates, including the recorded
principal-chapter mapping decisions and exact combined Vardaan faculty labels.

The refreshed production PITR dashboard showed:

```text
PITR retention: 7 days
Earliest restore point: 21 Jul 2026 01:13:03 UTC+05:30
Latest restore point:   28 Jul 2026 01:13:03 UTC+05:30
Latest point in UTC:    27 Jul 2026 19:43:03 UTC
```

This post-RAFTAAR point is the rollback target for the remaining registry gate.
The restore action was not started. Standing authorization does not waive the
per-playlist anonymous dry-run, create-only boundary, or immediate JEE
fingerprint stop condition.

## Botany chapter and two-course production gate — 28 July 2026

Before the Molecular Basis chapter write, the signed-in production dashboard
showed:

```text
PITR retention: 7 days
Earliest restore point: 22 Jul 2026 00:02:47 UTC+05:30
Latest restore point:   28 Jul 2026 01:47:03 UTC+05:30
```

The latest point is the recorded rollback target for this gate. The restore
action was not started. The guarded plan created chapter 128, after which
course 120 (10 lessons) and course 121 (15 lessons) were imported create-only.
The JEE fingerprint remained
`d7aae3ce7635401ebeffe97e627048bc` after every write.

## Reviewed-evidence Zoology production gate — 28 July 2026

Before the approved MISSION 30 Zoology import, the signed-in production
dashboard showed:

```text
PITR retention: 7 days
Earliest restore point: 22 Jul 2026 00:02:47 UTC+05:30
Latest restore point:   28 Jul 2026 09:41:19 UTC+05:30
```

The latest point is the rollback target for evidence decision
`c8cf544a-bd1f-4a2c-9a7e-d8490185a86c`. The restore action was not started.
The create-only import produced course 122 with 10 new videos and memberships,
zero reused videos, and zero chapters. The JEE fingerprint remained exact.

## Biological Classification RAFTAAR additive import — 28 July 2026

Before the create-only import, the Supabase PITR dashboard showed active
7-day retention and a latest restore point of `28 Jul 2026 10:37:21
UTC+05:30`. Production held 115 courses and 1,660 memberships; JEE held
exactly 83 courses and 1,307 memberships with fingerprint
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGUif6J3v0VsGbqnM8v0_cAv` passed a fresh anonymous
production dry-run with 8 published and 8 usable videos, no existing playlist,
no duplicate video IDs, no missing duration or embedding blocker, and the
existing Biological Classification chapter resolved. All eight source
descriptions directly credit Yashika ma’am; the importer now treats the
Unicode apostrophe in that honorific as equivalent to the ASCII spelling.

The create-only import produced course 123 with 8 new videos, 8 memberships,
zero reused videos, and zero chapters. Anonymous verification confirmed the
`neet` goal, Class 11 taxonomy, and working first and last official YouTube
embeds with no console warnings or errors. The immediate post-write JEE check
remained exactly 83 courses and 1,307 memberships with the unchanged
fingerprint above.

## Cell RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 10:41:21 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGXssnsUu88TqpFCSdDuRiCA` had 6 public, embeddable videos;
all six descriptions directly credited Yashika ma’am. An initial production
command used the non-existent spelling `Cell - The Unit of Life` and stopped
before any mutation. The corrected anonymous dry-run used the exact existing
chapter `Cell: The Unit of Life` and explicitly reported `action: reuse`,
zero production blockers, no existing playlist, and zero quality findings.

The create-only retry produced course 124 with 6 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.
