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
