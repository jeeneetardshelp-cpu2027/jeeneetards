# Forum moderation context v1 review package

Status: **local SQL and PGlite proof prepared; no remote database action run**

## Scope

This delta changes only the result contract of
`forum_admin_list_reports(integer)`. It does not add or change moderation
actions, report priorities, auto-hide behavior, RLS policies, or forum mode.

The admin queue keeps all nine reviewed v1 fields and adds bounded context:

- containing post id, title, and topic slug;
- target author's public username;
- a whitespace-normalized content preview capped at 600 characters;
- explicit target-exists, hidden, deleted, and post-locked flags.

Missing or permanently removed targets remain listable with
`target_exists = false`; their unavailable context is returned as `null`.
No email, full name, avatar, Auth metadata, or reporter-facing data is added.

## Files and run order

1. `forum_moderation_context_v1_preflight.sql` — read-only dependency and
   old-contract drift check.
2. `forum_moderation_context_v1_audit.sql` — read-only counts only; identifies
   pending urgent reports and missing targets without exposing content.
3. `forum_moderation_context_v1.sql` — atomic, deliberately non-idempotent
   function replacement.
4. `forum_moderation_context_v1_postflight.sql` — read-only result-contract and
   grant checks.
5. `forum_moderation_context_v1_rollback.sql` — destructive rollback, guarded
   to databases explicitly marked `staging` or `test`.
6. `forumModerationContextSql.test.js` — ephemeral PostgreSQL behavior,
   adversarial role, missing-target, and rollback proof.
7. `verifyForumV1JwtStaging.js` — the existing guarded five-account, real
   Auth/PostgREST journey now also proves the enriched response fields.

## Deliberately not included

`forum_reports.status` permits `dismissed`, but no reviewed forum RPC can dismiss
a false-positive report without applying a content action. The admin queue must
not fake this by calling `unhide`. A separate minimal, audited dismissal RPC is
a launch blocker for a usable moderation queue and needs an explicit decision.

## Remote gate

Do not run the delta on staging until the SQL diff is approved. After approval:
run preflight, audit, migration, and postflight in order; then run the entire
guarded HTTP/JWT sequence and retain its full evidence file. Any failed check
stops the sequence; do not improvise around an assertion.
