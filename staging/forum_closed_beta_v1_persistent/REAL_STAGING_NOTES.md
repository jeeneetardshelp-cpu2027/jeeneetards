# Forum closed-beta v1 persistent staging evidence

Run date: 2026-08-07  
Disposable project: `essmxonestbrgmgrtywn` (`edu-library-faculty-staging`)  
Reviewed package commit: `d5204d1feb793d872b87a6c998f35886a4d4f13f`

Production was not contacted. The frontend release flag was not changed.

## Persistent install

- `install.sql` SHA-256:
  `3a839dd00eec5a7d918bd6c4b0e11a81191ff85d6048957659f49afc97807098`
- The fresh SQL editor buffer was read back in 78 overlapping, gap-free
  accessible windows. The reconstructed buffer was 17,191 bytes and its hash
  matched the pinned installer before Run was pressed.
- The installer committed cleanly.
- All nine terminal fields were `true`:
  `environment_is_staging`, `forum_mode_is_off`, `beta_table_installed`,
  `beta_check_installed`, `beta_admin_write_installed`,
  `beta_admin_list_installed`, `no_beta_members_created`, `no_posts_created`,
  and `no_reports_created`.

## Temporary HTTP fixture helper

- `http_fixture_helper.sql` SHA-256:
  `c76a5bcec2ebc81d3dce3aa712e3e8177b7e56b1ce05a12c90686591971a68eb`
- Its fresh editor buffer was independently read back and hash-matched before
  execution.
- All five terminal fields were `true`, including service-role-only execution
  and denial for the authenticated browser role.

## Genuine Auth/PostgREST JWT proof

- Raw sanitized evidence:
  `REAL_STAGING_JWT_EVIDENCE_2026-08-07.json`
- Evidence SHA-256:
  `3a80174528d32818fce8de24a52bdceda20107cee74c57a67997a23ecb0947f7`
- Result: 31/31 checks passed; zero failures; `fatal` is null.
- Every check includes `raw_response_shape` evidence.
- Cleanup was attempted and completed.
- All eleven residue counters are zero: Auth fixtures, profiles, beta members,
  posts, comments, votes, reports, user stats, moderation logs, target-user
  logs, and rate events.
- The evidence contains no JWT-shaped token, fixture email, Supabase URL,
  service-role key, or anon key.

## Helper removal and final state

- `http_fixture_helper_rollback.sql` SHA-256:
  `87332a9694f8e59617d83383eea45854faee646195e2ec0fa95ebd9f7f67629b`
- Its fresh editor buffer was independently read back and hash-matched before
  the planned helper drop was confirmed.
- All three terminal fields were `true`: staging, mode off, helper removed.
- A final read-only aggregate returned sixteen `true` values. The closed-beta
  table and three reviewed beta RPCs remain installed; mode is `off`; the
  helper is absent; and Auth users, profiles, beta members, posts, comments,
  votes, reports, rate events, and beta membership audit actions are empty.

The persistent staging gate is complete. This evidence does not authorize a
production installation, a frontend release-flag change, or a forum mode
change.
