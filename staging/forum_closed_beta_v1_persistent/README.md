# Forum closed-beta v1 persistent staging package

This package installs the already-reviewed closed-beta delta **persistently on
the disposable staging clone only**. It does not authorize production work or
opening forum mode.

## Install gate

The generated installer runs the exact preflight and audit, then checks the
staging marker immediately before the first beta DDL. It also requires the
reviewed forum baseline, mode `off`, an empty Auth/profile store, no forum
content, and no existing beta objects.

Recompute `install.sql.sha256.txt` before running. Paste the complete buffer
into the disposable staging SQL editor and run it once. The terminal row must
have nine fields and every field must be `true`.

If the migration commits but postflight or terminal evidence fails, do not
retry. Run the guarded `src/migrations/forum_closed_beta_v1_rollback.sql`,
inspect the failure, and verify that the SQL client honours explicit
transactions.

## Real HTTP/JWT proof

After a reviewed persistent install:

1. Install `http_fixture_helper.sql` and verify its five-field terminal row.
2. Run `npm run verify:forum-beta-jwt-staging -- --confirm-forum-beta-jwt-staging`
   with the guarded staging environment variables.
3. Review the complete JSON evidence file, including cleanup residue.
4. Remove the helper with `http_fixture_helper_rollback.sql` and verify its
   three-field terminal row.

The helper accepts only three exact `@staging.invalid` Auth fixtures marked
for the current run, is executable only by `service_role`, and back-dates the
accounts past the ten-minute writer cooldown. The service-role credential stays
in the uncommitted staging environment file and never enters evidence.

The verifier must finish with mode `off`, zero beta memberships, zero fixture
accounts/profiles, and no fixture forum data or audit residue. A failed remote
assertion is a stop condition; do not edit around it live.

The completed 2026-08-07 disposable-staging run is recorded in
`REAL_STAGING_NOTES.md`; its complete sanitized 31-check evidence is preserved
in `REAL_STAGING_JWT_EVIDENCE_2026-08-07.json`.
