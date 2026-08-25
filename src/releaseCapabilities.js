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
  // TURNED BACK OFF on 2026-08-10. The frontend was released, but the database
  // mode was never opened, so production `forum_mode()` returns "off" and every
  // click on the nav item landed on "Discussions are temporarily unavailable".
  // The link was also in the footer and in the sitemap, so Google was being
  // asked to index a dead end. Verified against production the same day:
  // forum_mode -> "off", get_forum_topics -> [], get_forum_feed -> [],
  // and one profile in the whole database.
  //
  // This flag is the honest state until the mode is actually opened. Nothing is
  // deleted -- the ~40 forum files and their tests stay, and the routes still
  // resolve to ForumFeatureUnavailable so a shared link explains itself instead
  // of 404ing.
  //
  // Before flipping this back to true: obtain owner/legal review of the forum
  // rules drafted in LegalPage, deploy and production-verify the suspension UI,
  // and open the database mode through its separately reviewed runbook. Users
  // are 14-18, so none of those gates is implied by the code merely existing.
  forum: false,
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
  // "Continue with Google" one-tap sign-in. OFF until the owner completes the
  // Supabase + Google Cloud provider setup (docs/auth/google_oauth_setup.md) --
  // showing the button before Google is enabled would just error. Flip to true
  // in the SAME change that finishes that dashboard config. The button itself
  // lives in StudentAuth.jsx (used by the rating panel/prompt and /signin).
  googleAuth: false,
});

export const hasReleaseCapability = (name) =>
  RELEASE_CAPABILITIES[name] === true;
