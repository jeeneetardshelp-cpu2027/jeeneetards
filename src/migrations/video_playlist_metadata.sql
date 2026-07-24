-- ============================================================
--  METADATA FOUNDATION  —  the columns the advanced filter bar
--  needs. Run once in the Supabase SQL Editor. Safe to re-run.
--
--  ADDITIVE. All columns are nullable, so nothing existing breaks.
--    videos:    duration_seconds, caption_status, embedding_status,
--               last_verified_at   (auto-filled from the YouTube API)
--    playlists: content_type, language, difficulty, last_verified_at
--               (set by the admin — human judgments)
-- ============================================================

-- 1. Columns ---------------------------------------------------
alter table public.videos add column if not exists duration_seconds int;
alter table public.videos add column if not exists caption_status   text;   -- available | none | unknown
alter table public.videos add column if not exists embedding_status text;   -- embeddable | blocked | unknown
alter table public.videos add column if not exists last_verified_at timestamptz;

alter table public.playlists add column if not exists content_type   text;   -- full-course | one-shot | revision | pyq | practice
alter table public.playlists add column if not exists language       text;   -- hindi | english | hinglish
alter table public.playlists add column if not exists difficulty     text;   -- beginner | intermediate | advanced
alter table public.playlists add column if not exists last_verified_at timestamptz;


-- 2. CHECK constraints (nullable). ADD CONSTRAINT has no IF NOT EXISTS,
--    so guard each one so the file stays re-runnable.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'playlists_content_type_check') then
    alter table public.playlists add constraint playlists_content_type_check
      check (content_type is null or content_type in ('full-course','one-shot','revision','pyq','practice'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'playlists_language_check') then
    alter table public.playlists add constraint playlists_language_check
      check (language is null or language in ('hindi','english','hinglish'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'playlists_difficulty_check') then
    alter table public.playlists add constraint playlists_difficulty_check
      check (difficulty is null or difficulty in ('beginner','intermediate','advanced'));
  end if;
end $$;


-- 3. Surface the new playlist fields + a computed total duration to the
--    Chapter Hub. Adding columns changes the return type, so drop+recreate.
drop function if exists public.get_chapter_courses(bigint);

create function public.get_chapter_courses(p_chapter_id bigint)
returns table (
    playlist_id            bigint,
    title                  text,
    teacher                text,
    institute              text,
    lectures               bigint,
    average_rating         numeric,
    ratings_count          int,
    tags                   text[],
    class_levels           text[],
    content_type           text,
    language               text,
    difficulty             text,
    total_duration_seconds bigint
)
language sql
stable
as $$
    select
        p.id,
        p.title,
        p.teacher,
        ic.name as institute,
        (select count(*) from public.playlist_videos pv2 where pv2.playlist_id = p.id) as lectures,
        p.average_rating,
        p.ratings_count,
        p.tags,
        p.class_levels,
        p.content_type,
        p.language,
        p.difficulty,
        (select coalesce(sum(v.duration_seconds), 0)
           from public.playlist_videos pv3
           join public.videos v on v.id = pv3.video_id
          where pv3.playlist_id = p.id) as total_duration_seconds
    from public.playlists p
    join public.institutes_channels ic on ic.id = p.channel_id
    where exists (
        select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        where pv.playlist_id = p.id
          and v.chapter_id = p_chapter_id
    )
    order by p.average_rating desc, p.ratings_count desc;
$$;

grant execute on function public.get_chapter_courses(bigint) to anon, authenticated;


-- 4. Check what to fill next — videos still missing duration:
--     select count(*) as needs_backfill from public.videos where duration_seconds is null;
