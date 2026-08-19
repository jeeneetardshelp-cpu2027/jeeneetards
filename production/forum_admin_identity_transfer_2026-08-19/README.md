# Forum administrator identity transfer

Prepared for production project `kezelafqhgqrprpadmlf` only.

The reviewed production audit found two distinct identities: the sole current
administrator is a confirmed Auth account with no forum username, while the
confirmed `jeeneetardshelp@gmail.com` profile owns `alecc_daddy` but is not an
administrator. This package atomically transfers the one administrator role to
that exact target. It does not open the forum or alter forum content.

## Status

Prepared locally only. No file authorizes production execution. Read-only and
mutating files remain separate exact-hash approvals.

## Required order

1. Run `audit.sql` and independently review every field.
2. Run `preflight.sql`; all readiness fields must be true and
   `database_changed` must be false.
3. Stop. Obtain separate approval naming the exact `transfer.sql` SHA-256 and
   production project before any write.
4. Run only `transfer.sql` in a fresh editor after copy-back hash verification.
5. Run `postflight.sql` in a fresh editor. All state fields must be true and
   `database_changed` must be false.
6. Sign out and back in before testing `/admin`.

If a mutating result is uncertain, treat it as possibly committed and run only
the read-only postflight before deciding what happened. Never retry a failed
assertion by weakening a guard.

## Atomicity and rollback

`transfer.sql` locks the production marker, forum settings, and profiles;
requires mode `off`; validates both exact identity shapes; creates a locked-down
`forum_admin_transfer_state` table; records the previous and target profile IDs;
and changes exactly two `is_admin` values in one SQL statement. Any failure
rolls the entire transaction back, including the state table.

The captured UUIDs are deliberately not foreign keys: the operational audit
record must not create a new lifetime block on either account. If an account is
deleted before rollback, rollback fails closed because its profile no longer
matches.

`rollback.sql` never guesses the previous account. It reads the captured IDs,
revalidates both identities and the sole-admin state, reverses both role values
atomically, and records `rolled_back_at`. The state table deliberately remains
as an audit record. Rollback requires its own exact-hash production approval.

The state table has RLS enabled and no privileges for `public`, `anon`,
`authenticated`, or `service_role`.
