# Forum closed-beta activation runbook

Status: **local operational guide; no activation authorized by this file**

The closed-beta schema is installed in production. The recorded terminal state
is mode `off`, zero beta members, zero posts, and zero reports. See
`CLOSED_BETA_PRODUCTION_INSTALL_EVIDENCE_2026-08-08.json`.

## What must be true before activation

1. The deployed frontend contains the member-aware beta UI and the admin
   `Forum beta` panel from the reviewed activation-readiness change.
2. The production frontend still exposes only the reviewed `/forum`,
   `/forum/post/:postId`, and `/forum/submit` routes.
3. The moderator owner remains named and able to meet the twice-daily review
   commitment.
4. Every invited tester has signed in and claimed an allowed public forum
   username. Email addresses and user IDs must not be copied into review or
   evidence files.
5. A fresh PITR restore point has been checked in the Supabase dashboard.
6. The owner has separately approved the exact tester usernames and the
   production mode change. Installing the schema did not authorize either.

Stop if any condition is false. Do not work around a missing username by
editing `profiles` or `auth.users` directly.

## Enroll testers while mode is off

1. Sign in to `/admin` with the existing administrator account.
2. Open **Forum beta** and confirm the displayed mode is `off`.
3. Add each approved public username one at a time.
4. Confirm every expected username appears once and that the member count is
   exact. Do not activate with an unexpected or missing row.

The panel calls only the reviewed admin RPCs. Membership changes are written to
the forum moderation log; the browser never receives or stores a service-role
credential.

## Activate the closed beta

1. Keep the member list visible and recheck the exact count.
2. Type `BETA` in the activation confirmation field.
3. Select **Activate closed beta** once.
4. Confirm the panel reports mode `beta`.
5. In a separate signed-out browser, confirm the forum is readable but has no
   write controls.
6. With one enrolled account, claim/login as needed and complete one real
   post, answer, and vote journey.
7. With one non-enrolled account, confirm the UI does not show beta write
   controls and that a direct RPC write is rejected by the database.
8. Delete only the explicitly approved test content through the reviewed
   moderation path if the journey was intended to leave no content.

Record counts and booleans in evidence. Do not record JWTs, email addresses,
user IDs, report notes, post bodies, or student identity values.

## Emergency stop

Use **Stop closed beta** in `/admin` to change mode from `beta` to `off`.
This immediately pauses forum reads and writes while retaining the membership
list for investigation. Confirm mode `off` afterward.

Do not run the installation rollback after enrollment, a mode change, or forum
activity. The reviewed rollback deliberately refuses those states.

## Later public launch

This panel intentionally has no `open` control. Opening contributions to every
eligible signed-in student is a separate production decision with its own
evidence and approval gate.
