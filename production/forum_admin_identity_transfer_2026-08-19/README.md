# Forum administrator identity transfer

Prepared for production project `kezelafqhgqrprpadmlf` only.

The reviewed production audit found two distinct identities: the sole current
administrator is a confirmed Auth account with no forum username, while the
confirmed `jeeneetardshelp@gmail.com` profile owns `alecc_daddy` but is not an
administrator. This package atomically transfers the one administrator role to
that exact target. It does not open the forum or alter forum content.

## Status

The first reviewed `transfer.sql` revision was attempted once in production on
2026-08-20. The existing `protect_profile_admin_flag()` trigger rejected the
two-row update because the Supabase SQL Editor runs as `postgres` without a JWT
`service_role` claim. The transaction failed before `commit`; a fresh audit
confirmed the original sole administrator, target non-administrator, absent
transfer-state table, forum mode `off`, and `database_changed = false`.

This corrective revision is prepared locally only. It has new file hashes and
is not covered by the earlier execution approval. No file authorizes another
production attempt. Read-only and mutating files remain separate exact-hash
approvals.

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

The transfer and rollback require the exact Supabase SQL Editor context:
`current_user = session_user = postgres` and no incoming JWT role. They verify
that `trg_protect_profile_admin_flag` is enabled and still calls
`protect_profile_admin_flag()`. Immediately around the two-row update they set
the transaction-local `request.jwt.claim.role` to `service_role`, allowing the
existing protection trigger to evaluate its intended trusted path, and restore
the prior empty claim before checking postconditions. The trigger is never
disabled, dropped, or replaced; the setting automatically rolls back on any
error; and no service-role key is stored or used.

The package test fixture installs the real protection trigger and proves that a
plain update fails with the same production error before exercising the guarded
transfer and rollback successfully.

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
