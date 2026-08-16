# Forum suspension-admin v1 persistent staging package

This local package installs only the two reviewed suspension-admin wrappers on
the disposable Supabase staging clone. It is not production authorization, and
creating this package does not authorize running it on staging.

The single install buffer contains the reviewed operations in this order:

1. read-only preflight;
2. read-only counts-only audit;
3. atomic migration, with the staging and forum-off guard inside its transaction;
4. read-only postflight;
5. terminal evidence.

## Before any approved staging run

- Confirm the project ref is the disposable staging project, not production
  `kezelafqhgqrprpadmlf`.
- Confirm the clone contains no real production user data.
- Run the separately reviewed read-only checker:
  `npm run check:forum-suspension-admin-staging-readiness -- --confirm-forum-suspension-staging-readonly`.
  It must report `passed: true` before any SQL is pasted.
- Recompute every hash in `artifacts.sha256.txt`.
- Paste and run the complete `install.sql` buffer once; do not run fragments.
- If any assertion errors, stop and report it before changing or retrying SQL.

## Successful terminal row

- `environment_after = staging`
- `forum_mode = off`
- `set_suspension_by_username_installed = true`
- `list_suspensions_installed = true`
- `suspension_rows_unchanged = true`
- `moderation_log_rows_unchanged = true`
- `posts_unchanged = true`
- `comments_unchanged = true`
- `reports_unchanged = true`

The unchanged fields compare against a session-local baseline captured after
the staging guard and inside the migration transaction. The later JWT proof
must create a temporary suspension, verify it, lift it, and prove no fixture
residue remains.

After an approved persistent staging install, run
`http_fixture_helper.sql`, then execute the guarded verifier with
`npm run verify:forum-suspension-admin-jwt-staging -- --confirm-forum-suspension-admin-jwt-staging`.
Regardless of the verifier
result, run `http_fixture_helper_rollback.sql` and confirm
`fixture_helper_removed = true`. The verifier refuses any non-empty profile
or forum-content baseline and writes only type-shaped, credential-redacted
evidence outside the repository.

`rollback.sql` is the exact reviewed staging/test-only rollback. It removes
only these two wrappers and deliberately retains moderation history.
