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
- Recompute both hashes in `artifacts.sha256.txt`.
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

`rollback.sql` is the exact reviewed staging/test-only rollback. It removes
only these two wrappers and deliberately retains moderation history.
