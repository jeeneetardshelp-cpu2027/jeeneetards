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
  // TURNED BACK OFF on 2026-08-12. This flag reached `release` as `true` via
  // a separate build of the forum work that was never reviewed in the thread
  // that reviewed and approved the actual forum SQL/UI packages -- `main`
  // caught and reverted the same mistake on 2026-08-12 (see its history for
  // src/releaseCapabilities.js), but that fix was never brought to `release`.
  //
  // Production `forum_mode()` was confirmed "off" throughout: get_forum_topics
  // and get_forum_feed both returned [], and there was one profile in the
  // whole database, so no real forum content or student activity was ever
  // exposed. The live-site impact was limited to a dead nav/footer/sitemap
  // link landing on "Discussions are temporarily unavailable", which Google
  // was also being asked to index.
  //
  // Before flipping this back to true: reconcile this file with `main`'s
  // version so the two branches carry the same reviewed decision, publish
  // forum rules in the Terms (report reasons abuse_or_bullying, sexual_content
  // and self_harm exist in the schema but the Terms say nothing about
  // discussion/conduct), wire forum_admin_set_suspension to a UI, and open
  // the database mode as an explicit, separate operational decision. Users
  // are 14-18.
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
});

export const hasReleaseCapability = (name) =>
  RELEASE_CAPABILITIES[name] === true;
