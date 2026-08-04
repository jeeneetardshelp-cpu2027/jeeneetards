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

## Biomolecules RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 10:51:22 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGWdGiHo8NAzjyoPJ8f-WnxW` passed a fresh anonymous
production dry-run with 6 published and usable videos, no existing playlist,
no duplicate IDs, explicit Biomolecules chapter reuse, and zero blockers or
quality findings. Five consecutive descriptions directly credit Diksha Sharma
ma’am; the sixth practice session has no conflicting teacher credit.

The create-only import produced course 125 with 6 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Cell Cycle RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 10:57:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGUTn_FLRZy6bOmEQsaYU04W` passed a fresh anonymous
production dry-run with 4 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All four descriptions directly credit Yashika ma’am.

The create-only import produced course 126 with 4 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Photosynthesis RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:07:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGXUg1g7-QhV6yT7zlusZyst` passed a fresh anonymous
production dry-run with 6 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All six descriptions directly credit Yashika ma’am.

The create-only import produced course 127 with 6 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Respiration in Plants RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:11:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGUtHKU5qKGA98dIq2R39uQl` passed a fresh anonymous
production dry-run with 4 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All four descriptions directly credit Yashika ma’am.

The create-only import produced course 128 with 4 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Plant Growth RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:13:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGWRGzRbsaJMzdezxUOihCz2` passed a fresh anonymous
production dry-run with 3 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All three descriptions directly credit Yashika ma’am.

The create-only import produced course 129 with 3 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Breathing RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:17:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGXj5G926WZsNUPRWW_fXSGy` passed a fresh anonymous
production dry-run with 4 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All four descriptions directly credit Diksha Sharma Ma'am.

The create-only import produced course 130 with 4 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Locomotion RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:21:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGUhrtC9k3dU95QfeSN86siz` passed a fresh anonymous
production dry-run with 3 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All three descriptions directly credit Diksha Sharma Ma'am.

The create-only import produced course 131 with 3 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Excretory Products RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:27:23 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGUxPEVZQAL8i8SxXq4AAHXf` passed a fresh anonymous
production dry-run with 4 published and usable videos, no existing playlist or
duplicate IDs, explicit reuse of the canonical `Excretory Products and Their
Elimination` chapter, and zero blockers or findings. All four descriptions
directly credit Diksha Sharma Ma'am.

The create-only import produced course 132 with 4 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Body Fluids RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:31:24 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGVbEFnOZa1m2mJaN9RcuDXv` passed a fresh anonymous
production dry-run with 3 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
All three descriptions directly credit Diksha Sharma Ma'am.

The create-only import produced course 133 with 3 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Structural Organisation RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:33:24 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGVQx0FZY8t4IUWMSOQwlmhb` passed a fresh anonymous
production dry-run with 6 published and usable videos, no existing playlist or
duplicate IDs, explicit reuse of the canonical `Structural Organisation in
Animals` chapter, and zero blockers or findings. All six descriptions directly
credit Diksha Sharma Ma'am.

The create-only import produced course 134 with 6 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## Plant Kingdom RAFTAAR additive import — 28 July 2026

The signed-in PITR dashboard showed active 7-day retention and latest restore
point `28 Jul 2026 11:37:24 UTC+05:30`. The pre-write JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

Playlist `PLJyab0VQDBGWRpflhEkpXPVZRxKCHXDuQ` passed a fresh anonymous
production dry-run with 4 published and usable videos, no existing playlist or
duplicate IDs, explicit existing-chapter reuse, and zero blockers or findings.
The first three consecutive descriptions directly credit Yashika ma'am; the
fourth continuation has no conflicting attribution. The established PW faculty
identity is Yashika Singh Ma'am.

The create-only import produced course 135 with 4 new videos and memberships,
zero reuse, and zero chapters. Anonymous first/last embed checks passed with no
console warnings or errors. JEE remained exactly 83 courses and 1,307
memberships with the unchanged fingerprint.

## JEE faculty batch-1 additive migration — 28 July 2026

Before the separately approved production write, the signed-in PITR dashboard
showed active 7-day retention and latest restore point
`28 Jul 2026 13:21:28 UTC+05:30`.

The exact clone-rehearsed artifact SHA-256 was
`3e2c481904a900e1f6053722b9aa39ed3e947a71a564283e2867330386bf4da4`.
Production preflight showed 128 courses, 1,721 memberships, 124 chapters,
83 JEE courses, 1,307 JEE memberships, zero existing normalized faculty rows,
and fingerprint `d7aae3ce7635401ebeffe97e627048bc`.

The transaction added four verified teachers, eight verified aliases, four
institute links, four subject links, four JEE learning-goal links, and exactly
83 JEE course links. It added zero NEET links and changed no existing JEE
course or membership. Anonymous search, facets, profiles, public JEE browse,
and representative course 39 passed postflight with no console warnings or
errors. The JEE fingerprint remained exact.

## NEET faculty normalization backup boundary — 28 July 2026

NEET faculty review and artifact preparation performed no database writes.
Source review covers 43 of 45 NEET courses, but none of the three prepared NEET
faculty artifacts has been executed on a clone or production.

The existing restore clone predates production course IDs 91–135. It is not a
valid rehearsal target for this work. A future execution requires:

1. explicit approval to create a fresh current-production restore clone;
2. baseline verification of 128 courses, 83 JEE, 45 NEET, and JEE fingerprint
   `d7aae3ce7635401ebeffe97e627048bc`;
3. the artifact-by-artifact clone gates in
   `docs/faculty_registry_neet_rollout_plan_2026-07-28.md`;
4. owner review of the complete clone report;
5. a new exact production PITR restore point and separate approval naming one
   hash-pinned artifact.

The PITR timestamp recorded for the completed JEE faculty migration is
historical evidence only. It must not be reused as the rollback target for a
future NEET faculty write.

## NEET faculty batch-1 additive migration — 28 July 2026

Before the separately approved production write, the signed-in production PITR
dashboard showed active 7-day retention and latest restore point
`28 Jul 2026 15:16:22 UTC+05:30`.

The approved clone-rehearsed artifact SHA-256 was
`cdc67cc1fa3bb9f975a9610b1e78b0997e49fc8d035a0bad51bf4e7f09a75c94`.
Production matched the rehearsal baseline exactly: 128 playlists, 83 JEE
courses, 45 NEET courses, 1,721 memberships, 1,307 JEE memberships,
124 chapters, four teachers, eight aliases, 83 faculty links, and no existing
batch-1 teachers. The protected JEE fingerprint was
`d7aae3ce7635401ebeffe97e627048bc`.

The transaction added exactly two verified teachers, three verified aliases,
and 16 reviewed NEET course links. Postflight totals were six teachers,
11 aliases, and 99 faculty links. Diksha Sharma and Yashika Singh each returned
eight courses through the anonymous faculty-profile RPC; both responses were
HTTP 200. There were zero JEE cross-goal links. Playlist, membership, chapter,
JEE-course, and JEE-membership counts remained unchanged, and the protected
JEE fingerprint remained exact.

No batch 2–3 or course-91 artifact was applied. Each remains a separate
production gate requiring fresh PITR evidence and explicit approval naming its
exact SHA-256.

## NEET faculty batch 2–3 additive migration — 28 July 2026

Before the separately approved production write, the signed-in production PITR
dashboard showed active 7-day retention and latest restore point
`28 Jul 2026 15:54:24 UTC+05:30`.

The approved clone-rehearsed artifact SHA-256 was
`2ffde08d54e5049c38da413406fd5c914937d5a81b93145e717b010b1bec6f64`.
Production matched the expected post-batch-1 baseline: 128 playlists, 83 JEE
courses, 45 NEET courses, 1,721 memberships, 1,307 JEE memberships,
124 chapters, six teachers, 11 aliases, 99 faculty links, and fingerprint
`d7aae3ce7635401ebeffe97e627048bc`.

The transaction added exactly 18 verified teachers, 26 verified aliases, and
26 reviewed NEET course links. Postflight totals were 24 teachers, 37 aliases,
and 125 faculty links. All 18 new faculty profiles returned HTTP 200
anonymously, were verified, matched their requested slugs, and collectively
returned 26 mapped courses. There were zero JEE cross-goal links. Courses 91,
118, and 119 remained unlinked. Playlist, membership, chapter, JEE-course, and
JEE-membership counts remained unchanged, and the protected JEE fingerprint
remained exact.

The course-91 artifact was not applied. It remains a separate production gate
requiring fresh PITR evidence and explicit approval naming its exact SHA-256.

## NEET faculty course-91 additive migration — 28 July 2026

Before the separately approved production write, the signed-in production PITR
dashboard showed active 7-day retention and latest restore point
`28 Jul 2026 15:58:25 UTC+05:30`.

The approved clone-rehearsed artifact SHA-256 was
`992df1e36d7c38ff3aaae12ed5cc7884c8bfacd44d5c97a2eacc413a18eb20d6`.
Production matched the expected post-batch-2–3 baseline: 128 playlists, 83 JEE
courses, 45 NEET courses, 1,721 memberships, 1,307 JEE memberships,
124 chapters, 24 teachers, 37 aliases, and 125 faculty links. Course 91 had
zero normalized faculty links, Tarun Kumar did not yet exist, Samapti Sinha
did exist, the legacy label remained `Tarun Sir & Samapti Ma'am`, and the
protected JEE fingerprint matched
`d7aae3ce7635401ebeffe97e627048bc`.

The transaction added exactly one verified teacher, two verified aliases, and
two course links. Course 91 now links Tarun Kumar at position 1 and Samapti
Sinha at position 2. Anonymous faculty-profile calls returned HTTP 200:
Tarun Kumar returned one course and Samapti Sinha returned two. Postflight
totals were 25 teachers, 39 aliases, and 127 faculty links. Courses 118 and 119
remain intentionally unlinked, the course-91 legacy combined label remains
unchanged, and there were zero JEE cross-goal links. Playlist, membership,
chapter, JEE-course, and JEE-membership counts remained unchanged, and the
protected JEE fingerprint remained exact.

## NEET faculty restore-clone cleanup — 28 July 2026

After all clone-rehearsed NEET faculty artifacts passed their separately gated
production writes and final read-only production QA, the owner explicitly
approved permanent deletion of only
`youtube-neet-faculty-restore-rehearsal-20260728`
(`nxicoflvbxiemqjiqraz`).

The Supabase project settings page was checked immediately before deletion and
showed that exact project name and reference. After the permanent deletion
completed, the project no longer appeared in the organization project list.
Production `youtube` (`kezelafqhgqrprpadmlf`) remained present and untouched.

The older rehearsal clone `youtube-neet-restore-rehearsal-20260727`
(`napkhqkdsqmnunxwnurr`) was outside this approval and remains present.

The owner subsequently gave a separate explicit approval to permanently delete
that older rehearsal clone. Its project page was verified as
`youtube-neet-restore-rehearsal-20260727`
(`napkhqkdsqmnunxwnurr`) immediately before deletion. After deletion completed,
it no longer appeared in the organization project list. Production `youtube`
(`kezelafqhgqrprpadmlf`) remained present and untouched. No restore rehearsal
clones remain; the organization list contains the two staging projects and
production.

## Competishun+ ordered Mathematics imports — 30 July 2026

The owner reviewed and accepted a protected-baseline change caused by 43
memberships appended to existing JEE course 13, `Kinematics | Irodov
solutions`. The additions are Irodov Q.1.28 through Q.1.70. All 43 YouTube
video IDs existed and were embeddable when checked, but the official source
playlist exposed only its original 24 items at verification time. This is an
explicit owner-approved catalogue exception; it must not be mistaken for an
exact mirror of the current YouTube playlist.

The newly approved protected set is exactly 83 JEE courses and 1,350
memberships with fingerprint
`6829fcb6eae22479db7b82b7b3da654d`. Future protected-set checks must use this
fingerprint unless a later owner-approved baseline change is recorded.

Three reviewed Competishun+ Mathematics manifests were then imported
create-only in natural lecture-number order:

- course 193, Statistics Class XI: 2 new videos, zero reused;
- course 194, Complex Numbers Class XII: 9 new videos, zero reused;
- course 195, Probability Class XII: 8 new videos, zero reused.

Every manifest passed an anonymous dry-run before writing. After each import,
the protected 83-course fingerprint remained
`6829fcb6eae22479db7b82b7b3da654d`. The final rolling JEE catalogue was 112
courses and 1,570 memberships with fingerprint
`56f00c7db6fc1e8ff9b6f19250614e3f`.

Production browser QA confirmed the correct JEE Mathematics and class tags,
natural L1-to-final ordering, and working first and final YouTube embeds for
all three courses. No browser console warnings or errors were observed.

## Addendum, 31 July 2026 — a from-scratch restore today needs one more step

The two lineages recorded above (the 27 July isolated-restore rehearsal and
the 27 July production migration) both applied `universal_search.sql` as
step 2 of the missing-lineage list. That was correct and complete for what
existed on 27 July. It is no longer complete: on 30 July 2026, production's
search was further upgraded by `docs/sql/search_v11_2026-07-30.sql` (built
from `src/migrations/search_latin_key_v11.sql` +
`src/migrations/universal_search_v11.sql`, in that order — the second file's
own preflight refuses to continue without the first), fixing a
non-sargable-predicate performance bug and a single-token-only fuzzy-match
bug. That upgrade is not reflected in either lineage list above.

A restore performed strictly by replaying the lineages recorded above —
including applying `universal_search.sql` at step 2 exactly as written —
would leave a restored database on the pre-v11 search implementation, not
the search production actually runs today. **A restore performed after this
addendum's date should apply `docs/sql/search_v11_2026-07-30.sql` (or the
two `src/migrations/` files it concatenates, in the stated order)
immediately after the same step where `universal_search.sql` is applied
above**, not as a substitute for reading this document, but as an explicit
correction the historical entries above cannot self-update to reflect.

This gap was found by `docs/schema_reference.md`'s schema audit while
tracing a different, related issue: `production/faculty_quality_production.sql`
(an unrelated bundle file that also concatenates a copy of search) embedded
the same stale `universal_search.sql` and has separately been corrected to
reference the v11 files (see that file's own header and
`src/scripts/buildFacultyQualityProductionPackage.js`). The two fixes are
independent — this addendum covers the restore-lineage document specifically,
since a restore does not go through that bundle file at all.

## Operational checkpoint — 3 August 2026

The current database and recovery boundary is:

- production remains `youtube` / `kezelafqhgqrprpadmlf`;
- chapter/class scopes v14 was applied once on 2 August 2026 and its independent
  postflight passed;
- the reviewed v14 source SHA-256 is
  `6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459`;
- the pre-write PITR point recorded for that completed operation was
  `02 Aug 2026 13:31:42 UTC+05:30`;
- the verified postflight catalogue was 292 playlists, 3,088 videos, 3,094
  memberships, 241 chapters, 9 subjects, and 90 chapter/class scope rows;
- the protected original 83-course JEE slice remained at 1,307 memberships with
  fingerprint `c742fabf93ff8dd33d6ecd5eb4793db0` under the v14 postflight's
  defined fingerprint query;
- both historical NEET restore-rehearsal projects were permanently deleted
  after their evidence was accepted; no restore clone remains active.

See
[chapter-class-scope-v14-readiness-2026-08-02.md](chapter-class-scope-v14-readiness-2026-08-02.md)
for the hash-verified apply and postflight evidence. The older fingerprints and
restore points elsewhere in this document are historical gate records. They
must not be substituted for the exact query, baseline, and fresh restore point
required by a future change.

Do not rerun v13 or v14, start a restore, create a clone, or execute a checked-in
migration merely because it is present in the repository. Before any future
production write, re-open the Supabase PITR page, record the then-current latest
restore point, snapshot the live numerical baseline, and obtain approval for
the exact hash-verified artifact or manifest.

This 3 August release-hardening update performed no database write, migration,
content import, restore, clone operation, or manual CI dispatch.

## Competishun+ upload-only imports — 3 August 2026

Before the separately approved two-course create-only batch, the signed-in
production PITR dashboard showed active 7-day retention and latest restore
availability at `03 Aug 2026, 14:08:32 UTC+05:30`. Both source-ID-null
transactions passed fresh anonymous dry-runs, exact baseline/reuse guards, and
post-import verification. They created courses `303` and `304`, five videos,
and five memberships without reusing or modifying existing catalogue rows.

The immediate post-batch totals were 294 playlists, 3,093 videos, 3,099
memberships, and 241 chapters. Separate catalogue writers subsequently
advanced live totals; those later changes are outside this batch. The protected
original-83 JEE fingerprint remained
`c742fabf93ff8dd33d6ecd5eb4793db0`; rolling JEE was 168 courses / 1,896
memberships / `583e60e33ec1ed25f3f237a94e98f185`. Full evidence and artifact hashes
are recorded in
[competishun-upload-only-imports-2026-08-03.md](competishun-upload-only-imports-2026-08-03.md).

## PRMO and IOQM Solutions production gate — 3 August 2026

Before this create-only chapter and course batch, the signed-in production PITR
dashboard showed active 7-day retention and latest restore availability at
`03 Aug 2026, 17:02:35 UTC+05:30`. The quiet-window course baseline was `317
playlists / 3,728 videos / 3,734 memberships / 242 chapters / 92 chapter-class
rows`; all four target video IDs were absent.

The batch created Mathematics chapter `298`, `PRMO and IOQM Solutions`, then
created source-ID-null Olympiad course `329`, `PRMO & IOQM Solutions
(2018–2022)`, with four new videos and four memberships. The chapter and course
artifact SHA-256 values are respectively
`9eac1540f7b5c580ae548d812b96f05009b84e5b466d1bc3ef17d3becccef91a` and
`c017a5dcc6e68c5cd5b45fe45180bfb9f565dfa34cf7a82821e4d6df9caa6874`.

One initial course transaction failed on the identity-backed
`playlist_videos.id` column and rolled back atomically. The corrected artifact
names the writable membership columns explicitly. A separate dashboard
client-side empty-query error also performed no database write. Exact read-only
rollback checks preceded the successful retry.

Final totals were `318 playlists / 3,732 videos / 3,738 memberships / 242
chapters / 92 chapter-class rows`. Protected original JEE remained `83 courses
/ 1,307 memberships / c742fabf93ff8dd33d6ecd5eb4793db0`; rolling JEE remained
`178 courses / 2,391 memberships / 0ed8376c5c5cea7d06b3beafbc59c45f`.
No restore or clone was created and no schema migration was run.

## Unacademy NEET first production batch — 3 August 2026

Before the owner-approved three-course create-only batch, the signed-in
production PITR dashboard showed active seven-day retention and latest restore
availability at `03 Aug 2026, 18:18:37 UTC+05:30`. The quiet-window preflight
was `329 playlists / 3,864 videos / 3,870 memberships / 245 chapters / 92
chapter-class rows`, with no source-course or retained-video collision.

Fresh anonymous dry-runs passed immediately before each write. Courses `341`,
`342`, and `343` were then created one at a time for Chemical Bonding,
Evolution, and Principles of Inheritance and Variation. The batch added 44
videos and 44 memberships, reused zero videos, and created no chapters. Final
counts were `332 / 3,908 / 3,914 / 245 / 92` in the same order as the preflight.

The protected original JEE slice remained exactly `83 courses / 1,307
memberships / c742fabf93ff8dd33d6ecd5eb4793db0` after every write. No restore,
clone, migration, update, delete, or `release` push was performed. Attribution
evidence for Ashwani Tyagi and Pradeep Singh is bound to owner decision
`6579f542-da9b-499f-bd46-3aa796ea4f27` in the exact manifests and review record.

The later faculty-registry link gate used final artifact SHA-256
`ad02e44f160000889d1836dd8e26f234337d3eef60d4febf44d59238bd4f5796`.
Immediately before that additive-only write, production PITR again showed
active seven-day retention and latest restore availability at `03 Aug 2026,
22:58:47 UTC+05:30`. Exact preflight and postflight probes passed. The package
added two verified teachers, four aliases, two institute links, two subject
links, two goal links, and three course-teacher links; catalogue totals stayed
`334 / 3,955 / 3,961 / 245 / 92`, and protected JEE stayed `83 / 1,307 /
c742fabf93ff8dd33d6ecd5eb4793db0`. No restore, migration, content write, or
`release` push occurred.

## Unacademy NEET third production batch — 4 August 2026

The owner approved the protected JEE rebaseline to 82 courses, 1,304
memberships, fingerprint `30eee4a4a6842e5beeb7c97083d7f812` after the
deliberate removal of Communication Systems course 66 and its three lessons.

Fresh seven-day PITR evidence and stable anonymous baselines preceded each
create-only import. Plant Morphology, Plant Kingdom, and Ray Optics became
courses 391, 392, and 393, adding 18, 11, and 10 videos respectively. The total
batch delta was +3 playlists, +39 videos, +39 memberships, zero chapters, and
zero reuse. Final totals were 374 playlists, 4,430 videos, 4,436 memberships,
and 247 chapters. The protected JEE boundary remained exact after every import;
rolling JEE remained 212 courses / 2,848 memberships / fingerprint
`9eea2b44f0b19c08cc0907c57e091342`. No release deployment was requested or
performed. Full evidence is recorded in
[unacademy-neet-third-batch-readiness-2026-08-04.md](unacademy-neet-third-batch-readiness-2026-08-04.md).

## Unacademy NEET fourth production batch — 4 August 2026

The owner approved three create-only courses under decision
`0bd393bd-1ad4-4ed7-8f23-74b59dee5a23`. Before each transaction, the signed-in
production dashboard confirmed active seven-day PITR; the recorded latest
restore points were `04 Aug 2026, 16:42:24 IST`, `16:52:25 IST`, and
`16:52:25 IST`. Each quiet-window baseline remained exact across its anonymous
dry-run, with zero source/video collision and an `ok` quality result.

Human Health and Disease, Body Fluids and Circulation, and Mole Concept became
courses 394, 395, and 396. They added 17, 7, and 9 videos/memberships
respectively, with zero reuse and no chapter creation. Final totals were 377
playlists / 4,463 videos / 4,469 memberships / 247 chapters. The protected JEE
boundary remained exactly 82 courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812` after every write. No restore, clone,
migration, update/delete, or `release` push occurred. Full evidence is in
[unacademy-neet-fourth-batch-readiness-2026-08-04.md](unacademy-neet-fourth-batch-readiness-2026-08-04.md).

## Unacademy NEET fifth production batch — 4 August 2026

The owner approved three create-only courses under decision
`461233dd-54d1-413f-9625-2ffe5f164226`, explicitly accepting `Mahendra S.` as
the reviewed abbreviation for verified teacher Mahendra Singh. Before every
transaction, the signed-in production dashboard confirmed active seven-day
PITR. Recorded latest restore points were `04 Aug 2026, 17:08:25 IST`,
`17:08:25 IST`, and `17:20:26 IST`. Each quiet-window baseline remained exact
across its anonymous dry-run, with zero source/video collision and an `ok`
quality result.

Ecosystem, Gravitation, and Wave Optics became courses 397, 398, and 399. They
added 6, 5, and 7 videos/memberships respectively, with zero reuse and no
chapter creation. Final totals were 380 playlists / 4,481 videos / 4,487
memberships / 247 chapters. The protected JEE boundary remained exactly 82
courses / 1,304 memberships / fingerprint
`30eee4a4a6842e5beeb7c97083d7f812` after every write; rolling JEE remained
212 / 2,848 / `9eea2b44f0b19c08cc0907c57e091342`. No restore, clone,
migration, update/delete, or `release` push occurred. Full evidence is in
[unacademy-neet-fifth-batch-readiness-2026-08-04.md](unacademy-neet-fifth-batch-readiness-2026-08-04.md).
