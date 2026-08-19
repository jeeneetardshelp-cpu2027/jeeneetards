# Forum administrator bootstrap: `alecc_daddy`

Prepared for production project `kezelafqhgqrprpadmlf` only.

This package promotes exactly the already-confirmed account whose private Auth
email is `jeeneetardshelp@gmail.com` and whose public forum username is exactly
`alecc_daddy`. It does not create an account, change a username, open the forum,
or alter forum content.

## Status

Prepared only. No file in this directory authorizes production execution.
Running `grant.sql` or `rollback.sql` requires separate owner approval naming
the exact SHA-256 and production project reference.

## Required order

1. Confirm the SQL editor is connected to `kezelafqhgqrprpadmlf`.
2. Run `preflight.sql`. Every terminal field must be `true` except
   `database_changed`, which must be `false`.
3. Stop and review the result. Do not combine files in one editor buffer.
4. Only after separate exact-hash approval, run `grant.sql` once.
5. Run `postflight.sql` in a fresh editor and require all booleans to be `true`
   except `database_changed`, which must be `false`.
6. Sign out and back in before retesting `/admin` so the client session and
   profile query are fresh.

If any assertion fails, stop. Do not weaken a guard or retry the mutating file.
An uncertain `grant.sql` result must be treated as possibly committed; run the
read-only postflight before deciding anything else.

## Guards

- `public.app_environment` must exist and remain empty, the established
  production marker for this project.
- Forum v1 must have exactly one install-state row and mode must be `off`.
- There must be zero existing administrators before the grant.
- Exactly one joined Auth/profile row must match the confirmed email and exact
  public username.
- The update must affect exactly one row and leave exactly one administrator.
- No service-role key, password, JWT, or database URL is present in the package.

`rollback.sql` is deliberately exact and is safe only before the forum opens:
it requires mode `off`, exactly one administrator, and the same email/username
identity before removing that one grant.
