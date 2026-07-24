-- ============================================================
--  COURSES DATA — tags, teacher, and the Chapter Hub query.
--  Additive. Safe to run once, after the earlier scripts.
-- ============================================================

-- 1. New columns on playlists ---------------------------------
--    teacher : the person the course is "by" (e.g. "ABJ Sir")
--    tags    : simple curated labels for now (e.g. {"Best for Beginners"})
alter table public.playlists add column if not exists teacher text;
alter table public.playlists add column if not exists tags    text[] not null default '{}';

-- GIN index makes "find courses tagged X" fast later.
create index if not exists idx_playlists_tags on public.playlists using gin (tags);


-- 2. Chapter Hub query ----------------------------------------
--    Returns every course (playlist) that teaches this chapter —
--    i.e. contains at least one video whose chapter_id matches —
--    already sorted best-rated first, with everything the card needs.
--    Runs as the caller, so your public-read RLS still applies.
create or replace function public.get_chapter_courses(p_chapter_id bigint)
returns table (
    playlist_id    bigint,
    title          text,
    teacher        text,
    institute      text,
    lectures       bigint,
    average_rating numeric,
    ratings_count  int,
    tags           text[]
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
        p.tags
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

-- Let the public (logged-out) and logged-in users call it.
grant execute on function public.get_chapter_courses(bigint) to anon, authenticated;
