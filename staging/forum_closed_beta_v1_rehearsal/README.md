# Forum closed-beta v1 disposable-staging rehearsal

This package is rollback-only. It does not authorize a persistent staging or
production installation, beta membership provisioning, or a mode change.

## Preconditions

- Use only a disposable Supabase staging clone marked by
  `public.app_environment(id=true, name='staging')`.
- The reviewed persistent Forum v1, username claim, moderation context, and
  report-dismissal packages must already be installed with forum mode `off`.
- The forum must contain no posts, comments, or reports.
- The clone needs one admin and two non-admin accounts older than ten minutes.
- Stop traffic to the disposable project for the duration of the rehearsal.

If the disposable clone is empty, run this package's reviewed
`provision_test_accounts.sql` first. It creates three non-login
`@staging.invalid` fixtures behind its own persistent-forum staging guard.
Run the paired `teardown_test_accounts.sql` immediately after this rehearsal
and confirm both fixture-removal fields are true. Neither credential nor a
service role key belongs in this package.

## Run

1. Recompute and compare `rollback_rehearsal.sha256.txt`.
2. Paste the complete `rollback_rehearsal.sql` into the staging SQL editor.
3. Run it once as one buffer. If any assertion errors, stop and report it; do
   not edit around the failure.
4. Confirm the final result row has seven fields and every field is `true`.
5. If fixtures were provisioned, run the paired teardown and verify its final
   removal row before leaving the staging project.

If any final field is false, the delta persisted. Do not retry. Run the guarded
`forum_closed_beta_v1_rollback.sql` and verify that the SQL client honours
explicit transactions before doing anything else.

## What it proves

- The pinned delta installs over the reviewed persistent forum baseline.
- Real `authenticated` and `anon` PostgreSQL roles exercise the grants.
- A beta member writes while a non-member is denied.
- The non-member can still submit a safety report.
- Non-admin membership changes and direct table access are denied.
- Anonymous reads, open-mode compatibility, and read-only pausing still work.
- One final `ROLLBACK` restores the original schema, data, usernames and mode.

## What it cannot prove

The uncommitted schema is invisible to separate PostgREST connections. Real
HTTP JWT proof requires a later reviewed persistent staging install and guarded
test accounts. Nothing in this package authorizes that remote step.
