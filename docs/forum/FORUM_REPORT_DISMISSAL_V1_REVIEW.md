# Forum report dismissal v1 review package

Status: **local SQL proof prepared; no remote database action run**

## Scope

This delta adds one RPC, `forum_admin_dismiss_report(bigint)`. An authenticated
administrator can move exactly one pending report to `dismissed`, recording
`resolved_at` and `resolved_by`.

It does not update, hide, unhide, lock, delete, or otherwise change a post or
comment. It does not insert a moderation-log action, alter auto-hide behavior,
change report priority, or broaden direct table access. A missing target does
not prevent its pending report from being dismissed.

The RPC rejects non-admin callers, anonymous callers, unknown report ids, and
reports that are no longer pending. Repeating a dismissal therefore fails
instead of rewriting its resolver or timestamp.

## Files and run order

1. `forum_report_dismissal_v1_preflight.sql` - read-only dependency, status,
   resolution-column, and function-absence checks.
2. `forum_report_dismissal_v1_audit.sql` - read-only counts only; no report or
   student content is exposed.
3. `forum_report_dismissal_v1.sql` - atomic, deliberately non-idempotent RPC
   creation and fail-closed grants.
4. `forum_report_dismissal_v1_postflight.sql` - read-only function security,
   grant, and direct-table-access checks.
5. `forum_report_dismissal_v1_rollback.sql` - destructive function removal,
   guarded to databases explicitly marked `staging` or `test`.
6. `forumReportDismissalSql.test.js` - ephemeral PostgreSQL proof for state
   transition, content non-interference, missing targets, replay rejection,
   real browser roles, and guarded rollback.
7. `verifyForumV1JwtStaging.js` - prepared full-journey assertion for a real
   admin Auth JWT, resolution metadata, queue removal, and identical content
   state before and after dismissal.

## Remote gate

Do not run this delta on staging until its diff is approved. After both the
moderation-context and dismissal deltas are approved, run each package's
preflight, audit, migration, and postflight in that order. Then run the full
guarded HTTP/JWT sequence and retain its entire evidence file. Stop on the
first error; do not retry or alter SQL to bypass an assertion.

Neither this review package nor a staging pass authorizes production/release
execution.
