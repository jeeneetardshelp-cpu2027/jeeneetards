# Content-report hardening production runbook

Status: staging passed 11/11 on 23 July 2026. The hardening migration was
applied to the `youtube` production project on 23 July 2026 after owner
approval and confirmation of a recent backup. Preflight and postflight both
reported 3 existing rows; all six postflight security/integrity booleans were
`true`. The anonymous production capability contract subsequently passed from
a network-connected terminal.

The signed-in-only UI was then implemented and covered by component tests:
anonymous users cannot submit, the authenticated user id is always sent,
backend errors are translated into student-safe messages, and notes share the
1,000-character backend limit. A local browser preview verified the signed-out
course journey and caught/remedied duplicate rating/report login forms. The
signed-in browser gate then passed on disposable staging (run `536891`): the UI
showed its success state, all seven database evidence checks passed, the browser
logged no console errors, and cleanup confirmed zero reports, playlists,
videos, channels and auth users. The local credential state was deleted.
The backend remains production-ready, but `RELEASE_FEATURES.contentReporting`
is disabled for the browse-only MVP because public student accounts and
contributions require a separate under-18 consent/age-assurance decision.

## Preconditions

1. If rerunning a migration or rollback, disable the frontend report control
   until production postflight and the signed-in browser gate pass again.
2. Confirm a recent Supabase production backup is available.
3. Select the `youtube` production project. Never use a project based only on
   the browser tab title; verify the project name in the Supabase header.
4. Regenerate the package with `npm run build:reports-production` and verify its
   hashes against `content_reports_v10_production.sha256.txt`.

## Execution order

1. Run `content_reports_v10_production_preflight.sql`. Save its single result
   row. Stop if the environment says staging/test, either required object is
   missing, or the project is not the intended production project.
2. Review the historical counts. They are informational: the migration does
   not delete or rewrite existing report rows.
3. Only after explicit owner approval, run `content_reports_v10_production.sql`.
   Supabase may warn that policies, grants and a trigger are changed; that is the
   intended scope. The script is one transaction.
4. Save the final result row. Every boolean must be `true`, and the report-row
   count must equal the preflight count.
5. Re-run the anonymous production capability contract. A future reporting
   release still requires the signed-in browser gate plus a legally reviewed
   student-account and under-18 consent design.

## Rollback

Use `content_reports_v10_production_rollback.sql` only if the migration causes a
verified production regression. It preserves rows but deliberately restores
anonymous submission, so the frontend report control must remain disabled.

No production script in this package enables the report UI.
