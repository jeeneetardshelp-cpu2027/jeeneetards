-- ============================================================
--  STRUCTURED RATINGS  —  extend playlist_ratings with the extra
--  dimensions the rating form collects. Run once; safe to re-run.
--
--  ADDITIVE. playlist_ratings already exists (community_schema.sql) with:
--    rating (overall 1–5), review, unique(playlist_id,user_id), and a
--    trigger that keeps playlists.average_rating / ratings_count fresh off
--    `rating`. That all stays — we only add columns.
-- ============================================================

alter table public.playlist_ratings add column if not exists clarity_rating  int;   -- explanation clarity 1–5
alter table public.playlist_ratings add column if not exists question_rating int;   -- question quality 1–5
alter table public.playlist_ratings add column if not exists difficulty      text;  -- beginner | moderate | advanced
alter table public.playlist_ratings add column if not exists best_for        text;  -- first-learning | revision | practice

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plr_clarity_range') then
    alter table public.playlist_ratings add constraint plr_clarity_range
      check (clarity_rating is null or clarity_rating between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plr_question_range') then
    alter table public.playlist_ratings add constraint plr_question_range
      check (question_rating is null or question_rating between 1 and 5);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plr_difficulty_check') then
    alter table public.playlist_ratings add constraint plr_difficulty_check
      check (difficulty is null or difficulty in ('beginner','moderate','advanced'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plr_best_for_check') then
    alter table public.playlist_ratings add constraint plr_best_for_check
      check (best_for is null or best_for in ('first-learning','revision','practice'));
  end if;
end $$;

-- No RLS change: the existing owner-write policies on playlist_ratings
-- already cover the new columns. No trigger change: the average is still
-- driven by `rating`.
--
-- Reminder — before students can sign up and rate, enable email sign-ups in
-- Supabase (Authentication → Providers → Email). For local testing you can
-- turn OFF "Confirm email" so a new account is usable immediately.
