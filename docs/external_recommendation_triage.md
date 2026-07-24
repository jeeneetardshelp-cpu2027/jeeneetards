# External recommendation triage — 23 July 2026

This document records which suggestions from the supplied hard audit match the
current project. It prevents stale observations from becoming requirements.

## Adopted now

- Add a top-level React error boundary. Async views already have loading, empty
  and error states, but an unexpected render exception could still blank a route.
- Verify `profiles.is_admin` before loading or displaying admin forms. Database
  RLS and RPC checks remain authoritative; this is UI defence in depth.
- Keep Content Security Policy, HTTPS/HSTS and deployment-header checks in the
  release gate. These were completed before this review.

## Useful next, but evidence is required first

- Move browser YouTube imports behind an authenticated server/Edge function,
  with caching, quota controls and retry/backoff. The CLI already uses a separate
  server-side key; public browsing itself does not need the YouTube Data API.
- Load-test search and facet RPCs with realistic catalogue cardinality before
  choosing full-text search, materialized views or new composite indexes.
- Change the course lecture sequence from 500-row transport chunks to student-
  visible incremental loading or virtualization before importing very large
  playlists.
- Add Playwright journeys and database query-budget tests once the audit harness
  uses deterministic seeded fixtures.
- Add privacy-approved error monitoring after the Privacy Policy and retention
  policy are final.
- Move to ordered Supabase CLI migrations before a second developer or automated
  production deployment is introduced. `staging_bootstrap.sql` is currently a
  generated disposable-environment artifact, not the source of truth.

## Already implemented; audit claim was stale

- Course catalogue and lecture browsing use bounded database ranges.
- Search inputs are debounced; universal search highlights matches and has
  grouped results. The production universal-search route remains deliberately
  gated until its RPC is deployed.
- Loading, honest empty and explicit error states exist on core discovery paths.
- Dashboard and student routes use the shared theme and responsive AppShell.
- Mobile widths and back-navigation restoration have automated checks.
- Browser and server YouTube keys are separate, restricted and guarded by tests.
- Admin RPC bodies re-check `is_admin()` and staging tests verify non-admin
  rejection. Several especially sensitive functions are service-role only.
- Production capability drift, secret leakage and hosting configuration have
  explicit release gates.

## Rejected or modified

- Do not remove the service-role *placeholder name* from `.env.example`. A
  placeholder documents the required server variable and does not expose a key;
  secret scanning and `.gitignore` protect real values.
- Do not revoke every admin RPC from `authenticated` while the admin interface
  uses the signed-in administrator's JWT. That would also block real admins.
  Move the operation to an Edge function first, then make its RPC service-role
  only.
- Do not replace trigram matching with full-text search. Trigrams are valuable
  for aliases, initials and misspellings; a future measured design may combine
  both.
- Do not add materialized facet counts, Redis or Realtime pre-emptively. They add
  invalidation and operational complexity without a measured bottleneck.
- Do not create successively versioned public RPC names for routine changes.
  Transactional `create or replace` migrations avoid forcing the frontend to
  support several API versions.
- Do not refresh view/like counts merely because YouTube exposes them. They are
  volatile, quota-expensive and not currently part of the student decision model.
- Do not add Swagger solely for internal PostgREST RPCs before there is a public
  API or a second client team.

## Remaining launch blockers unaffected by this review

- Replace and professionally review the Terms and Privacy templates.
- Initialize and inspect a private Git repository before connecting GitHub or
  Vercel.

The first realistic catalogue scale gate subsequently passed with 1,000
playlists and 10,000 videos. Chapter navigation passed narrowly at 1,011 ms p95
against a 1,200 ms budget and remains the first performance watch item.
