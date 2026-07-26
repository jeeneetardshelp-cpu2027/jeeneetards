# Backup and restore readiness

This is a release control for database-changing work. It does not attest that a
backup exists or that a restore exercise has passed.

## Current production status — 26 July 2026

- Project name: `youtube`.
- Project reference: `kezelafqhgqrprpadmlf`.
- The signed-in Supabase `Database Backups` page reports that this is a Free
  Plan project and that Free Plan does not include project backups.
- No qualifying production backup timestamp, retention window, restore
  destination, or isolated restore-rehearsal result is recorded.
- Therefore production migrations, content imports, chapter creation, and
  corrective data writes are blocked. Staging validation may continue.
- Staging-only checkpoints now exist for General Organic Chemistry: Part 2
  (course/chapter `1244` / `152`) and Indefinite Integration (`1245` / `153`).
  Neither is production-approved, and neither may be promoted merely because
  its content and staging checks passed.

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
