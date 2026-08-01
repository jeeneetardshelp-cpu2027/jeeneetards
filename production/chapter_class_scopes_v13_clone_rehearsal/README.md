# Chapter class scopes v13 - clone rehearsal package

This package is **prepared only**. It has not been connected to or run against
Supabase. Run it only on an isolated restore clone of the reviewed production
snapshot. Never run either SQL file on production.

1. Run `read_only_preflight.sql` and require exactly
   `292 / 3088 / 3094 / 241 / 9 / 4`,
   protected `83 / 1350`, fingerprint
   `6829fcb6eae22479db7b82b7b3da654d`, both RPCs present, and no scope table.
2. In the same verified clone, run `rollback_rehearsal.sql` as a whole.
3. Require the final result: `rollback verified; no persistent database change`.
4. If the SQL client stops after an error, issue `rollback;` or close the
   connection. The generated file contains no `commit`.

The rehearsal temporarily creates the table/rows and replaces the two browse
functions inside one transaction, checks counts and the protected fingerprint,
then rolls everything back. Source definitions and grants are verified after
rollback. It is not a production migration package.

Because the changes never become visible outside the transaction, browser QA
cannot be evidence from this rollback-only gate. A persistent clone-only gate
must be approved separately before browser/runtime verification.
