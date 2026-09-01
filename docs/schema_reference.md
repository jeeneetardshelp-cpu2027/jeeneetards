# Production schema reference

**Generated 2026-09-01 from the migration baseline. GENERATED, NOT HAND-MAINTAINED —
re-derive it rather than editing a row.**

**Source:** [`supabase/migrations/20260831140005_production_baseline.sql`](../supabase/migrations/20260831140005_production_baseline.sql)
— the Supabase CLI baseline pulled from the live production database on 31 Aug 2026 and
recorded in the remote migration history. Every column, default, constraint, trigger, RLS
policy and function signature below was parsed out of that file, so this page is exactly
as accurate as the baseline and no more. It replaces the 2026-07-30 edition, which was
generated from a PostgREST spec, predated the forum, polls and study-material clusters
entirely, and had drifted into actively misleading.

**Counts in the baseline: 66 tables, 181 functions, 98 RLS policies.** RLS is enabled on
all 66 tables; 145 of the 181 functions are `SECURITY DEFINER`.

## How to keep this true

Schema truth is the ordered migration chain in `supabase/migrations/` — not this page, and
not the loose `.sql` files at the repo root, in `src/migrations/` or in `docs/sql/`, many of
which still carry stale "NOT applied to production" headers. Read
[`supabase/README.md`](../supabase/README.md) for the workflow: new schema ships as a new
timestamped migration applied with `npx supabase db push`, and the SQL Editor is read-only.

`npx supabase migration list` — not this page — is the authority on what is deployed.

**Applied after the baseline, so NOT described below:**

- `20260901120000_study_days.sql` — `public.study_days (user_id uuid, day date)`, PK
  `(user_id, day)`, FK to `auth.users` on delete cascade. Default-deny RLS, owner-only
  select/insert (`auth.uid() = user_id`), no `anon` access, explicit table grants. Server
  copy of the prep streak's study days so a streak survives sign-out. One row is one date:
  no lesson ids, titles, durations or times of day.

**Staged but not applied at generation time:**

- `20260901160000_universal_search_materials.sql` — re-emits `universal_search` with two
  extra group keys, `material` and `paper`. Until it is pushed, the live function returns
  the five groups listed under [Enum-like contracts](#enum-like-contracts).

## Contents

- [Catalogue & curriculum taxonomy](#catalogue--curriculum-taxonomy)
- [Community: accounts, ratings, reviews, reports](#community-accounts-ratings-reviews-reports)
- [Forum](#forum)
- [Polls](#polls)
- [Study materials](#study-materials)
- [Faculty](#faculty)
- [Progress & streaks](#progress--streaks)
- [Admin, audit & environment](#admin-audit--environment)
- [RPC functions](#rpc-functions)
- [Enum-like contracts](#enum-like-contracts)
- [Known quirks](#known-quirks)

---

## Tables

### Catalogue & curriculum taxonomy

23 tables: `institutes_channels`, `categories`, `subjects`, `chapters`, `topics`, `videos`, `playlists`, `playlist_videos`, `playlist_attributes`, `video_stats`, `boards`, `class_levels`, `learning_goals`, `category_learning_goals`, `chapter_class_levels`, `learning_goal_class_levels`, `learning_goal_topics`, `playlist_boards`, `playlist_class_levels`, `playlist_learning_goals`, `video_class_levels`, `video_learning_goals`, `video_topics`.

#### `institutes_channels`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `youtube_channel_id` | text | not null | — |
| `logo_url` | text | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `youtube_channel_id`

RLS on. Policies:
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `categories`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `name`, `slug`

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `subjects`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `name`, `slug`

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `chapters`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `subject_id` | bigint | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `subject_id, name`, `subject_id, slug`  
**FK** `subject_id` → `subjects.id` on delete cascade

RLS on. Policies:
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `topics`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `chapter_id` | bigint | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `chapter_id, name`, `chapter_id, slug`  
**FK** `chapter_id` → `chapters.id` on delete cascade

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `videos`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `youtube_video_id` | text | not null | — |
| `title` | text | not null | — |
| `description` | text | null | — |
| `channel_id` | bigint | not null | — |
| `category_id` | bigint | not null | — |
| `subject_id` | bigint | not null | — |
| `chapter_id` | bigint | null | — |
| `published_at` | date | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |
| `duration_seconds` | integer | null | — |
| `caption_status` | text | null | — |
| `embedding_status` | text | null | — |
| `last_verified_at` | timestamp with time zone | null | — |
| `source_title` | text | null | — |

**PK** `id`  
**Unique** `youtube_video_id`  
**FK** `category_id` → `categories.id` on delete restrict, `channel_id` → `institutes_channels.id` on delete restrict, `chapter_id` → `chapters.id` on delete set null, `subject_id` → `subjects.id` on delete restrict

**Triggers:** `trg_videos_updated_at` (before update → FOR EACH ROW EXECUTE FUNCTION set_updated_at())

RLS on. Policies:
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `playlists`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `title` | text | not null | — |
| `description` | text | null | — |
| `slug` | text | null | — |
| `channel_id` | bigint | not null | — |
| `category_id` | bigint | null | — |
| `subject_id` | bigint | null | — |
| `thumbnail_url` | text | null | — |
| `display_order` | integer | not null | `1000000` |
| `average_rating` | numeric(3,2) | not null | `0` |
| `ratings_count` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |
| `teacher` | text | null | — |
| `tags` | text[] | not null | `'{}'::text[]` |
| `youtube_playlist_id` | text | null | — |
| `class_levels` | text[] | not null | `'{}'::text[]` |
| `content_type` | text | null | — |
| `language` | text | null | — |
| `difficulty` | text | null | — |
| `last_verified_at` | timestamp with time zone | null | — |
| `audience_focus` | text | null | — |
| `view_count_total` | bigint | not null | `0` |
| `popularity_score` | numeric | not null | `0` |
| `stats_fetched_at` | timestamp with time zone | null | — |
| `source_title` | text | null | — |
| `source_title_changed` | boolean | not null | `false` |
| `title_review_status` | text | not null | `'pending'::text` |
| `faculty_credit_status` | text | not null | `'pending'::text` |

**PK** `id`  
**Unique** `slug`  
**FK** `category_id` → `categories.id` on delete set null, `channel_id` → `institutes_channels.id` on delete restrict, `subject_id` → `subjects.id` on delete set null

**Checks:**
- `playlists_content_type_check` — `(((content_type IS NULL) OR (content_type = ANY (ARRAY['full-course', 'one-shot', 'revision', 'pyq', 'practice']))))`
- `playlists_difficulty_check` — `(((difficulty IS NULL) OR (difficulty = ANY (ARRAY['beginner', 'intermediate', 'advanced']))))`
- `playlists_faculty_credit_status_check` — `((faculty_credit_status = ANY (ARRAY['pending', 'identified', 'team', 'unknown'])))`
- `playlists_language_check` — `(((language IS NULL) OR (language = ANY (ARRAY['hindi', 'english', 'hinglish']))))`
- `playlists_title_review_status_check` — `((title_review_status = ANY (ARRAY['pending', 'approved'])))`

**Triggers:** `trg_force_class_levels` (before insert or update → FOR EACH ROW EXECUTE FUNCTION force_derived_class_levels())

RLS on. Policies:
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `playlist_videos`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `playlist_id` | bigint | not null | — |
| `video_id` | bigint | not null | — |
| `position` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `playlist_id, video_id`  
**FK** `playlist_id` → `playlists.id` on delete cascade, `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `playlist_attributes`

| column | type | null | default |
| --- | --- | --- | --- |
| `playlist_id` | bigint | not null | — |
| `pacing` | text | null | — |
| `theory_percentage` | smallint | null | — |
| `prerequisites_level` | text | null | — |
| `completeness_status` | text | not null | `'unassessed'::text` |
| `best_for` | text | null | — |
| `review_status` | text | not null | `'proposed'::text` |
| `source` | text | not null | `'manual'::text` |
| `evidence_note` | text | null | — |
| `verified_by` | uuid | null | — |
| `verified_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `playlist_id`  
**FK** `playlist_id` → `playlists.id` on delete cascade, `verified_by` → `auth.users.id` on delete set null

**Checks:**
- `playlist_attributes_check` — `(((review_status <> 'verified') OR (verified_at IS NOT NULL)))`
- `playlist_attributes_completeness_status_check` — `((completeness_status = ANY (ARRAY['unassessed', 'partial', 'complete'])))`
- `playlist_attributes_pacing_check` — `(((pacing IS NULL) OR (pacing = ANY (ARRAY['slow', 'moderate', 'fast', 'crash-course']))))`
- `playlist_attributes_prerequisites_level_check` — `(((prerequisites_level IS NULL) OR (prerequisites_level = ANY (ARRAY['none', 'basic', 'intermediate', 'advanced']))))`
- `playlist_attributes_review_status_check` — `((review_status = ANY (ARRAY['proposed', 'verified', 'rejected'])))`
- `playlist_attributes_source_check` — `((source = ANY (ARRAY['manual', 'import', 'editorial-review'])))`
- `playlist_attributes_theory_percentage_check` — `(((theory_percentage IS NULL) OR ((theory_percentage >= 0) AND (theory_percentage <= 100))))`

**Triggers:** `trg_touch_playlist_attributes` (before update → FOR EACH ROW EXECUTE FUNCTION touch_playlist_attributes())

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `video_stats`

| column | type | null | default |
| --- | --- | --- | --- |
| `video_id` | bigint | not null | — |
| `view_count` | bigint | null | — |
| `like_count` | bigint | null | — |
| `views_per_day` | numeric | null | — |
| `popularity_score` | numeric | not null | `0` |
| `fetched_at` | timestamp with time zone | not null | `now()` |

**PK** `video_id`  
**FK** `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `public reads stats` — SELECT to `public`: `USING true`

#### `boards`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `name`, `slug`

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `class_levels`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `name`, `slug`

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `learning_goals`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `name` | text | not null | — |
| `slug` | text | not null | — |
| `display_order` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `name`, `slug`

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `category_learning_goals`

| column | type | null | default |
| --- | --- | --- | --- |
| `category_id` | bigint | not null | — |
| `learning_goal_id` | bigint | not null | — |

**PK** `category_id, learning_goal_id`  
**FK** `category_id` → `categories.id` on delete cascade, `learning_goal_id` → `learning_goals.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `chapter_class_levels`

| column | type | null | default |
| --- | --- | --- | --- |
| `chapter_id` | bigint | not null | — |
| `class_level_id` | bigint | not null | — |
| `source_url` | text | not null | — |
| `scope_note` | text | not null | — |
| `reviewed_on` | date | not null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `chapter_id, class_level_id`  
**FK** `chapter_id` → `chapters.id` on delete cascade, `class_level_id` → `class_levels.id` on delete cascade

RLS on. Policies:
  - `public read canonical chapter classes` — SELECT to `public`: `USING true`

#### `learning_goal_class_levels`

| column | type | null | default |
| --- | --- | --- | --- |
| `learning_goal_id` | bigint | not null | — |
| `class_level_id` | bigint | not null | — |

**PK** `learning_goal_id, class_level_id`  
**FK** `class_level_id` → `class_levels.id` on delete cascade, `learning_goal_id` → `learning_goals.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `learning_goal_topics`

| column | type | null | default |
| --- | --- | --- | --- |
| `learning_goal_id` | bigint | not null | — |
| `topic_id` | bigint | not null | — |
| `is_required` | boolean | not null | `true` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `learning_goal_id, topic_id`  
**FK** `learning_goal_id` → `learning_goals.id` on delete cascade, `topic_id` → `topics.id` on delete cascade

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `playlist_boards`

| column | type | null | default |
| --- | --- | --- | --- |
| `playlist_id` | bigint | not null | — |
| `board_id` | bigint | not null | — |

**PK** `playlist_id, board_id`  
**FK** `board_id` → `boards.id` on delete cascade, `playlist_id` → `playlists.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `playlist_class_levels`

| column | type | null | default |
| --- | --- | --- | --- |
| `playlist_id` | bigint | not null | — |
| `class_level_id` | bigint | not null | — |

**PK** `playlist_id, class_level_id`  
**FK** `class_level_id` → `class_levels.id` on delete cascade, `playlist_id` → `playlists.id` on delete cascade

**Triggers:** `trg_sync_pl_class_array` (after insert or delete → FOR EACH ROW EXECUTE FUNCTION sync_playlist_class_levels_array())

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `playlist_learning_goals`

| column | type | null | default |
| --- | --- | --- | --- |
| `playlist_id` | bigint | not null | — |
| `learning_goal_id` | bigint | not null | — |

**PK** `playlist_id, learning_goal_id`  
**FK** `learning_goal_id` → `learning_goals.id` on delete cascade, `playlist_id` → `playlists.id` on delete cascade

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `video_class_levels`

| column | type | null | default |
| --- | --- | --- | --- |
| `video_id` | bigint | not null | — |
| `class_level_id` | bigint | not null | — |

**PK** `video_id, class_level_id`  
**FK** `class_level_id` → `class_levels.id` on delete cascade, `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `video_learning_goals`

| column | type | null | default |
| --- | --- | --- | --- |
| `video_id` | bigint | not null | — |
| `learning_goal_id` | bigint | not null | — |

**PK** `video_id, learning_goal_id`  
**FK** `learning_goal_id` → `learning_goals.id` on delete cascade, `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `admin deletes` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admin inserts` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `public read` — SELECT to `public`: `USING true`

#### `video_topics`

| column | type | null | default |
| --- | --- | --- | --- |
| `video_id` | bigint | not null | — |
| `topic_id` | bigint | not null | — |
| `coverage_kind` | text | not null | `'theory'::text` |
| `review_status` | text | not null | `'proposed'::text` |
| `source` | text | not null | `'manual'::text` |
| `verified_by` | uuid | null | — |
| `verified_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `video_id, topic_id`  
**FK** `topic_id` → `topics.id` on delete cascade, `verified_by` → `auth.users.id` on delete set null, `video_id` → `videos.id` on delete cascade

**Checks:**
- `video_topics_check` — `(((review_status <> 'verified') OR (verified_at IS NOT NULL)))`
- `video_topics_coverage_kind_check` — `((coverage_kind = ANY (ARRAY['theory', 'practice', 'pyq', 'mixed'])))`
- `video_topics_review_status_check` — `((review_status = ANY (ARRAY['proposed', 'verified', 'rejected'])))`
- `video_topics_source_check` — `((source = ANY (ARRAY['manual', 'import', 'editorial-review'])))`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

---

### Community: accounts, ratings, reviews, reports

4 tables: `profiles`, `playlist_ratings`, `video_comments`, `content_reports`.

#### `profiles`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | uuid | not null | — |
| `username` | text | null | — |
| `full_name` | text | null | — |
| `avatar_url` | text | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `is_admin` | boolean | not null | `false` |

**PK** `id`  
**Unique** `username`  
**FK** `id` → `auth.users.id` on delete cascade

**Triggers:** `trg_forum_anonymize_profile` (before delete → FOR EACH ROW EXECUTE FUNCTION forum_anonymize_profile_content()); `trg_protect_profile_admin_flag` (before insert or update → FOR EACH ROW EXECUTE FUNCTION protect_profile_admin_flag())

RLS on. Policies:
  - `profiles are public` — SELECT to `public`: `USING true`
  - `user inserts own profile` — INSERT to `public`: `WITH CHECK (auth.uid() = id)`
  - `user updates own profile` — UPDATE to `public`: `USING (auth.uid() = id) / WITH CHECK (auth.uid() = id)`

#### `playlist_ratings`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `playlist_id` | bigint | not null | — |
| `user_id` | uuid | not null | — |
| `rating` | integer | not null | — |
| `review` | text | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |
| `clarity_rating` | integer | null | — |
| `question_rating` | integer | null | — |
| `difficulty` | text | null | — |
| `best_for` | text | null | — |
| `review_hidden` | boolean | not null | `false` |
| `review_hidden_at` | timestamp with time zone | null | — |
| `review_hidden_by` | uuid | null | — |

**PK** `id`  
**Unique** `playlist_id, user_id`  
**FK** `playlist_id` → `playlists.id` on delete cascade, `review_hidden_by` → `profiles.id` on delete set null, `user_id` → `profiles.id` on delete cascade

**Checks:**
- `playlist_ratings_rating_check` — `(((rating >= 1) AND (rating <= 5)))`
- `plr_best_for_check` — `(((best_for IS NULL) OR (best_for = ANY (ARRAY['first-learning', 'revision', 'practice']))))`
- `plr_clarity_range` — `(((clarity_rating IS NULL) OR ((clarity_rating >= 1) AND (clarity_rating <= 5))))`
- `plr_difficulty_check` — `(((difficulty IS NULL) OR (difficulty = ANY (ARRAY['beginner', 'moderate', 'advanced']))))`
- `plr_question_range` — `(((question_rating IS NULL) OR ((question_rating >= 1) AND (question_rating <= 5))))`
- `plr_review_length` — `(((review IS NULL) OR (char_length(review) <= 1000)))`

**Triggers:** `trg_enforce_rating_submission` (before insert or update → FOR EACH ROW EXECUTE FUNCTION enforce_rating_submission()); `trg_plratings_updated_at` (before update → FOR EACH ROW EXECUTE FUNCTION set_updated_at()); `trg_protect_review_moderation_columns` (before update → FOR EACH ROW EXECUTE FUNCTION protect_review_moderation_columns()); `trg_refresh_playlist_rating` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION refresh_playlist_rating())

RLS on. Policies:
  - `owner and admin read all ratings` — SELECT to `authenticated`: `USING ((auth.uid() = user_id) OR public.is_admin())`
  - `user deletes own rating` — DELETE to `public`: `USING (auth.uid() = user_id)`
  - `user inserts own rating` — INSERT to `public`: `WITH CHECK (auth.uid() = user_id)`
  - `user updates own rating` — UPDATE to `public`: `USING (auth.uid() = user_id) / WITH CHECK (auth.uid() = user_id)`
  - `visible ratings are public` — SELECT to `public`: `USING (review_hidden = false)`

#### `video_comments`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `video_id` | bigint | not null | — |
| `user_id` | uuid | not null | — |
| `parent_id` | bigint | null | — |
| `body` | text | not null | — |
| `timestamp_seconds` | integer | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `parent_id` → `video_comments.id` on delete cascade, `user_id` → `profiles.id` on delete cascade, `video_id` → `videos.id` on delete cascade

**Checks:**
- `video_comments_body_check` — `((char_length(body) > 0))`

**Triggers:** `trg_vcomments_updated_at` (before update → FOR EACH ROW EXECUTE FUNCTION set_updated_at())

RLS on. Policies:
  - `comments are public` — SELECT to `public`: `USING true`
  - `user deletes own comment` — DELETE to `public`: `USING (auth.uid() = user_id)`
  - `user inserts own comment` — INSERT to `public`: `WITH CHECK (auth.uid() = user_id)`
  - `user updates own comment` — UPDATE to `public`: `USING (auth.uid() = user_id) / WITH CHECK (auth.uid() = user_id)`

#### `content_reports`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `target_type` | text | not null | — |
| `target_id` | bigint | not null | — |
| `reason` | text | not null | — |
| `note` | text | null | — |
| `reporter_id` | uuid | null | — |
| `status` | text | not null | `'pending'::text` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `reporter_id` → `profiles.id` on delete set null

**Checks:**
- `content_reports_reason_check` — `((reason = ANY (ARRAY['broken', 'wrong-category', 'inappropriate', 'other'])))`
- `content_reports_status_check` — `((status = ANY (ARRAY['pending', 'reviewed', 'dismissed'])))`
- `content_reports_target_type_check` — `((target_type = ANY (ARRAY['video', 'playlist'])))`

**Triggers:** `trg_enforce_content_report_submission` (before insert → FOR EACH ROW EXECUTE FUNCTION enforce_content_report_submission())

RLS on. Policies:
  - `admin reads reports` — SELECT to `public`: `USING public.is_admin()`
  - `admin updates reports` — UPDATE to `public`: `USING public.is_admin() / WITH CHECK public.is_admin()`
  - `signed-in users report own` — INSERT to `authenticated`: `WITH CHECK ((auth.uid() IS NOT NULL) AND (reporter_id = auth.uid()))`

---

### Forum

13 tables: `forum_topics`, `forum_posts`, `forum_comments`, `forum_votes`, `forum_reports`, `forum_moderation_log`, `forum_suspensions`, `forum_beta_members`, `forum_settings`, `forum_install_state`, `forum_admin_transfer_state`, `forum_rate_events`, `forum_user_stats`.

#### `forum_topics`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `slug` | text | not null | — |
| `name` | text | not null | — |
| `description` | text | null | — |
| `kind` | text | not null | — |
| `display_order` | integer | not null | `1000` |
| `is_active` | boolean | not null | `false` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `slug`

**Checks:**
- `forum_topics_description_check` — `(((description IS NULL) OR (char_length(description) <= 240)))`
- `forum_topics_kind_check` — `((kind = ANY (ARRAY['academic', 'non_academic'])))`
- `forum_topics_name_check` — `(((char_length(btrim(name)) >= 2) AND (char_length(btrim(name)) <= 50)))`
- `forum_topics_slug_check` — `((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'))`

RLS on. Policies:
  - `forum admins inspect topics` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_posts`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `topic_id` | bigint | not null | — |
| `author_id` | uuid | null | — |
| `title` | text | not null | — |
| `body` | text | not null | — |
| `is_solved` | boolean | not null | `false` |
| `upvote_count` | integer | not null | `0` |
| `downvote_count` | integer | not null | `0` |
| `score` | integer | not null | `0` |
| `hot_rank` | double precision | not null | `0` |
| `comment_count` | integer | not null | `0` |
| `hidden_at` | timestamp with time zone | null | — |
| `hidden_by` | uuid | null | — |
| `hidden_reason` | text | null | — |
| `locked_at` | timestamp with time zone | null | — |
| `locked_by` | uuid | null | — |
| `deleted_at` | timestamp with time zone | null | — |
| `edited_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `author_id` → `profiles.id` on delete set null, `hidden_by` → `profiles.id` on delete set null, `locked_by` → `profiles.id` on delete set null, `topic_id` → `forum_topics.id` on delete restrict

**Checks:**
- `forum_posts_comment_count_check` — `((comment_count >= 0))`
- `forum_posts_downvote_count_check` — `((downvote_count >= 0))`
- `forum_posts_hidden_shape` — `(((hidden_at IS NOT NULL) OR ((hidden_by IS NULL) AND (hidden_reason IS NULL))))`
- `forum_posts_live_body` — `(((deleted_at IS NOT NULL) OR ((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 20000))))`
- `forum_posts_live_title` — `(((deleted_at IS NOT NULL) OR ((char_length(btrim(title)) >= 10) AND (char_length(btrim(title)) <= 300))))`
- `forum_posts_locked_shape` — `(((locked_at IS NOT NULL) OR (locked_by IS NULL)))`
- `forum_posts_score_matches_counts` — `((score = (upvote_count - downvote_count)))`
- `forum_posts_upvote_count_check` — `((upvote_count >= 0))`

**Triggers:** `trg_forum_post_stats` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION forum_apply_user_content_delta()); `trg_forum_prepare_post` (before insert or update → FOR EACH ROW EXECUTE FUNCTION forum_prepare_post())

RLS on. Policies:
  - `forum admins inspect posts` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_comments`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `post_id` | bigint | not null | — |
| `author_id` | uuid | null | — |
| `parent_id` | bigint | null | — |
| `body` | text | not null | — |
| `depth` | integer | not null | `0` |
| `upvote_count` | integer | not null | `0` |
| `downvote_count` | integer | not null | `0` |
| `score` | integer | not null | `0` |
| `hidden_at` | timestamp with time zone | null | — |
| `hidden_by` | uuid | null | — |
| `hidden_reason` | text | null | — |
| `deleted_at` | timestamp with time zone | null | — |
| `edited_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `id, post_id`  
**FK** `author_id` → `profiles.id` on delete set null, `hidden_by` → `profiles.id` on delete set null, `parent_id, post_id` → `forum_comments.id, post_id` on delete cascade, `post_id` → `forum_posts.id` on delete cascade

**Checks:**
- `forum_comments_depth_check` — `(((depth >= 0) AND (depth <= 10)))`
- `forum_comments_downvote_count_check` — `((downvote_count >= 0))`
- `forum_comments_hidden_shape` — `(((hidden_at IS NOT NULL) OR ((hidden_by IS NULL) AND (hidden_reason IS NULL))))`
- `forum_comments_live_body` — `(((deleted_at IS NOT NULL) OR ((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 10000))))`
- `forum_comments_score_matches_counts` — `((score = (upvote_count - downvote_count)))`
- `forum_comments_upvote_count_check` — `((upvote_count >= 0))`

**Triggers:** `trg_forum_comment_count` (after insert or delete → FOR EACH ROW EXECUTE FUNCTION forum_apply_comment_count_delta()); `trg_forum_comment_stats` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION forum_apply_user_content_delta()); `trg_forum_prepare_comment` (before insert or update → FOR EACH ROW EXECUTE FUNCTION forum_prepare_comment())

RLS on. Policies:
  - `forum admins inspect comments` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_votes`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `voter_id` | uuid | not null | — |
| `target_author_id` | uuid | null | — |
| `post_id` | bigint | null | — |
| `comment_id` | bigint | null | — |
| `value` | smallint | not null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `comment_id` → `forum_comments.id` on delete cascade, `post_id` → `forum_posts.id` on delete cascade, `target_author_id` → `profiles.id` on delete set null, `voter_id` → `profiles.id` on delete cascade

**Checks:**
- `forum_votes_exactly_one_target` — `((((post_id IS NOT NULL) AND (comment_id IS NULL)) OR ((post_id IS NULL) AND (comment_id IS NOT NULL))))`
- `forum_votes_value_check` — `((value = ANY (ARRAY['-1'::integer, 1])))`

**Triggers:** `trg_forum_prepare_vote` (before insert or update → FOR EACH ROW EXECUTE FUNCTION forum_prepare_vote()); `trg_forum_vote_delta` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION forum_apply_vote_delta())

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `forum_reports`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `reporter_id` | uuid | null | — |
| `target_type` | text | not null | — |
| `target_id` | bigint | not null | — |
| `reason` | text | not null | — |
| `note` | text | null | — |
| `priority` | text | not null | `'normal'::text` |
| `status` | text | not null | `'pending'::text` |
| `resolved_at` | timestamp with time zone | null | — |
| `resolved_by` | uuid | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `reporter_id` → `profiles.id` on delete set null, `resolved_by` → `profiles.id` on delete set null

**Checks:**
- `forum_reports_note_check` — `(((note IS NULL) OR (char_length(note) <= 1000)))`
- `forum_reports_priority_check` — `((priority = ANY (ARRAY['normal', 'urgent'])))`
- `forum_reports_reason_check` — `((reason = ANY (ARRAY['spam', 'abuse_or_bullying', 'personal_information', 'sexual_content', 'self_harm', 'wrong_or_unsafe_advice', 'off_topic', 'other'])))`
- `forum_reports_resolution_shape` — `((((status = 'pending') AND (resolved_at IS NULL) AND (resolved_by IS NULL)) OR ((status <> 'pending') AND (resolved_at IS NOT NULL))))`
- `forum_reports_status_check` — `((status = ANY (ARRAY['pending', 'reviewed', 'dismissed'])))`
- `forum_reports_target_type_check` — `((target_type = ANY (ARRAY['post', 'comment'])))`

RLS on. Policies:
  - `forum admins inspect reports` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_moderation_log`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `actor_id` | uuid | null | — |
| `action` | text | not null | — |
| `target_type` | text | not null | — |
| `target_id` | bigint | null | — |
| `target_user_id` | uuid | null | — |
| `reason` | text | null | — |
| `report_id` | bigint | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `actor_id` → `profiles.id` on delete set null, `report_id` → `forum_reports.id` on delete set null, `target_user_id` → `profiles.id` on delete set null

**Checks:**
- `forum_moderation_log_action_check` — `((action = ANY (ARRAY['hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve', 'auto_hide', 'suspend', 'unsuspend', 'set_mode', 'beta_add', 'beta_remove'])))`
- `forum_moderation_log_target_type_check` — `((target_type = ANY (ARRAY['post', 'comment', 'user', 'forum'])))`
- `forum_moderation_remove_reason` — `(((action <> 'remove') OR (char_length(btrim(COALESCE(reason, ''))) >= 3)))`

RLS on. Policies:
  - `forum admins inspect moderation log` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_suspensions`

| column | type | null | default |
| --- | --- | --- | --- |
| `user_id` | uuid | not null | — |
| `suspended_until` | timestamp with time zone | not null | — |
| `reason` | text | not null | — |
| `created_by` | uuid | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `user_id`  
**FK** `created_by` → `profiles.id` on delete set null, `user_id` → `profiles.id` on delete cascade

**Checks:**
- `forum_suspensions_check` — `((suspended_until > created_at))`
- `forum_suspensions_reason_check` — `(((char_length(btrim(reason)) >= 3) AND (char_length(btrim(reason)) <= 500)))`

RLS on. Policies:
  - `forum admins inspect suspensions` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_beta_members`

| column | type | null | default |
| --- | --- | --- | --- |
| `user_id` | uuid | not null | — |
| `added_at` | timestamp with time zone | not null | `now()` |
| `added_by` | uuid | null | — |

**PK** `user_id`  
**FK** `added_by` → `profiles.id` on delete set null, `user_id` → `profiles.id` on delete cascade

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `forum_settings`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | boolean | not null | `true` |
| `mode` | text | not null | `'off'::text` |
| `updated_at` | timestamp with time zone | not null | `now()` |
| `updated_by` | uuid | null | — |

**PK** `id`  
**FK** `updated_by` → `profiles.id` on delete set null

**Checks:**
- `forum_settings_id_check` — `(id)`
- `forum_settings_mode_check` — `((mode = ANY (ARRAY['off', 'read_only', 'beta', 'open'])))`

RLS on. Policies:
  - `forum admins inspect settings` — SELECT to `authenticated`: `USING public.is_admin()`

#### `forum_install_state`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | boolean | not null | `true` |
| `installed_at` | timestamp with time zone | not null | `now()` |
| `baseline_username_fingerprint` | text | not null | — |
| `installed_topic_fingerprint` | text | not null | — |
| `anon_insert_table` | boolean | not null | — |
| `anon_update_table` | boolean | not null | — |
| `authenticated_insert_table` | boolean | not null | — |
| `authenticated_update_table` | boolean | not null | — |
| `anon_insert_columns` | text[] | not null | — |
| `anon_update_columns` | text[] | not null | — |
| `authenticated_insert_columns` | text[] | not null | — |
| `authenticated_update_columns` | text[] | not null | — |

**PK** `id`

**Checks:**
- `forum_install_state_id_check` — `(id)`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `forum_admin_transfer_state`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | boolean | not null | `true` |
| `previous_admin_id` | uuid | not null | — |
| `target_admin_id` | uuid | not null | — |
| `transferred_at` | timestamp with time zone | not null | `now()` |
| `rolled_back_at` | timestamp with time zone | null | — |

**PK** `id`

**Checks:**
- `forum_admin_transfer_state_check` — `((previous_admin_id <> target_admin_id))`
- `forum_admin_transfer_state_id_check` — `(id)`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `forum_rate_events`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `user_id` | uuid | not null | — |
| `action` | text | not null | — |
| `target_id` | bigint | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `user_id` → `profiles.id` on delete cascade

**Checks:**
- `forum_rate_events_action_check` — `((action = ANY (ARRAY['post', 'comment', 'edit_post', 'edit_comment', 'vote', 'report'])))`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

#### `forum_user_stats`

| column | type | null | default |
| --- | --- | --- | --- |
| `user_id` | uuid | not null | — |
| `karma` | integer | not null | `0` |
| `post_count` | integer | not null | `0` |
| `comment_count` | integer | not null | `0` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `user_id`  
**FK** `user_id` → `profiles.id` on delete cascade

**Checks:**
- `forum_user_stats_comment_count_check` — `((comment_count >= 0))`
- `forum_user_stats_post_count_check` — `((post_count >= 0))`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

---

### Polls

8 tables: `polls`, `poll_options`, `poll_votes`, `poll_comments`, `poll_reports`, `poll_settings`, `poll_image_hosts`, `poll_rate_events`.

#### `polls`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `slug` | text | not null | — |
| `topic_id` | bigint | not null | — |
| `question` | text | not null | — |
| `detail` | text | null | — |
| `status` | text | not null | `'pending'::text` |
| `author_id` | uuid | null | — |
| `review_note` | text | null | — |
| `reviewed_by` | uuid | null | — |
| `reviewed_at` | timestamp with time zone | null | — |
| `published_at` | timestamp with time zone | null | — |
| `closes_at` | timestamp with time zone | null | — |
| `vote_count` | integer | not null | `0` |
| `comment_count` | integer | not null | `0` |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `slug`  
**FK** `author_id` → `profiles.id` on delete set null, `reviewed_by` → `profiles.id` on delete set null, `topic_id` → `forum_topics.id` on delete restrict

**Checks:**
- `polls_check` — `(((status <> ALL (ARRAY['live', 'closed'])) OR ((reviewed_at IS NOT NULL) AND (published_at IS NOT NULL))))`
- `polls_check1` — `(((closes_at IS NULL) OR (published_at IS NULL) OR (closes_at > published_at)))`
- `polls_comment_count_check` — `((comment_count >= 0))`
- `polls_detail_check` — `(((detail IS NULL) OR (char_length(btrim(detail)) <= 600)))`
- `polls_question_check` — `(((char_length(btrim(question)) >= 10) AND (char_length(btrim(question)) <= 160)))`
- `polls_review_note_check` — `(((review_note IS NULL) OR (char_length(btrim(review_note)) <= 500)))`
- `polls_slug_check` — `((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'))`
- `polls_status_check` — `((status = ANY (ARRAY['pending', 'live', 'rejected', 'closed', 'hidden'])))`
- `polls_vote_count_check` — `((vote_count >= 0))`

**Triggers:** `polls_touch_updated_at` (before update → FOR EACH ROW EXECUTE FUNCTION poll_touch_updated_at())

RLS on. Policies:
  - `poll admins inspect polls` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_options`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `poll_id` | bigint | not null | — |
| `position` | smallint | not null | — |
| `label` | text | not null | — |
| `image_url` | text | null | — |
| `vote_count` | integer | not null | `0` |

**PK** `id`  
**Unique** `poll_id, position`  
**FK** `poll_id` → `polls.id` on delete cascade

**Checks:**
- `poll_options_image_url_check` — `(((image_url IS NULL) OR (image_url ~ '^https://[a-z0-9.-]+/')))`
- `poll_options_label_check` — `(((char_length(btrim(label)) >= 1) AND (char_length(btrim(label)) <= 80)))`
- `poll_options_position_check` — `(((position >= 1) AND (position <= 6)))`
- `poll_options_vote_count_check` — `((vote_count >= 0))`

RLS on. Policies:
  - `poll admins inspect options` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_votes`

| column | type | null | default |
| --- | --- | --- | --- |
| `poll_id` | bigint | not null | — |
| `voter_id` | uuid | not null | — |
| `option_id` | bigint | not null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `poll_id, voter_id`  
**FK** `option_id` → `poll_options.id` on delete cascade, `poll_id` → `polls.id` on delete cascade, `voter_id` → `profiles.id` on delete cascade

**Triggers:** `poll_votes_apply_delta` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION poll_apply_vote_delta())

RLS on. Policies:
  - `poll admins inspect votes` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_comments`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `poll_id` | bigint | not null | — |
| `author_id` | uuid | null | — |
| `body` | text | not null | — |
| `is_removed` | boolean | not null | `false` |
| `removed_by` | uuid | null | — |
| `removed_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `edited_at` | timestamp with time zone | null | — |

**PK** `id`  
**FK** `author_id` → `profiles.id` on delete set null, `poll_id` → `polls.id` on delete cascade, `removed_by` → `profiles.id` on delete set null

**Checks:**
- `poll_comments_body_check` — `(((char_length(btrim(body)) >= 2) AND (char_length(btrim(body)) <= 1500)))`

**Triggers:** `poll_comments_apply_delta` (after insert or delete or update → FOR EACH ROW EXECUTE FUNCTION poll_apply_comment_delta())

RLS on. Policies:
  - `poll admins inspect comments` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_reports`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `target_type` | text | not null | — |
| `poll_id` | bigint | null | — |
| `comment_id` | bigint | null | — |
| `reporter_id` | uuid | not null | — |
| `reason` | text | not null | — |
| `detail` | text | null | — |
| `status` | text | not null | `'open'::text` |
| `created_at` | timestamp with time zone | not null | `now()` |
| `resolved_by` | uuid | null | — |
| `resolved_at` | timestamp with time zone | null | — |

**PK** `id`  
**FK** `comment_id` → `poll_comments.id` on delete cascade, `poll_id` → `polls.id` on delete cascade, `reporter_id` → `profiles.id` on delete cascade, `resolved_by` → `profiles.id` on delete set null

**Checks:**
- `poll_reports_check` — `((((target_type = 'poll') AND (poll_id IS NOT NULL) AND (comment_id IS NULL)) OR ((target_type = 'comment') AND (comment_id IS NOT NULL) AND (poll_id IS NULL))))`
- `poll_reports_detail_check` — `(((detail IS NULL) OR (char_length(btrim(detail)) <= 500)))`
- `poll_reports_reason_check` — `((reason = ANY (ARRAY['spam', 'abuse', 'personal_information', 'off_topic', 'misinformation', 'other'])))`
- `poll_reports_status_check` — `((status = ANY (ARRAY['open', 'actioned', 'dismissed'])))`
- `poll_reports_target_type_check` — `((target_type = ANY (ARRAY['poll', 'comment'])))`

RLS on. Policies:
  - `poll admins inspect reports` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_settings`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | boolean | not null | `true` |
| `mode` | text | not null | `'off'::text` |
| `updated_at` | timestamp with time zone | not null | `now()` |
| `updated_by` | uuid | null | — |

**PK** `id`  
**FK** `updated_by` → `profiles.id` on delete set null

**Checks:**
- `poll_settings_id_check` — `(id)`
- `poll_settings_mode_check` — `((mode = ANY (ARRAY['off', 'read_only', 'open'])))`

RLS on. Policies:
  - `poll admins inspect settings` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_image_hosts`

| column | type | null | default |
| --- | --- | --- | --- |
| `host` | text | not null | — |
| `note` | text | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `host`

**Checks:**
- `poll_image_hosts_host_check` — `(((host = lower(host)) AND (host ~ '^[a-z0-9.-]+$')))`

RLS on. Policies:
  - `poll admins inspect image hosts` — SELECT to `authenticated`: `USING public.is_admin()`

#### `poll_rate_events`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `user_id` | uuid | not null | — |
| `action` | text | not null | — |
| `target_id` | bigint | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `user_id` → `profiles.id` on delete cascade

**Checks:**
- `poll_rate_events_action_check` — `((action = ANY (ARRAY['submit', 'vote', 'comment', 'report'])))`

RLS on, **no policy** — no `anon`/`authenticated` access at all; reachable only through `SECURITY DEFINER` RPCs and `service_role`.

---

### Study materials

3 tables: `study_materials`, `study_material_scopes`, `study_material_videos`.

#### `study_materials`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `title` | text | not null | — |
| `description` | text | null | — |
| `material_type` | text | not null | — |
| `source_name` | text | not null | — |
| `source_url` | text | not null | — |
| `preview_image_url` | text | null | — |
| `file_format` | text | not null | `'web'::text` |
| `language` | text | not null | `'English'::text` |
| `exam_year` | integer | null | — |
| `page_count` | integer | null | — |
| `is_downloadable` | boolean | not null | `false` |
| `rights_status` | text | not null | — |
| `rights_note` | text | null | — |
| `review_status` | text | not null | `'pending'::text` |
| `published_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `title, source_url`

**Checks:**
- `study_materials_description_length` — `(((description IS NULL) OR (char_length(description) <= 1000)))`
- `study_materials_exam_year_check` — `(((exam_year IS NULL) OR ((exam_year >= 2000) AND (exam_year <= 2100))))`
- `study_materials_file_format_check` — `((file_format = ANY (ARRAY['web', 'pdf'])))`
- `study_materials_https_preview` — `(((preview_image_url IS NULL) OR (preview_image_url ~ '^https://[^[:space:]]+$')))`
- `study_materials_https_source` — `((source_url ~ '^https://[^[:space:]]+$'))`
- `study_materials_language_check` — `((language = ANY (ARRAY['English', 'Hindi', 'Hinglish'])))`
- `study_materials_page_count_check` — `(((page_count IS NULL) OR (page_count > 0)))`
- `study_materials_publish_gate` — `((((review_status = 'approved') AND (published_at IS NOT NULL)) OR ((review_status <> 'approved') AND (published_at IS NULL))))`
- `study_materials_review_check` — `((review_status = ANY (ARRAY['pending', 'approved', 'rejected'])))`
- `study_materials_rights_check` — `((rights_status = ANY (ARRAY['official_source', 'open_license', 'creator_permission'])))`
- `study_materials_source_name_length` — `(((char_length(btrim(source_name)) >= 2) AND (char_length(btrim(source_name)) <= 120)))`
- `study_materials_title_length` — `(((char_length(btrim(title)) >= 3) AND (char_length(btrim(title)) <= 180)))`
- `study_materials_type_check` — `((material_type = ANY (ARRAY['short_notes', 'formula_sheet', 'full_notes', 'previous_year_paper'])))`

**Triggers:** `trg_study_material_updated_at` (before update → FOR EACH ROW EXECUTE FUNCTION touch_study_material_updated_at())

RLS on. Policies:
  - `admins delete` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admins insert` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `admins update` — UPDATE to `authenticated`: `USING public.is_admin() / WITH CHECK public.is_admin()`
  - `public reads approved study materials` — SELECT to `public`: `USING ((review_status = 'approved') AND (published_at <= now()))`

#### `study_material_scopes`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `material_id` | bigint | not null | — |
| `learning_goal_id` | bigint | null | — |
| `board_id` | bigint | null | — |
| `class_level_id` | bigint | null | — |
| `subject_id` | bigint | null | — |
| `chapter_id` | bigint | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `board_id` → `boards.id` on delete restrict, `chapter_id` → `chapters.id` on delete restrict, `class_level_id` → `class_levels.id` on delete restrict, `learning_goal_id` → `learning_goals.id` on delete restrict, `material_id` → `study_materials.id` on delete cascade, `subject_id` → `subjects.id` on delete restrict

**Checks:**
- `study_material_scopes_not_empty` — `(((learning_goal_id IS NOT NULL) OR (board_id IS NOT NULL) OR (class_level_id IS NOT NULL) OR (subject_id IS NOT NULL) OR (chapter_id IS NOT NULL)))`

**Triggers:** `trg_validate_study_material_scope` (before insert or update → FOR EACH ROW EXECUTE FUNCTION validate_study_material_scope())

RLS on. Policies:
  - `admins delete` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admins insert` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `admins update` — UPDATE to `authenticated`: `USING public.is_admin() / WITH CHECK public.is_admin()`
  - `public reads approved material scopes` — SELECT to `public`: `USING (EXISTS ( SELECT 1 FROM public.study_materials m WHERE ((m.id = study_material_scopes.material_id) AND (m.review_status = 'approved') AND (m.published_at <= now()))))`

#### `study_material_videos`

| column | type | null | default |
| --- | --- | --- | --- |
| `material_id` | bigint | not null | — |
| `video_id` | bigint | not null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `material_id, video_id`  
**FK** `material_id` → `study_materials.id` on delete cascade, `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `admins delete` — DELETE to `authenticated`: `USING public.is_admin()`
  - `admins insert` — INSERT to `authenticated`: `WITH CHECK public.is_admin()`
  - `admins update` — UPDATE to `authenticated`: `USING public.is_admin() / WITH CHECK public.is_admin()`
  - `public reads approved material videos` — SELECT to `public`: `USING (EXISTS ( SELECT 1 FROM public.study_materials m WHERE ((m.id = study_material_videos.material_id) AND (m.review_status = 'approved') AND (m.published_at <= now()))))`

---

### Faculty

9 tables: `teachers`, `teacher_aliases`, `teacher_institutes`, `teacher_subjects`, `teacher_learning_goals`, `teacher_name_proposals`, `teacher_proposal_decisions`, `playlist_teachers`, `video_teachers`.

#### `teachers`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `display_name` | text | not null | — |
| `canonical_name` | text | not null | — |
| `slug` | text | not null | — |
| `bio` | text | null | — |
| `photo_url` | text | null | — |
| `verified` | boolean | not null | `false` |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `slug`

**Triggers:** `trg_teacher_canonical` (before insert or update → FOR EACH ROW EXECUTE FUNCTION set_teacher_canonical())

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `teacher_aliases`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `teacher_id` | bigint | not null | — |
| `alias` | text | not null | — |
| `normalized_alias` | text | not null | — |
| `alias_type` | text | not null | `'nickname'::text` |
| `status` | text | not null | `'proposed'::text` |
| `source` | text | not null | `'manual'::text` |
| `created_by` | uuid | null | — |
| `verified_by` | uuid | null | — |
| `verified_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `teacher_id, normalized_alias`  
**FK** `created_by` → `auth.users.id` on delete set null, `teacher_id` → `teachers.id` on delete cascade, `verified_by` → `auth.users.id` on delete set null

**Checks:**
- `teacher_aliases_alias_type_check` — `((alias_type = ANY (ARRAY['full-name', 'short', 'initials', 'nickname', 'maiden', 'transliteration', 'misspelling'])))`
- `teacher_aliases_source_check` — `((source = ANY (ARRAY['manual', 'migrated', 'import', 'student-report'])))`
- `teacher_aliases_status_check` — `((status = ANY (ARRAY['proposed', 'verified', 'rejected'])))`

**Triggers:** `trg_alias_normalized` (before insert or update → FOR EACH ROW EXECUTE FUNCTION set_alias_normalized())

RLS on. Policies:
  - `admin read aliases` — SELECT to `authenticated`: `USING public.is_admin()`
  - `public read verified` — SELECT to `authenticated, anon`: `USING (status = 'verified')`

#### `teacher_institutes`

| column | type | null | default |
| --- | --- | --- | --- |
| `teacher_id` | bigint | not null | — |
| `institute_id` | bigint | not null | — |
| `is_primary` | boolean | not null | `false` |

**PK** `teacher_id, institute_id`  
**FK** `institute_id` → `institutes_channels.id` on delete cascade, `teacher_id` → `teachers.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `teacher_subjects`

| column | type | null | default |
| --- | --- | --- | --- |
| `teacher_id` | bigint | not null | — |
| `subject_id` | bigint | not null | — |

**PK** `teacher_id, subject_id`  
**FK** `subject_id` → `subjects.id` on delete cascade, `teacher_id` → `teachers.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `teacher_learning_goals`

| column | type | null | default |
| --- | --- | --- | --- |
| `teacher_id` | bigint | not null | — |
| `learning_goal_id` | bigint | not null | — |

**PK** `teacher_id, learning_goal_id`  
**FK** `learning_goal_id` → `learning_goals.id` on delete cascade, `teacher_id` → `teachers.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `teacher_name_proposals`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `raw_teacher` | text | not null | — |
| `normalized` | text | null | — |
| `occurrences` | integer | not null | `0` |
| `kind` | text | not null | — |
| `status` | text | not null | `'pending'::text` |
| `resolved_teacher_ids` | bigint[] | null | — |
| `note` | text | null | — |
| `reviewed_by` | uuid | null | — |
| `reviewed_at` | timestamp with time zone | null | — |
| `created_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `raw_teacher`  
**FK** `reviewed_by` → `auth.users.id` on delete set null

**Checks:**
- `teacher_name_proposals_kind_check` — `((kind = ANY (ARRAY['single', 'multi-person', 'organization-or-team', 'blank'])))`
- `teacher_name_proposals_status_check` — `((status = ANY (ARRAY['pending', 'approved-existing', 'approved-new', 'split', 'rejected', 'deferred'])))`

RLS on. Policies:
  - `admin read proposals` — SELECT to `public`: `USING public.is_admin()`

#### `teacher_proposal_decisions`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `proposal_id` | bigint | not null | — |
| `raw_teacher` | text | not null | — |
| `decision` | text | not null | — |
| `teacher_ids` | bigint[] | null | — |
| `note` | text | null | — |
| `decided_by` | uuid | null | — |
| `decided_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `decided_by` → `auth.users.id` on delete set null, `proposal_id` → `teacher_name_proposals.id` on delete restrict

**Checks:**
- `teacher_proposal_decisions_decision_check` — `((decision = ANY (ARRAY['approved-existing', 'approved-new', 'split', 'rejected', 'deferred'])))`

RLS on. Policies:
  - `admin read decisions` — SELECT to `public`: `USING public.is_admin()`

#### `playlist_teachers`

| column | type | null | default |
| --- | --- | --- | --- |
| `playlist_id` | bigint | not null | — |
| `teacher_id` | bigint | not null | — |
| `role` | text | not null | `'instructor'::text` |
| `position` | integer | not null | `1` |

**PK** `playlist_id, teacher_id`  
**FK** `playlist_id` → `playlists.id` on delete cascade, `teacher_id` → `teachers.id` on delete restrict

**Checks:**
- `playlist_teachers_role_check` — `((role = ANY (ARRAY['instructor', 'co-instructor', 'guest'])))`

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

#### `video_teachers`

| column | type | null | default |
| --- | --- | --- | --- |
| `video_id` | bigint | not null | — |
| `teacher_id` | bigint | not null | — |

**PK** `video_id, teacher_id`  
**FK** `teacher_id` → `teachers.id` on delete restrict, `video_id` → `videos.id` on delete cascade

RLS on. Policies:
  - `public read` — SELECT to `public`: `USING true`

---

### Progress & streaks

1 table: `video_progress`.

#### `video_progress`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `user_id` | uuid | not null | — |
| `playlist_id` | bigint | not null | — |
| `video_id` | bigint | not null | — |
| `chapter_id` | bigint | null | — |
| `position_seconds` | numeric | not null | `0` |
| `duration_seconds` | numeric | null | — |
| `watched` | boolean | not null | `false` |
| `updated_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `user_id, playlist_id, video_id`  
**FK** `chapter_id` → `chapters.id` on delete set null, `playlist_id` → `playlists.id` on delete cascade, `user_id` → `profiles.id` on delete cascade, `video_id` → `videos.id` on delete cascade

**Checks:**
- `video_progress_duration_seconds_check` — `(((duration_seconds IS NULL) OR (duration_seconds >= (0)::numeric)))`
- `video_progress_position_seconds_check` — `((position_seconds >= (0)::numeric))`

RLS on. Policies:
  - `user deletes own progress` — DELETE to `public`: `USING (auth.uid() = user_id)`
  - `user inserts own progress` — INSERT to `public`: `WITH CHECK (auth.uid() = user_id)`
  - `user reads own progress` — SELECT to `public`: `USING (auth.uid() = user_id)`
  - `user updates own progress` — UPDATE to `public`: `USING (auth.uid() = user_id) / WITH CHECK (auth.uid() = user_id)`

---

### Admin, audit & environment

5 tables: `app_environment`, `playlist_quality_reviews`, `catalog_management_audit`, `playlist_import_audit`, `class_levels_migration_audit`.

#### `app_environment`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | boolean | not null | `true` |
| `name` | text | not null | — |

**PK** `id`

**Checks:**
- `app_environment_id_check` — `(id)`
- `app_environment_name_check` — `((name = ANY (ARRAY['production', 'staging', 'test'])))`

RLS on. Policies:
  - `env readable` — SELECT to `public`: `USING true`

#### `playlist_quality_reviews`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `playlist_id` | bigint | not null | — |
| `before_state` | jsonb | not null | — |
| `after_state` | jsonb | not null | — |
| `note` | text | null | — |
| `reviewed_by` | uuid | null | — |
| `reviewed_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**FK** `playlist_id` → `playlists.id` on delete cascade, `reviewed_by` → `auth.users.id` on delete set null

RLS on. Policies:
  - `admin reads quality reviews` — SELECT to `authenticated`: `USING public.is_admin()`

#### `catalog_management_audit`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `action` | text | not null | — |
| `playlist_id` | bigint | null | — |
| `video_id` | bigint | null | — |
| `before_state` | jsonb | not null | — |
| `after_state` | jsonb | null | — |
| `actor_id` | uuid | null | — |
| `occurred_at` | timestamp with time zone | not null | `now()` |

**PK** `id`

**Checks:**
- `catalog_management_audit_action_check` — `((action = ANY (ARRAY['update-playlist', 'set-video-taxonomy', 'clear-video-taxonomy', 'reassign-video-chapter', 'delete-playlist'])))`

RLS on. Policies:
  - `admin reads catalog management audit` — SELECT to `authenticated`: `USING public.is_admin()`

#### `playlist_import_audit`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `request_id` | uuid | not null | — |
| `youtube_playlist_id` | text | not null | — |
| `playlist_id` | bigint | null | — |
| `request_payload` | jsonb | not null | — |
| `before_state` | jsonb | not null | — |
| `after_state` | jsonb | not null | — |
| `result` | jsonb | not null | — |
| `actor_id` | uuid | null | — |
| `occurred_at` | timestamp with time zone | not null | `now()` |

**PK** `id`  
**Unique** `request_id`  
**FK** `playlist_id` → `playlists.id` on delete set null

RLS on. Policies:
  - `admin reads playlist import audit` — SELECT to `authenticated`: `USING public.is_admin()`

#### `class_levels_migration_audit`

| column | type | null | default |
| --- | --- | --- | --- |
| `id` | bigint identity | not null | — |
| `playlist_id` | bigint | not null | — |
| `verdict` | text | not null | — |
| `array_labels` | text[] | null | — |
| `junction_labels` | text[] | null | — |
| `migrated_at` | timestamp with time zone | not null | `now()` |
| `run_id` | uuid | null | — |

**PK** `id`

RLS on. Policies:
  - `admin read audit` — SELECT to `public`: `USING public.is_admin()`

---

## RPC functions

All 181 functions in the baseline, grouped the way the tables are. `SECURITY DEFINER`
means the function runs as its owner and bypasses RLS — the body is the access check;
`invoker` means the caller's RLS applies. Every `SECURITY DEFINER` function in the
baseline pins `search_path`.

### Catalogue & browse — 16 functions

- `assert_playlist_video_channel(p_playlist_id bigint, p_video_id bigint)` — SECURITY DEFINER  
  → `void`
- `browse_facet_counts(p_goal text DEFAULT NULL::text, p_class text DEFAULT NULL::text, p_subject text DEFAULT NULL::text, p_chapter text DEFAULT NULL::text, p_channel bigint DEFAULT NULL::bigint, p_language text[] DEFAULT NULL::text[], p_type text[] DEFAULT NULL::text[], p_difficulty text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text)` — invoker  
  → `TABLE(facet text, value text, n bigint)`
- `chapter_matches_class_scope(p_chapter_id bigint, p_playlist_id bigint, p_class text)` — invoker  
  → `boolean`
- `class_label_to_slug(p_label text)` — invoker  
  → `text`
- `derived_class_levels(p_playlist_id bigint)` — SECURITY DEFINER  
  → `text[]`
- `force_derived_class_levels()` — SECURITY DEFINER  
  → `trigger`
- `get_browse_curriculum(p_goal text DEFAULT NULL::text, p_class text DEFAULT NULL::text, p_subject text DEFAULT NULL::text)` — invoker  
  → `TABLE(level text, entity_id bigint, slug text, name text, display_order integer, course_count bigint)`
- `get_chapter_champions(p_chapter bigint)` — SECURITY DEFINER  
  → `TABLE(playlist_id bigint, title text, teacher text, institute text, clarity_avg numeric, clarity_n integer, question_avg numeric, question_n integer)`
- `get_chapter_courses(p_chapter_id bigint)` — invoker  
  → `TABLE(playlist_id bigint, title text, teacher text, institute text, lectures bigint, average_rating numeric, ratings_count integer, tags text[], class_levels text[], content_type text, language text, difficulty text, total_duration_seconds bigint)`
- `get_playlist_comparison(p_playlist_ids bigint[], p_chapter_id bigint, p_learning_goal_id bigint DEFAULT NULL::bigint)` — SECURITY DEFINER  
  → `TABLE(requested_order integer, playlist_id bigint, course_status text, title text, teacher text, channel_title text, subject_title text, class_levels text[], language text, content_type text, difficulty text, chapter_lecture_count bigint, chapter_duration_seconds bigint, pacing text, theory_percentage smallint, prerequisites_level text, completeness_status text, best_for text, metadata_verified_at timestamp with time zone, coverage_mapped_topics bigint, coverage_required_topics bigint, syllabus_coverage_pct numeric, average_rating numeric, ratings_count integer, last_verified_at timestamp with time zone)`
- `playlist_channel_still_matches()` — SECURITY DEFINER  
  → `trigger`
- `playlist_video_channel_matches()` — SECURITY DEFINER  
  → `trigger`
- `set_updated_at()` — invoker  
  → `trigger`
- `sync_playlist_class_levels_array()` — SECURITY DEFINER  
  → `trigger`
- `touch_playlist_attributes()` — invoker, internal only — no role holds EXECUTE  
  → `trigger`
- `video_channel_still_matches()` — SECURITY DEFINER  
  → `trigger`

### Search — 11 functions

- `normalize_search_text(p_text text)` — invoker  
  → `text`
- `search_filler_tokens()` — invoker  
  → `text[]`
- `search_latin_key(p_text text)` — invoker  
  → `text`
- `search_playlist_ids(p_query text)` — invoker  
  → `TABLE(id bigint)`
- `search_query_tokens(p_query text)` — invoker  
  → `TABLE(qlen integer, q text, q_tokens text[], q_long text)`
- `search_rank(p_haystack text, p_needle text)` — invoker  
  → `integer`
- `search_rank_tokens(p_haystack text, p_tokens text[], p_needle text)` — invoker  
  → `integer`
- `search_singular(p_tok text)` — invoker  
  → `text`
- `search_video_ids(p_query text)` — invoker  
  → `TABLE(id bigint)`
- `translit_devanagari(p_text text)` — invoker  
  → `text`
- `universal_search(p_query text, p_types text[] DEFAULT NULL::text[], p_limit integer DEFAULT 5, p_offset integer DEFAULT 0)` — invoker  
  → `TABLE(group_key text, entity_id bigint, title text, subtitle text, aka text, slug text, match_type text, match_rank integer, matched_on text, is_ambiguous boolean, group_total bigint, extra jsonb)`

### Community: ratings, reviews, reports, accounts — 8 functions

- `admin_list_reviews()` — SECURITY DEFINER  
  → `TABLE(id bigint, playlist_id bigint, playlist_title text, user_id uuid, rating integer, review text, review_hidden boolean, review_hidden_at timestamp with time zone, created_at timestamp with time zone)`
- `admin_set_review_hidden(p_rating_id bigint, p_hidden boolean)` — SECURITY DEFINER  
  → `void`
- `enforce_content_report_submission()` — SECURITY DEFINER  
  → `trigger`
- `enforce_rating_submission()` — SECURITY DEFINER  
  → `trigger`
- `handle_new_user()` — SECURITY DEFINER  
  → `trigger`
- `protect_profile_admin_flag()` — SECURITY DEFINER  
  → `trigger`
- `protect_review_moderation_columns()` — SECURITY DEFINER  
  → `trigger`
- `refresh_playlist_rating()` — SECURITY DEFINER  
  → `trigger`

### Forum — 42 functions

- `forum_adjust_karma(p_author uuid, p_delta integer)` — SECURITY DEFINER  
  → `void`
- `forum_admin_dismiss_report(p_report_id bigint)` — SECURITY DEFINER  
  → `void`
- `forum_admin_list_beta_members()` — SECURITY DEFINER  
  → `TABLE(username text, added_at timestamp with time zone, added_by_username text)`
- `forum_admin_list_reports(p_limit integer DEFAULT 100)` — SECURITY DEFINER  
  → `TABLE(id bigint, reporter_id uuid, target_type text, target_id bigint, reason text, note text, priority text, status text, created_at timestamp with time zone, post_id bigint, topic_slug text, post_title text, target_author_username text, content_preview text, target_exists boolean, target_is_hidden boolean, target_is_deleted boolean, post_is_locked boolean)`
- `forum_admin_list_suspensions()` — SECURITY DEFINER  
  → `TABLE(username text, suspended_until timestamp with time zone, reason text, created_at timestamp with time zone, created_by_username text, is_active boolean)`
- `forum_admin_moderate(p_target_type text, p_target_id bigint, p_action text, p_reason text DEFAULT NULL::text, p_report_id bigint DEFAULT NULL::bigint)` — SECURITY DEFINER  
  → `void`
- `forum_admin_set_beta_member(p_username text, p_enabled boolean)` — SECURITY DEFINER  
  → `boolean`
- `forum_admin_set_mode(p_mode text)` — SECURITY DEFINER  
  → `text`
- `forum_admin_set_suspension(p_user_id uuid, p_suspended_until timestamp with time zone, p_reason text)` — SECURITY DEFINER  
  → `void`
- `forum_admin_set_suspension_by_username(p_username text, p_days integer, p_reason text)` — SECURITY DEFINER  
  → `TABLE(username text, suspended_until timestamp with time zone, reason text)`
- `forum_anonymize_profile_content()` — SECURITY DEFINER  
  → `trigger`
- `forum_apply_comment_count_delta()` — SECURITY DEFINER  
  → `trigger`
- `forum_apply_user_content_delta()` — SECURITY DEFINER  
  → `trigger`
- `forum_apply_vote_delta()` — SECURITY DEFINER  
  → `trigger`
- `forum_cast_vote(p_target_type text, p_target_id bigint, p_value smallint)` — SECURITY DEFINER  
  → `TABLE(viewer_vote smallint, score integer, upvote_count integer, downvote_count integer)`
- `forum_claim_username(p_username text)` — SECURITY DEFINER  
  → `text`
- `forum_create_comment(p_post_id bigint, p_parent_id bigint, p_body text)` — SECURITY DEFINER  
  → `bigint`
- `forum_create_post(p_topic_slug text, p_title text, p_body text)` — SECURITY DEFINER  
  → `bigint`
- `forum_delete_comment(p_comment_id bigint)` — SECURITY DEFINER  
  → `void`
- `forum_delete_post(p_post_id bigint)` — SECURITY DEFINER  
  → `void`
- `forum_edit_comment(p_comment_id bigint, p_body text)` — SECURITY DEFINER  
  → `void`
- `forum_edit_post(p_post_id bigint, p_title text, p_body text)` — SECURITY DEFINER  
  → `void`
- `forum_get_my_identity()` — SECURITY DEFINER  
  → `TABLE(username text, needs_username boolean)`
- `forum_hot_rank(p_score integer, p_created_at timestamp with time zone)` — invoker  
  → `double precision`
- `forum_is_beta_member()` — SECURITY DEFINER  
  → `boolean`
- `forum_mode()` — SECURITY DEFINER  
  → `text`
- `forum_prepare_comment()` — SECURITY DEFINER  
  → `trigger`
- `forum_prepare_post()` — SECURITY DEFINER  
  → `trigger`
- `forum_prepare_vote()` — SECURITY DEFINER  
  → `trigger`
- `forum_record_rate_event(p_user_id uuid, p_action text, p_target_id bigint, p_hour_limit integer, p_day_limit integer DEFAULT NULL::integer)` — SECURITY DEFINER  
  → `void`
- `forum_recount_karma(p_apply boolean DEFAULT false)` — SECURITY DEFINER  
  → `TABLE(user_id uuid, stored_karma integer, actual_karma integer)`
- `forum_recount_metrics(p_apply boolean DEFAULT false)` — SECURITY DEFINER  
  → `TABLE(target_type text, target_id bigint, stored_score integer, actual_score integer, stored_upvotes integer, actual_upvotes integer, stored_downvotes integer, actual_downvotes integer)`
- `forum_require_open()` — SECURITY DEFINER  
  → `void`
- `forum_require_reporter()` — SECURITY DEFINER  
  → `uuid`
- `forum_require_writer()` — SECURITY DEFINER  
  → `uuid`
- `forum_submit_report(p_target_type text, p_target_id bigint, p_reason text, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `bigint`
- `forum_toggle_solved(p_post_id bigint)` — SECURITY DEFINER  
  → `boolean`
- `forum_username_is_allowed(p_username text)` — SECURITY DEFINER  
  → `boolean`
- `get_forum_comments(p_post_id bigint)` — SECURITY DEFINER  
  → `TABLE(id bigint, post_id bigint, parent_id bigint, depth integer, author_username text, body text, is_tombstone boolean, score integer, upvote_count integer, downvote_count integer, viewer_vote smallint, created_at timestamp with time zone, edited_at timestamp with time zone)`
- `get_forum_feed(p_sort text DEFAULT 'hot'::text, p_topic_slug text DEFAULT NULL::text, p_query text DEFAULT NULL::text, p_cursor_hot double precision DEFAULT NULL::double precision, p_cursor_score integer DEFAULT NULL::integer, p_cursor_created_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 25)` — SECURITY DEFINER  
  → `TABLE(id bigint, topic_slug text, topic_name text, author_username text, title text, body_preview text, is_solved boolean, score integer, upvote_count integer, downvote_count integer, comment_count integer, viewer_vote smallint, hot_rank double precision, created_at timestamp with time zone, edited_at timestamp with time zone)`
- `get_forum_post(p_post_id bigint)` — SECURITY DEFINER  
  → `TABLE(id bigint, topic_slug text, topic_name text, author_username text, title text, body text, is_solved boolean, is_locked boolean, is_deleted boolean, score integer, upvote_count integer, downvote_count integer, comment_count integer, viewer_vote smallint, created_at timestamp with time zone, edited_at timestamp with time zone)`
- `get_forum_topics()` — SECURITY DEFINER  
  → `TABLE(id bigint, slug text, name text, description text, kind text, display_order integer)`

### Polls — 36 functions

- `get_my_poll_submissions()` — SECURITY DEFINER  
  → `TABLE(id bigint, slug text, question text, status text, review_note text, created_at timestamp with time zone, reviewed_at timestamp with time zone)`
- `get_poll(p_slug text)` — SECURITY DEFINER  
  → `TABLE(id bigint, slug text, question text, detail text, topic_slug text, topic_name text, author_username text, status text, published_at timestamp with time zone, closes_at timestamp with time zone, vote_count integer, comment_count integer, viewer_option_id bigint, results_visible boolean, can_vote boolean, options jsonb)`
- `get_poll_comments(p_poll_id bigint, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)` — SECURITY DEFINER  
  → `TABLE(id bigint, author_username text, body text, created_at timestamp with time zone, edited_at timestamp with time zone, is_mine boolean)`
- `get_poll_topics()` — SECURITY DEFINER  
  → `TABLE(slug text, name text, kind text, description text)`
- `get_polls_feed(p_sort text DEFAULT 'new'::text, p_topic_slug text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)` — SECURITY DEFINER  
  → `TABLE(id bigint, slug text, question text, detail text, topic_slug text, topic_name text, author_username text, status text, published_at timestamp with time zone, closes_at timestamp with time zone, vote_count integer, comment_count integer, viewer_option_id bigint, results_visible boolean, options jsonb)`
- `poll_add_comment(p_poll_id bigint, p_body text)` — SECURITY DEFINER  
  → `bigint`
- `poll_admin_close_expired()` — SECURITY DEFINER  
  → `TABLE(id bigint, question text, closed_at timestamp with time zone)`
- `poll_admin_list_pending(p_limit integer DEFAULT 50)` — SECURITY DEFINER  
  → `TABLE(id bigint, slug text, question text, detail text, topic_slug text, topic_name text, author_username text, created_at timestamp with time zone, options jsonb)`
- `poll_admin_list_reports(p_limit integer DEFAULT 100)` — SECURITY DEFINER  
  → `TABLE(id bigint, target_type text, poll_id bigint, poll_slug text, poll_question text, comment_id bigint, comment_body text, comment_removed boolean, reporter_username text, reason text, detail text, status text, created_at timestamp with time zone)`
- `poll_admin_resolve_report(p_report_id bigint, p_status text)` — SECURITY DEFINER  
  → `void`
- `poll_admin_review(p_poll_id bigint, p_decision text, p_note text DEFAULT NULL::text, p_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)` — SECURITY DEFINER  
  → `text`
- `poll_admin_set_comment_removed(p_comment_id bigint, p_removed boolean)` — SECURITY DEFINER  
  → `void`
- `poll_admin_set_mode(p_mode text)` — SECURITY DEFINER  
  → `text`
- `poll_admin_set_option_image(p_option_id bigint, p_image_url text)` — SECURITY DEFINER  
  → `void`
- `poll_admin_set_status(p_poll_id bigint, p_status text)` — SECURITY DEFINER  
  → `text`
- `poll_apply_comment_delta()` — SECURITY DEFINER  
  → `trigger`
- `poll_apply_vote_delta()` — SECURITY DEFINER  
  → `trigger`
- `poll_cast_vote(p_poll_id bigint, p_option_id bigint)` — SECURITY DEFINER  
  → `void`
- `poll_clear_vote(p_poll_id bigint)` — SECURITY DEFINER  
  → `void`
- `poll_delete_comment(p_comment_id bigint)` — SECURITY DEFINER  
  → `void`
- `poll_edit_comment(p_comment_id bigint, p_body text)` — SECURITY DEFINER  
  → `void`
- `poll_image_host_allowed(p_url text)` — SECURITY DEFINER  
  → `boolean`
- `poll_is_effectively_closed(p_status text, p_closes_at timestamp with time zone)` — invoker  
  → `boolean`
- `poll_mode()` — SECURITY DEFINER  
  → `text`
- `poll_options_json(p_poll_id bigint, p_viewer uuid)` — SECURITY DEFINER  
  → `jsonb`
- `poll_record_rate_event(p_user_id uuid, p_action text, p_target_id bigint, p_hour_limit integer, p_day_limit integer DEFAULT NULL::integer)` — SECURITY DEFINER  
  → `void`
- `poll_recount_metrics(p_apply boolean DEFAULT false)` — SECURITY DEFINER  
  → `TABLE(scope text, id bigint, stored integer, actual integer)`
- `poll_require_open()` — SECURITY DEFINER  
  → `void`
- `poll_require_reporter()` — SECURITY DEFINER  
  → `uuid`
- `poll_require_voter()` — SECURITY DEFINER  
  → `uuid`
- `poll_require_writer()` — SECURITY DEFINER  
  → `uuid`
- `poll_results_visible(p_poll_id bigint, p_viewer uuid)` — SECURITY DEFINER  
  → `boolean`
- `poll_slugify(p_text text)` — invoker  
  → `text`
- `poll_submit(p_topic_slug text, p_question text, p_detail text, p_options jsonb)` — SECURITY DEFINER  
  → `bigint`
- `poll_submit_report(p_target_type text, p_target_id bigint, p_reason text, p_detail text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `void`
- `poll_touch_updated_at()` — invoker  
  → `trigger`

### Study materials — 4 functions

- `get_study_material_curriculum(p_goal_slug text DEFAULT NULL::text, p_board_slug text DEFAULT NULL::text, p_class_slug text DEFAULT NULL::text, p_subject_slug text DEFAULT NULL::text)` — invoker  
  → `TABLE(level text, entity_id bigint, slug text, name text, display_order integer, resource_count bigint)`
- `get_study_materials(p_goal_slug text DEFAULT NULL::text, p_board_slug text DEFAULT NULL::text, p_class_slug text DEFAULT NULL::text, p_subject_slug text DEFAULT NULL::text, p_chapter_slug text DEFAULT NULL::text, p_chapter_id bigint DEFAULT NULL::bigint, p_video_id bigint DEFAULT NULL::bigint, p_material_type text DEFAULT NULL::text, p_limit integer DEFAULT 60, p_offset integer DEFAULT 0)` — invoker  
  → `TABLE(id bigint, title text, description text, material_type text, source_name text, source_url text, preview_image_url text, file_format text, language text, exam_year integer, page_count integer, is_downloadable boolean, rights_status text, scopes jsonb, total_count bigint)`
- `touch_study_material_updated_at()` — invoker  
  → `trigger`
- `validate_study_material_scope()` — SECURITY DEFINER  
  → `trigger`

### Faculty: registry, aliases, proposals, review — 33 functions

- `add_teacher_alias(p_teacher_id bigint, p_alias text, p_type text DEFAULT 'nickname'::text, p_verified boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `approve_faculty_review_group_as_new(p_normalized text, p_display_name text, p_verified boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `approve_group_as_existing(p_normalized text, p_teacher_id bigint, p_add_alias boolean DEFAULT true)` — SECURITY DEFINER  
  → `jsonb`
- `approve_proposal_as_existing(p_proposal_id bigint, p_teacher_id bigint, p_add_alias boolean DEFAULT true)` — SECURITY DEFINER  
  → `jsonb`
- `approve_proposal_as_new(p_proposal_id bigint, p_display_name text DEFAULT NULL::text, p_verified boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `create_teacher(p_display_name text, p_aliases jsonb DEFAULT '[]'::jsonb, p_verified boolean DEFAULT false, p_duplicate_acknowledged boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `defer_faculty_review_group(p_normalized text, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `jsonb`
- `defer_proposal(p_proposal_id bigint, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `jsonb`
- `faculty_import_capability()` — SECURITY DEFINER  
  → `jsonb`
- `get_faculty_facets(p_chapter_id bigint DEFAULT NULL::bigint, p_subject_id bigint DEFAULT NULL::bigint, p_goal_id bigint DEFAULT NULL::bigint)` — invoker  
  → `TABLE(teacher_id bigint, display_name text, slug text, verified boolean, institutes text, course_count bigint)`
- `get_faculty_profile(p_slug text)` — invoker  
  → `jsonb`
- `get_faculty_review_groups(p_status text DEFAULT 'pending'::text)` — SECURITY DEFINER  
  → `TABLE(normalized text, kind text, variants jsonb, variant_count integer, total_occurrences bigint, candidates jsonb)`
- `get_proposal_groups(p_status text DEFAULT 'pending'::text)` — SECURITY DEFINER  
  → `TABLE(normalized text, kind text, variants jsonb, variant_count integer, total_occurrences bigint, candidates jsonb)`
- `log_proposal_decision(p_proposal_id bigint, p_raw text, p_decision text, p_teacher_ids bigint[], p_note text)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `void`
- `looks_like_multiple_people(p_name text)` — invoker  
  → `boolean`
- `looks_like_organization(p_name text)` — invoker  
  → `boolean`
- `normalize_person_name(p_name text)` — invoker  
  → `text`
- `reject_faculty_review_group(p_normalized text, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `jsonb`
- `reject_proposal(p_proposal_id bigint, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `jsonb`
- `resolve_teacher_exact(p_name text)` — SECURITY DEFINER  
  → `jsonb`
- `scan_free_text_teachers()` — SECURITY DEFINER  
  → `jsonb`
- `search_teacher_candidates(p_query text, p_limit integer DEFAULT 10)` — SECURITY DEFINER  
  → `TABLE(teacher_id bigint, display_name text, slug text, verified boolean, match_type text, match_rank integer, matched_on text, alias_status text, institutes text, subjects text, goals text, course_count bigint, is_ambiguous boolean)`
- `search_teachers(p_query text, p_limit integer DEFAULT 10)` — SECURITY DEFINER  
  → `TABLE(teacher_id bigint, display_name text, slug text, verified boolean, match_type text, match_rank integer, matched_on text, alias_status text, institutes text, subjects text, goals text, course_count bigint, is_ambiguous boolean)`
- `search_teachers_internal(p_query text, p_limit integer, p_include_unverified boolean)` — invoker, internal only — no role holds EXECUTE  
  → `TABLE(teacher_id bigint, display_name text, slug text, verified boolean, match_type text, match_rank integer, matched_on text, alias_status text, institutes text, subjects text, goals text, course_count bigint, is_ambiguous boolean)`
- `set_alias_normalized()` — invoker  
  → `trigger`
- `set_playlist_teachers(p_playlist_id bigint, p_teacher_ids bigint[])` — SECURITY DEFINER  
  → `jsonb`
- `set_teacher_canonical()` — invoker  
  → `trigger`
- `set_teacher_context(p_teacher_id bigint, p_institute_ids bigint[] DEFAULT NULL::bigint[], p_subject_ids bigint[] DEFAULT NULL::bigint[], p_goal_ids bigint[] DEFAULT NULL::bigint[])` — SECURITY DEFINER  
  → `jsonb`
- `set_video_teachers(p_video_id bigint, p_teacher_ids bigint[])` — SECURITY DEFINER  
  → `jsonb`
- `similar_teachers(p_name text, p_limit integer DEFAULT 5)` — SECURITY DEFINER  
  → `TABLE(teacher_id bigint, display_name text, slug text, verified boolean, match_type text, match_rank integer, matched_on text, alias_status text, institutes text, subjects text, goals text, course_count bigint, is_ambiguous boolean)`
- `split_faculty_review_group(p_normalized text, p_teacher_ids bigint[], p_override_kind boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `split_proposal(p_proposal_id bigint, p_teacher_ids bigint[], p_override_kind boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `validate_teacher_ids_payload(payload jsonb)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `bigint[]`

### Admin: import, catalog management, quality, audit — 31 functions

- `catalog_manage_capability()` — SECURITY DEFINER  
  → `jsonb`
- `catalog_playlist_snapshot(p_playlist_id bigint)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `jsonb`
- `catalog_similarity(text, text)` — invoker  
  → `real`
- `catalog_video_taxonomy_snapshot(p_video_id bigint)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `jsonb`
- `catalog_word_similarity(text, text)` — invoker  
  → `real`
- `clear_managed_video_taxonomy(p_playlist_id bigint, p_video_id bigint, p_allow_shared boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `clear_video_taxonomy(p_video_id bigint)` — SECURITY DEFINER  
  → `jsonb`
- `content_quality_capability()` — SECURITY DEFINER  
  → `jsonb`
- `create_course(payload jsonb)` — SECURITY DEFINER  
  → `jsonb`
- `create_course_with_teachers(payload jsonb)` — SECURITY DEFINER  
  → `jsonb`
- `delete_managed_playlist(p_playlist_id bigint, p_expected_title text)` — SECURITY DEFINER  
  → `jsonb`
- `get_content_quality_queue(p_ready boolean DEFAULT false, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)` — SECURITY DEFINER  
  → `TABLE(playlist_id bigint, display_title text, source_title text, legacy_teacher text, institute text, subject text, content_type text, language text, difficulty text, title_review_status text, faculty_credit_status text, source_title_changed boolean, faculty jsonb, missing_fields text[], quality_ready boolean)`
- `get_manage_playlists(p_search text DEFAULT NULL::text, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)` — SECURITY DEFINER  
  → `TABLE(total_count bigint, playlist_id bigint, title text, teacher text, youtube_playlist_id text, channel_id bigint, channel_name text, category_id bigint, category_name text, subject_id bigint, subject_name text, content_type text, language text, difficulty text, audience_focus text, display_order integer, learning_goal_ids bigint[], class_level_ids bigint[], videos jsonb)`
- `import_playlist(payload jsonb, mode text DEFAULT 'merge'::text)` — SECURITY DEFINER  
  → `jsonb`
- `import_playlist_with_chapters(payload jsonb, mode text DEFAULT 'merge'::text)` — SECURITY DEFINER  
  → `jsonb`
- `import_playlist_with_quality(payload jsonb, mode text DEFAULT 'merge'::text)` — SECURITY DEFINER  
  → `jsonb`
- `import_playlist_with_teachers(payload jsonb, mode text DEFAULT 'merge'::text)` — SECURITY DEFINER  
  → `jsonb`
- `is_admin()` — SECURITY DEFINER  
  → `boolean`
- `migrate_class_levels(p_enable_triggers boolean DEFAULT true)` — SECURITY DEFINER  
  → `jsonb`
- `per_video_chapter_import_capability()` — invoker  
  → `jsonb`
- `per_video_chapter_import_snapshot(p_playlist_id bigint)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `jsonb`
- `per_video_chapter_import_video_snapshot(p_video_id bigint)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `jsonb`
- `playlist_quality_missing(p_playlist_id bigint)` — SECURITY DEFINER, internal only — no role holds EXECUTE  
  → `text[]`
- `purge_migration_audit(p_keep_runs integer DEFAULT 3)` — SECURITY DEFINER  
  → `jsonb`
- `reassign_video_chapter(p_playlist_id bigint, p_video_id bigint, p_chapter_id bigint, p_expected_current_chapter_id bigint, p_allow_shared boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `review_playlist_quality(p_playlist_id bigint, p_display_title text, p_teacher_ids bigint[], p_faculty_status text, p_content_type text, p_language text, p_difficulty text, p_note text DEFAULT NULL::text)` — SECURITY DEFINER  
  → `jsonb`
- `rls_auto_enable()` — SECURITY DEFINER  
  → `event_trigger`
- `set_managed_video_taxonomy(p_playlist_id bigint, p_video_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[], p_allow_shared boolean DEFAULT false)` — SECURITY DEFINER  
  → `jsonb`
- `set_video_taxonomy(p_video_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[])` — SECURITY DEFINER  
  → `jsonb`
- `update_managed_playlist(p_playlist_id bigint, p_expected_title text, p_title text, p_teacher text, p_channel_id bigint, p_learning_goal_ids bigint[], p_class_level_ids bigint[], p_content_type text, p_language text, p_difficulty text, p_audience_focus text)` — SECURITY DEFINER  
  → `jsonb`
- `validate_import_payload(payload jsonb, mode text, require_videos boolean)` — SECURITY DEFINER  
  → `jsonb`

**Progress and streaks have no RPCs.** `video_progress` and `study_days` are read and
written straight through PostgREST under owner-only RLS.

---

## Enum-like contracts

Postgres `enum` types are not used anywhere. Every closed value set below is a `text`
column with a `CHECK (... = ANY (ARRAY[...]))` constraint, listed here because application
code has to match these strings exactly. Extracted from the baseline's CHECK constraints.

| table.column | allowed values |
| --- | --- |
| `app_environment.name` | `production`, `staging`, `test` |
| `catalog_management_audit.action` | `update-playlist`, `set-video-taxonomy`, `clear-video-taxonomy`, `reassign-video-chapter`, `delete-playlist` |
| `content_reports.reason` | `broken`, `wrong-category`, `inappropriate`, `other` |
| `content_reports.status` | `pending`, `reviewed`, `dismissed` |
| `content_reports.target_type` | `video`, `playlist` |
| `forum_moderation_log.action` | `hide`, `unhide`, `lock`, `unlock`, `remove`, `solve`, `unsolve`, `auto_hide`, `suspend`, `unsuspend`, `set_mode`, `beta_add`, `beta_remove` |
| `forum_moderation_log.target_type` | `post`, `comment`, `user`, `forum` |
| `forum_rate_events.action` | `post`, `comment`, `edit_post`, `edit_comment`, `vote`, `report` |
| `forum_reports.priority` | `normal`, `urgent` |
| `forum_reports.reason` | `spam`, `abuse_or_bullying`, `personal_information`, `sexual_content`, `self_harm`, `wrong_or_unsafe_advice`, `off_topic`, `other` |
| `forum_reports.status` | `pending`, `reviewed`, `dismissed` |
| `forum_reports.target_type` | `post`, `comment` |
| `forum_settings.mode` | `off`, `read_only`, `beta`, `open` |
| `forum_topics.kind` | `academic`, `non_academic` |
| `forum_votes.value` | `-1`, `1` |
| `playlist_attributes.completeness_status` | `unassessed`, `partial`, `complete` |
| `playlist_attributes.review_status` | `proposed`, `verified`, `rejected` |
| `playlist_attributes.source` | `manual`, `import`, `editorial-review` |
| `playlist_teachers.role` | `instructor`, `co-instructor`, `guest` |
| `playlists.faculty_credit_status` | `pending`, `identified`, `team`, `unknown` |
| `playlists.title_review_status` | `pending`, `approved` |
| `poll_rate_events.action` | `submit`, `vote`, `comment`, `report` |
| `poll_reports.reason` | `spam`, `abuse`, `personal_information`, `off_topic`, `misinformation`, `other` |
| `poll_reports.status` | `open`, `actioned`, `dismissed` |
| `poll_reports.target_type` | `poll`, `comment` |
| `poll_settings.mode` | `off`, `read_only`, `open` |
| `polls.status` | `pending`, `live`, `rejected`, `closed`, `hidden` |
| `study_materials.file_format` | `web`, `pdf` |
| `study_materials.language` | `English`, `Hindi`, `Hinglish` |
| `study_materials.material_type` | `short_notes`, `formula_sheet`, `full_notes`, `previous_year_paper` |
| `study_materials.review_status` | `pending`, `approved`, `rejected` |
| `study_materials.rights_status` | `official_source`, `open_license`, `creator_permission` |
| `teacher_aliases.alias_type` | `full-name`, `short`, `initials`, `nickname`, `maiden`, `transliteration`, `misspelling` |
| `teacher_aliases.source` | `manual`, `migrated`, `import`, `student-report` |
| `teacher_aliases.status` | `proposed`, `verified`, `rejected` |
| `teacher_name_proposals.kind` | `single`, `multi-person`, `organization-or-team`, `blank` |
| `teacher_name_proposals.status` | `pending`, `approved-existing`, `approved-new`, `split`, `rejected`, `deferred` |
| `teacher_proposal_decisions.decision` | `approved-existing`, `approved-new`, `split`, `rejected`, `deferred` |
| `video_topics.coverage_kind` | `theory`, `practice`, `pyq`, `mixed` |
| `video_topics.review_status` | `proposed`, `verified`, `rejected` |
| `video_topics.source` | `manual`, `import`, `editorial-review` |

Two of these are the site's emergency switches rather than data classifications:
`forum_settings.mode` and `poll_settings.mode`, read by `forum_mode()` and `poll_mode()`.
Both fall back to `off` when the settings row is missing, and both are independent of the
frontend flags in `src/releaseCapabilities.js` — the database is the real boundary.

Documented but **not** enforced by a constraint:

- `class_levels_migration_audit.verdict` — the migration that created it documents
  `agree | array-only | junction-only | both-empty`, but the baseline shows no CHECK. Safe
  in practice only because `migrate_class_levels()` is its sole writer.

`universal_search(p_query, p_types, p_limit, p_offset)` returns a `group_key` column whose
live value set is `faculty`, `chapter`, `playlist`, `lecture`, `institute` (the default of
its `p_types` argument). The staged materials migration adds `material` and `paper`.
`src/searchDestinations.js` owns where each group key sends the student — a new group key
needs a case there, or the result becomes a dead row.

---

## Known quirks

Carried forward from the previous edition where the baseline confirms they are still true,
and re-worded to say what the baseline actually shows. Resolved ones were dropped.

1. **Nine functions are revoked from `PUBLIC` and granted to nobody.** `catalog_playlist_snapshot`,
   `catalog_video_taxonomy_snapshot`, `log_proposal_decision`, `per_video_chapter_import_snapshot`,
   `per_video_chapter_import_video_snapshot`, `playlist_quality_missing`, `search_teachers_internal`,
   `touch_playlist_attributes` and `validate_teacher_ids_payload` hold no EXECUTE grant for
   `anon`, `authenticated` or `service_role`. They still appear on the PostgREST surface,
   because Postgres exposes function existence independently of grants, but a direct call by
   any of those roles fails with permission denied. They work only as internal helpers called
   from other functions owned by the same role. Do not wire a client to one.

2. **`rls_auto_enable` would not be re-bound by a from-scratch replay.** It is an event-trigger
   function (`RETURNS event_trigger`, `SECURITY DEFINER`, pinned `search_path`) that enables
   row level security on any new table created in `public` and logs what it did. Its source is
   in the repo now, in the baseline — the previous edition's "no source anywhere" discrepancy
   is resolved. But the Supabase CLI dump format **comments out `CREATE EVENT TRIGGER`
   statements**, so replaying the baseline into an empty database recreates the function and
   not the binding. A restore has to re-create the event trigger by hand, or new tables will
   silently be created without RLS.

3. **Per-feature `.sql` files outside `supabase/migrations/` are not a status report.**
   `src/migrations/teachers_v7.sql` still opens "NOT applied anywhere"; `production/README.md`
   still reads "Nothing here has been applied to production". Both were true when written and
   are false now — the baseline contains those objects. Trust the migration chain, and read
   the older files as history.

4. **`pg_trgm` is installed into `public`, not `extensions`.** So `similarity()` and
   `word_similarity()` live in `public` and appear on the API surface with no first-party
   file defining them. `catalog_similarity(text, text)` is the wrapper the codebase calls: it
   pins `search_path` to `''` and calls `public.similarity` fully qualified, which settles the
   old open question about whether `search_teachers_internal`'s `search_path` is pinned in
   production. It is not — it does not need to be, because it reaches trigram matching only
   through that wrapper.

5. **Eleven tables have RLS on and no policy at all**, which denies `anon` and
   `authenticated` outright: `forum_admin_transfer_state`, `forum_beta_members`,
   `forum_install_state`, `forum_rate_events`, `forum_user_stats`, `forum_votes`,
   `learning_goal_topics`, `playlist_attributes`, `poll_rate_events`, `topics` and
   `video_topics`. Reads of those tables go through `SECURITY DEFINER` RPCs. A PostgREST
   query against one returns an empty set rather than an error, which looks exactly like
   "no data" when you are debugging.

