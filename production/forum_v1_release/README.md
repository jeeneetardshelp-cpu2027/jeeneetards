# Forum v1 production installation package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project `kezelafqhgqrprpadmlf`.

SQL cannot read a Supabase project reference. The fail-closed database guard
therefore requires `public.app_environment` to exist with **zero rows**, the
production convention in this repository, and refuses any existing forum
object, case-insensitive username collision, or unsupported PUBLIC profile
write grant. The operator must still confirm the project reference in the
Supabase dashboard before any future run.

## Files and future run order

1. `preflight.sql` — read-only; run and retain every result row.
2. `audit.sql` — read-only existing-profile and ACL counts.
3. `install.sql` — first production mutation; requires a separate deliberate
   approval of its exact SHA-256 and a fresh, verified PITR/backup restore point.
4. `postflight.sql` — read-only after installation.

Do not run `rollback.sql` automatically. It is a separately destructive,
separately approved recovery action. It refuses unless mode remains `off`, all
forum activity tables are empty, and no non-null username changed after install.

## Atomicity and failure behavior

`install.sql` is one explicit transaction. The reviewed core, username claim,
moderation context and dismissal migrations have only their outer transaction
wrappers removed. Their guards and every reviewed postflight run before the
single COMMIT. Any assertion failure aborts the transaction; do not retry until
the error and database state are reviewed.

The package is deliberately non-idempotent. Do not add `if not exists` to the
installer. A rerun must fail on existing objects rather than guess at drift.

The install leaves `forum_settings.mode = 'off'`, creates no posts/comments/
votes/reports/moderation rows, and does not enable the frontend release flag.

## Rollback state

The username migration replaces broad profile INSERT/UPDATE grants with safe
column grants. `forum_install_state` privately snapshots the exact pre-install
anon/authenticated table and column ACLs, a fingerprint of existing non-null
usernames, and the installed topic configuration. Browser and service roles
receive no access to that table. The rollback restores and verifies the ACL
snapshot before dropping it, and refuses username or topic drift.

## Hash review

Re-run `npm.cmd run build:forum-production`, recompute every entry in
`SHA256SUMS.txt`, compare `source_manifest.json`, and review the full SQL.
The builder never reads credentials or connects to Supabase.

No frontend flag flip, deployment, forum-mode change, production fixture, or
HTTP write test is authorized by this package.
