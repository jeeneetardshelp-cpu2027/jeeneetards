// releaseCapabilities.js — the capabilities the CURRENT production release
// can honestly expose to students.
//
// This is deliberately explicit. The frontend previously exposed Search,
// Compare and Faculty because their React code existed, even though the RPCs
// they require had never been deployed to production. Green component tests
// could not detect that mismatch.
//
// After a database feature and its release-ready data are deployed and verified,
// change its value here in the same release. `npm run
// verify:production-capabilities` checks this file against meaningful anonymous
// production results before GitHub/Vercel deployment.
export const RELEASE_CAPABILITIES = Object.freeze({
  catalogNavigation: true,
  universalSearch: true,
  comparison: true,
  facultyRegistry: true,
  boardClassification: true,
  // Released after the anonymous production postflight confirmed the schema,
  // reviewed NCERT seed and exact JEE/NEET/CBSE + lecture-context retrieval.
  studyMaterials: true,
});

// Product rollout decisions are separate from database capability. In
// particular, the presence of a writable table does not make an anonymous
// submission feature safe to expose without throttling and abuse controls.
export const RELEASE_FEATURES = Object.freeze({
  // CLOSED BETA opened on 2026-08-25 after the separately reviewed production
  // database runbook set forum_mode() to "beta". Public reading is available,
  // while database policy limits contributions to approved beta members. The
  // database mode remains the independent emergency control for forum access.
  forum: true,
  // Ratings launch (2026-07-30): the site owner reviewed the under-18
  // consent/age-assurance question and chose to proceed. Enabling ratings
  // requires accounts (rating.jsx gates submission on a signed-in user), so
  // both flip together. contentReporting is a separate decision and stays
  // off for now — NOT because a moderation path is missing (AdminPanel's
  // "Reports" tab / useReports.js is a complete is_admin-gated queue, and
  // the backend hardening (content_reports_hardening_v10.sql) is confirmed
  // live in production, adversarially reviewed 2026-07-31, verdict SAFE TO
  // FLIP). This is now a pure product-timing call, not an infra blocker:
  // any signed-in account can already insert a report via the console
  // regardless of this flag (VideoReport.jsx's reportUiEnabled() only hides
  // the UI control, DB RLS is the real boundary) — the flag just decides
  // when students are actually shown the "Report an issue" button.
  //
  // Production Auth was owner-verified on 2026-08-06 with sign-up and email
  // confirmation both ON. See docs/browse_only_auth_evidence_2026-08-06.json;
  // it supersedes the stale 2026-07-23 snapshot. These dashboard settings are
  // outside this codebase and are not changed by the frontend release flags.
  studentAccounts: true,
  courseRatingSubmission: true,
  // Deliberately sequenced AFTER admin review moderation shipped
  // (rating_review_moderation.sql) -- the owner explicitly chose to hold
  // public display until an admin could hide an inappropriate review.
  reviewDisplay: true,
  // Flipped 2026-07-31 after an adversarial security review found no
  // exploitable path (unauthorized read/write, rate-limit/dedup bypass,
  // XSS) -- see the comment above and site-audit memory item #24.
  contentReporting: true,
  // "Continue with Google" one-tap sign-in. Flipped ON 2026-08-26, in the same
  // change as the dashboard config it depends on: the owner created the Google
  // Cloud OAuth client (redirect URI -> the Supabase /auth/v1/callback), enabled
  // the Google provider in Supabase with that client id/secret, and allow-listed
  // the site + return URLs (docs/auth/google_oauth_setup.md). The button lives
  // in StudentAuth.jsx (used by the rating panel/prompt and /signin).
  //
  // This removes the email+password+confirm wall that is the ratings cold-start
  // bottleneck -- production had ~2 accounts and 0 ratings behind it.
  googleAuth: true,
  // Student polls: vote, comment and share, with students suggesting polls an
  // admin approves before they go live.
  //
  // polls_v1.sql is installed on production (verified: 13/13 anon-surface
  // checks, npm run verify:polls-production) and on staging.
  //
  // DO NOT SHIP THIS FLAG ON WHILE PRODUCTION poll_mode() IS 'off'. It is not
  // harmless: with the flag on, "Polls" appears in the top nav, /polls goes in
  // the sitemap, and pageMetadata marks it index,follow -- while every click
  // lands on "Polls are temporarily unavailable" because the database is shut.
  // That is precisely what happened to the forum, which was turned back off on
  // 2026-08-10 for exactly this ("Google was being asked to index a dead end").
  //
  // The correct order is: open production's poll_mode FIRST, then deploy this.
  // Turning this on to preview staging is not a reason -- run the dev server
  // against the staging keys instead, which costs production nothing.
  polls: true,
});

export const hasReleaseCapability = (name) =>
  RELEASE_CAPABILITIES[name] === true;
