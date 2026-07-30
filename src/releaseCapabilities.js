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
});

// Product rollout decisions are separate from database capability. In
// particular, the presence of a writable table does not make an anonymous
// submission feature safe to expose without throttling and abuse controls.
export const RELEASE_FEATURES = Object.freeze({
  // Ratings launch (2026-07-30): the site owner reviewed the under-18
  // consent/age-assurance question and chose to proceed. Enabling ratings
  // requires accounts (rating.jsx gates submission on a signed-in user), so
  // both flip together. contentReporting is a separate, unrelated decision
  // and stays off — there is still no moderation path for reported content.
  //
  // NOTE: flipping this flag alone does not turn on real sign-ups. Supabase
  // Auth's own project setting ("Allow new users to sign up") was verified
  // OFF in production on 2026-07-23 (docs/browse_only_auth_evidence.json)
  // and can only be changed from the Supabase dashboard -- not from this
  // codebase, and not by an automated agent (account creation is outside
  // what this assistant will do, including to test it).
  studentAccounts: true,
  courseRatingSubmission: true,
  contentReporting: false,
});

export const hasReleaseCapability = (name) =>
  RELEASE_CAPABILITIES[name] === true;
