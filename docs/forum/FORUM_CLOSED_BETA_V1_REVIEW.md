# Forum closed beta v1 review

Status: **local SQL checkpoint only; not applied to staging or production**

## Why this delta exists

The approved launch sequence requires a small closed beta before public
posting. The installed forum has only `off`, `read_only`, and `open` modes.
Setting it to `open` would allow every confirmed signed-in account with a valid
username to contribute, so it cannot represent a closed beta safely.

This delta adds an explicit `beta` mode. In beta mode:

- public topic, feed, thread, and comment reads remain available, while signed-in
  students can still submit safety reports;
- every publishing or voting RPC still enters `forum_require_writer()`;
- only accounts in `forum_beta_members` pass that writer gate;
- `read_only` and `off` retain their existing meanings;
- `open` deliberately retains the later public-launch behavior.

## Objects added

- `forum_beta_members`: private allow-list keyed to `profiles.id`, with the
  adding admin and timestamp recorded;
- `forum_is_beta_member()`: an authenticated student can check only their own
  membership;
- `forum_admin_set_beta_member(text, boolean)`: an internally admin-guarded,
  case-insensitive add/remove RPC addressed by claimed forum username;
- `forum_admin_list_beta_members()`: an internally admin-guarded list for the
  later management UI.

The existing mode and moderation-log constraints gain `beta` and the
`beta_add` / `beta_remove` audit actions. Membership changes create audit rows
only when the state actually changes.

## Security boundary

- No browser role has direct table access to `forum_beta_members`.
- Anonymous callers cannot execute any beta RPC.
- Authenticated callers can reach the beta RPCs, but both admin mutations and
  listing re-check `public.is_admin()` inside `SECURITY DEFINER` functions with
  an empty search path.
- Membership cannot bypass account age, username, suspension, rate-limit,
  ownership, edit-window, lock, or content-validation checks. It is an extra
  condition in the existing central writer gate, not a replacement.
- Non-members are denied before any post, comment, vote, edit, delete, or
  solved-state mutation occurs.
- Safety reports remain available to authenticated non-members while the forum
  is readable. A beta allow-list must never silence a report.

## Moderation ownership

`alecc.daddy` remains the named operational owner with a twice-daily review
commitment. A dot is intentionally invalid in public forum usernames, so this
operational handle is not forced into `profiles.username`. The read-only audit
instead reports whether at least one admin profile has a valid forum username;
the owner-to-admin-account mapping must be confirmed operationally before beta
activation.

## Files and order

1. `forum_closed_beta_v1_preflight.sql` — read-only, requires mode `off`, the
   reviewed three-mode baseline, and no pre-existing beta objects.
2. `forum_closed_beta_v1_audit.sql` — read-only counts/readiness booleans only;
   no account identifiers, emails, names, or content.
3. `forum_closed_beta_v1.sql` — atomic and deliberately non-idempotent.
4. `forum_closed_beta_v1_postflight.sql` — read-only structural, grant,
   search-path, empty-membership, and unchanged-mode verification.
5. `forum_closed_beta_v1_rollback.sql` — staging/test only, refuses non-off
   mode and refuses an unmarked or production environment.

## Local proof

`src/forumClosedBetaSql.test.js` creates genuine `anon`, `authenticated`, and
`service_role` Postgres roles in PGlite and proves:

- preflight, audit, migration, and postflight complete from the reviewed v1 +
  username-claim baseline;
- install creates no members and leaves mode `off`;
- a beta member can publish in `beta` mode;
- a non-member cannot post, reply, vote, edit, or toggle solved state;
- anonymous reading and authenticated safety reporting still work;
- membership management is admin-only, case-insensitive, non-enumerable, and
  auditable without duplicate log events;
- `read_only` denies members and `open` retains public-write behavior;
- rollback restores the three-mode contract only in test/staging and refuses
  production.

## Rollback-only staging package

`npm run build:forum-beta-staging` generates
`staging/forum_closed_beta_v1_rehearsal/rollback_rehearsal.sql` from the pinned
preflight, audit, migration, postflight, and rollback sources. The generated
manifest records every source hash and the artifact hash. The rehearsal:

- refuses anything except an explicitly marked disposable staging project;
- requires the installed forum baseline, mode `off`, and empty forum data;
- runs with genuine `authenticated` and `anon` PostgreSQL roles;
- proves member writing, non-member denial, safety reporting, private-table
  denial, admin guarding, public reads, open-mode compatibility, and read-only
  pausing;
- ends with one unconditional `ROLLBACK` and an all-true restoration row.

This remains local evidence only. It has not been run against Supabase and
cannot prove real HTTP/PostgREST JWT behavior.

## Remaining gates

This SQL must not be applied merely because local tests pass. The next reviewed
rounds are:

1. independent SQL diff review;
2. independent review of the generated staging package and PGlite rehearsal;
3. approved disposable-staging execution, followed by genuine staging
   Auth/PostgREST JWT proof for admin, member, non-member, and
   anonymous roles;
4. JavaScript UI support for the `beta` mode, including draft preservation and
   a clear non-member state;
5. production install while mode remains `off`;
6. deliberate membership provisioning and live verification;
7. a separately approved `off` to `beta` transition.

Moving from `beta` to `open` is a later public-launch decision and is not
authorized by this package.
