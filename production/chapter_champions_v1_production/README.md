# Chapter champions v1 — production package

Adds **one read-only RPC**, `get_chapter_champions(bigint)`, to the production
project `kezelafqhgqrprpadmlf` — the sanctioned window onto the clarity and
question-quality ratings CourseRating has always collected but no surface has
ever shown (anon's column grant deliberately excludes both columns, so the
browser cannot aggregate them itself).

Per-course **aggregates only** for one chapter's courses: no user ids, no
review text, no per-row data. Each dimension's average is `NULL` until it has
**5 votes** — the same `RATING_CONFIDENCE_MIN` floor every UI surface applies
(`src/ratingConfidence.js`) — so no client can ever show an unconfident score.

## Frontend pairing

`src/useChapterChampions.js` + `src/ChapterChampions.jsx` (the "Chapter
champions" board on the watch page, beside ChapterTeachers). The frontend
degrades to silence when this RPC is absent (`isMissingCatalogRpc`), so it is
**safe to ship in any order relative to this SQL**. With production ratings
only now accumulating via the completion-time prompt, the board will stay
invisible until real courses clear the floor — by design.

## Files and run order

1. Take a fresh PITR restore point in the Supabase dashboard.
2. Run `production_apply.sql` **whole**; confirm the notice
   `CHAPTER CHAMPIONS v1 SELF-TEST PASSED` and the final
   `CHAPTER CHAMPIONS v1 APPLY VERIFIED`. The self-test runs **inside** the
   transaction — a failure rolls the whole apply back.
3. Run `read_only_postflight.sql`; every row should read `ok`.
4. `rollback.sql` drops the function; the frontend degrades gracefully again.

Guards: production-empty `app_environment` target guard; in-transaction
dependency preflight (tables + `clarity_rating`/`question_rating` columns);
refuses to replace an existing definition (`ALREADY APPLIED`). Non-destructive:
`create function` only — no DROP, no ALTER TABLE, no index build.

## Rehearsal

The whole package ran in PGlite: 15 checks — happy path (floor semantics,
NULL-below-floor, chapter isolation, institute join), **anon can execute the
definer RPC while lacking the column grants**, postflight, rollback keeps every
rating row, target/dependency guards, and ALREADY-APPLIED on re-run — all
passing. Running against the production database remains an operator action.
