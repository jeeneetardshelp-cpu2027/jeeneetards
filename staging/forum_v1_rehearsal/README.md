# Forum v1 disposable-staging rehearsal

This package is rollback-only. It does not authorize a persistent staging or
production installation.

## Preconditions

- Use a disposable Supabase staging project marked by
  `public.app_environment(id=true, name='staging')`.
- The staging project must already contain one admin profile and four non-admin
  users older than ten minutes. The SQL refuses to manufacture auth users.
- Stop site traffic to this disposable project while the single transaction is
  running.

The rehearsal assigns temporary usernames to three selected users and clears a
fourth username to test the hard claim gate. The final `ROLLBACK` restores all
of them.

If the disposable clone is empty, the separately reviewed
`provision_test_accounts.sql` creates the required five non-login
`@staging.invalid` fixtures. Run `teardown_test_accounts.sql` immediately
after the successful rehearsal. Both scripts carry an independent staging
guard; neither contains or requires a service-role credential in the file.

## Run

1. Verify `rollback_rehearsal.sha256.txt` against `rollback_rehearsal.sql`.
2. Paste the entire SQL file into the disposable staging SQL editor as one run.
3. If any statement errors or the client stops, execute `rollback;` immediately
   in the same SQL editor session.
4. A successful run ends with one row where:
   - `environment_after = staging`
   - `forum_posts_removed = true`
   - `forum_votes_removed = true`
   - `forum_rpcs_removed = true`

If that final row is not all true, the schema persisted. Do not retry the
rehearsal. Run the guarded `src/migrations/forum_v1_rollback.sql`, then verify
whether the SQL client honours explicit multi-statement transactions before
doing anything else.

The first real-project refusal and subsequent staging runs are recorded in
`REAL_STAGING_NOTES.md`.

## What it proves

- The reviewed migration and postflight execute on staging-shaped PostgreSQL.
- The real `authenticated` and `anon` database roles can reach only their
  granted RPCs.
- `auth.uid()` ownership, username gate, voting, literal search, cursor
  validation, reports, auto-hide, moderation, recounts and read-only mode work.
- Browser roles cannot select forum base tables.
- The complete transaction restores the original staging state.

## Feed cursor contract

`p_cursor_id` marks a cursor as present. Such a cursor must also supply
`p_cursor_created_at`; Hot additionally requires `p_cursor_hot`, and Top
additionally requires `p_cursor_score`. New needs no rank or score field.
Incomplete cursors raise an error instead of returning an unexplained empty
page.

## What it cannot prove

Because uncommitted schema is invisible to PostgREST connections and the whole
package rolls back, this rehearsal cannot test a real HTTP JWT through
PostgREST. That requires a later, explicitly approved persistent staging
installation plus dedicated test accounts. Do not describe this rollback-only
rehearsal as an end-to-end API test.

## Launch blocker carried forward

The database correctly refuses publishing without `profiles.username`. The
application still needs a username-claim flow, reserved-name rules, uniqueness
error handling, and a reviewed backfill/claim strategy for existing profiles
before forum writing can launch.
