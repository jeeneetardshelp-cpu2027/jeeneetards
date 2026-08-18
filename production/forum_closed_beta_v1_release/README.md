# Forum closed-beta v1 production delta package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project `kezelafqhgqrprpadmlf`.

SQL cannot read a Supabase project reference. Every artifact therefore requires
`public.app_environment` to exist with **zero rows**, the production convention
in this repository. The operator must still confirm the project reference in
the Supabase dashboard before any future run.

## Files and future run order

1. `preflight.sql` - read-only; retain every result row.
2. `audit.sql` - read-only counts and readiness booleans; no student identity
   or content values are returned.
3. `install.sql` - the production mutation; requires a separate deliberate
   approval of its exact SHA-256 and a fresh verified PITR/backup restore point.
4. `postflight.sql` - read-only after installation.

The preflight and installer refuse unless the reviewed Forum v1 production
baseline and its private rollback state are present, mode is `off`, all
non-seed forum tables are empty, six launch topics remain active, and no beta
object exists.

## Atomicity and terminal state

`install.sql` is one explicit transaction. It contains the exact reviewed
closed-beta preflight, migration, and postflight bodies with only their outer
transaction wrappers removed. Any assertion failure aborts the transaction.
Stop and review the error and database state; do not edit or retry live.

The package is deliberately non-idempotent. Do not add `if not exists`.
Successful installation leaves forum mode `off`, creates no beta members or
forum activity, retains the baseline `forum_install_state`, and does not alter
the frontend release flag.

The install terminal row has nine booleans and every field must be `true`.
The postflight must then pass independently.

## Rollback

Do not run `rollback.sql` automatically. It is a separately destructive,
separately approved recovery action that removes only the closed-beta delta and
retains Forum v1. It refuses after mode changes, beta enrollment, or any forum
activity. Once membership or beta testing starts, this rollback is no longer
the approved recovery path.

## Later gates not authorized here

Installing this schema does not authorize mode `beta`, adding beta members,
production Auth/JWT write tests, a frontend deployment, or opening the forum.
With mode `off`, anonymous production forum reads must continue to fail closed.

## Hash review

Run `npm.cmd run build:forum-beta-production`, independently recompute every
entry in `SHA256SUMS.txt`, compare `source_manifest.json`, and review the
full SQL. The builder never reads credentials or connects to Supabase.
