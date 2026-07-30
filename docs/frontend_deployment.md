# Frontend deployment runbook

Status: source, host configuration and release gates are prepared. Hosting is
external state; confirm the current preview and production deployment in the
selected provider before following the promotion steps below.

## Build contract

- Install: `npm ci`
- Production capability contract: `npm run verify:production-capabilities`
- Build: `npm run build`
- Output directory: `dist`
- Release gate: `npm run verify:frontend-release`
- Runtime: static Vite SPA with browser-side React Router

The production capability contract is anonymous and read-only. It fails when
the checked-in UI says a database feature is available but the production API
cannot serve it (or when a newly deployed feature is still marked unavailable).
Write features held back for product or abuse-safety reasons live separately in
`RELEASE_FEATURES`; table existence alone must never enable them.

The frontend release gate also refuses to pass while the Terms or Privacy page
contains template placeholders. The approved inputs and browse-only decision
are recorded in `docs/legal_release_inputs.md`.

## Public accounts and ratings gate

Updated 2026-07-30: the owner reviewed the under-18 consent/age-assurance
question (see `docs/legal_release_inputs.md`'s 2026-07-30 addendum) and chose
to enable public student accounts and rating submission. This reverses the
prior browse-only gate for those two features specifically.

Before this can work end-to-end, open the **youtube production project** in
Supabase and go to Authentication > Sign In / Providers. Turn ON **Allow new
users to sign up**. Keep **Allow anonymous sign-ins** OFF — named accounts are
required for one-rating-per-student. This is a dashboard-only setting; it
cannot be changed from this repository or by an automated agent (account
creation, including to test this, is outside what an automated assistant
should do here).

The last captured settings evidence is stored in
`docs/browse_only_auth_evidence.json`. Treat that file as a historical record
of the state *before* this decision (2026-07-23), not a live settings check.
Re-check the actual dashboard state before any deployment that depends on it.

Then confirm the current intent in `src/releaseCapabilities.js`:

- `studentAccounts: true`
- `courseRatingSubmission: true`
- `contentReporting: false` — unchanged; still no moderation path for
  reported content, so this stays off until that exists.

The report backend may remain hardened and deployed regardless of
`contentReporting`'s value. That flag controls only the public UI surface.

Both `vercel.json` and `netlify.toml` provide the required SPA fallback so a
direct visit to `/browse`, `/course/:id`, `/faculty/:slug`, or `/compare` loads
`index.html` instead of returning a host-level 404.

## Host environment variables

Add only these intentionally public build variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_YOUTUBE_API_KEY`

Never add or upload either server credential:

- `SUPABASE_SERVICE_ROLE_KEY`
- `YOUTUBE_API_KEY`

The production bundle is checked against the real local values of both server
credentials before release.

## After the first preview URL exists

1. Add the exact preview and production origins to the browser YouTube key's
   HTTP-referrer allow-list. Keep the key restricted to YouTube Data API v3.
2. Before public traffic, obtain legal advice on whether the exam/school
   audience makes this a child-directed YouTube API Client. If it does, notify
   Google using its required child-directed-client process; privacy-enhanced
   embeds do not remove that obligation.
3. Confirm public sign-up and anonymous sign-in are still disabled in Supabase
   Auth. Admin sign-in must continue to work.
4. Test `/`, `/explore`, the full JEE guided journey, a copied `/browse?...`
   URL, a copied `/course/:id` URL, `/compare`, `/admin`, light/dark mode and
   360 px mobile layout.
5. Confirm response security headers and that a hard refresh on every client
   route returns the application rather than a 404.
6. Confirm the course page exposes no student sign-in, rating-submission, or
   report-submission control and that Terms and Privacy show the approved text.
7. Keep the preview deployment until these checks pass; promote only after the
   evidence is saved.

## Repository workflow

This project is versioned in Git and tracks the GitHub `main` branch. The
checked-in GitHub Actions workflow runs the release gates for pushes and pull
requests. Before connecting or changing a hosting provider, review the tracked
file and secret scope, then configure only the browser-safe environment
variables listed above.
