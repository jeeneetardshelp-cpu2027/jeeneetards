# Forum v1 persistent staging install

This package installs the reviewed forum schema **persistently on the disposable
staging clone only**. It is not a production package.

The generated SQL contains the exact reviewed preflight, core migration and
postflight. A staging marker guard runs after the read-only preflight and before
the first forum DDL. The installed forum mode remains `off`.

## Expected terminal row

- `environment_after = staging`
- `forum_mode = off`
- `forum_posts_installed = true`
- `forum_rpcs_installed = true`
- `six_topics_installed = true`

If the core commits but postflight or terminal evidence fails, do not retry the
installer. Run the guarded `src/migrations/forum_v1_rollback.sql`, inspect the
failure, and rebuild from an empty staging schema.

After installation, install `http_fixture_helper.sql`, run the guarded HTTP
JWT verifier, then run `http_fixture_helper_rollback.sql`. The helper is
staging-only, restricted to `service_role`, and must not remain installed.
