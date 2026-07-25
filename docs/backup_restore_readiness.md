# Backup and restore readiness

This is a release control for database-changing work. It does not attest that a
backup exists or that a restore exercise has passed.

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

