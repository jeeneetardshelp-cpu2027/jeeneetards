# Browse search v1 — production package

Hardened, self-verifying package that upgrades `/browse` search (result list **and**
filter-count sidebar) to the homepage's `universal_search` engine on the production
project `kezelafqhgqrprpadmlf`.

It is the hardened form of the reviewed drafts
`docs/sql/browse_search_2026-08-25.sql` and
`docs/sql/browse_facet_search_2026-08-25.sql`, combined into one transaction whose
self-tests run **before** commit, so any parity/dependency/drift failure rolls the
whole apply back instead of leaving a broken anon-facing function live to students.

## What it changes

- **Adds** `search_query_tokens(text)`, `search_playlist_ids(text)`, `search_video_ids(text)`
  — anon-executable, `SECURITY INVOKER`, reusing `universal_search`'s helpers so the
  browse list matches identically to the homepage (multi-token, trigram typo, Hinglish).
- **Replaces** `browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)`.
  Its body is byte-identical to the live v13 definition **except** the `ok_search`
  predicate, which now matches via `search_playlist_ids` instead of a title `ILIKE`
  (verified by diff against `production/chapter_class_scopes_v13_production/production_apply.sql`;
  v14 does not touch this function).

Non-destructive: `create or replace` + one `alter function ... set search_path` only.
No `DROP`/`ALTER TABLE`/index build — it cannot lock reads. Idempotent.

## Why it is safe to ship independently of the frontend

The frontend (already in production) calls these RPCs and, if they are absent, falls
back to the old title `ILIKE` for both the list and the counts — so `/browse` search
keeps working before, during, and after this apply. This package only upgrades the
match quality.

## Files and SHA-256

| File | SHA-256 |
| --- | --- |
| `production_apply.sql` | `6ffdaee878edd4a1be6b672bc97e725098e63f10ae67efe6c0eb84f4f17aa5d2` |
| `read_only_postflight.sql` | `5276fe1c8722a061928385ed5cf4821c406051888e3893427868d56f56453502` |
| `rollback.sql` | `8a8cd0b8e12ccb584a07eda401b6e81d7a63d30bea131a5e4bb07b5aa6583232` |

## Guards built in

1. **Target guard** — refuses unless `app_environment` exists and is production-empty.
2. **Dependency preflight** (in-transaction) — refuses if `pg_trgm`, the shared
   `universal_search` helpers, the catalogue tables, `browse_facet_counts`, or v13's
   `chapter_matches_class_scope` are absent.
3. **Drift guard** — refuses unless the live `browse_facet_counts` is the exact v13
   title-`ILIKE` body this delta was diffed against; separately reports ALREADY APPLIED.
4. **In-transaction self-test** — proves the id functions match `universal_search`, the
   friction-problems leak is closed, the facet counts route through the new engine, and
   the 2-character floor holds. **A failure rolls the whole apply back.**

## Run order

1. Take a fresh PITR restore point in the Supabase dashboard.
2. Run `production_apply.sql` **whole**; confirm the notice
   `BROWSE SEARCH v1 SELF-TEST PASSED` and the final `BROWSE SEARCH v1 APPLY VERIFIED`.
3. Run `read_only_postflight.sql`; every row should read `ok` and the behaviour counts
   should be non-zero / zero as labelled.
4. If needed, `rollback.sql` restores the v13 `browse_facet_counts` and drops the three
   new functions (frontend degrades gracefully to the old `ILIKE`).

## Rehearsal

The whole package was rehearsed in PGlite (real `pg_trgm`) — 16 checks covering the
happy path, idempotent re-run, target/dependency/drift guards, **self-test-failure
rollback**, postflight, and rollback restoration — all passing. Running it against the
production database remains a deliberate operator action (take the PITR point first).
