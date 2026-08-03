# Chapter class scopes v14 - clone rehearsal package

This package is rollback-only and must run exclusively on a fresh isolated
restore clone of the reviewed production snapshot. **Never run it on production.**
It contains no production authorization and no persistent apply.

Pinned review source:

- `src/migrations/chapter_class_scopes_v14_draft.sql`
- SHA-256 `6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459`

Required order:

1. Create or select a fresh isolated restore clone of production.
2. Run `read_only_preflight.sql`. Require exactly
   `292 / 3088 / 3094 / 241 / 9 / 4`,
   five existing v13 scope rows, and protected
   `83 / 1307 / c742fabf93ff8dd33d6ecd5eb4793db0`.
3. Run `rollback_rehearsal.sql` as one complete script.
4. Require final result
   `v14 rollback verified; no persistent database change`.
5. If the client stops on any error, issue `rollback;` or close that SQL
   connection. Do not continue or fix forward.

Inside one transaction the rehearsal removes only the source review guard,
inserts the 85 reviewed rows, verifies 90 total canonical rows, validates the
projected JEE/NEET/School browse outputs and protected original-83 fingerprint,
then rolls back. Post-rollback checks require the five-row v13 state and the
original browse outputs.

The four deferred chapters remain absent: `probability`, `p-block-elements`,
`surface-chemistry`, and `qualitative-analysis`.

Successful rollback evidence is not approval for a persistent clone apply or
production. Those are later, separately authorized gates.
