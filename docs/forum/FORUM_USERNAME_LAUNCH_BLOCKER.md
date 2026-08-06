# Forum username launch blocker

Status: **must be completed before forum writing is enabled**

## Step 4 implementation checkpoint (2026-08-06)

A local, unapplied claim delta now exists for full review:

- `forum_username_claim_v1_audit.sql` reports the existing-profile state without writes;
- preflight, atomic migration, read-only postflight, and staging/test-only rollback files;
- one-time `forum_claim_username(text)` and bounded `forum_get_my_identity()` RPCs;
- case-insensitive uniqueness and server-side format/reserved-name enforcement;
- column-scoped profile grants that prevent direct browser username writes;
- a PGlite behavioural rehearsal and a guarded real JWT staging verifier;
- UI claim gates and locally preserved post/answer drafts behind the forum flag.

Nothing in this checkpoint has been applied to staging or production. This
remains a launch blocker until the SQL diff is approved, the persistent staging
delta and JWT fixture cycle pass, and the final production application receives
separate authorization. Existing students are never assigned a synthetic public
username: a missing profile row is completed only when that student explicitly
claims the name they chose.

The forum database requires every post and comment author to have a valid,
unique `profiles.username`. This is a deliberate trust and moderation boundary,
but the current application neither asks students to claim a username nor
assigns one to existing profiles.

## Required UI flow

1. A signed-in student who tries to post without a username is sent to a short
   username-claim screen; their draft must be preserved locally.
2. The screen explains that the username is public and checks the same database
   rules used by the forum: 3 to 30 characters and only letters, numbers, `_`
   or `-`.
3. The final claim is made by a database RPC, not by trusting a browser-only
   availability check. Duplicate-name errors must return a friendly retry.
4. Reserved staff-like, abusive, impersonating, and misleading names are
   rejected server-side.
5. After a successful claim, the original draft is restored and the student can
   submit it normally.

## Existing profiles

Do not silently publish a student's real name, email prefix, or generated
identity as their forum username. Existing students should claim a public name
on first contribution. A private, collision-safe placeholder may be used only
if it is never rendered publicly and cannot satisfy the forum publishing gate.

Before persistent staging, prepare a read-only count of:

- profiles with a valid username;
- profiles with a missing or invalid username;
- case-insensitive username collisions;
- usernames that match the reserved-name list.

Any corrective backfill must be reviewed separately and rehearsed on staging.
The forum should remain readable while this flow is unfinished, but its remote
mode must not be set to `open` for student writing.

## Verification required before launch

- New and existing accounts can claim a username.
- Concurrent claims of the same name yield one winner and one friendly error.
- Refreshing or returning from sign-in does not lose a saved draft.
- Direct browser writes cannot bypass the claim RPC or reserved-name policy.
- Moderation views and public author labels show the claimed username only.
- The light and dark mobile layouts remain clear at the claim gate.
