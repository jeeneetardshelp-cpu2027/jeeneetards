-- ============================================================
--  ADD CLASS LEVELS TO PLAYLISTS  —  run once in the Supabase
--  SQL Editor. Safe to run more than once.
--
--  A course is now tagged with which classes it's for (11th, 12th,
--  Dropper, 10th) instead of shown by a text title. One course can
--  belong to several classes, so this is an array.
-- ============================================================

-- 1. The column ------------------------------------------------
alter table public.playlists
    add column if not exists class_levels text[] not null default '{}';


-- 2. Surface it to the app -------------------------------------
--    The Chapter Hub reads courses through get_chapter_courses().
--    Adding a column to a function's RETURNS TABLE changes its return
--    type, which CREATE OR REPLACE can't do — so drop, then recreate.
drop function if exists public.get_chapter_courses(bigint);

create function public.get_chapter_courses(p_chapter_id bigint)
returns table (
    playlist_id    bigint,
    title          text,
    teacher        text,
    institute      text,
    lectures       bigint,
    average_rating numeric,
    ratings_count  int,
    tags           text[],
    class_levels   text[]
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
        p.class_levels
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
