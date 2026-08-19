# Forum suspension-admin v1 production package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project `kezelafqhgqrprpadmlf`.

SQL cannot read a Supabase project reference. Every artifact therefore requires
`public.app_environment` to exist with **zero rows**, the production convention
in this repository. The operator must still confirm the project reference in
the Supabase dashboard before any future run.

## Files and future run order

1. `preflight.sql` - read-only; retain every result row.
2. `audit.sql` - read-only counts only; no username, reason, account id,
   student content, or email is returned.
3. `install.sql` - production mutation. It requires separate deliberate
   approval of its exact SHA-256 and a fresh verified PITR/backup restore point.
4. `postflight.sql` - independent read-only verification after installation.

The installer is deliberately non-idempotent and creates only two functions.
It leaves forum mode `off`, creates no suspension or moderation row, changes no
profile or forum-content row, installs no staging fixture helper, and does not
change `RELEASE_FEATURES.forum`.

The mutation is one explicit transaction. The production marker, Forum v1
baseline, forum-off state, staging-helper absence, and wrapper absence are
checked again inside that transaction before either function is created. Any
failure aborts the transaction; stop and review rather than editing or retrying
live SQL.

## Successful installer evidence

Every boolean in the terminal row must be `true`: mode off, baseline retained,
both wrappers installed, staging helper absent, and all nine profile/forum table
counts unchanged. Then run the independent postflight and retain its rows.

## Rollback

Do not run `rollback.sql` automatically. It is a separate destructive action
requiring separate exact-hash approval. It removes only the two wrappers and
retains every suspension and moderation-log row. The reviewed UUID-taking
`forum_admin_set_suspension(uuid, timestamptz, text)` RPC remains available,
but the browser admin UI loses its username-based path after rollback.

## Not authorized by this package

Preparing or installing these wrappers does not authorize changing forum mode,
changing the frontend release flag, creating production test accounts, running
JWT write tests, suspending a student, or deploying UI changes.

## Review

Run `npm.cmd run build:forum-suspension-admin-production`, independently
recompute every entry in `SHA256SUMS.txt`, compare `source_manifest.json`,
read the full SQL, and verify the package PR before considering execution.
The builder reads no credential and makes no network or database connection.
