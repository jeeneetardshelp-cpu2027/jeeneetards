# Production Schema Reference

Generated 2026-07-30, cross-verified against live production via Supabase's PostgREST OpenAPI spec (40 tables, 76 RPC functions confirmed live at generation time). This supersedes CLAUDE.md's "schema.sql, community_schema.sql, courses_data.sql" description of the database, which reflects only the earliest layer of what is now a much larger accumulated schema.

RLS policies, triggers, foreign keys and function bodies below are sourced from reading the actual SQL migration files in this repo, not from the OpenAPI spec (which only confirms table/column/function existence and shape) -- so treat those specific claims as accurate as of when each cited file was last verified to match production, not as independently live-verified the way column existence is.

## Contents

- [Core Catalogue](#core-catalogue)
- [Curriculum Taxonomy & Browse](#curriculum-taxonomy-&-browse)
- [Community & Social (accounts, ratings, reviews, reports)](#community-&-social-accounts-ratings-reviews-reports)
- [Teacher / Faculty Core Data](#teacher-faculty-core-data)
- [Faculty Review & Proposal Workflow](#faculty-review-&-proposal-workflow)
- [Import, Catalog Management & Audit Trails](#import-catalog-management-&-audit-trails)
- [Search Infrastructure](#search-infrastructure)

---

## Core Catalogue

### `institutes_channels`

**Source:** `schema.sql` (original `create table`, RLS enable + "public read" policy). `admin_policies.sql` adds the insert policy.

**Columns** (live, from ground truth):
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `name` | text | not null | — |
| `youtube_channel_id` | text | not null | — (unique) |
| `logo_url` | text | nullable | — |
| `created_at` | timestamptz | not null | `now()` |

**Constraints:** `youtube_channel_id` is `unique` (schema.sql line 13). No CHECK constraints found anywhere in the repo for this table.

**RLS:** enabled. Policies:
- `"public read"` — `for select using (true)` (schema.sql) — anyone, including logged-out, can read.
- `"admin inserts"` — `for insert to authenticated with check (public.is_admin())` (admin_policies.sql) — only a signed-in user whose `profiles.is_admin = true` can insert.
- No update/delete policy exists anywhere in the repo. Rows can only be updated/deleted via the Supabase dashboard (service_role, which bypasses RLS).

**Triggers:** none.

**Foreign keys (incoming):** referenced by `videos.channel_id` (on delete restrict) and `playlists.channel_id` (on delete restrict).

---

### `categories`

**Source:** `schema.sql` only. No other file alters this table.

**Columns:**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `name` | text | not null | — (unique) |
| `slug` | text | not null | — (unique) |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamptz | not null | `now()` |

**Constraints:** `name` unique, `slug` unique. No CHECK constraints.

**RLS:** enabled, single policy `"public read" for select using (true)` (schema.sql). There is **no insert/update/delete policy anywhere in the repo** for `categories` — not even in `admin_policies.sql`, which only grants inserts on `institutes_channels`, `chapters`, `videos`, `playlists`, `playlist_videos`. Categories can only be written from the Supabase dashboard / service_role, never through the app, even by an admin user.

**Triggers:** none.

**Foreign keys (incoming):** referenced by `videos.category_id` (on delete restrict) and `playlists.category_id` (on delete set null).

---

### `subjects`

**Source:** `schema.sql` only.

**Columns:**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `name` | text | not null | — (unique) |
| `slug` | text | not null | — (unique) |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamptz | not null | `now()` |

**Constraints:** `name` unique, `slug` unique.

**RLS:** enabled, `"public read"` select-only, same as `categories` — **no write policy of any kind exists**, including for admins. Dashboard/service_role only.

**Triggers:** none.

**Foreign keys (incoming):** `chapters.subject_id` (on delete cascade), `videos.subject_id` (on delete restrict), `playlists.subject_id` (on delete set null).

---

### `chapters`

**Source:** `schema.sql` (creates the table). `docs/sql/set_chapter_display_order_2026-07-29.sql` (2026-07-29) later changes `display_order`'s default and bulk-assigns real syllabus ordering to 134 rows.

**Columns:**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `subject_id` | bigint | not null (FK → `subjects.id`, on delete cascade) | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | none (see note) |
| `created_at` | timestamptz | not null | `now()` |

Ground truth shows `display_order` still required (NOT NULL) but with **no default** listed. `schema.sql` originally gave it `default 0`; `set_chapter_display_order_2026-07-29.sql` explicitly runs `alter table public.chapters alter column display_order set default null` — the migration's own comment explains why: "New chapters used to default to display_order 0, which sorts BEFORE 1 … a future import would jump to the top of every menu. NULL sorts last." This matches ground truth exactly (no default present), so any future insert that omits `display_order` will now violate the NOT NULL constraint unless a value is explicitly supplied — a real behavioral change from the original schema.

**Constraints:** `unique (subject_id, name)`, `unique (subject_id, slug)` (schema.sql). No CHECK constraints.

**RLS:** enabled. `"public read"` select policy (schema.sql). `"admin inserts"` insert policy, admin-only (admin_policies.sql). No update/delete policy anywhere — matches the `set_chapter_display_order_2026-07-29.sql` bulk UPDATE having been run directly against production (service_role/dashboard), not through the app.

**Triggers:** none.

**Indexes:** `idx_chapters_subject` on `(subject_id)`.

**Foreign keys (incoming):** `videos.chapter_id` (on delete set null), `topics.chapter_id` (outside this cluster).

---

### `videos`

**Source:** `schema.sql` (base table + `trg_videos_updated_at`). `src/migrations/video_playlist_metadata.sql` adds `duration_seconds`, `caption_status`, `embedding_status`, `last_verified_at`. `docs/sql/clean_lesson_titles_2026-07-29.sql` adds `source_title`.

**Columns:**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `youtube_video_id` | text | not null | — (unique, 11-char YouTube ID) |
| `title` | text | not null | — |
| `description` | text | nullable | — |
| `channel_id` | bigint | not null (FK → `institutes_channels.id`, on delete restrict) | — |
| `category_id` | bigint | not null (FK → `categories.id`, on delete restrict) | — |
| `subject_id` | bigint | not null (FK → `subjects.id`, on delete restrict) | — |
| `chapter_id` | bigint | nullable (FK → `chapters.id`, on delete set null) | — |
| `published_at` | date | nullable | — |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()`, auto-touched by trigger |
| `duration_seconds` | integer | nullable | — |
| `caption_status` | text | nullable | — (documented via comment only: `available \| none \| unknown`, **not DB-enforced**) |
| `embedding_status` | text | nullable | — (comment only: `embeddable \| blocked \| unknown`, **not DB-enforced**) |
| `last_verified_at` | timestamptz | nullable | — |
| `source_title` | text | nullable | — |

**Constraints:** `youtube_video_id` unique. No CHECK constraints exist for `caption_status`/`embedding_status`/`duration_seconds` despite the app treating them as enums — these are free text at the DB layer.

**Triggers:** `trg_videos_updated_at` — `before update … execute function public.set_updated_at()` — sets `new.updated_at = now()` on every row update (schema.sql).

**RLS:** enabled. `"public read"` select (schema.sql). `"admin inserts"` insert-only, admin-gated (admin_policies.sql). No update/delete policy — row edits (e.g. the 1,700+ title cleanups in `clean_lesson_titles_2026-07-29.sql`, or `source_title` backfill) are run directly as service_role/dashboard SQL, not through the app's RLS-governed path.

**Indexes:** `idx_videos_channel`, `idx_videos_category`, `idx_videos_subject`, `idx_videos_chapter`.

**Note on `source_title`:** per `clean_lesson_titles_2026-07-29.sql`'s comment, this column is a non-destructive backup of the original YouTube title — the curated `title` column is what's shown, and "import/refresh scripts never overwrite `videos.title`" once it diverges from `source_title`.

---

### `playlists`

**Source:** the table itself is created by `community_schema.sql` (not `schema.sql`), which also sets up the rating-average trigger. Columns were added incrementally across many later files:

| column added | source file |
|---|---|
| `teacher`, `tags` | `courses_data.sql` |
| `youtube_playlist_id` | `playlist_idempotency.sql` |
| `class_levels` | `src/migrations/add_class_levels.sql` |
| `content_type`, `language`, `difficulty`, `last_verified_at` | `src/migrations/video_playlist_metadata.sql` |
| `audience_focus` | `src/migrations/import_rpc.sql` |
| `view_count_total`, `popularity_score`, `stats_fetched_at` | `src/migrations/video_stats.sql` |
| `source_title`, `source_title_changed`, `title_review_status`, `faculty_credit_status` | `src/migrations/content_quality_v10.sql` |

**Columns (ground truth):**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `title` | text | not null | — |
| `description` | text | nullable | — |
| `slug` | text | nullable | — (unique) |
| `channel_id` | bigint | not null (FK → `institutes_channels.id`, on delete restrict) | — |
| `category_id` | bigint | nullable (FK → `categories.id`, on delete set null) | — |
| `subject_id` | bigint | nullable (FK → `subjects.id`, on delete set null) | — |
| `thumbnail_url` | text | nullable | — |
| `display_order` | integer | not null | `1000000` (set in `community_schema.sql`, re-asserted by `src/migrations/playlist_order_v10.sql` which also backfills legacy `0` rows to `1000000`) |
| `average_rating` | numeric(3,2) | not null | `0`, maintained only by trigger — never write directly |
| `ratings_count` | integer | not null | `0`, maintained only by trigger |
| `created_at` | timestamptz | not null | `now()` |
| `teacher` | text | nullable | — |
| `tags` | text[] | not null | `'{}'`, GIN-indexed (`idx_playlists_tags`) |
| `youtube_playlist_id` | text | nullable | — (unique among non-null values via partial unique index) |
| `class_levels` | text[] | not null | `'{}'` — **derived/read-only in practice**, see trigger note below |
| `content_type` | text | nullable | — CHECK: `content_type in ('full-course','one-shot','revision','pyq','practice')` |
| `language` | text | nullable | — CHECK: `language in ('hindi','english','hinglish')` |
| `difficulty` | text | nullable | — CHECK: `difficulty in ('beginner','intermediate','advanced')` |
| `last_verified_at` | timestamptz | nullable | — |
| `audience_focus` | text | nullable | — (no CHECK constraint; app-layer validated in `catalog_management_v11.sql`'s admin RPC only) |
| `view_count_total` | bigint | not null | `0` |
| `popularity_score` | numeric | not null | `0` |
| `stats_fetched_at` | timestamptz | nullable | — |
| `source_title` | text | nullable | — |
| `source_title_changed` | boolean | not null | `false` |
| `title_review_status` | text | not null | `'pending'` — CHECK: `title_review_status in ('pending','approved')` |
| `faculty_credit_status` | text | not null | `'pending'` — CHECK: `faculty_credit_status in ('pending','identified','team','unknown')` |

**Constraints:** `slug` unique (nullable-safe); `uq_playlists_youtube_playlist_id` — partial unique index `on (youtube_playlist_id) where youtube_playlist_id is not null` (`playlist_idempotency.sql`) so hand-made courses can all have `NULL`; three named CHECK constraints (above) all guarded with `if not exists (select … from pg_constraint)` so the files are re-runnable.

**Triggers:**
- `trg_force_derived_class_levels` → **`trg_force_class_levels`**, `before insert or update … execute function public.force_derived_class_levels()`. This overwrites whatever `class_levels` value a caller supplies with `public.derived_class_levels(new.id)`, computed from the `playlist_class_levels` junction table. In effect `playlists.class_levels` is a denormalised, trigger-maintained mirror — direct writes to it are silently discarded. Defined identically in `src/migrations/import_playlist_v3.sql` (marked "DO NOT apply to production") and again, gated behind a `p_enable_triggers` flag with a pre-flight drift check, in `production/production_migration.sql` (the actual production build script) and `src/migrations/import_playlist_v6.sql`.
- `trg_sync_pl_class_array` on `playlist_class_levels` (after insert or delete) also updates `playlists.class_levels` via the same `derived_class_levels()` helper, keeping the mirror in sync when the junction table changes directly.
- `trg_refresh_playlist_rating` lives on `playlist_ratings`, not on `playlists` itself, but its effect is entirely on this table: `after insert or update or delete on public.playlist_ratings … execute function public.refresh_playlist_rating()` recomputes `average_rating` (rounded avg to 2dp) and `ratings_count` for the affected `playlist_id` (`community_schema.sql`). This is the "auto-average" the top-level CLAUDE.md refers to — never recompute it in the app.

**RLS:** enabled (`community_schema.sql`). `"public read"` select (community_schema.sql, also restated identically in `schema.sql`'s sibling tables pattern). `"admin inserts"` insert-only, admin-gated (`admin_policies.sql`). **No update/delete RLS policy exists anywhere.** All observed row-level updates to `playlists` (content_quality_v10's `review_playlist_quality`, catalog_management_v11's metadata editor, the import RPCs) go through `SECURITY DEFINER` functions that check `public.is_admin()` internally and so bypass RLS by design, or through service_role.

**Indexes:** `idx_playlists_channel`, `idx_playlists_category`, `idx_playlists_subject`, `idx_playlists_avg_rating` (community_schema.sql); `idx_playlists_tags` GIN (courses_data.sql); `idx_playlists_popularity`, `idx_playlists_views` (video_stats.sql).

**Related but out-of-cluster table:** `public.video_stats` (created in `video_stats.sql`) is the per-video source that a refresh job aggregates into `playlists.view_count_total`/`popularity_score`/`stats_fetched_at`. It is public-select-only with no RLS write policy — "only the service-role refresh job … may write."

---

### `playlist_videos`

**Source:** `community_schema.sql` only.

**Columns:**
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint (identity) | not null (PK) | — |
| `playlist_id` | bigint | not null (FK → `playlists.id`, on delete cascade) | — |
| `video_id` | bigint | not null (FK → `videos.id`, on delete cascade) | — |
| `position` | integer | not null | `0` |
| `created_at` | timestamptz | not null | `now()` |

**Constraints:** `unique (playlist_id, video_id)` — a video can't appear twice in the same course.

**Triggers:** none.

**RLS:** enabled. `"public read"` select (community_schema.sql). `"admin inserts"` insert-only, admin-gated (admin_policies.sql). No update/delete policy.

**Indexes:** `idx_plvideos_playlist`, `idx_plvideos_video`.

---

### `get_chapter_courses(p_chapter_id bigint)`

**What it does:** Returns every course (playlist) that has at least one video mapped to the given chapter, sorted best-rated first (`average_rating desc, ratings_count desc`), with everything the Chapter Hub card needs (institute name via join, lecture count, tags, etc.).

**Signature (ground truth):** GET/POST RPC, single required param `p_chapter_id bigint`. Ground truth's OpenAPI dump does not expose the returned row shape (RPC responses are generic `200 OK`), so the exact live `RETURNS TABLE` cannot be confirmed from the ground-truth file alone — see Discrepancies.

**Security:** `language sql stable` — **not** `security definer`. Its own comment states "Runs as the caller, so your public-read RLS still applies," which works because every table it reads (`playlists`, `institutes_channels`, `playlist_videos`, `videos`) has a public `select` policy.

**Grants:** every version explicitly does `grant execute on function public.get_chapter_courses(bigint) to anon, authenticated`. No `revoke` statement was ever found for this function, and Supabase's default-privilege rule (documented in `v6_2_grant_tightening.sql`) grants execute on new `public` functions to `postgres, anon, authenticated, service_role` automatically — so it's callable by anon (logged-out) and authenticated alike, matching that it's the query behind the public Chapter Hub.

**History (three competing "drop + recreate" definitions found, each widening the return columns as new `playlists` columns were added):**
1. `courses_data.sql` (base): returns `playlist_id, title, teacher, institute, lectures, average_rating, ratings_count, tags`.
2. `src/migrations/add_class_levels.sql`: adds `class_levels` to the above.
3. `src/migrations/video_playlist_metadata.sql`: adds `content_type, language, difficulty, total_duration_seconds` (a `sum(v.duration_seconds)` computed column) on top of the `add_class_levels.sql` shape.

All three are also bundled sequentially (in that same order) inside `staging_bootstrap.sql`. Because `CREATE OR REPLACE` can't change a function's `RETURNS TABLE` shape, each file explicitly does `drop function if exists … ; create function …`.

---

### `get_playlist_comparison(p_playlist_ids bigint[], p_chapter_id bigint, p_learning_goal_id bigint default null)`

**What it does:** Given up to 4 playlist ids and a required chapter scope, returns one row per requested id, in the caller's requested order (`requested_order`), with a `course_status` of `'ok' | 'wrong-chapter' | 'not-found'` per row rather than silently dropping bad ids. For each valid, in-chapter playlist it reports chapter-scoped lecture count and total duration (duration is `NULL` unless every lecture in that chapter has a known duration), reviewed-only comparison metadata from `playlist_attributes` (pacing, theory %, prerequisites level, completeness, "best for" — all `NULL` unless `review_status = 'verified'`), and, when `p_learning_goal_id` is supplied, syllabus coverage percentage computed from verified `video_topics`/`learning_goal_topics` mappings.

**Signature (ground truth, confirmed against the SQL):**
- `p_playlist_ids bigint[]` — required, max 4 non-null positive ids, no duplicates (all enforced with explicit `raise exception`).
- `p_chapter_id bigint` — required, must reference an existing `chapters.id`.
- `p_learning_goal_id bigint` — optional (`default null`), if supplied must reference an existing `learning_goals.id`.
- Returns a wide table: `requested_order, playlist_id, course_status, title, teacher, channel_title, subject_title, class_levels, language, content_type, difficulty, chapter_lecture_count, chapter_duration_seconds, pacing, theory_percentage, prerequisites_level, completeness_status, best_for, metadata_verified_at, coverage_mapped_topics, coverage_required_topics, syllabus_coverage_pct, average_rating, ratings_count, last_verified_at`.

**Security:** `language plpgsql stable security definer set search_path = ''`. It joins several editorial-internal tables (`playlist_attributes`, `topics`, `learning_goal_topics`, `video_topics`) that are themselves locked down (`revoke all … from public, anon, authenticated`, `grant … to service_role` only) — `SECURITY DEFINER` is what lets an anonymous browsing student get the reviewed projection without being granted direct table access.

**Grants:** `revoke all on function public.get_playlist_comparison(bigint[], bigint, bigint) from public, anon, authenticated, service_role;` immediately followed by `grant execute … to anon, authenticated, service_role;` — i.e. deliberately re-asserted (defence-in-depth) rather than relying on default privileges.

**Comment:** `comment on function … is 'Truthful ordered comparison: max 4 bigint playlist ids, required chapter scope, optional learning-goal coverage. Unknown metadata remains NULL.'` — this exact string is what ground truth's OpenAPI `summary` field surfaces, confirming this is the live definition.

**Source:** the *only* file anywhere in the repo that defines this function is `src/migrations/comparison_metadata_v8.sql`. See Discrepancies — this matters because that file's own header says it should not be live.

---

### Discrepancies

1. **`get_playlist_comparison` is live in production despite its source file explicitly saying it shouldn't be.** `src/migrations/comparison_metadata_v8.sql`'s header reads: *"v8 STAGING CANDIDATE … This file is not included in `staging_bootstrap.sql` or the production migration builder. Apply only to a disposable staging project after independent review."* Yet the ground-truth OpenAPI spec (pulled from production this morning) shows `get_playlist_comparison` live, with a parameter signature and `summary` comment that match this file byte-for-byte. Neither `production/production_migration.sql` nor `staging_bootstrap.sql` contain any reference to `get_playlist_comparison`, `playlist_attributes`, or `topics` (confirmed by grep) — so whoever put this live did so by running `comparison_metadata_v8.sql` directly against production, bypassing the "staging only, independently reviewed" process the file itself describes. This also means the satellite tables `playlist_attributes`, `topics`, `learning_goal_topics`, and `video_topics` that back it are live in production without appearing in the "official" production migration builder.

2. **`get_chapter_courses`'s current live return shape cannot be confirmed, and is plausibly stale.** Three files (`courses_data.sql` → `add_class_levels.sql` → `video_playlist_metadata.sql`) each `drop`+`recreate` this function, cumulatively adding columns, and no file after `video_playlist_metadata.sql` touches it again. But *seven* more columns were added to `playlists` after that point by later files (`import_rpc.sql`'s `audience_focus`, `video_stats.sql`'s `view_count_total`/`popularity_score`/`stats_fetched_at`, `content_quality_v10.sql`'s `source_title`/`source_title_changed`/`title_review_status`/`faculty_credit_status`) — none of which appear in `get_chapter_courses`'s `RETURNS TABLE`. Ground truth's OpenAPI dump doesn't expose RPC return-row shapes (just `200: OK`), so I cannot verify from the ground-truth file whether the Chapter Hub RPC was ever updated (e.g. directly via the SQL Editor with no corresponding checked-in file) to surface these newer fields, or whether it has simply never been revisited. Recommend running `select pg_get_functiondef('public.get_chapter_courses'::regproc)` against production to settle this.

3. **No orphan/unexplained columns found for this cluster.** Every column present in the ground-truth JSON for `institutes_channels`, `categories`, `subjects`, `chapters`, `videos`, `playlists`, and `playlist_videos` was traced to a specific migration file (see per-table "Source" notes above) — none needed to be reported as "live with no explanation."
## Curriculum Taxonomy & Browse

### `learning_goals`
**Columns** (live): `id` bigint identity PK · `name` text not null unique · `slug` text not null unique · `display_order` int not null default `0` · `created_at` timestamptz not null default `now()`.

**Source**: `src/migrations/learning_goals_and_class_levels.sql` (§1) — `create table if not exists public.learning_goals`. Seeded with JEE / NEET / Olympiad / School Boards (§2, `on conflict (slug) do nothing`).

**RLS**: enabled. Policies (created via a `do $$ ... execute format(...) $$` loop over `learning_goals`, `boards`, `class_levels`, `playlist_learning_goals`, `video_learning_goals`, `playlist_class_levels`, `video_class_levels`):
- `"public read"` — `for select using (true)` — anyone.
- `"admin inserts"` — `for insert to authenticated with check (public.is_admin())`.
- `"admin deletes"` — `for delete to authenticated using (public.is_admin())`.
- No update policy exists — rows can only be created/removed, never edited, by admins.

**Triggers**: none found.
**FKs / checks**: none (this is a root reference table).

---

### `class_levels`
**Columns** (live): `id` bigint identity PK · `name` text not null unique ("Class 11") · `slug` text not null unique ("class-11") · `display_order` int not null default `0` · `created_at` timestamptz not null default `now()`.

**Source**: same file/section as `learning_goals`. Seeded with Class 10 / 11 / 12 / Dropper. A comment in the file explicitly notes this table does **not** collide with the unrelated `playlists.class_levels` text[] column (different namespace; that array column was later made a derived/trigger-maintained mirror of the junction data — see `derived_class_levels` below).

**RLS**: same pattern as `learning_goals` — public read, admin insert, admin delete, no update policy.
**Triggers**: none on this table itself.
**FKs / checks**: none.

---

### `boards`
**Columns** (live): `id` bigint identity PK · `name` text not null unique · `slug` text not null unique · `display_order` int not null default `0` · `created_at` timestamptz not null default `now()`.

**Source**: same file/section as above. Seeded with CBSE (`display_order=1`) in `learning_goals_and_class_levels.sql`; ICSE and State Board were added later by `src/migrations/import_playlist_v4.sql` / `production/production_migration.sql` (§ "TAXONOMY FIX", review item 4) via `insert ... on conflict (slug) do nothing`.

**RLS**: same pattern — public read, admin insert, admin delete, no update policy.
**Triggers**: none. **FKs / checks**: none.

---

### `category_learning_goals`
**Columns** (live): `category_id` bigint PK, FK → `categories.id` · `learning_goal_id` bigint PK, FK → `learning_goals.id`. Composite PK `(category_id, learning_goal_id)`.

**Source**: `src/migrations/import_playlist_v6.sql` (§1, "CATEGORY ↔ LEARNING GOAL"), reproduced verbatim in `production/production_migration.sql` (lines 643–660). Purpose per the file's own comment: Browse reads `videos.category_id` while Explore reads `video_learning_goals`; nothing tied the two together before this table, so the same course could show under JEE in Browse and NEET in Explore. It's declared many-to-many "intentionally... a category may legitimately serve several goals later." Backfilled once: jee↔jee, neet↔neet, olympiad↔olympiad, school-boards↔school.
Both FKs cascade on delete (`on delete cascade`).

**RLS**: enabled, only `"public read" for select using (true)`. **No insert/update/delete policy of any kind exists for this table** — unlike the `admin inserts`/`admin deletes` pair on `learning_goals`/`class_levels`/`boards`, writes here are reachable only through a service_role/postgres session (e.g., the Supabase dashboard), not through any policy-gated authenticated path.
**Triggers**: none. **Checks**: none beyond the FKs/PK.

---

### `learning_goal_class_levels`
**Columns** (live): `learning_goal_id` bigint PK, FK → `learning_goals.id` · `class_level_id` bigint PK, FK → `class_levels.id`. Composite PK `(learning_goal_id, class_level_id)`.

**Source**: first introduced in `src/migrations/import_playlist_v3.sql` (marked "DO NOT apply to production"), carried forward unchanged into `import_playlist_v4.sql`, and that v4 copy is what's bundled into `production/production_migration.sql` (lines 109–124) — the actually-applied version. Purpose: "entrance exams never accept Class 10; school boards do" — enforced in the DB rather than app constants. Backfilled: JEE/NEET/Olympiad × {class-11, class-12, dropper}; School × {class-10, class-11, class-12}. Both FKs cascade on delete.

**RLS**: enabled, only `"public read" for select using (true)`. No insert/update/delete policy — same restricted-write pattern as `category_learning_goals`.
**Triggers**: none. **Checks**: none beyond FKs/PK.

---

### `learning_goal_topics`
**Columns** (live): `learning_goal_id` bigint PK, FK → `learning_goals.id` · `topic_id` bigint PK, FK → `topics.id` · `is_required` boolean not null default `true` · `created_at` timestamptz not null default `now()`. Composite PK `(learning_goal_id, topic_id)`.

**Source**: `src/migrations/comparison_metadata_v8.sql` only (§2). Purpose per its comment: "Which topics are part of a particular exam/learning-goal syllabus. A topic can be required for JEE, optional for Olympiad, and absent for NEET without duplicating the topic identity." Both FKs cascade on delete. Index `idx_lgt_topic (topic_id)`.

**RLS**: `alter table ... enable row level security` with **zero `create policy` statements** for this table anywhere in the repo. Table-level grants explicitly `revoke all ... from public, anon, authenticated` and `grant select, insert, update, delete ... to service_role` only. Net effect: this table is invisible to anon/authenticated through PostgREST; the only in-repo consumer is the `get_playlist_comparison()` SECURITY DEFINER RPC (not part of this cluster), which reads it internally.
**Triggers**: none. **Checks**: none beyond FKs/PK.

⚠️ See Discrepancies — this table's only defining file says it must never reach production.

---

### `topics`
**Columns** (live): `id` bigint identity PK · `chapter_id` bigint not null, FK → `chapters.id` · `name` text not null · `slug` text not null · `display_order` int not null default `0` · `created_at` timestamptz not null default `now()`.

**Source**: `src/migrations/comparison_metadata_v8.sql` only (§2). `chapter_id` FK is `on delete cascade`. Unique constraints: `unique (chapter_id, slug)` and `unique (chapter_id, name)` (both live as composite uniques, not visible as separate columns in the OpenAPI spec). Index `idx_topics_chapter_order (chapter_id, display_order, id)`.

**RLS**: identical lockdown to `learning_goal_topics` — RLS enabled, no policies, `revoke all` from public/anon/authenticated, `select/insert/update/delete` granted to `service_role` only (plus `usage, select` on `topics_id_seq` to `service_role`).
**Triggers**: none directly on `topics` (the file's trigger, `trg_touch_playlist_attributes`, is on the unrelated `playlist_attributes` table).
**Checks**: none beyond the two unique constraints and the FK.

⚠️ See Discrepancies below — same file/status caveat as `learning_goal_topics`.

---

### `video_learning_goals`
**Columns** (live): `video_id` bigint PK, FK → `videos.id` · `learning_goal_id` bigint PK, FK → `learning_goals.id`. Composite PK `(video_id, learning_goal_id)`.

**Source**: `src/migrations/learning_goals_and_class_levels.sql` §3. Both FKs `on delete cascade`. Index `idx_vlg_goal (learning_goal_id)`. Backfilled once (§5a) from `videos.category_id` joined to `categories.name = learning_goals.name` — the file notes this original name-matching backfill was itself superseded later (`import_playlist_v6.sql` review item 4 replaced *reads* going forward with explicit `learning_goal_id`, since `categories.name` vs `learning_goals.name` string-matching silently failed for School Boards content).

**RLS**: public read / admin insert / admin delete / no update (same loop-generated policy set as `learning_goals`).
**Triggers**: none directly; rows are written by the `set_managed_video_taxonomy` / `import_playlist_with_chapters` admin RPCs (outside this cluster) rather than by a DB trigger.
**Checks**: none beyond FKs/PK.

---

### `video_class_levels`
**Columns** (live): `video_id` bigint PK, FK → `videos.id` · `class_level_id` bigint PK, FK → `class_levels.id`. Composite PK `(video_id, class_level_id)`.

**Source**: same file/section as `video_learning_goals`. Both FKs `on delete cascade`. Index `idx_vcl_class (class_level_id)`. Backfilled once (§5c) as "the union of the classes of the playlists that contain [the video]" via `playlist_videos` ⋈ `playlist_class_levels`.

**RLS**: public read / admin insert / admin delete / no update.
**Triggers**: none directly.
**Checks**: none beyond FKs/PK.

---

### `playlist_learning_goals`
**Columns** (live): `playlist_id` bigint PK, FK → `playlists.id` · `learning_goal_id` bigint PK, FK → `learning_goals.id`. Composite PK `(playlist_id, learning_goal_id)`.

**Source**: `src/migrations/learning_goals_and_class_levels.sql` §3, both FKs `on delete cascade`, index `idx_plg_goal (learning_goal_id)`; a second index `idx_plg_goal_playlist (learning_goal_id, playlist_id)` was added later by `src/migrations/catalog_navigation_v9.sql` specifically to support `get_browse_curriculum`/`browse_facet_counts`. Backfilled once (§5a) from `playlists.category_id`. Written going forward by `update_managed_playlist()` (delete-then-reinsert per call) — see `catalog_management_v11.sql`, outside this cluster.

**RLS**: public read / admin insert / admin delete / no update.
**Triggers**: none directly.
**Checks**: none beyond FKs/PK.

---

### `playlist_class_levels`
**Columns** (live): `playlist_id` bigint PK, FK → `playlists.id` · `class_level_id` bigint PK, FK → `class_levels.id`. Composite PK `(playlist_id, class_level_id)`.

**Source**: same file/section as `playlist_learning_goals`. Both FKs `on delete cascade`, index `idx_pcl_class (class_level_id)`; `catalog_navigation_v9.sql` adds `idx_pcl_class_playlist (class_level_id, playlist_id)`. Backfilled once (§5b) from the legacy `playlists.class_levels` text[] array (label→slug mapping: `10th→class-10`, `11th→class-11`, `12th→class-12`, `dropper→dropper`); the file notes that at backfill time every array was empty, so nothing landed then. This junction is now the **source of truth** and a `before` trigger (`force_derived_class_levels`, created in `production/production_migration.sql` around line 1018, calling `derived_class_levels()`) overwrites any direct write to `playlists.class_levels` so the legacy array can never drift from this table.

**RLS**: public read / admin insert / admin delete / no update.
**Triggers**: none directly on this table (it's the trigger's *input*, not its target — the trigger fires on `playlists`).
**Checks**: none beyond FKs/PK.

---

### `playlist_boards`
**Columns** (live): `playlist_id` bigint PK, FK → `playlists.id` · `board_id` bigint PK, FK → `boards.id`. Composite PK `(playlist_id, board_id)`.

**Source**: `src/migrations/import_playlist_v4.sql` (§2, "TAXONOMY FIX"), bundled unchanged into `production/production_migration.sql` (lines 151–159). Both FKs `on delete cascade`. Index `idx_pb_board (board_id)`. Purpose per the file: "Boards become their own axis... instead of being crammed into the goal" — i.e. School Boards content is tagged with which board(s) (CBSE/ICSE/State) separately from its learning-goal tag. Enforced by `validate_import_payload()`: content under the `school` learning goal *requires* at least one `board_id`; content under any other goal is *forbidden* from having one.

**RLS**: enabled, only `"public read" for select using (true)`. No insert/update/delete policy — same restricted-write pattern as `category_learning_goals` / `learning_goal_class_levels`.
**Triggers**: none. **Checks**: none beyond FKs/PK.

---

### `get_browse_curriculum(p_goal text, p_class text, p_subject text)`

**What it does**: Returns one "level" of bounded curriculum navigation per call so the browser never has to download every playlist/video to build a menu. With no `p_goal`, returns all learning goals with a distinct playlist count per goal (zero-count goals are kept, not hidden, so an unpopulated goal can show "Coming soon"). With `p_goal` and no `p_subject`, returns subjects that have at least one matching course under that goal. With both `p_goal` and `p_subject`, returns chapters with at least one matching course. `p_class` is applied as an additional filter on subjects/chapters (not on the goal level) with special Dropper semantics: `p_class='dropper'` matches playlists tagged `dropper`, `class-11`, **or** `class-12` (Dropper students are assumed to draw from both class years).

**Returns**: `table(level text, entity_id bigint, slug text, name text, display_order integer, course_count bigint)`.

**Security**: `language sql stable security invoker set search_path = ''`. **Not** SECURITY DEFINER — it runs as the calling role, relying on the public-read RLS policies of `learning_goals`/`subjects`/`chapters`/`playlist_learning_goals`/`playlist_class_levels`/`class_levels`.

**Who can execute**: explicit `revoke all ... from public, anon, authenticated, service_role` followed by `grant execute ... to anon, authenticated, service_role` — i.e. deliberately opened to everyone including anonymous visitors (matches "public browsing must work without login").

**Source**: `src/migrations/catalog_navigation_v9.sql`; the actually-applied production copy is `production/catalog_navigation_v9/production_delta.sql` (functionally identical — diffed, only a stray comment-line difference). Two supporting indexes ship in the same file: `idx_plg_goal_playlist (learning_goal_id, playlist_id)` and `idx_pcl_class_playlist (class_level_id, playlist_id)`.

---

### `browse_facet_counts(p_goal, p_class, p_subject, p_chapter text, p_channel bigint, p_language text[], p_type text[], p_difficulty text[], p_search text)`

**What it does**: Computes contextual, distinct-playlist facet counts for the catalogue filter UI in one round trip. Each facet (`goal`, `class`, `subject`, `chapter`, `language`, `type`, `difficulty`, `channel`) applies every *other* active filter but excludes its own filter from its own count (so, e.g., selecting "JEE" doesn't zero out the count next to "JEE" itself). The Dropper class option again uses the class-11+class-12+dropper superset. Only facet values with `n > 0` are returned.

**Returns**: `table(facet text, value text, n bigint)`.

**Security**: `language sql stable security invoker set search_path = ''`.

**Who can execute**: same pattern — explicit `revoke all` then `grant execute to anon, authenticated, service_role`.

**Source**: same file as above, `src/migrations/catalog_navigation_v9.sql` / `production/catalog_navigation_v9/production_delta.sql`.

---

### `derived_class_levels(p_playlist_id bigint)`

**What it does**: Recomputes the legacy `playlists.class_levels` text[] label array (`'10th'`/`'11th'`/`'12th'`/`'Dropper'`, in `class_levels.display_order`) from the `playlist_class_levels` junction table, so the junction can be treated as the single source of truth while old code that still reads the array column keeps working. Used both by the one-time `migrate_class_levels()` backfill/audit routine and by the `force_derived_class_levels()` `before`-trigger on `playlists` that overwrites any direct write to the array column.

**Params / return**: `p_playlist_id bigint` → `text[]`. Matches ground truth exactly (GET/POST both expose the single required `p_playlist_id` param).

**Security**: `language sql stable security definer set search_path = ''` — **is** SECURITY DEFINER (runs with the function owner's privileges, bypassing RLS on `playlist_class_levels`/`class_levels`; though those tables are public-read anyway, so this doesn't expose anything extra).

**Who can execute**: **no explicit `grant`/`revoke` statement exists anywhere in the repo for this function.** `src/migrations/v6_2_grant_tightening.sql` — the file whose entire purpose is closing default-grant gaps — explicitly lists the five functions it *does* tighten (`migrate_class_levels`, `purge_migration_audit`, `validate_import_payload`, `has_trigger`, the drift-fixture helpers) and `derived_class_levels` is not among them. Supabase's default `alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role` therefore still applies: it remains executable by `anon`, `authenticated`, and `service_role` by default.

**Source**: first defined in `src/migrations/import_playlist_v3.sql` (staging-only draft), superseded by the identical copy in `import_playlist_v4.sql`, which is the version bundled into `production/production_migration.sql` (lines 166–178).

---

### `class_label_to_slug(p_label text)`

**What it does**: One-place translation from the legacy human-readable class labels (`'10th'`, `'11th'`, `'12th'`, `'Dropper'`, case/whitespace-insensitive via `lower(trim(...))`) to the canonical `class_levels.slug` values (`'class-10'` etc.). The file's comment states this exists so label↔slug mapping logic lives in exactly one SQL function rather than being duplicated across import validation and the audit/backfill routine. Returns `null` for an unrecognized label (used by `validate_import_payload` to reject unknown class labels).

**Params / return**: `p_label text` → `text`. Matches ground truth.

**Security**: `language sql immutable set search_path = ''` — **no `security definer` clause**, so this is a plain SECURITY INVOKER function (the ground truth JSON's lack of a `summary`/description field is consistent with there being no `comment on function` statement for it either, same as `derived_class_levels`).

**Who can execute**: same situation as `derived_class_levels` — no explicit grant/revoke anywhere in the repo, and it is not in `v6_2_grant_tightening.sql`'s tightened list, so it remains executable by `anon`, `authenticated`, and `service_role` under Supabase's default function privileges.

**Source**: same provenance chain as `derived_class_levels` — `import_playlist_v3.sql` → `import_playlist_v4.sql` → bundled into `production/production_migration.sql` (lines 181–186).

---

### Discrepancies

1. **`topics` and `learning_goal_topics` are live in production but their only source file explicitly disclaims production use.** The single file in the entire repo that defines these tables, `src/migrations/comparison_metadata_v8.sql`, opens with:
   > "v8 STAGING CANDIDATE... Additive delta on top of the verified v7 staging schema. **This file is not included in staging_bootstrap.sql or the production migration builder.** Apply only to a disposable staging project after independent review."

   Confirmed by grep: neither `topics` nor `learning_goal_topics` (nor the sibling `video_topics`/`playlist_attributes`, outside this cluster) appear anywhere in `staging_bootstrap.sql` or `production/production_migration.sql`. Yet the ground-truth OpenAPI pull taken this morning against live production shows both tables present with exactly the columns this file defines. Either the file's "not applied to production" disclaimer is stale (it *was* applied, undocumented, outside the normal migration-builder pipeline), or there is an unknown second source not present in this repo checkout. This should be resolved with whoever ran the deploy — do not assume the disclaimer is still accurate.

2. **`topics`/`learning_goal_topics` break the cluster's otherwise-uniform "public read" pattern.** Every other reference/junction table in this cluster (`learning_goals`, `class_levels`, `boards`, `category_learning_goals`, `learning_goal_class_levels`, `playlist_boards`, the four `video_*`/`playlist_*` junctions) has RLS enabled with at least a `"public read" for select using (true)` policy. `topics` and `learning_goal_topics` have RLS enabled with **zero** policies and an explicit `revoke all ... from public, anon, authenticated` — meaning, unlike every sibling table, they are not readable through the public API at all, only via `service_role` or a SECURITY DEFINER function. This is very likely intentional (the file calls them "editorial internals"), but it's a real behavioral inconsistency worth flagging given point 1 above — if they were deployed unreviewed, this access pattern may not have been deliberately verified for production either.

3. **No unauthorized-write escalation found.** For completeness: `category_learning_goals`, `learning_goal_class_levels`, and `playlist_boards` have public-read-only RLS with no write policy of any kind (writes possible only via `service_role`/`postgres`), which is a stricter pattern than `learning_goals`/`class_levels`/`boards` (which additionally allow admin insert/delete). This is consistent across every file that defines them (draft and production copies agree) — not a discrepancy, just noted because it's an asymmetry within the cluster.

No other columns, tables, or RPC parameters in the ground-truth file were left undocumented, and no other case was found where a migration file's claimed schema disagreed with the live OpenAPI shape for this cluster's 12 tables and 4 RPCs.
## Community & Social (accounts, ratings, reviews, reports)

### `profiles`

**Live columns** (from ground truth):
| column | type | nullable | default |
|---|---|---|---|
| `id` | uuid, PK, FK → `auth.users.id` | not null | — |
| `username` | text | nullable | — |
| `full_name` | text | nullable | — |
| `avatar_url` | text | nullable | — |
| `created_at` | timestamptz | not null | `now()` |
| `is_admin` | boolean | not null | `false` |

Origin: `community_schema.sql` creates the base table (`id uuid primary key references auth.users(id) on delete cascade`, `username text unique`, `full_name`, `avatar_url`, `created_at`). `admin_policies.sql` adds `is_admin boolean not null default false` via `alter table ... add column if not exists`.

**RLS** (`community_schema.sql`):
- SELECT: `"profiles are public"` — `using (true)`. Everyone (including anon) can read every profile row.
- INSERT: `"user inserts own profile"` — `with check (auth.uid() = id)`.
- UPDATE: `"user updates own profile"` — `using (auth.uid() = id) with check (auth.uid() = id)`.
- No DELETE policy exists — rows are only removed via the `on delete cascade` from `auth.users`.

**Column-level grants (defense-in-depth on top of RLS)**:
- `src/migrations/fix_profile_privilege_escalation.sql`: `revoke update (is_admin), insert (is_admin) on table public.profiles from anon, authenticated` — a signed-in user's own-row UPDATE policy would otherwise let them flip `is_admin` on themselves; this closes that column specifically, backed by trigger `trg_protect_profile_admin_flag` (below).
- `src/migrations/fix_profile_is_admin_select_disclosure.sql`: `revoke select on table public.profiles from anon, authenticated` then `grant select (id, username, full_name, avatar_url, created_at) on table public.profiles to anon, authenticated` — i.e. `is_admin` is **not** SELECT-able by anon/authenticated at all (table-level SELECT was revoked and re-granted column-by-column, because a column-level revoke alone does nothing when table-level SELECT is already granted — the file's own comments describe this as a fixed prior mistake). `public.is_admin()` (SECURITY DEFINER) remains the sanctioned way for a user to check their own admin status client-side.

**Triggers**:
- `on_auth_user_created` (`community_schema.sql`) — `after insert on auth.users`, calls `public.handle_new_user()` (SECURITY DEFINER) to auto-create the matching `profiles` row, seeding `full_name`/`avatar_url` from `raw_user_meta_data`.
- `trg_protect_profile_admin_flag` (`src/migrations/fix_profile_privilege_escalation.sql`) — `before insert or update on public.profiles`, calls `public.protect_profile_admin_flag()` (SECURITY DEFINER): raises `42501` if a non-`service_role` caller tries to change `is_admin` on UPDATE, or insert a row with `is_admin <> false`.

**Foreign keys**: `id → auth.users.id` (`on delete cascade`).

**Rollback file present**: `src/migrations/fix_profile_privilege_escalation_rollback.sql` would drop the trigger/function and re-grant `update(is_admin), insert(is_admin)` to anon/authenticated — not applied (ground truth still shows `is_admin` present and the hardening is live per the trigger's continued existence in later files that depend on it).

---

### `playlist_ratings`

**Live columns**:
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint, PK (identity) | not null | — |
| `playlist_id` | bigint, FK → `playlists.id` | not null | — |
| `user_id` | uuid, FK → `profiles.id` | not null | — |
| `rating` | integer | not null | — |
| `review` | text | nullable | — |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |
| `clarity_rating` | integer | nullable | — |
| `question_rating` | integer | nullable | — |
| `difficulty` | text | nullable | — |
| `best_for` | text | nullable | — |
| `review_hidden` | boolean | not null | `false` |
| `review_hidden_at` | timestamptz | nullable | — |
| `review_hidden_by` | uuid, FK → `profiles.id` | nullable | — |

Origin: base table + `rating`/`review` from `community_schema.sql` (`unique(playlist_id, user_id)`, `check (rating between 1 and 5)`). `src/migrations/structured_ratings.sql` adds `clarity_rating`, `question_rating`, `difficulty`, `best_for`. `src/migrations/rating_review_moderation.sql` adds `review_hidden`, `review_hidden_at`, `review_hidden_by`.

**Check constraints**:
- `rating between 1 and 5` (inline `check`, `community_schema.sql`)
- `plr_clarity_range`: `clarity_rating is null or clarity_rating between 1 and 5`
- `plr_question_range`: `question_rating is null or question_rating between 1 and 5`
- `plr_difficulty_check`: `difficulty is null or difficulty in ('beginner','moderate','advanced')`
- `plr_best_for_check`: `best_for is null or best_for in ('first-learning','revision','practice')`
(all four from `structured_ratings.sql`, added idempotently via `pg_constraint` existence checks)

**Foreign keys**: `playlist_id → playlists.id` (`on delete cascade`), `user_id → profiles.id` (`on delete cascade`), `review_hidden_by → profiles.id` (`on delete set null`).

**RLS**:
- SELECT: `"ratings are public"` — `using (true)`. **Note**: this policy does not exclude hidden reviews — a client that queries the table directly without filtering can still read `review` text on rows where `review_hidden = true`. The frontend (`src/useVisibleReviews.js`) enforces the `review_hidden = false` filter itself; there is no RLS-level enforcement of hidden-review invisibility.
- INSERT: `"user inserts own rating"` — `with check (auth.uid() = user_id)`.
- UPDATE: `"user updates own rating"` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- DELETE: `"user deletes own rating"` — `using (auth.uid() = user_id)`.

**Column-level grants**: `rating_review_moderation.sql` — `revoke update (review_hidden, review_hidden_at, review_hidden_by) on table public.playlist_ratings from anon, authenticated` (defense-in-depth; real enforcement is the trigger below, since table-level UPDATE is already granted for the student's own-row policy).

**Triggers**:
- `trg_refresh_playlist_rating` (`community_schema.sql`, redefined by `src/migrations/fix_rating_trigger.sql`) — `after insert or update or delete`, calls `public.refresh_playlist_rating()`. Recomputes `playlists.average_rating` (rounded avg of `rating`) and `playlists.ratings_count` for the affected `playlist_id`. Originally ran with caller's own privileges and silently updated 0 rows against admin-only-write `playlists`; `fix_rating_trigger.sql` made it `security definer set search_path = public` so it can actually write `playlists`, and one-time backfilled existing averages.
- `trg_plratings_updated_at` (`community_schema.sql`) — `before update`, calls `public.set_updated_at()`, sets `updated_at = now()`.
- `trg_protect_review_moderation_columns` (`rating_review_moderation.sql`) — `before update`, calls `public.protect_review_moderation_columns()` (SECURITY DEFINER): raises `42501` if any of `review_hidden`/`review_hidden_at`/`review_hidden_by` change and `public.is_admin()` is false.

---

### `video_comments`

**Live columns**:
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint, PK (identity) | not null | — |
| `video_id` | bigint, FK → `videos.id` | not null | — |
| `user_id` | uuid, FK → `profiles.id` | not null | — |
| `parent_id` | bigint, FK → `video_comments.id` (self) | nullable | — |
| `body` | text | not null | — |
| `timestamp_seconds` | integer | nullable | — |
| `created_at` | timestamptz | not null | `now()` |
| `updated_at` | timestamptz | not null | `now()` |

Origin: entirely from `community_schema.sql`. No other migration file touches this table anywhere in the repo.

**Check constraints**: `char_length(body) > 0` (inline `check`, `community_schema.sql`).

**Foreign keys**: `video_id → videos.id` (`on delete cascade`), `user_id → profiles.id` (`on delete cascade`), `parent_id → video_comments.id` (`on delete cascade`, self-referential for threaded replies).

**RLS**:
- SELECT: `"comments are public"` — `using (true)`.
- INSERT: `"user inserts own comment"` — `with check (auth.uid() = user_id)`.
- UPDATE: `"user updates own comment"` — `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.
- DELETE: `"user deletes own comment"` — `using (auth.uid() = user_id)`.

**Triggers**: `trg_vcomments_updated_at` (`community_schema.sql`) — `before update`, calls `public.set_updated_at()`.

---

### `content_reports`

**Live columns**:
| column | type | nullable | default |
|---|---|---|---|
| `id` | bigint, PK (identity) | not null | — |
| `target_type` | text | not null | — |
| `target_id` | bigint | not null | — |
| `reason` | text | not null | — |
| `note` | text | nullable | — |
| `reporter_id` | uuid, FK → `profiles.id` | nullable | — |
| `status` | text | not null | `'pending'` |
| `created_at` | timestamptz | not null | `now()` |

Origin: `src/migrations/content_reports.sql` (base table). Hardened by `src/migrations/content_reports_hardening_v10.sql`, applied to production verbatim via the wrapper `content_reports_v10_production.sql` (diffed identical body, wrapped in `begin/commit` with pre/post environment-safety checks). There is also `content_reports_v10_production_preflight.sql` (read-only evidence query, changes nothing) and `content_reports_v10_production_rollback.sql` (reverts to anonymous-insert policy, preserving rows).

**Check constraints** (from `content_reports.sql`):
- `target_type in ('video','playlist')`
- `reason in ('broken','wrong-category','inappropriate','other')`
- `status in ('pending','reviewed','dismissed')`

Note: `target_id` has **no foreign key** — it's a polymorphic reference resolved in application code / trigger logic depending on `target_type`, not a DB-enforced relationship. `enforce_content_report_submission()` (below) does check at insert time that the referenced `video`/`playlist` id exists, but this is not a standing constraint — a target row deleted later would leave a dangling `content_reports` row.

**Foreign keys**: `reporter_id → profiles.id` (`on delete set null`).

**Indexes**: `idx_content_reports_status` on `(status)`.

**RLS** (current, post-hardening):
- INSERT: `"signed-in users report own"` (`content_reports_hardening_v10.sql`, replacing the original `"anyone reports"` policy) — `to authenticated`, `with check (auth.uid() is not null and reporter_id = auth.uid())`. Anonymous reporting is no longer possible: `revoke insert on table public.content_reports from public, anon` plus `grant insert ... to authenticated, service_role`, and the sequence's `USAGE`/`SELECT` were revoked from anon similarly.
- SELECT: `"admin reads reports"` (from `content_reports.sql`, untouched by the hardening migration) — `using (public.is_admin())`.
- UPDATE: `"admin updates reports"` (also untouched) — `using (public.is_admin()) with check (public.is_admin())`.
- No DELETE policy exists for any role.

**Triggers**: `trg_enforce_content_report_submission` (`content_reports_hardening_v10.sql`) — `before insert`, calls `public.enforce_content_report_submission()` (SECURITY DEFINER, `set search_path = ''`). One sentence per behavior:
- Lets `service_role` through untouched (admin/test tooling).
- Rejects the insert (`42501`) unless `reporter_id` exactly matches the caller's `auth.uid()`.
- Rejects (`22023`) a `note` longer than 1000 characters.
- Rejects (`22023`) if the `video`/`playlist` named by `target_type`/`target_id` doesn't exist.
- Takes a per-user `pg_advisory_xact_lock` to serialize concurrent submissions, then rejects (`23505`) a duplicate pending report (same reporter/target/reason already `pending`), and rejects (`P0001`) a 10th+ report from the same user within the last hour.
- Forces `status = 'pending'` and `created_at = now()` server-side regardless of client input.

---

### `is_admin()`

- **Signature**: `is_admin() returns boolean`, `language sql`, `stable`, `security definer`, `set search_path = public`.
- **Body** (`admin_policies.sql`): `select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)` — resolves whether the *current caller* is an admin, defaulting to `false` for anonymous/unmatched callers. Runs as owner (SECURITY DEFINER) specifically so it can read `profiles.is_admin` even though that column's direct SELECT is revoked from anon/authenticated (see `profiles` above).
- **Execute grants**: `grant execute on function public.is_admin() to authenticated` is the only explicit grant found. No explicit `revoke ... from anon/public` for this function exists anywhere in the repo, so under Supabase's default `alter default privileges ... grant all on functions to ... anon, authenticated` (documented in `src/migrations/v6_2_grant_tightening.sql`'s comments), `anon` likely retains default EXECUTE too — harmless here since it just resolves to `false` for an unauthenticated caller.
- Used as the authorization gate inside `admin_list_reviews()`, `admin_set_review_hidden()`, the `content_reports` admin SELECT/UPDATE policies, `protect_review_moderation_columns()`, and various admin-only INSERT policies in `admin_policies.sql` (`institutes_channels`, `chapters`, `videos`, `playlists`, `playlist_videos`).

### `admin_list_reviews()`

- **Signature**: `admin_list_reviews() returns table(id bigint, playlist_id bigint, playlist_title text, user_id uuid, rating int, review text, review_hidden boolean, review_hidden_at timestamptz, created_at timestamptz)`, `language sql`, `stable`, `security definer`, `set search_path = ''`.
- **Body** (`src/migrations/rating_review_moderation.sql`): joins `playlist_ratings` to `playlists` (for the title), gated by `public.is_admin()` inside the query itself (`where public.is_admin() and r.review is not null and length(trim(r.review)) > 0`), ordered newest-first. Returns every rating that has non-blank review text — hidden and visible alike — so an admin can review or un-hide.
- **Execute grants**: `revoke all on function public.admin_list_reviews() from public, anon; grant execute ... to authenticated`. A non-admin `authenticated` caller can execute it but the internal `is_admin()` check in the `where` clause means it simply returns zero rows for them, not an error.

### `admin_set_review_hidden(p_rating_id bigint, p_hidden boolean)`

- **Signature** (matches ground truth exactly): params `p_rating_id bigint`, `p_hidden boolean`; `returns void`, `language plpgsql`, `security definer`, `set search_path = ''`.
- **Body** (`rating_review_moderation.sql`): raises `42501` if `not public.is_admin()`; otherwise updates the target `playlist_ratings` row, setting `review_hidden = p_hidden`, and `review_hidden_at`/`review_hidden_by` to `now()`/`auth.uid()` when hiding, or `null`/`null` when un-hiding. Raises `P0002` if `p_rating_id` doesn't match any row.
- **Execute grants**: `revoke all on function public.admin_set_review_hidden(bigint, boolean) from public, anon; grant execute ... to authenticated`. Same pattern as above — callable by any signed-in user, but the internal `is_admin()` check is the real gate (raises rather than silently no-oping, since this is a targeted write not a filtered read).
- This is the function backing the "Review moderation: admin can hide an inappropriate review" feature (commit `216aae9`), consumed from `src/useReviewModeration.js`, and the visibility filter it enables is read by `src/useVisibleReviews.js` for the "Public review display" feature (commit `5bbef6f`).

---

### Discrepancies

None found for this cluster. For all four tables and three RPCs, every column/parameter/type in the ground-truth OpenAPI file is fully accounted for by a specific migration file, and no migration file claims a column/function that isn't present live (e.g. the `fix_profile_privilege_escalation_rollback.sql` and `content_reports_v10_production_rollback.sql` rollback scripts exist but the ground truth confirms neither has been run — `is_admin` write-protection and the `content_reports` hardened INSERT policy are both live). One behavioral note worth flagging even though it isn't a file-vs-ground-truth mismatch: `playlist_ratings`' `"ratings are public"` SELECT policy has no awareness of `review_hidden` — hiding a review only removes it from the app's own query pattern (`useVisibleReviews.js` filters client-side), not from what the anon key can technically read via a direct, unfiltered table query.
## Teacher / Faculty Core Data

### Source files found

The full picture for this cluster is spread across:
- `src/migrations/teachers_v7.sql` — the canonical source of every table and every RPC in this cluster (tables, triggers, RLS, search engine, write-path functions, grants).
- `src/migrations/teachers_v7_import.sql` — faculty-aware import wrappers (`import_playlist_with_teachers`, `create_course_with_teachers`, `validate_teacher_ids_payload`, `faculty_import_capability`) — not in this cluster's RPC list, but they call `set_playlist_teachers`, which is.
- `src/migrations/teachers_v7_admin_ui.sql` — admin review-console wrappers around the proposal ledger (`get_faculty_review_groups`, `approve_faculty_review_group_as_new`, etc.) — not in this cluster's RPC list.
- `src/migrations/content_quality_v10.sql` — replaces `import_playlist_with_teachers` with a version that also captures `source_title`; not in this cluster.
- `production/faculty_quality_production.sql` — an **auto-generated production package** that concatenates (in order) `faculty_quality_production_preflight.sql` → `teachers_v7.sql` → `teachers_v7_import.sql` → `teachers_v7_admin_ui.sql` → `universal_search.sql` → `content_quality_v10.sql` → `faculty_quality_production_postflight.sql`. This is the file whose preflight/postflight `do $$ ... $$` blocks assert `public.teachers`, `public.teacher_aliases`, `public.playlist_teachers`, and `search_teachers(text,int)` exist — i.e. this is the applied-to-production migration package for this cluster.
- `faculty_staging_delta.sql` and `faculty_quality_production_wrapper_dry_run.sql` — byte-for-byte staging rehearsal copies of the same source (auto-generated / dry-run only, not production).
- `faculty_staging_repair_1.sql` (and the duplicate `src/migrations/faculty_staging_repair_1.sql`) — a **staging-only** repair that re-points `search_teachers_internal`'s `search_path` at the schema-qualified `pg_trgm` install; its own header says "Apply ONLY to the disposable staging project."
- `src/migrations/faculty_registry_neet_batch1_prepared.sql`, `..._batch23_prepared.sql`, `..._batch4_course91_prepared.sql`, `..._drona_prepared.sql`, `..._jee_batch1_clone_rehearsal.sql` — **data-only** faculty seeding scripts (direct `insert into public.teachers`, no schema changes); each is marked "PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE REHEARSAL AND OWNER APPROVAL."

No file anywhere in the repo alters these tables' columns after `teachers_v7.sql` creates them (checked with a repo-wide `alter table ... teachers|teacher_aliases|...` search — every hit is only the `enable row level security` statement, repeated verbatim across the staging/production copies of the same source). So the live columns match `teachers_v7.sql`'s original `create table` statements exactly.

---

### teachers

Columns (from ground truth, all match `teachers_v7.sql`'s `create table`):

| column | type | nullable | default |
|---|---|---|---|
| id | bigint (identity) | not null, PK | — |
| display_name | text | not null | — |
| canonical_name | text | not null | — (set by trigger, comparison key only) |
| slug | text | not null, unique | — (auto-generated by trigger if omitted) |
| bio | text | nullable | — |
| photo_url | text | nullable | — |
| verified | boolean | not null | `false` |
| created_at | timestamptz | not null | `now()` |

Indexes: `idx_teachers_canonical` (btree on `canonical_name`), `idx_teachers_canonical_pattern` (`text_pattern_ops`, for prefix search), `idx_teachers_canonical_trgm` (GIN `gin_trgm_ops`, for fuzzy search).

**Deliberately no unique constraint on `canonical_name`** — two different real people can share a name; only `slug` is unique (disambiguated with a numeric suffix on collision).

Triggers:
- `trg_teacher_canonical` (before insert or update, per row) → `set_teacher_canonical()`: recomputes `canonical_name` from `display_name` via `normalize_person_name()`, raising an exception if it normalizes to nothing; if `slug` is null/empty it derives one from `canonical_name` (dashes for spaces) and de-duplicates with a `-2`, `-3`, ... suffix, using `pg_advisory_xact_lock` keyed on the canonical name to serialize concurrent inserts of the same name.

RLS: enabled. One SELECT policy, `"public read"` (`for select using (true)`) — public/anon can read every row. **No INSERT/UPDATE/DELETE policy exists**, so direct writes by `anon`/`authenticated` are blocked by RLS regardless of table grants; all writes go through the SECURITY DEFINER RPCs (`create_teacher`, the proposal-approval functions) or `service_role`.

Foreign keys referencing `teachers.id`: `teacher_aliases.teacher_id` (cascade), `teacher_institutes.teacher_id` (cascade), `teacher_subjects.teacher_id` (cascade), `teacher_learning_goals.teacher_id` (cascade), `playlist_teachers.teacher_id` (restrict), `video_teachers.teacher_id` (restrict), `teacher_name_proposals.resolved_teacher_ids` (bigint array, not a real FK).

No CHECK constraints on this table.

---

### teacher_aliases

| column | type | nullable | default |
|---|---|---|---|
| id | bigint (identity) | not null, PK | — |
| teacher_id | bigint | not null, FK → `teachers.id` ON DELETE CASCADE | — |
| alias | text | not null | — |
| normalized_alias | text | not null (set by trigger) | — |
| alias_type | text | not null | `'nickname'` |
| status | text | not null | `'proposed'` |
| source | text | not null | `'manual'` |
| created_by | uuid | nullable, FK → `auth.users.id` ON DELETE SET NULL | — |
| verified_by | uuid | nullable, FK → `auth.users.id` ON DELETE SET NULL | — |
| verified_at | timestamptz | nullable | — |
| created_at | timestamptz | not null | `now()` |

CHECK constraints:
- `alias_type in ('full-name','short','initials','nickname','maiden','transliteration','misspelling')`
- `status in ('proposed','verified','rejected')`
- `source in ('manual','migrated','import','student-report')`

Unique constraint: `unique (teacher_id, normalized_alias)` — an alias is unique **within** a teacher, deliberately not across teachers (two teachers can share an alias; that's how ambiguity is represented instead of silently merged).

Indexes: `idx_alias_teacher` (`teacher_id`), `idx_alias_norm` (`normalized_alias`), `idx_alias_norm_pattern` (`text_pattern_ops`), `idx_alias_norm_trgm` (GIN trigram).

Trigger: `trg_alias_normalized` (before insert or update, per row) → `set_alias_normalized()`: recomputes `normalized_alias` from `alias` via `normalize_person_name()`, raising an exception if it normalizes to nothing.

RLS: enabled, **not blanket-public** (explicitly called out in the source comments as a deliberate departure from the other junction tables — an unreviewed alias is treated as an unreviewed identity claim about a real person). Two OR'd SELECT policies:
- `"public read verified"` (to `anon, authenticated`, `using (status = 'verified')`)
- `"admin read aliases"` (to `authenticated`, `using (public.is_admin())`)

No INSERT/UPDATE/DELETE policy — writes only via `create_teacher`, `add_teacher_alias`, and the proposal-approval RPCs (all SECURITY DEFINER).

---

### teacher_institutes

| column | type | nullable |
|---|---|---|
| teacher_id | bigint | not null, PK (composite), FK → `teachers.id` ON DELETE CASCADE |
| institute_id | bigint | not null, PK (composite), FK → `institutes_channels.id` ON DELETE CASCADE |
| is_primary | boolean | not null, default `false` |

Index: `idx_ti_inst` on `institute_id`.

RLS: enabled. One SELECT policy `"public read"` (`using (true)`). No write policy — writes only via `set_teacher_context()`.

No CHECK constraints, no triggers.

---

### teacher_subjects

| column | type | nullable |
|---|---|---|
| teacher_id | bigint | not null, PK (composite), FK → `teachers.id` ON DELETE CASCADE |
| subject_id | bigint | not null, PK (composite), FK → `subjects.id` ON DELETE CASCADE |

Index: `idx_ts_sub` on `subject_id`.

RLS: enabled. One SELECT policy `"public read"` (`using (true)`). No write policy — writes only via `set_teacher_context()`.

No CHECK constraints, no triggers.

---

### teacher_learning_goals

| column | type | nullable |
|---|---|---|
| teacher_id | bigint | not null, PK (composite), FK → `teachers.id` ON DELETE CASCADE |
| learning_goal_id | bigint | not null, PK (composite), FK → `learning_goals.id` ON DELETE CASCADE |

Index: `idx_tlg_goal` on `learning_goal_id`.

RLS: enabled. One SELECT policy `"public read"` (`using (true)`). No write policy — writes only via `set_teacher_context()`.

No CHECK constraints, no triggers.

---

### playlist_teachers

| column | type | nullable | default |
|---|---|---|---|
| playlist_id | bigint | not null, PK (composite), FK → `playlists.id` ON DELETE CASCADE | — |
| teacher_id | bigint | not null, PK (composite), FK → `teachers.id` ON DELETE **RESTRICT** | — |
| role | text | not null | `'instructor'` |
| position | integer | not null | `1` |

Note the asymmetry with the other junction tables: deleting a teacher who is linked to a playlist is **blocked** (`on delete restrict`), not cascaded — a teacher with course credits can't be silently removed.

CHECK constraint: `role in ('instructor','co-instructor','guest')`.

Index: `idx_pt_teacher` on `teacher_id`.

RLS: enabled. One SELECT policy `"public read"` (`using (true)`). No write policy — writes only via `set_playlist_teachers()` and the proposal-approval functions (`approve_proposal_as_existing`, `approve_proposal_as_new`, `split_proposal`, none of which are in this cluster's RPC list but which write to this table).

---

### video_teachers

| column | type | nullable |
|---|---|---|
| video_id | bigint | not null, PK (composite), FK → `videos.id` ON DELETE CASCADE |
| teacher_id | bigint | not null, PK (composite), FK → `teachers.id` ON DELETE **RESTRICT** |

Same restrict-on-teacher-delete pattern as `playlist_teachers`.

Index: `idx_vt_teacher` on `teacher_id`.

RLS: enabled. One SELECT policy `"public read"` (`using (true)`). No write policy — writes only via `set_video_teachers()`.

No CHECK constraints, no triggers.

---

## RPC Functions

### normalize_person_name(p_name text) → text
`language sql immutable`. Not SECURITY DEFINER. **No explicit grant/revoke found anywhere in the repo** for this function, so it retains PostgreSQL's default EXECUTE-to-PUBLIC grant from creation — callable by `anon`, `authenticated`, and `service_role` alike.
Lower-cases, strips apostrophes/quote variants, collapses punctuation and whitespace to single spaces, strips a fixed list of honorifics (`sir`, `maam`, `mam`, `madam`, `mister`, `mr`, `mrs`, `ms`, `miss`, `dr`, `doctor`, `prof`, `professor`, `ji`, `bhaiya`, `bhaiyya`, `guruji`), then trims and returns `null` if the result is empty. Deliberately Unicode-safe: it does not use `[:alnum:]`-style stripping, because PostgreSQL's `[:alnum:]` recognizes Devanagari base letters but not their combining vowel marks, which would otherwise mangle Indic-script names. This is documented as **a comparison key, never proof of identity** — same-normalized ≠ same person.

### looks_like_multiple_people(p_name text) → boolean
`language sql immutable`. Same ungated/default-grant situation as above. Regex-tests for `&`, `+`, `/`, `,`, or the words `and`/`aur`/`evam`/`with` (Hindi/English "and" variants) — used to route ambiguous free-text names to manual review rather than silently creating one merged teacher.

### looks_like_organization(p_name text) → boolean
`language sql immutable`. Same ungated/default-grant situation. Regex-tests for words like `team`, `department`, `dept`, `faculty`, `faculties`, `teachers`, `staff`, `various`, `multiple`, `panel`, `group`, `institute`, `academy`, `classes` — used to keep non-person strings ("Physics Department") from ever becoming a `teachers` row.

### search_teachers_internal(p_query text, p_limit int, p_include_unverified boolean) → table(teacher_id, display_name, slug, verified, match_type, match_rank, matched_on, alias_status, institutes, subjects, goals, course_count, is_ambiguous)
`language sql stable`. **Not** SECURITY DEFINER. This is the private ranking engine shared by every search/resolve/dedup RPC in this cluster. Ranks candidates 1 (exact canonical-name or verified-alias match) → 2 (exact match on an unverified/proposed alias, only surfaced when `p_include_unverified`) → 3 (prefix, ≥2 chars) → 4 (contains, ≥3 chars) → 5 (trigram-similarity ≥0.4, ≥4 chars, via a `catalog_similarity()` wrapper around `pg_trgm`'s `similarity()`). Deduplicates to one best-rank row per teacher and flags `is_ambiguous = true` whenever more than one teacher ties at the best rank — callers are documented as required not to auto-select in that case.
**Grants: revoked from `public`, `anon`, `authenticated`, and `service_role`** (final `revoke all ... from public, anon, authenticated, service_role` in `teachers_v7.sql` section 17) — i.e. **no role at all can call it directly**; it is reachable only from inside the SECURITY DEFINER wrappers below, which execute as the function owner.

### search_teachers(p_query text, p_limit int default 10) → same table shape as above
`language sql stable`, **SECURITY DEFINER**, `set search_path = ''`. Public search entry point: calls `search_teachers_internal(p_query, p_limit, false)` with `p_include_unverified` hardcoded to `false` (not exposed as a parameter, so no caller can widen it). Granted to `anon, authenticated, service_role`; the SECURITY DEFINER + hardcoded-false design exists specifically because logged-out students must be able to search without ever seeing an unreviewed alias claim.

### search_teacher_candidates(p_query text, p_limit int default 10) → same table shape
`language plpgsql stable`, **SECURITY DEFINER**, `set search_path = ''`. Admin-only variant that includes proposed aliases (`p_include_unverified = true`); body-checks `public.is_admin() OR auth.role() = 'service_role' OR session_user IN ('postgres','supabase_admin')` and raises `42501` otherwise. Revoked from `public, anon`; granted to `authenticated, service_role` (the grant only lets a caller reach the in-body check, per the source comment).

### similar_teachers(p_name text, p_limit int default 5) → same table shape
`language plpgsql stable`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser body guard as above. Used to preview near-duplicate teachers before `create_teacher()` runs. Revoked from `public, anon`; granted to `authenticated, service_role`.

### resolve_teacher_exact(p_name text) → jsonb
`language plpgsql stable`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser body guard. Takes the top matches (`match_rank <= 2`) from `search_teachers_internal` and returns exactly one of three outcomes: `{resolved:false, reason:'no-match'}`, `{resolved:true, teacher_id}` (exactly one verified exact hit), `{resolved:false, reason:'ambiguous', candidates:[...]}` (multiple verified exact hits), or `{resolved:false, reason:'unverified-match', candidates:[...]}` (only unreviewed-alias hits). Deliberately has no tie-breaking logic — a human must decide. Revoked from `public, anon`; granted to `authenticated, service_role`.

### create_teacher(p_display_name text, p_aliases jsonb default '[]', p_verified boolean default false, p_duplicate_acknowledged boolean default false) → jsonb
`language plpgsql`, **SECURITY DEFINER**, `set search_path = ''` (volatile — it writes). Body-checks the same admin/service-role/superuser guard. Rejects if `normalize_person_name(p_display_name)` is null, or if `looks_like_multiple_people()`/`looks_like_organization()` trip. Runs duplicate detection via `search_teachers_internal` (rank-1 matches only) **before** inserting — a strong match does not block creation, but does require `p_duplicate_acknowledged = true` or the call raises with the candidate list in the error (`check_violation`). On success inserts one `teachers` row plus one `teacher_aliases` row for the display name itself (status `verified` if `p_verified` else `proposed`), then inserts any `p_aliases` entries (accepts either raw strings or `{alias,type}` objects) as `proposed` aliases, `on conflict (teacher_id, normalized_alias) do nothing`. Returns `{teacher_id, created, duplicate_acknowledged, matched_before_create}`. Grants: revoked from `public, anon, authenticated`; **granted to `service_role` only** — an ordinary admin cannot call this directly over PostgREST, only through server-side/service-role code paths (or indirectly, since it's invoked internally by `approve_proposal_as_new`, which authenticated admins can reach).

### add_teacher_alias(p_teacher_id bigint, p_alias text, p_type text default 'nickname', p_verified boolean default false) → jsonb
`language plpgsql`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser guard, plus validates `p_teacher_id` exists and `normalize_person_name(p_alias)` is non-null. Upserts into `teacher_aliases` on the `(teacher_id, normalized_alias)` unique constraint; on conflict it only ever moves `status` **forward** toward `'verified'` (explicitly not via `greatest()`, since alphabetic ordering of status strings would silently invert if a new status like `'withdrawn'` were ever added). Returns `{teacher_id, alias, also_used_by}` where `also_used_by` lists other teachers who already have the same normalized alias (informational, not an error — aliases are allowed to collide across people). Grants: revoked from `public, anon, authenticated`; **granted to `service_role` only**.

### get_faculty_facets(p_chapter_id bigint default null, p_subject_id bigint default null, p_goal_id bigint default null) → table(teacher_id, display_name, slug, verified, institutes, course_count)
`language sql stable`. Not SECURITY DEFINER, not gated — plain public function. Returns teachers who have at least one playlist matching the optional chapter/subject/learning-goal filters, with a comma-joined `institutes` string and a distinct playlist `course_count`, ordered by course count desc, verified desc, name. Granted explicitly to `anon, authenticated, service_role` (and never revoked from the implicit default `public` grant either).

### get_faculty_profile(p_slug text) → jsonb
`language sql stable`. Not SECURITY DEFINER, not gated. Looks up one teacher by `slug` and returns a single JSON object: `id, display_name, slug, verified, bio, photo_url`, `aliases` (all non-`rejected` aliases with type/status), `institutes` (names), `course_count`, and `courses` (playlist id/title/subject name/role/average_rating/ratings_count for every playlist that teacher is linked to). Returns SQL `null` if the slug doesn't match any teacher. Granted to `anon, authenticated, service_role`.

### set_teacher_context(p_teacher_id bigint, p_institute_ids bigint[] default null, p_subject_ids bigint[] default null, p_goal_ids bigint[] default null) → jsonb
`language plpgsql`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser guard. Per-array semantics are explicit and load-bearing: `null` (omitted key) = leave that junction table alone; `{}` (empty array) = clear all rows for that teacher; a non-empty array = validate every id exists, reject duplicates, then delete-and-reinsert (replace-exactly). Writes to `teacher_institutes`, `teacher_subjects`, and/or `teacher_learning_goals` depending on which arrays were passed. Returns `{teacher_id, institutes, subjects, goals}` counts. Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

### set_playlist_teachers(p_playlist_id bigint, p_teacher_ids bigint[]) → jsonb
`language plpgsql`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser guard. `p_teacher_ids` is required (an explicit `null` raises — the source comment notes "omit the key upstream to preserve" is the caller-side contract, but this RPC itself always replaces). Validates the playlist exists, rejects duplicate teacher ids, validates every teacher id exists (`'create the faculty record first'` if not), then deletes all existing `playlist_teachers` rows for that playlist and re-inserts the given ids in order, with the first getting `role='instructor'` and the rest `role='co-instructor'`. Grants: revoked from `public, anon`; granted to `authenticated, service_role`. (Also called internally by `import_playlist_with_teachers`/`create_course_with_teachers` in `teachers_v7_import.sql`, and by the proposal-approval functions — none of which are in this cluster.)

### set_video_teachers(p_video_id bigint, p_teacher_ids bigint[]) → jsonb
`language plpgsql`, **SECURITY DEFINER**, `set search_path = ''`. Same admin/service-role/superuser guard and same replace-exactly semantics as `set_playlist_teachers`, but for `video_teachers` (no `role`/`position` columns to set — every row is just `(video_id, teacher_id)`). Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### Discrepancies

1. **Stale "not applied" / "staging only" headers vs. confirmed live production status.** `src/migrations/teachers_v7.sql` opens with: *"Delta on top of v6.2. NOT applied anywhere. NOT part of the verified production migration. Staging only, and only after review."* `teachers_v7_import.sql` says it is *"intentionally absent from both production and staging builders until the corrected faculty model has passed a fresh disposable-staging run."* `teachers_v7_admin_ui.sql` says it is *"Isolated from all builders until disposable-staging verification."* All three claims are contradicted by two independent pieces of evidence: (a) the ground-truth OpenAPI spec shows every one of this cluster's tables and RPCs live in production today, and (b) `production/faculty_quality_production.sql` — an auto-generated package whose own preflight/postflight blocks assert the existence of `public.teachers`, `public.teacher_aliases`, `public.playlist_teachers`, and `search_teachers(text,int)` — concatenates exactly these three files verbatim between a preflight and postflight check. These header comments are simply out of date; the files were promoted to production at some point after being written, and nobody updated the in-file "not applied" language.

2. **`search_teachers_internal`'s `search_path` pinning: unconfirmed for production.** `faculty_staging_repair_1.sql` (present at both repo root and `src/migrations/`) alters `search_teachers_internal` with `SET search_path = public, <pg_trgm schema>, pg_temp` to fix an unqualified-`similarity()` resolution problem, but its own header restricts it to *"the disposable staging project that already received the original faculty_staging_delta.sql."* No file anywhere in the repo (including `production/faculty_quality_production.sql` and `production/production_migration.sql`) shows this fix being applied to production. Since the ground-truth OpenAPI spec cannot show function-level `search_path` settings, it's not possible to confirm from available evidence whether production's live `search_teachers_internal` has this pinning or still relies on the caller's default `search_path` to resolve `pg_trgm`'s `similarity()` via the `catalog_similarity()` wrapper (the wrapper itself is schema-qualified at install time and unaffected either way).

3. **No genuine column-level discrepancies found.** Every column, type, nullability, default, FK, and CHECK constraint in the ground-truth file for `teachers`, `teacher_aliases`, `teacher_institutes`, `teacher_subjects`, `teacher_learning_goals`, `playlist_teachers`, and `video_teachers` is fully explained by `teachers_v7.sql`'s original `create table` statements, and no other `.sql` file in the repo issues an `ALTER TABLE` against any of these tables beyond the identical `ENABLE ROW LEVEL SECURITY` statement repeated across the staging/production copies. Similarly, every RPC parameter and return-type shape in the ground truth matches `teachers_v7.sql` exactly, with no signature drift found in any later file.

4. **Not found anywhere / unexplained live objects: none.** All 7 tables and all 15 RPCs assigned to this cluster trace cleanly back to `src/migrations/teachers_v7.sql` as their origin.
## Faculty Review & Proposal Workflow

### Tables

#### `teacher_name_proposals`
Source: `src/migrations/teachers_v7.sql` (section 3, "THE PROPOSAL LEDGER"), reproduced verbatim inside `faculty_staging_delta.sql` and inside the applied production bundle `production/faculty_quality_production.sql`.

**Columns** (live, from ground truth):

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | bigint (identity) | not null | Primary key. |
| `raw_teacher` | text | not null | The exact free-text string seen in `playlists.teacher`; `unique` constraint. |
| `normalized` | text | nullable | Output of `normalize_person_name(raw_teacher)`; null when the raw string normalises to nothing. |
| `occurrences` | integer | not null, default `0` | How many playlists carry this raw string. |
| `kind` | text | not null | CHECK `kind in ('single','multi-person','organization-or-team','blank')`. |
| `status` | text | not null, default `'pending'` | CHECK `status in ('pending','approved-existing','approved-new','split','rejected','deferred')`. |
| `resolved_teacher_ids` | bigint[] | nullable | Filled in on approval/split. |
| `note` | text | nullable | |
| `reviewed_by` | uuid | nullable | FK → `auth.users(id)`, `on delete set null`. |
| `reviewed_at` | timestamptz | nullable | |
| `created_at` | timestamptz | not null, default `now()` | |

**Indexes**: `idx_proposal_status` on `(status)`.

**Foreign keys**: `reviewed_by → auth.users(id) ON DELETE SET NULL`.

**Check constraints**: `kind` and `status` enum checks above; `raw_teacher` has a plain `unique` constraint (not a CHECK).

**RLS**: enabled. Single policy `"admin read proposals"` — `FOR SELECT USING (public.is_admin())`, no role list (applies to whichever role reaches it). In addition, `revoke all on table public.teacher_name_proposals from anon` strips `anon`'s table-level grant entirely, so `anon` cannot read the table at all regardless of RLS. No INSERT/UPDATE/DELETE policy exists — all writes happen exclusively through the `SECURITY DEFINER` RPCs below (`scan_free_text_teachers`, `approve_proposal_as_existing/new`, `split_proposal`, `reject_proposal`, `defer_proposal`), which run as the function owner and are therefore not blocked by the missing write policies.

**Triggers**: none on this table directly. (The `trg_teacher_canonical` and `trg_alias_normalized` triggers defined in the same file apply to `teachers` and `teacher_aliases`, not to this table.)

---

#### `teacher_proposal_decisions`
Source: `src/migrations/teachers_v7.sql` (section 13, "IMMUTABLE DECISION LOG"), same file also carried in `faculty_staging_delta.sql` and `production/faculty_quality_production.sql`.

**Columns** (live, from ground truth):

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | bigint (identity) | not null | Primary key. |
| `proposal_id` | bigint | not null | FK → `teacher_name_proposals(id)`, `on delete restrict`. |
| `raw_teacher` | text | not null | Snapshot of the raw string at decision time. |
| `decision` | text | not null | CHECK `decision in ('approved-existing','approved-new','split','rejected','deferred')`. |
| `teacher_ids` | bigint[] | nullable | |
| `note` | text | nullable | |
| `decided_by` | uuid | nullable | FK → `auth.users(id)`, `on delete set null`. |
| `decided_at` | timestamptz | not null, default `now()` | |

**Indexes**: `idx_decisions_proposal` on `(proposal_id)`.

**Foreign keys**: `proposal_id → teacher_name_proposals(id) ON DELETE RESTRICT`; `decided_by → auth.users(id) ON DELETE SET NULL`.

**Check constraints**: `decision` enum check above.

**RLS**: enabled. Policy `"admin read decisions"` — `FOR SELECT USING (public.is_admin())`. The migration comment explicitly frames this table as **append-only by privilege, not just by RLS**: `revoke all on table ... from anon, authenticated, service_role` followed by an explicit `revoke insert, update, delete ... from anon, authenticated, service_role`, then `grant select on table ... to authenticated` only (gated by the admin RLS policy). Net effect: `anon` has no access at all; `authenticated` can only `SELECT`, and only rows visible via `is_admin()`; `service_role` has no direct table grant either (despite normally bypassing RLS, it was explicitly stripped of table privileges here). The only writable path is `log_proposal_decision()`, a `SECURITY DEFINER` function that inserts as the function owner.

**Triggers**: none.

---

### RPCs

#### `scan_free_text_teachers()`
No parameters. `SECURITY DEFINER`. Body-guarded to `is_admin() OR auth.role() = 'service_role' OR session_user IN ('postgres','supabase_admin')`. Reads distinct values of `playlists.teacher`, computes `normalize_person_name()` and a `kind` classification (`blank` / `organization-or-team` / `multi-person` / `single`), and upserts one row per distinct raw string into `teacher_name_proposals` (`on conflict (raw_teacher) do update set occurrences = excluded.occurrences`). Writes **only** to `teacher_name_proposals` — creates no teacher, alias, or playlist link. Returns a `jsonb` summary (`proposals_total`, `pending`, `multi_person`, etc.).
**Execute grants**: initially revoked from `public, anon, authenticated` and granted to `service_role` only (teachers_v7.sql §12); later re-granted to `authenticated, service_role` by `teachers_v7_admin_ui.sql`. Final state: `authenticated`, `service_role`.

#### `get_proposal_groups(p_status text default 'pending')`
`SECURITY DEFINER`, `stable`, no body-level auth check of its own (relies on caller grants). Groups pending/other-status `teacher_name_proposals` rows by `normalized` value (e.g. "ABJ Sir" / "abj sir" / "ABJ  SIR" become one group), returning `normalized, kind, variants (jsonb), variant_count, total_occurrences, candidates (jsonb)` — candidates come from `search_teachers_internal()` against the group's representative raw string.
**Execute grants**: `service_role` only (revoked from `public, anon, authenticated`).

#### `get_faculty_review_groups(p_status text default 'pending')`
Defined in `teachers_v7_admin_ui.sql`. `SECURITY DEFINER`, `stable`. Body-guarded (`is_admin()`/`service_role`/superuser). Pure pass-through wrapper: `return query select * from public.get_proposal_groups(p_status);` — exists solely so an authenticated admin (not just `service_role`) can reach the otherwise `service_role`-only `get_proposal_groups`.
**Execute grants**: `authenticated, service_role`.

#### `approve_proposal_as_existing(p_proposal_id bigint, p_teacher_id bigint, p_add_alias boolean default true)`
`SECURITY DEFINER`. Body-guarded. Locks the proposal row `FOR UPDATE` (documented reason: prevent two admins double-approving/double-linking concurrently), rejects if status isn't `pending`/`deferred`, rejects `kind = 'multi-person'` or `'organization-or-team'` (must use `split_proposal` or be rejected instead). Optionally inserts/updates a `verified` alias for the target teacher, links every playlist whose `playlists.teacher = raw_teacher` to that teacher via `playlist_teachers` (idempotent via `on conflict do nothing`), sets proposal `status = 'approved-existing'` with `resolved_teacher_ids`, and calls `log_proposal_decision()` in the same transaction. Returns `jsonb` with `playlists_linked` count.
**Execute grants**: `service_role` only.

#### `approve_proposal_as_new(p_proposal_id bigint, p_display_name text default null, p_verified boolean default false)`
`SECURITY DEFINER`. Same locking/status/kind guards as above. Calls `create_teacher()` (with `p_duplicate_acknowledged := true`, since the raw string is already a reviewed proposal) to create the new teacher, optionally adds the raw string as a verified alias if a different display name was supplied, links matching playlists, sets `status = 'approved-new'`, logs the decision.
**Execute grants**: `service_role` only.

#### `split_proposal(p_proposal_id bigint, p_teacher_ids bigint[], p_override_kind boolean default false)`
`SECURITY DEFINER`. Handles "Amit & Priya"-style multi-person proposals: requires ≥2 teacher ids, requires `kind in ('multi-person','organization-or-team')` unless `p_override_kind := true`, rejects duplicate/unknown teacher ids, links every matching playlist to *every* listed teacher (first gets role `instructor`, rest `co-instructor`), sets `status = 'split'`, logs the decision.
**Execute grants**: `service_role` only.

#### `reject_proposal(p_proposal_id bigint, p_note text default null)`
`SECURITY DEFINER`. Sets `status = 'rejected'` (only from `pending`/`deferred`), logs the decision. Raises if the proposal wasn't in a rejectable state.
**Execute grants**: `service_role` only.

#### `defer_proposal(p_proposal_id bigint, p_note text default null)`
`SECURITY DEFINER`. Sets `status = 'deferred'` (only from `pending`), logs the decision.
**Execute grants**: `service_role` only.

#### `approve_group_as_existing(p_normalized text, p_teacher_id bigint, p_add_alias boolean default true)`
`SECURITY DEFINER`. Applies `approve_proposal_as_existing()` to every `pending`/`deferred` proposal sharing the given `normalized` value, in one loop (locking each row `for update`), aggregating `playlists_linked` across variants. Raises if no matching proposals exist.
**Execute grants**: initially `service_role` only (teachers_v7.sql §16); re-granted to `authenticated, service_role` by `teachers_v7_admin_ui.sql`.

#### `approve_faculty_review_group_as_new(p_normalized text, p_display_name text, p_verified boolean default false)`
Defined in `teachers_v7_admin_ui.sql`. `SECURITY DEFINER`. Body-guarded. Loops every `pending`/`deferred` proposal for the `normalized` group: the *first* variant is approved via `approve_proposal_as_new()` (creating the teacher), every subsequent variant is approved via `approve_proposal_as_existing()` against that same new teacher id — so one group produces exactly one teacher. Aggregates `playlists_linked`.
**Execute grants**: `authenticated, service_role`.

#### `reject_faculty_review_group(p_normalized text, p_note text default null)`
`SECURITY DEFINER`, in `teachers_v7_admin_ui.sql`. Loops every `pending`/`deferred` proposal in the normalized group and calls `reject_proposal()` on each.
**Execute grants**: `authenticated, service_role`.

#### `defer_faculty_review_group(p_normalized text, p_note text default null)`
`SECURITY DEFINER`, in `teachers_v7_admin_ui.sql`. Loops every `pending`-status proposal (not `deferred` — narrower than the reject/split group variants) in the group and calls `defer_proposal()` on each.
**Execute grants**: `authenticated, service_role`.

#### `split_faculty_review_group(p_normalized text, p_teacher_ids bigint[], p_override_kind boolean default false)`
`SECURITY DEFINER`, in `teachers_v7_admin_ui.sql`. Loops every `pending`/`deferred` proposal in the group and calls `split_proposal()` on each with the same teacher id set, aggregating `links_created`.
**Execute grants**: `authenticated, service_role`.

#### `log_proposal_decision(p_proposal_id bigint, p_raw text, p_decision text, p_teacher_ids bigint[], p_note text)`
`SECURITY DEFINER`, `language sql`. Single-statement `insert into teacher_proposal_decisions (...) values (...)`, `decided_by := auth.uid()`. This is the sole write path into the append-only decision log, called internally (via `perform`) from every approve/reject/defer/split function above.
**Execute grants**: revoked from **all** roles including `service_role` in the final "AUTHORIZATION BOUNDARY" grant block (`teachers_v7.sql` §17). It is reachable only because it is called from inside other `SECURITY DEFINER` functions executing as the function owner — no role can invoke it directly via PostgREST despite it appearing in the API surface (see Discrepancies).

#### `scan_free_text_teachers` / grouping helpers — none additional.

#### `faculty_import_capability()`
Defined in `teachers_v7_import.sql`. No parameters. `SECURITY DEFINER`, `stable`. Body-guarded. Simple capability-flag responder for the admin UI, returning a fixed `jsonb`: `{teacher_ids_supported: true, omitted: "preserve", empty_array: "clear", non_empty_array: "replace"}`. Exists so the UI can detect whether the faculty-aware import wrappers are installed before sending `teacher_ids` to an importer that would silently ignore them.
**Execute grants**: `authenticated, service_role`.

#### `validate_teacher_ids_payload(payload jsonb)`
Defined in `teachers_v7_import.sql`. `SECURITY DEFINER`, `stable`, returns `bigint[]`. Private validator shared by `import_playlist_with_teachers()` and `create_course_with_teachers()` (both outside this cluster). Requires the `teacher_ids` key to exist and be a JSON array of positive whole numbers, rejects duplicates, rejects unknown teacher ids (must already exist in `teachers`), and returns the ordered id array.
**Execute grants**: revoked from **all** roles including `service_role` (`revoke all ... from public, anon, authenticated, service_role`) — see Discrepancies. Only reachable internally via the two `SECURITY DEFINER` importer wrappers.

---

### Discrepancies

1. **Source-file comments claim "not applied to production," but the live database says otherwise.** `src/migrations/teachers_v7.sql` opens with "Delta on top of v6.2. **NOT applied anywhere. NOT part of the verified production migration. Staging only, and only after review.**" `teachers_v7_admin_ui.sql` and `teachers_v7_import.sql` carry equivalent disclaimers ("Isolated from all builders until disposable-staging verification" / "intentionally absent from both production and staging builders"). The ground-truth OpenAPI spec (pulled live this morning) shows `teacher_name_proposals`, `teacher_proposal_decisions`, and every RPC in this cluster **are live in production**. This is explained — not contradicted — by `production/faculty_quality_production.sql`, an "AUTO-GENERATED — FACULTY + CONTENT QUALITY PRODUCTION PACKAGE" that concatenates `teachers_v7.sql` + `teachers_v7_import.sql` + `teachers_v7_admin_ui.sql` + `universal_search.sql` + `content_quality_v10.sql` behind a preflight/postflight pair, and whose postflight explicitly asserts `teachers`, `teacher_aliases`, `playlist_teachers`, `playlist_quality_reviews`, `search_teachers`, `universal_search`, and the quality-queue RPCs all exist. In other words: the package **was** promoted to production at some point, but the original per-feature source files (`teachers_v7.sql` etc.) were never updated to drop their "staging only / not applied" header comments. Anyone reading only `teachers_v7.sql` today would incorrectly conclude this entire cluster is not live. Flagging rather than silently correcting, per instructions.

2. **Two RPCs are listed in the live PostgREST API surface but are executable by no role at all.** `log_proposal_decision(...)` and `validate_teacher_ids_payload(payload jsonb)` both end with `revoke all on function ... from public, anon, authenticated, service_role` (no subsequent re-grant to anyone). PostgREST/OpenAPI still lists them (including `validate_teacher_ids_payload` as a `GET` with a `payload` query parameter) because Postgres exposes function *existence* independent of grants — but any direct call, by any external role including `service_role`, will fail with "permission denied for function...". They function only as private helpers invoked from inside other `SECURITY DEFINER` functions (owned by the function owner, which bypasses the grant check). This isn't a bug, but it means the ground-truth API listing overstates what's actually callable — worth knowing before anyone tries to wire a client directly to either endpoint.

3. **No file in the repo fully explains why `get_faculty_review_groups` / `get_proposal_groups` and the singular vs. `*_faculty_review_group` RPC pairs both exist and are both still live**, beyond the inline comments in `teachers_v7_admin_ui.sql` ("this wrapper lets an authenticated admin reach it while keeping the authorization decision inside the function"). That's a real design rationale, not a gap — noted here only so the apparent duplication (e.g. `defer_proposal` vs. `defer_faculty_review_group`, `get_proposal_groups` vs. `get_faculty_review_groups`) isn't mistaken for redundant/dead code when it is in fact single-proposal vs. grouped-variant operations layered for grant reasons (`service_role`-only inner function vs. `authenticated`-reachable outer wrapper).

No other discrepancy was found for this cluster: all live columns, types, nullability, and RPC parameter/return shapes in the ground-truth file matched the SQL exactly, including default values, CHECK constraint value lists, and grant states, once the three sequential migration files (`teachers_v7.sql` → `teachers_v7_import.sql` → `teachers_v7_admin_ui.sql`) and their production concatenation (`production/faculty_quality_production.sql`) are read together.
## Import, Catalog Management & Audit Trails

### Production status note (read this first)

Every table and RPC in this cluster except `app_environment`/`video_stats`/the v6 import core is defined in a migration file whose own header says something like *"DO NOT apply to production"* or *"staging only, NOT part of the verified production migration."* Those headers are now **stale**. `docs/backup_restore_readiness.md` ("Production v6-through-v12 migration — passed", 27 Jul 2026) records that on 2026-07-27 the following were applied to production `youtube` (`kezelafqhgqrprpadmlf`) in order, each verified with a preflight/postflight and a row-count/fingerprint check: the v6 bundle (`production/production_migration.sql`), `teachers_v7.sql` + `teachers_v7_import.sql` + `teachers_v7_admin_ui.sql` + `universal_search.sql`, `comparison_metadata_v8.sql`, `content_quality_v10.sql`, and finally `per_video_chapter_import_v12.sql`. `catalog_navigation_v9` and `catalog_management_v11` were already present in production before that run. This matches the live ground-truth spec. `production/README.md`, however, still reads "Status: PREPARED, NOT AUTHORIZED. Nothing here has been applied to production" — that file was never updated after the real deployment and should not be trusted for current status (see Discrepancies).

---

### Table: `playlist_import_audit`

Source: `src/migrations/per_video_chapter_import_v12.sql`.

Columns (live):
- `id bigint` — PK, identity
- `request_id uuid` — **unique**, not null (idempotency key for `import_playlist_with_chapters`)
- `youtube_playlist_id text` — not null
- `playlist_id bigint` — FK → `playlists.id`, `on delete set null`, nullable
- `request_payload jsonb` — not null (the exact payload submitted)
- `before_state jsonb` — not null
- `after_state jsonb` — not null
- `result jsonb` — not null
- `actor_id uuid` — nullable
- `occurred_at timestamptz` — not null, default `now()`

RLS: enabled. Table privileges are fully revoked from `public, anon, authenticated, service_role` (including the `playlist_import_audit_id_seq` sequence), then `select` is explicitly re-granted to `authenticated` and `service_role`. A single RLS policy, `"admin reads playlist import audit"`, allows `select` to `authenticated` `using (public.is_admin())` — so a signed-in non-admin holds the table grant but reads zero rows. No insert/update/delete policy exists anywhere; the only writer is `import_playlist_with_chapters()` (SECURITY DEFINER, runs as owner).

Triggers: none.

Foreign keys: `playlist_id → playlists.id` (`on delete set null` — the audit row survives playlist deletion).

Check constraints: none beyond the `unique(request_id)` and NOT NULL columns.

---

### Table: `playlist_quality_reviews`

Source: `src/migrations/content_quality_v10.sql`.

Columns (live):
- `id bigint` — PK, identity
- `playlist_id bigint` — FK → `playlists.id`, `on delete cascade`, not null
- `before_state jsonb` — not null
- `after_state jsonb` — not null
- `note text` — nullable
- `reviewed_by uuid` — FK → `auth.users.id`, `on delete set null`, nullable
- `reviewed_at timestamptz` — not null, default `now()`

Index: `idx_pqr_playlist_time (playlist_id, reviewed_at desc)`.

RLS: enabled. Policy `"admin reads quality reviews"` — `select` to `authenticated` `using (public.is_admin())`. Table grants: everything revoked from `public, anon, authenticated, service_role`, then `select` re-granted to `authenticated, service_role` only — there is no direct insert/update/delete path for anyone, including `service_role`. The only writer is `review_playlist_quality()` (SECURITY DEFINER).

Triggers: none.

---

### Table: `playlist_attributes`

Source: `src/migrations/comparison_metadata_v8.sql`.

Columns (live):
- `playlist_id bigint` — PK **and** FK → `playlists.id`, `on delete cascade`
- `pacing text` — nullable, `check (pacing in ('slow','moderate','fast','crash-course'))`
- `theory_percentage smallint` — nullable, `check (between 0 and 100)`
- `prerequisites_level text` — nullable, `check (in ('none','basic','intermediate','advanced'))`
- `completeness_status text` — not null, default `'unassessed'`, `check (in ('unassessed','partial','complete'))`
- `best_for text` — nullable
- `review_status text` — not null, default `'proposed'`, `check (in ('proposed','verified','rejected'))`
- `source text` — not null, default `'manual'`, `check (in ('manual','import','editorial-review'))`
- `evidence_note text` — nullable
- `verified_by uuid` — FK → `auth.users.id`, `on delete set null`
- `verified_at timestamptz` — nullable
- `created_at timestamptz` — not null, default `now()`
- `updated_at timestamptz` — not null, default `now()`
- table-level `check (review_status <> 'verified' or verified_at is not null)`

Trigger: `trg_touch_playlist_attributes` (before update) → `touch_playlist_attributes()`, sets `new.updated_at := now()`. `touch_playlist_attributes()` itself is revoked from every role (only reachable as a trigger, never called directly).

RLS: enabled, but **no policy of any kind is defined**. Table grants: everything revoked from `public, anon, authenticated`; full `select, insert, update, delete` granted only to `service_role` (plus `usage, select` on `topics_id_seq`, an unrelated sibling table's sequence — no sequence grant needed here since the PK is not an identity column). Effectively the only access path for anyone other than `service_role`/the function owner is the read-only, bounded projection returned by `get_playlist_comparison()` (SECURITY DEFINER), which is granted to `anon, authenticated, service_role`.

---

### Table: `catalog_management_audit`

Source: `src/migrations/catalog_management_v11.sql`.

Columns (live):
- `id bigint` — PK, identity
- `action text` — not null, `check (action in ('update-playlist','set-video-taxonomy','clear-video-taxonomy','reassign-video-chapter','delete-playlist'))`
- `playlist_id bigint` — nullable, **no FK constraint** (deliberate — see below)
- `video_id bigint` — nullable, no FK constraint
- `before_state jsonb` — not null
- `after_state jsonb` — nullable
- `actor_id uuid` — nullable, no FK constraint declared
- `occurred_at timestamptz` — not null, default `now()`

RLS: enabled. Table grants fully revoked from `public, anon, authenticated, service_role`, then `select` re-granted to `authenticated, service_role`. Policy `"admin reads catalog management audit"` — `select` to `authenticated` `using (public.is_admin())`.

Triggers: none. Rows are inserted explicitly by `update_managed_playlist`, `set_managed_video_taxonomy`, `clear_managed_video_taxonomy`, `reassign_video_chapter`, and `delete_managed_playlist` — all SECURITY DEFINER.

Foreign keys: **none** on `playlist_id`/`video_id` — matches the ground-truth spec (no `<fk/>` annotation on either column, unlike `playlist_import_audit.playlist_id`). This is intentional: `delete_managed_playlist` writes an audit row referencing a `playlist_id` immediately before deleting that very playlist, so a FK with any `on delete` action other than `set null`/`cascade` (which would itself corrupt the audit) is avoided by having no FK at all.

---

### Table: `class_levels_migration_audit`

Source: `src/migrations/import_playlist_v6.sql` (base `create table`), with `run_id` added by the same file via `alter table ... add column if not exists run_id uuid`.

Columns (live):
- `id bigint` — PK, identity
- `playlist_id bigint` — not null, **no FK** (same reasoning pattern as `catalog_management_audit`; also lets the audit be produced by a bulk `SELECT`-driven loop without per-row lock ordering against `playlists`)
- `verdict text` — not null. Comment documents it as one of `agree | array-only | junction-only | both-empty`, but **there is no CHECK constraint enforcing this** — see Discrepancies.
- `array_labels text[]` — nullable
- `junction_labels text[]` — nullable
- `migrated_at timestamptz` — not null, default `now()`
- `run_id uuid` — nullable (added after the base table)

RLS: enabled. Policy `"admin read audit"` — `select` `using (public.is_admin())` (no explicit `to` clause, so it applies to any role RLS would otherwise let through). Table-level: `revoke all ... from anon` only — `authenticated` and `service_role` still hold whatever default table privileges Postgres/Supabase grants by default (the file only explicitly revokes from `anon`), gated by the RLS policy for non-service roles.

Triggers: none on this table itself, but it is the audit trail for `migrate_class_levels()`, which (when `p_enable_triggers` is true) installs two *other* triggers as a side effect: `trg_force_class_levels` (before insert/update on `playlists`, via `force_derived_class_levels()`) and `trg_sync_pl_class_array` (after insert/delete on `playlist_class_levels`, via `sync_playlist_class_levels_array()`) — both of which keep `playlists.class_levels` (legacy text[] column) mechanically derived from the `playlist_class_levels` junction table.

---

### Table: `app_environment`

Source: `src/migrations/import_playlist_v4.sql` (also re-declared identically in `production/production_migration.sql`, the bundled build).

Columns (live):
- `id boolean` — PK, default `true`, `check (id)` (forces exactly one row)
- `name text` — not null, `check (name in ('production','staging','test'))`

RLS: enabled. Policy `"env readable"` — `select using (true)` — public, unauthenticated read. No insert/update/delete policy exists; the row is written only by hand (SQL Editor) or by test bootstrap scripts.

Purpose (per repo comments): a single-row environment marker. Production intentionally ships this table **empty** — the integration test harness refuses to run against a database with no row in `app_environment`, so an empty table is what permanently keeps the automated test suite from ever touching production.

Triggers/FKs/checks: none beyond the two CHECKs above.

---

### Table: `video_stats`

Source: `src/migrations/video_stats.sql`.

Columns (live):
- `video_id bigint` — PK **and** FK → `videos.id`, `on delete cascade`
- `view_count bigint` — nullable
- `like_count bigint` — nullable (comment: null when the creator hides likes)
- `views_per_day numeric` — nullable
- `popularity_score numeric` — not null, default `0`
- `fetched_at timestamptz` — not null, default `now()`

Indexes: `idx_video_stats_views (view_count desc)`, `idx_video_stats_popularity (popularity_score desc)`, `idx_video_stats_fetched (fetched_at)`.

RLS: enabled. Policy `"public reads stats"` — `select using (true)`. Comment states explicitly there is **no** insert/update/delete policy by design — only the service-role refresh job (which bypasses RLS entirely) writes this table, mirroring how the rest of the catalogue is admin/service-maintained.

Triggers: none (refresh is done by an external job, `src/scripts/refreshVideoStats.js`, not a DB trigger).

Side effect on `playlists`: the same file adds three denormalised rollup columns to `public.playlists` — `view_count_total bigint not null default 0`, `popularity_score numeric not null default 0`, `stats_fetched_at timestamptz` (nullable) — plus indexes `idx_playlists_popularity` and `idx_playlists_views`. These are aggregated from member videos by the same refresh job, not by a trigger.

---

### Table: `video_topics`

Source: `src/migrations/comparison_metadata_v8.sql`.

Columns (live):
- `video_id bigint` — FK → `videos.id`, `on delete cascade`, part of composite PK
- `topic_id bigint` — FK → `topics.id`, `on delete cascade`, part of composite PK
- `coverage_kind text` — not null, default `'theory'`, `check (in ('theory','practice','pyq','mixed'))`
- `review_status text` — not null, default `'proposed'`, `check (in ('proposed','verified','rejected'))`
- `source text` — not null, default `'manual'`, `check (in ('manual','import','editorial-review'))`
- `verified_by uuid` — FK → `auth.users.id`, `on delete set null`
- `verified_at timestamptz` — nullable
- `created_at timestamptz` — not null, default `now()`
- primary key `(video_id, topic_id)`
- table-level `check (review_status <> 'verified' or verified_at is not null)`

Index: partial index `idx_video_topics_topic_verified (topic_id, video_id) where review_status = 'verified'` (fast path for computing chapter/goal coverage using only reviewed evidence).

RLS: enabled, **no policy defined** (same pattern as `playlist_attributes`). Table grants fully revoked from `public, anon, authenticated`; full CRUD granted only to `service_role`. Read access for ordinary callers is exclusively through `get_playlist_comparison()`.

Triggers: none.

---

### RPC: `import_playlist(payload jsonb, mode text default 'merge')`

Source: `src/migrations/import_playlist_v4.sql`, revised validator wiring in `src/migrations/import_playlist_v6.sql`. LANGUAGE plpgsql, **SECURITY DEFINER**, `set search_path = ''`.

Does: the core catalogue importer. Checks caller is admin or `service_role`; calls `validate_import_payload()`; takes an advisory lock keyed on `youtube_playlist_id` to serialize concurrent imports of the same source; race-safe upserts the channel, resolves/creates the chapter, race-safe upserts the playlist (on the partial unique index over `youtube_playlist_id`), links learning goal / class levels / boards, then for each video race-safe upserts the video row and links goals/classes additively, links it into `playlist_videos` at its position, and — in `'replace'` mode — deletes any `playlist_videos` rows not in the new set. Returns `{playlist_id, mode, reused_playlist, videos_added, videos_reused, lessons}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role` (deliberately left reachable by `authenticated` because admins are authenticated users — the body's `is_admin()` check is the real boundary).

---

### RPC: `import_playlist_with_chapters(payload jsonb, mode text default 'merge')`

Source: `src/migrations/per_video_chapter_import_v12.sql`. SECURITY DEFINER.

Does: guarded, **create-only**, per-video-chapter-mapped import wrapper around `import_playlist()`. Requires `request_id` (uuid) for idempotency — a retry with the identical payload replays the previously recorded result (verifying the live catalogue state hasn't drifted from what was recorded, else it raises); a retry with a *different* payload for the same `request_id` raises. Requires `manifest_sha256` / `source_snapshot_sha256` (64-hex SHA-256 strings) and a `manifest_assignment_count` matching the video count. Forbids top-level `chapter_id`/`chapter_name` — every video in the payload must carry its own positive-integer `chapter_id`, spanning at least two distinct chapters, all of which must already exist under `payload.subject_id`. Refuses if the source playlist already exists (not a retry path — that's an editorial conflict). Locks rows in a stable order, delegates the actual playlist/video/taxonomy writes to `import_playlist()`, then applies each video's `chapter_id` (only if the video didn't already have a conflicting one), and finally inserts a full audit row into `playlist_import_audit`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `import_playlist_with_quality(payload jsonb, mode text default 'merge')`

Source: `src/migrations/content_quality_v10.sql`. SECURITY DEFINER.

Does: wraps `import_playlist()` to additionally capture the exact, verbatim YouTube playlist title as `source_title` (required, ≤500 chars) — kept separate from the curated `title` shown to students — and flags `source_title_changed` when a re-import's source title differs from a previously recorded one.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `import_playlist_with_teachers(payload jsonb, mode text default 'merge')`

Two definitions exist in the repo history for the same signature; the one **live in production** is the later one.
- `src/migrations/teachers_v7_import.sql` (v7, superseded): wraps `import_playlist()` + `set_playlist_teachers()`.
- `src/migrations/content_quality_v10.sql` (v10, **current/live**, applied after v7 in production per `docs/backup_restore_readiness.md`): does everything the v7 version did, plus also captures `source_title`/`source_title_changed` (same as `import_playlist_with_quality`) and sets `faculty_credit_status = 'identified'` when teacher ids were supplied, else `'pending'`.

Does (current body): validates `payload.teacher_ids` via `validate_teacher_ids_payload()` before any write; calls `import_playlist()` with `teacher_ids`/`source_title` stripped out of the payload; replaces the playlist's teacher links via `set_playlist_teachers()`; updates `faculty_credit_status`; optionally records `source_title`. Returns the base import result plus `{teachers, teacher_links_replaced, source_title_captured}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `create_course(payload jsonb)`

Source: `src/migrations/import_playlist_v4.sql`. SECURITY DEFINER.

Does: manual (non-YouTube-harvested) course creation. Runs the same shared validator (`require_videos := false`, so it expects `payload.video_ids`, not `payload.videos`). Verifies the target channel exists, inserts the playlist row, links goals/classes/boards, links every `video_id` into `playlist_videos`, and — as an explicit consistency check — re-counts the actual `playlist_videos` rows and raises if it doesn't match the validated expected count. Returns `{playlist_id, lessons}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

Known limitation (per `production/README.md`): takes no advisory lock, so two identical concurrent manual submissions can create two courses.

---

### RPC: `create_course_with_teachers(payload jsonb)`

Source: `src/migrations/teachers_v7_import.sql`. SECURITY DEFINER.

Does: validates `payload.teacher_ids`, calls `create_course()` with `teacher_ids` stripped from the payload, then sets the playlist's teacher links via `set_playlist_teachers()`. Returns the base result plus `{teachers, teacher_links_replaced}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `validate_import_payload(payload jsonb, mode text, require_videos boolean)`

Source: `src/migrations/import_playlist_v4.sql`, replaced by `src/migrations/import_playlist_v6.sql` (current/live version). LANGUAGE plpgsql, STABLE, SECURITY DEFINER. **No `is_admin()`/role check in the function body at all** — its only access boundary is the GRANT/REVOKE state.

Does: the single shared validator used by `import_playlist`, `create_course`, and (indirectly) their `_with_*` wrappers and `import_playlist_with_chapters`. Validates: `mode` is `merge`/`replace`; `title` present; `youtube_playlist_id` format (when required or supplied); `youtube_channel_id` format; `learning_goal_id` explicit and valid; `category_id`/`subject_id`/`chapter_id` valid and chapter belongs to subject; `category_id` ↔ `learning_goal_id` is a declared legal pair via `category_learning_goals` (v6 addition — the fix for Browse vs. Explore disagreeing); `board_ids` array valid, required iff the goal is `school`, forbidden otherwise; `class_labels` map to valid, goal-compatible `class_levels` via `learning_goal_class_levels`; `audience_focus` must be among the supplied classes; `content_type`/`language`/`difficulty` enum checks; then branches — if `require_videos` is false, validates `payload.video_ids` (positive whole numbers, ≤500, no duplicates, all existing); if true, validates `payload.videos[]` (valid `youtube_video_id` format, no duplicate ids, non-blank titles, in-range `duration_seconds`). Returns `{goal_id, class_ids, board_ids, video_count}`.

Grants: `import_playlist_v4.sql` revoked from `public, anon`. `import_playlist_v6.sql` additionally revokes from `authenticated`. `v6_2_grant_tightening.sql` revokes from `authenticated` again (closing the default-privilege gap Supabase grants automatically to every new function). **Net live state: executable only by `service_role`** (and by the function owner when called internally from `import_playlist`/`create_course`, which is why the public import flow still works end-to-end even though a client can never call this RPC directly).

---

### RPC: `per_video_chapter_import_capability()`

Source: `src/migrations/per_video_chapter_import_v12.sql`. LANGUAGE sql, IMMUTABLE, **SECURITY INVOKER** (the only function in this cluster that is not SECURITY DEFINER).

Does: static feature-probe, returns `{version:12, per_video_chapter_id:true, all_or_none_mapping:true, create_only:true, request_replay:true, audit_snapshot:true, rollback_rpc:false}` — lets the admin UI detect whether v12 is installed before offering per-video-chapter import.

Grants: revoked from `public`; granted to `anon, authenticated, service_role` — deliberately open to everyone, since it leaks no data.

---

### RPC: `per_video_chapter_import_snapshot(p_playlist_id bigint)`

Source: `src/migrations/per_video_chapter_import_v12.sql`. LANGUAGE sql, STABLE, SECURITY DEFINER.

Does: returns a jsonb snapshot of exactly the playlist state the v12 import contract owns (id, source ids, title, teacher, channel/category/subject, content metadata, goal/class/board id arrays, ordered video links) — deliberately excludes ratings, popularity counters, and verification timestamps, so those changing independently never causes a false "drift" during an idempotent replay. Used internally by `import_playlist_with_chapters()` for its before/after audit rows and its replay-drift check.

Grants: `revoke all ... from public, anon, authenticated, service_role` — blanket revoke, **never re-granted to anyone anywhere in the repo**. See Discrepancies.

---

### RPC: `per_video_chapter_import_video_snapshot(p_video_id bigint)`

Source: `src/migrations/per_video_chapter_import_v12.sql`. LANGUAGE sql, STABLE, SECURITY DEFINER.

Does: same pattern as the playlist snapshot, at video granularity (id, source id, channel/category/subject/chapter, goal/class id arrays).

Grants: `revoke all ... from public, anon, authenticated, service_role` — same blanket revoke as above. See Discrepancies.

---

### RPC: `migrate_class_levels(p_enable_triggers boolean default true)`

Source: `src/migrations/import_playlist_v6.sql`. SECURITY DEFINER.

Does: the one-time (but re-runnable/idempotent-safe) migration that reconciles the legacy `playlists.class_levels text[]` column against the `playlist_class_levels` junction table. Authorization check is `is_admin() OR auth.role() = 'service_role' OR session_user in ('postgres','supabase_admin')` — the `session_user` branch exists specifically because this is normally invoked from the SQL Editor, which carries no JWT (`auth.role()` is null there). Logic: (1) abort if any playlist has an unknown class label in its array; (2) abort if any playlist's array and its junction-derived array disagree (a real, unresolved conflict) — audit-first, so a partial backfill never happens; (3) for every playlist, classify as `both-empty`/`array-only`/`junction-only`/`agree`, insert one row per playlist into `class_levels_migration_audit` under a fresh `run_id`, and backfill the junction from the array where the junction was empty; (4) re-verify zero drift after backfill, abort otherwise; (5) if `p_enable_triggers`, install/enable `force_derived_class_levels()`/`trg_force_class_levels` on `playlists` and `sync_playlist_class_levels_array()`/`trg_sync_pl_class_array` on `playlist_class_levels`, making the array thereafter mechanically derived. Returns `{run_id, backfilled, drift_after, triggers_enabled, verdicts}`.

Grants: revoked from `public, anon, authenticated` (v6, then re-revoked from `authenticated` in `v6_2_grant_tightening.sql` to close the Supabase default-privilege gap); granted only to `service_role`.

---

### RPC: `purge_migration_audit(p_keep_runs int default 3)`

Source: `src/migrations/import_playlist_v6.sql`. SECURITY DEFINER.

Does: retention/cleanup for `class_levels_migration_audit`. Same three-way authorization check as `migrate_class_levels`. Deletes every row whose `run_id` is not among the `p_keep_runs` most-recent distinct run_ids (ranked by `max(migrated_at)`). Returns `{removed, kept_runs}`. Retention is explicit/manual — nothing calls this automatically.

Grants: revoked from `public, anon, authenticated` (same v6 → v6.2 tightening pattern); granted only to `service_role`.

---

### RPC: `catalog_manage_capability()`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: admin/service-role-gated feature probe for the v11 catalogue-management UI, returns `{version:11, paginated_playlist_list:true, playlist_metadata_and_taxonomy:true, video_taxonomy:true, video_chapter_reassignment:true, playlist_deletion:true, audit_snapshots:true}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `catalog_playlist_snapshot(p_playlist_id bigint)`

Source: `src/migrations/catalog_management_v11.sql`. LANGUAGE sql, STABLE, SECURITY DEFINER.

Does: returns the full playlist row plus `learning_goal_ids`, `class_level_ids`, `video_links` (from `playlist_videos`), and `ratings` (from `playlist_ratings`), all as jsonb. Used purely as the before/after evidence captured into `catalog_management_audit` by `update_managed_playlist()` and `delete_managed_playlist()`.

Grants: `revoke all ... from public, anon, authenticated, service_role` immediately after creation, in the same file — **never granted to any role afterward**. See Discrepancies.

---

### RPC: `catalog_video_taxonomy_snapshot(p_video_id bigint)`

Source: `src/migrations/catalog_management_v11.sql`. LANGUAGE sql, STABLE, SECURITY DEFINER.

Does: same pattern for a single video — full row plus `learning_goal_ids`/`class_level_ids`. Used as before/after evidence by `set_managed_video_taxonomy()`, `clear_managed_video_taxonomy()`, and `reassign_video_chapter()`.

Grants: same blanket revoke, never re-granted. See Discrepancies.

---

### RPC: `get_manage_playlists(p_search text default null, p_limit int default 20, p_offset int default 0)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: paginated admin playlist browser. Admin/service-role gated; bounds-checks `p_limit` (1–100) and `p_offset` (≥0); returns one row per playlist with a window `total_count`, joined channel/category/subject names, taxonomy id arrays, and a nested `videos` jsonb array (each entry carrying `shared_playlist_count` — how many other playlists also link that video — plus its own taxonomy ids). Filters by `title`/`teacher`/`youtube_playlist_id` `ilike` when `p_search` is given.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `update_managed_playlist(p_playlist_id, p_expected_title, p_title, p_teacher, p_channel_id, p_learning_goal_ids, p_class_level_ids, p_content_type, p_language, p_difficulty, p_audience_focus)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: full playlist metadata + taxonomy editor with an **optimistic-concurrency guard** (`p_expected_title` must equal the current title, else it raises — protects against a stale-form overwrite). Validates: title 3–160 chars; channel exists; goal/class arrays non-empty and duplicate-free with all-valid ids; category↔goal match (goal's slug must equal the playlist's category slug); for `jee`/`neet` categories, class levels restricted to `class-11`/`class-12`/`dropper`; `content_type`/`language`/`difficulty` enums; `audience_focus` must be one of the selected classes' legacy labels. Snapshots before/after via `catalog_playlist_snapshot()`, replaces the goal/class junction rows, recomputes and writes the legacy `playlists.class_levels` text[] to stay in sync, and inserts a `catalog_management_audit` row with `action = 'update-playlist'`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `delete_managed_playlist(p_playlist_id bigint, p_expected_title text)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: optimistic-concurrency-guarded playlist deletion. Snapshots the before-state, counts retained `playlist_videos` links and how many of the playlist's videos have **no other** playlist linking them ("orphans"), records a `catalog_management_audit` row (`action = 'delete-playlist'`) with a synthetic after-state describing those counts, then deletes the `playlists` row (relying on the schema's own FK cascade to remove `playlist_videos` link rows — the underlying `videos` rows themselves are never deleted; the function explicitly returns `deleted_videos: 0`).

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `set_managed_video_taxonomy(p_playlist_id, p_video_id, p_learning_goal_ids, p_class_level_ids, p_allow_shared default false)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: replaces a video's learning-goal/class-level taxonomy from the "Manage Catalog" admin UI. Requires the video be linked to the given playlist; requires both id arrays non-empty, duplicate-free, and valid; enforces goal↔video-category match and the same JEE/NEET class restriction as `update_managed_playlist`; if the video is linked from more than one playlist, refuses unless `p_allow_shared = true` (protects against silently reclassifying a video other courses also depend on). Snapshots before/after via `catalog_video_taxonomy_snapshot()`, replaces the junction rows, records a `catalog_management_audit` row (`action = 'set-video-taxonomy'`).

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `clear_managed_video_taxonomy(p_playlist_id, p_video_id, p_allow_shared default false)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: same guard structure as `set_managed_video_taxonomy` but removes all taxonomy for the video instead of replacing it. Records `catalog_management_audit` (`action = 'clear-video-taxonomy'`).

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `reassign_video_chapter(p_playlist_id, p_video_id, p_chapter_id, p_expected_current_chapter_id, p_allow_shared default false)`

Source: `src/migrations/catalog_management_v11.sql`. SECURITY DEFINER.

Does: optimistic-concurrency-guarded chapter reassignment (`p_expected_current_chapter_id` must match, else raises — protects against a stale-UI overwrite). Requires the video be linked to the given playlist; the new chapter must exist and belong to the same `subject_id` as the video; same shared-video confirmation guard as above. Snapshots before/after via `catalog_video_taxonomy_snapshot()`, updates `videos.chapter_id`, records `catalog_management_audit` (`action = 'reassign-video-chapter'`).

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `set_video_taxonomy(p_video_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[])`

Source: `src/migrations/import_playlist_v4.sql`, replaced (hardened) by `src/migrations/import_playlist_v6.sql` (current/live version). SECURITY DEFINER.

Does: the earlier/simpler, playlist-context-free video-taxonomy setter — used by `import_playlist()` and as a standalone admin-panel operation predating v11's shared-video-aware `set_managed_video_taxonomy`. Requires both arrays non-empty; v6 adds duplicate-id rejection *before* any delete happens (so a bad call fails atomically rather than partially clearing taxonomy); validates ids exist; validates every (goal, class) pair is a declared-compatible combination via `learning_goal_class_levels`. Deliberately performs **no** category check and **no** shared-video guard — a single video may legitimately serve multiple goals, and this function has no notion of "which playlist is asking." Deletes and re-inserts `video_learning_goals`/`video_class_levels`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`. Explicitly **not** tightened by `v6_2_grant_tightening.sql` — the file's own comment says this is deliberate, since admins reach it as `authenticated` users and the body's `is_admin()` check is the real gate.

---

### RPC: `clear_video_taxonomy(p_video_id bigint)`

Source: `src/migrations/import_playlist_v4.sql`. SECURITY DEFINER.

Does: deletes all `video_learning_goals`/`video_class_levels` rows for a video; returns `{video_id, goals_removed, classes_removed}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `content_quality_capability()`

Source: `src/migrations/content_quality_v10.sql`. SECURITY DEFINER.

Does: admin/service-role-gated feature probe, returns `{quality_review_supported:true, source_title_supported:true, faculty_identity_required_for_identified:true, automatic_identity_resolution:false}`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `get_content_quality_queue(p_ready boolean default false, p_limit int default 100, p_offset int default 0)`

Source: `src/migrations/content_quality_v10.sql`. SECURITY DEFINER.

Does: admin editorial queue listing playlists that are (`p_ready = true`) or are not (`p_ready = false`) fully quality-reviewed. Bounds-checks `p_limit` (1–200) and `p_offset` (≥0). Joins channel/subject, current faculty links (as jsonb), and calls `playlist_quality_missing()` per row via a lateral join to compute `missing_fields[]` and `quality_ready = (missing_fields is empty)`.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `playlist_quality_missing(p_playlist_id bigint)`

Source: `src/migrations/content_quality_v10.sql`. LANGUAGE sql, STABLE, SECURITY DEFINER. No in-body auth check.

Does: pure computation, returns `text[]` of missing-field codes for a playlist: `title-review`, `source-title`, `source-title-changed`, `faculty-credit`, `faculty-link` (status says identified but no teacher row linked), `faculty-team-conflict` (status says team but a teacher *is* linked), `course-type`, `language`, `difficulty`, `subject`, `learning-goal`, `class-level`, `lessons`, `lesson-chapter` (a linked video has no `chapter_id`).

Grants: `revoke all on function public.playlist_quality_missing(bigint) from public, anon, authenticated, service_role` — blanket revoke, **never re-granted to anyone**, including `service_role`. See Discrepancies.

---

### RPC: `review_playlist_quality(p_playlist_id, p_display_title, p_teacher_ids, p_faculty_status, p_content_type, p_language, p_difficulty, p_note default null)`

Source: `src/migrations/content_quality_v10.sql`. SECURITY DEFINER.

Does: the editorial write-path for the quality queue. Locks the playlist row; normalises/validates `p_display_title` (3–90 chars); requires `p_teacher_ids` explicit (not null); `p_faculty_status` must be `identified`/`team`/`unknown`, with `identified` requiring ≥1 teacher id, `team` forbidding teacher ids and requiring a ≥3-char editorial `p_note`; validates `content_type`/`language`/`difficulty` enums. Captures a before-state jsonb, replaces the playlist's teacher links via `set_playlist_teachers()`, updates the playlist row (title, `title_review_status = 'approved'`, `faculty_credit_status`, content metadata, `source_title_changed = false`), inserts a before/after row into `playlist_quality_reviews`, and returns `{playlist_id, missing_fields, quality_ready}` from a fresh `playlist_quality_missing()` call.

Grants: revoked from `public, anon`; granted to `authenticated, service_role`.

---

### RPC: `rls_auto_enable`

**No source found.** A repo-wide, case-insensitive search for `rls_auto` and `auto_enable` across every `.sql`, `.js`, and `.md` file in the repository (root, `docs/sql/`, `src/migrations/`, `production/`) returns zero matches. No migration file, wrapper, dry-run, or evidence document mentions this function under any name variant. It appears live in production per the ground-truth OpenAPI spec (POST-only, empty object body schema, no parameters visible in the spec) but its definition, its authorization model, and even which migration (if any) created it are unknown from this repository. See Discrepancies.

---

### Discrepancies

1. **`rls_auto_enable` has no source in the repository at all.** It is live in production (confirmed by the ground-truth OpenAPI pull) but no `.sql` file, script, or doc anywhere in the repo defines, mentions, or grants it. It may have been created directly in the Supabase SQL Editor, by a Supabase dashboard automation, or by tooling outside this repo. This should not be inferred, guessed at, or silently attributed to any of the migration files above.

2. **Five SECURITY DEFINER helper RPCs are blanket-revoked from every role, including `service_role`, in their own defining migration file — and are never granted to anyone anywhere else in the repo — yet the ground-truth spec lists them as live, invocable REST endpoints:**
   - `per_video_chapter_import_snapshot(bigint)`
   - `per_video_chapter_import_video_snapshot(bigint)`
   - `catalog_playlist_snapshot(bigint)`
   - `catalog_video_taxonomy_snapshot(bigint)`
   - `playlist_quality_missing(bigint)`

   All five are called *internally* by other SECURITY DEFINER functions owned by the same role (e.g. `import_playlist_with_chapters`, `update_managed_playlist`, `get_content_quality_queue`), which succeeds regardless of grants because a function owner always holds implicit EXECUTE on its own objects. But per Postgres semantics, a direct PostgREST call to any of these five as `anon`, `authenticated`, or even `service_role` should fail with a permission-denied error — despite PostgREST/the OpenAPI spec exposing them as normal callable RPC routes because they sit in `public` with a compatible signature. This is either intentional defense-in-depth (making them truly internal-only) or an oversight where a grant was meant to be added and never was. It should be verified against actual production behavior (an authenticated non-admin call to e.g. `catalog_playlist_snapshot`) rather than assumed either way.

3. **Migration file headers and `production/README.md` are stale relative to actual deployment history.** `per_video_chapter_import_v12.sql` says "DO NOT apply to production until the backup/restore gate and a disposable-staging rehearsal pass"; `teachers_v7.sql`, `teachers_v7_import.sql`, `comparison_metadata_v8.sql`, and `content_quality_v10.sql` all carry similar "staging only" / "NOT applied anywhere" language; `production/README.md` still states "Status: PREPARED, NOT AUTHORIZED. Nothing here has been applied to production." All of this was true when written but is now false: `docs/backup_restore_readiness.md` documents that every one of these was applied to production on 2026-07-27 with recorded preflight/postflight verification, and the live ground-truth spec confirms it. Anyone reading only the SQL files or `production/README.md` would incorrectly conclude these features are not live.

4. **`class_levels_migration_audit.verdict` is documented but not enforced.** The column comment in `import_playlist_v6.sql` says it holds one of `agree | array-only | junction-only | both-empty`, but there is no `CHECK` constraint on the column — nothing in the schema itself prevents an arbitrary text value. In practice this is safe today because the only writer is `migrate_class_levels()`, which is locked down to `service_role` only, but the schema does not defend the invariant independently of that function's code.

5. **`import_playlist_with_teachers(jsonb, text)` has two different bodies in the repo under the identical signature**, defined first in `teachers_v7_import.sql` (v7) and then re-defined (via `create or replace function`) in `content_quality_v10.sql` (v10). Since v10 was applied to production after v7, the **v10 body is what's actually live** (it also touches `source_title`/`faculty_credit_status`, which the v7 body does not). A reader who opens only `teachers_v7_import.sql` looking for the current behavior of this RPC would get an outdated picture.
</br>
## Search Infrastructure

No tables are assigned to this cluster — the ground-truth file (`cluster_G-search-infrastructure.json`) lists eight RPC functions and zero tables. All eight are pure/query functions (no owned tables); several read from `chapters`, `playlists`, `videos`, `institutes_channels` (owned by other clusters) but do not belong to this one.

Provenance overview: the current live implementation is the **v11 search rewrite**, shipped as two companion migration files, `src/migrations/search_latin_key_v11.sql` and `src/migrations/universal_search_v11.sql`, which are also distributed pre-concatenated as a single paste-in-SQL-Editor script at `docs/sql/search_v11_2026-07-30.sql` (1,643 lines = the two files' 684 + 921 lines plus a combined header — verified by line count, not a separate implementation). The v11 files supersede an earlier generation, `src/migrations/universal_search.sql` (the original ranking implementation) and `src/migrations/search_hide_empty_chapters.sql` (a small patch on top of it that added the "hide chapters with no videos" guard). v11 folds that guard in directly (see `universal_search` below) and keeps `search_rank`/`normalize_search_text` from the original file unchanged and still live, while adding `search_rank_tokens`, `translit_devanagari`, and `search_latin_key` as new functions and swapping `universal_search`'s internals to use them.

---

### normalize_search_text(p_text text) → text

- **Source:** `src/migrations/universal_search.sql` (original), re-declared identically (no behavior change) nowhere else — it is untouched by the v11 migration.
- **Behavior:** Case/punctuation-insensitive comparison key for non-person text. Lower-cases, strips apostrophe-family characters, collapses all punctuation/whitespace runs to a single space, trims, and returns `NULL` for empty/whitespace-only input. Deliberately not `normalize_person_name()` (which strips honorifics like "sir"/"dr"/"ji" — wrong for a chapter or lecture title).
- **Language/volatility:** `sql`, `immutable`. Not `SECURITY DEFINER` (plain SQL function, runs as caller — irrelevant here since it touches no table).
- **Used for:** backs the `idx_*_trgm` / `idx_*_pattern` expression indexes on `chapters.name`, `playlists.title`, `videos.title`, `institutes_channels.name`; also used inside `universal_search` today only to measure `q_raw` length for the short-query floor (design note 4 of `universal_search_v11.sql`).
- **Grants:** `revoke all ... from public, anon, authenticated, service_role` then explicit `grant execute ... to anon, authenticated, service_role` in both `universal_search.sql` and re-asserted in `universal_search_v11.sql`. Matches ground truth (callable via GET/POST with no auth).

### search_rank(p_haystack text, p_needle text) → int

- **Source:** `src/migrations/universal_search.sql`. Explicitly **kept and unchanged** by the v11 rewrite — design note 9 in `universal_search_v11.sql` states other code and the staging test suite still reference it, so it was left in place even though `universal_search` itself no longer calls it (replaced by `search_rank_tokens`).
- **Behavior:** single-string match tier: 1 = exact, 3 = prefix (needle ≥ 2 chars), 4 = substring/"partial" (needle ≥ 3 chars), 5 = fuzzy via `catalog_similarity()` (whole-string `pg_trgm` similarity ≥ 0.4, needle ≥ 4 chars), else `NULL`.
- **Language/volatility:** `sql`, `immutable`.
- **Note:** this is the tier logic `universal_search` *used to* run in production before v11; it is now dead code from `universal_search`'s point of view but still exists and is still granted.
- **Grants:** revoked from all then granted to `anon, authenticated, service_role` (same pattern as above).

### search_rank_tokens(p_haystack text, p_tokens text[], p_needle text) → int

- **Source:** `src/migrations/universal_search_v11.sql`. New in v11; replaces `search_rank`'s role inside `universal_search`.
- **Behavior:** multi-token match tier for `universal_search`: 1 = exact (`haystack = needle`), 3 = prefix (needle ≥ 2 chars), 4 = **all tokens present** (needle ≥ 3 chars, every element of `p_tokens` is a substring of the haystack via `position()`), 5 = fuzzy (needle ≥ 4 chars, every token clears `catalog_word_similarity(tok, haystack) >= 0.5`, not just the needle as a whole — fixes an earlier bug where "class 12" matched on "class" alone and pulled in 253 wrong lectures), else `NULL`. The 0.5 threshold here must stay equal to the transaction-local `pg_trgm.word_similarity_threshold` GUC that `universal_search` sets before calling this, or the index prefilter and the tier calculation disagree.
- **Language/volatility:** `sql`, `immutable`. Matches ground truth exactly (`p_haystack`, `p_tokens text[]`, `p_needle`, all required).
- **Grants:** revoked from all then granted to `anon, authenticated, service_role`, required because `universal_search` is `SECURITY INVOKER` and calls this by name in the logged-out (`anon`) request path.

### translit_devanagari(p_text text) → text

- **Source:** `src/migrations/search_latin_key_v11.sql`. New in v11.
- **Behavior:** mechanical, non-scholarly Devanagari→Latin transliteration matching how an Indian student actually types (long vowels emitted short — "sakhi" not "saakhii"; inherent vowel kept — कबीर → "kabira"). Implemented as an explicit character-by-character `plpgsql` loop over Unicode code points (not `translate()`, since consonant+matra+virama composition is context-dependent), covering conjuncts (क्ष→"ksha", the hardcoded ज्ञ→"gy" digraph), nasalization/visarga, Devanagari digits, danda→space, nukta-based retroflex letters, and ZWNJ/ZWJ stripping. Identity transform (byte-for-byte passthrough) for any input containing no Devanagari code points (U+0900–U+097F), which is the "only ever adds letters, never removes them" guarantee.
- **Language/volatility:** `plpgsql`, `immutable`, `parallel safe`, `set search_path = ''`. Must remain declared `IMMUTABLE` — `universal_search_v11.sql` has a preflight `do` block that raises an exception at apply time if `search_latin_key`'s underlying volatility isn't `'i'`, because the function backs an expression index.
- **Self-test:** the file ends with two `do $selftest$` blocks that `raise exception` (not just warn) on failure — one checks ~30+ literal transliteration pairs against real CBSE Class 10 Hindi chapter/lesson titles plus idempotence, the other checks null/empty handling, Latin-identity equivalence with `normalize_search_text`, Unicode spelling robustness (precomposed vs. decomposed nukta forms, ZWNJ invisibility), positional rules (inherent vowel, matra replacement, virama cancellation), and — notably — a **live query against `public.playlist_videos`/`public.videos`** asserting zero same-course title collisions under the new key (this is a real regression test: an earlier revision of the function folded long vowels everywhere and collapsed "Meiosis I"/"Meiosis II" into one unreachable key).
- **Grants:** revoked from all then granted to `anon, authenticated, service_role` — required because `universal_search` (SECURITY INVOKER) calls `search_latin_key`, which calls this, by name in the anon path.

### search_latin_key(p_text text) → text

- **Source:** `src/migrations/search_latin_key_v11.sql`. New in v11.
- **Behavior:** the shared script-neutral comparison key = `normalize_search_text(translit_devanagari(p_text))`. Composition, not reimplementation, so the Latin-only indexes stay consistent with the Hinglish bridge. Guarantees: identity on pure-Latin input (equals `normalize_search_text(x)`), idempotent (`search_latin_key(search_latin_key(x)) = search_latin_key(x)`), null/empty/punctuation-only input → `NULL`.
- **Language/volatility:** `sql`, `immutable`, `parallel safe`, `set search_path = ''`.
- **Used for:** four new expression indexes built by `universal_search_v11.sql` — `idx_chapters_name_latin_trgm`, `idx_playlists_title_latin_trgm`, `idx_videos_title_latin_trgm`, `idx_institutes_name_latin_trgm` (GIN, `gin_trgm_ops`) plus four matching `text_pattern_ops` btree indexes (`idx_*_latin_pattern`) for the prefix tier. The v11 file explicitly reindexes every index matching `%_latin_%` unconditionally on every re-apply, because if the transliteration table is ever edited after the indexes exist, a stale expression index would silently drop matching rows and the self-tests (which call the function directly, not the index) would not catch it.
- **Grants:** revoked from all then granted to `anon, authenticated, service_role`.

### universal_search(p_query text, p_types text[] DEFAULT NULL, p_limit int DEFAULT 5, p_offset int DEFAULT 0) → TABLE(group_key text, entity_id bigint, title text, subtitle text, aka text, slug text, match_type text, match_rank int, matched_on text, is_ambiguous boolean, group_total bigint, extra jsonb)

- **Source:** currently `src/migrations/universal_search_v11.sql` (live version, confirmed by ground truth: params `p_query`/`p_types`/`p_limit`/`p_offset` match exactly). Superseded prior versions: `src/migrations/universal_search.sql` (original) and `src/migrations/search_hide_empty_chapters.sql` (patched the original to add the empty-chapter guard — that guard is preserved verbatim in v11's chapter branch, marked "CONTENT GUARD... preserved").
- **Behavior:** one grouped, ranked, paginated search across five potential groups — faculty, chapter, playlist, lecture, institute. All ranking and paging happen server-side; the client never receives the full catalogue, only up to `p_limit` rows per group plus a `group_total` count for "showing 5 of 43" UI. Requires the query to normalize to ≥ 2 characters (measured as the *shorter* of the plain-normalized length and the Latin-key length, so a 1-character Devanagari input that transliterates to 2+ Latin letters still returns nothing) or it returns zero rows immediately. Sets `pg_trgm.word_similarity_threshold = 0.5` transaction-locally via `set_config(..., true)` so fuzzy-match behavior is pinned in the function rather than depending on a per-database GUC. For each of chapter/playlist/lecture/institute it: computes `search_latin_key()` of the row's name/title, applies a sargable `WHERE` predicate (`LIKE '%'||longest_token||'%' OR LIKE query||'%' OR %> longest_token`, each disjunct a member of `gin_trgm_ops` applied directly to the indexed expression — deliberately not wrapped in a CTE alias, to avoid silently losing index usage), computes the tier via `search_rank_tokens`, and orders by `(tier, length(title), title)`. Chapter branch additionally filters `WHERE EXISTS (SELECT 1 FROM videos v WHERE v.chapter_id = ch.id)` so empty/parked chapters never surface. Lecture branch's `extra` payload includes `chapter_id`, `subject_id`, `playlist_id` (lowest playlist id containing that video) and `youtube_video_id`, added in v11 so a lecture result can deep-link straight to the lesson rather than a filtered catalogue view. Faculty branch is reached only via dynamic SQL guarded by `to_regclass('public.teachers') IS NOT NULL` — real faculty identity lives in `teachers_v7.sql` (a separate, not-always-installed capability outside this cluster) and delegates entirely to `search_teachers()`; when the teacher tables are absent, the faculty group is simply omitted rather than fabricated from `playlists.teacher` free text.
- **Params/returns:** matches ground truth exactly — `p_query text` (required), `p_types text[]` (optional, null/empty = all five groups), `p_limit int` (optional, clamped to `[1,50]`, default 5), `p_offset int` (optional, floored at 0, default 0).
- **Language/volatility/security:** `plpgsql`, `stable`, **`SECURITY INVOKER`** (deliberate — "catalogue rows stay subject to RLS, so this function can never become a way to read something the caller could not already read"; the faculty branch's real gate is that `search_teachers()` is `SECURITY DEFINER` and hardcodes `include_unverified => false`). `set search_path = public, pg_temp` at creation, then altered post-creation via a `do` block to additionally pin `pg_trgm`'s actual schema (`extensions` on Supabase, `public` elsewhere, looked up from `pg_extension` rather than guessed) — required because the `%>` word-similarity operator is resolved by `plpgsql` at first execution, not at `CREATE`, so without the schema on the path the very first search would fail with `operator does not exist: text %> text`.
- **Self-test:** `universal_search_v11.sql` ends with a `do $selftest$` block, run inside the same transaction as the DDL so a failure rolls the whole migration back, that runs the **real RPC against the real catalogue** (not fixtures) and raises on failure. Checks: short-query floor (1-char, punctuation-only, empty query all return 0 rows), the four `match_type` strings the UI knows about (`exact`/`prefix`/`partial`/`fuzzy` — faculty's `alias` tier is excluded from this check since it's owned by `search_teachers()`), that pre-existing exact/prefix chapter matching still works, multi-token matching (literal + a case derived live from real title data so it can't rot), typo tolerance (a literal "projctile motin" case plus a live one-character-deletion case derived from a real 10+ letter word), and the Hinglish bridge (a live Devanagari title's own Latin key must find it, ideally as an `exact` match — non-fatal `WARNING` if not, since that would indicate `search_latin_key` isn't idempotent — and typing the Devanagari title itself must still work).
- **Grants:** revoked from all then granted to `anon, authenticated, service_role`, both on `universal_search` itself and (re-asserted) on every helper it calls by name (`search_rank_tokens`, `catalog_word_similarity`, `search_latin_key`, `normalize_search_text`) — the comments stress this repeatedly: because the function is `SECURITY INVOKER`, a missing grant on any one helper breaks public search entirely for every visitor with "permission denied for function X", not just a degraded feature.
- **Helper function created alongside, not in ground truth (so not separately documented here but relevant):** `catalog_similarity(text,text)` (wraps `pg_trgm.similarity`, from the v1 file, used by `search_rank`) and `catalog_word_similarity(text,text)` (wraps `pg_trgm.word_similarity`, from `universal_search_v11.sql`, used by `search_rank_tokens`) — both schema-qualified wrappers compiled via `do` blocks against wherever `pg_trgm` actually lives on that Supabase project, both `immutable strict set search_path = ''`, both revoked-then-granted to `anon, authenticated, service_role`.

### show_limit() → real, show_trgm(text) → text[]

- **Source: not found anywhere in this repository.** No migration file, no `docs/sql`, no `production/` bundle, and no script defines, comments on, or grants these two functions. They are **not application code**.
- **Explanation (not from a repo file — inferred from the pg_trgm extension's own contents):** `show_limit()` and `show_trgm(text)` are built-in functions shipped by the `pg_trgm` PostgreSQL extension itself (`show_trgm` returns the trigram array PostgreSQL would generate for a string; `show_limit`/`set_limit` read/set the legacy similarity threshold, superseded by the `pg_trgm.similarity_threshold` GUC but still installed for backward compatibility). Every SQL file in this cluster's lineage runs `create extension if not exists pg_trgm;` (first appears in `src/migrations/universal_search.sql` line 47), which is sufficient to make both functions live and PostgREST-visible with zero application-authored SQL. Per the task's ground-truth caveat, extension-owned function grants/ownership are not visible via OpenAPI or via repo search either — their default PostgreSQL grants (`PUBLIC` can execute both by default) were never explicitly reviewed, revoked, or re-granted by any file in this repo, unlike every other function in this cluster which has an explicit revoke-then-grant block.
- **Flagging:** because no CLAUDE.md, migration, or comment anywhere in the repo acknowledges that these two are live and PostgREST-exposed, they are effectively **undocumented, unreviewed public API surface** — worth a follow-up decision (explicitly grant-and-document, or revoke from `anon`/`authenticated` if they were never meant to be callable over PostgREST) rather than leaving them as accidental extension-default exposure.

---

### Discrepancies

1. **`production/faculty_quality_production.sql` embeds a stale, pre-v11 copy of `universal_search`/`search_rank`/`normalize_search_text`.** This auto-generated bundle (header: "AUTO-GENERATED — FACULTY + CONTENT QUALITY PRODUCTION PACKAGE") concatenates `src/migrations/universal_search.sql` verbatim (confirmed by matching function bodies — `search_rank(normalize_search_text(...))` calls, not `search_rank_tokens(search_latin_key(...))`) as one of its dependency sections, around line 1468–1810. Ground truth confirms `search_rank_tokens` and `search_latin_key` are what's actually live today. If this package were ever re-applied to production as a unit (its own preflight only checks for table/RPC *existence*, not version), the `CREATE OR REPLACE` on `universal_search` inside it would silently regress the live function back to the non-sargable, single-token, no-Hinglish-bridge v1 behavior described as broken in `universal_search_v11.sql`'s own "WHAT WAS WRONG" section — while `search_latin_key_v11.sql`'s expression indexes and self-tests would still be sitting untouched (since that file isn't in the bundle), leaving a partially-inconsistent search stack. This file should either be regenerated against the current v11 lineage or clearly marked historical/do-not-reapply.

   **RESOLVED 31 July 2026:** a follow-up investigation found this was worse than "the committed file is stale" — `src/scripts/buildFacultyQualityProductionPackage.js` hardcoded `universal_search.sql` in its own source list, so re-running the build would have reproduced the exact same stale bundle, not healed it. Fixed the build script's source order (`search_latin_key_v11.sql` then `universal_search_v11.sql`, replacing `universal_search.sql`), regenerated `production/faculty_quality_production.sql` and `faculty_quality_production_wrapper_dry_run.sql` from it, and confirmed the regenerated bundle contains `word_similarity`/`search_rank_tokens` and zero occurrences of the old non-sargable `search_rank(normalize_search_text(...))` pattern. `src/facultyQualityProductionSource.test.js` (4 tests) passes against the new files.

2. **`src/migrations/universal_search_tests.sql` (STAGING ONLY) tests the pre-v11 contract.** It asserts behavior against `search_rank`/`normalize_search_text` tiers and states "Requires: schema.sql, universal_search.sql" — it contains no reference to `search_rank_tokens`, `search_latin_key`, or the multi-token/Hinglish behavior v11 added. Its fixtures and assertions (e.g. exact `search_rank` tier expectations) would not exercise, and could give false confidence about, the tier logic that's actually live in production (`search_rank_tokens`). Not a live-vs-repo mismatch in the ground-truth sense, but a staging test file that has not been kept in sync with the shipped implementation.

3. **`docs/backup_restore_readiness.md` disaster-recovery lineage predates v11.** Its documented restore-drill apply order (line ~148) lists `universal_search.sql` (the v1 file) as the search-related step, with no mention of `search_latin_key_v11.sql` / `universal_search_v11.sql`. Since `search_v11_2026-07-30.sql`'s filename dates it to today, this is most likely just temporally superseded rather than contradictory — but as written, following that document's lineage today would reconstruct a database missing `search_rank_tokens`, `translit_devanagari`, and `search_latin_key` entirely, which ground truth shows are live. The restore doc needs its lineage step list updated to include the v11 files (in dependency order: `search_latin_key_v11.sql` before `universal_search_v11.sql`, per that file's own preflight check).

   **RESOLVED 31 July 2026:** the two apply-order lists in `docs/backup_restore_readiness.md` are dated, hash-verified historical records of what was actually applied on 27 July — editing them to retroactively insert v11 would falsify that record, not fix it. Instead added a dated addendum at the end of the document explaining the gap and stating explicitly what a *future* from-scratch restore must additionally apply (`docs/sql/search_v11_2026-07-30.sql`, or the two `src/migrations/` files it concatenates, immediately after the step where `universal_search.sql` is applied in the historical lists above).

4. **`show_limit()` / `show_trgm(text)` have no first-party source anywhere in the repo** (see above) — they are live only because `pg_trgm` is installed, not because any file in this repository defines or grants them.