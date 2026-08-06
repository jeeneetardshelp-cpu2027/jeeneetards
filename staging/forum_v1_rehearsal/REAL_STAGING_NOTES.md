# Forum v1 real-staging rehearsal notes

Project reference: `essmxonestbrgmgrtywn`
Environment marker: `public.app_environment(id=true, name='staging')`
Rehearsal SHA-256: `051879f8f7c3fe8e042ea5de97486645fb1469b43466777cc43d2019702f5262`

## 2026-08-06 — passed fail-closed prerequisite guard

The exact rehearsal batch was submitted once through the Supabase SQL Editor.
The read-only preflight committed, the staging guard passed, and the fixture
prerequisite guard then stopped execution with:

`REFUSING: staging needs one admin profile`

This is a **passed guard test**. It proves on the real disposable Supabase
project that missing identity fixtures stop execution before forum DDL.

The immediate read-only post-failure check returned:

- `environment_after = staging`
- `forum_posts_removed = true`
- `forum_votes_removed = true`
- `forum_rpcs_removed = true`
- eligible admin profiles: `0`
- eligible non-admin profiles: `0`

A subsequent aggregate-only user-data audit returned zero Auth users,
identities, sessions, refresh tokens, profiles, playlist ratings, video
comments, and content reports. The forum schema was absent. No row contents,
emails, names, keys, or other production user data were read.

Conclusion: nothing from the failed rehearsal persisted, the client preserved
the fail-closed boundary, and the clone contains no production user accounts or
user-generated community data in the audited tables.

## Reviewed sequence

1. Review `provision_test_accounts.sql` and `teardown_test_accounts.sql`. — passed
2. Provision the five marked `@staging.invalid` fixtures. — passed
3. Run the exact rollback-only rehearsal once successfully. — passed
4. Confirm its final row is all true. — passed
5. Run teardown and confirm both fixture-removal fields are true. — passed

## 2026-08-06 — successful rollback rehearsal and fixture cleanup

The reviewed sequence was executed on the same disposable staging project.
Each SQL Editor copy was normalized for Windows line endings and re-hashed
before execution.

Provisioning SHA-256:
`b6bb2ccec48faf221f5d4b64a974a8c9e4654def8356e9f8636e05d81f4c0bdd`

Provisioning terminal row:

- `environment_after = staging`
- `five_fixture_users_created = true`
- `five_fixture_profiles_created = true`
- `exactly_one_fixture_admin = true`

Rollback rehearsal terminal row:

- `environment_after = staging`
- `forum_posts_removed = true`
- `forum_votes_removed = true`
- `forum_rpcs_removed = true`

Teardown SHA-256:
`339184251bbca15b6e1b5d66dea9ada2275c4ecdc42d3cf3776e967faf618f0d`

Teardown terminal row:

- `environment_after = staging`
- `fixture_users_removed = true`
- `fixture_profiles_removed = true`

No assertion was bypassed or changed. The forum transaction rolled back, and
the five exact disposable Auth users plus their cascaded profile rows were
removed. No service-role credential was placed in the repository or SQL files.

Result: the rollback-only PostgreSQL/RLS rehearsal gate is **passed** on the
real staging clone. A persistent staging install and real HTTP/PostgREST JWT
test remain separate future gates.
