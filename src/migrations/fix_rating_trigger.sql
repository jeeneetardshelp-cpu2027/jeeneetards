-- ============================================================
--  FIX: rating auto-average never updated playlists.
--
--  refresh_playlist_rating() ran as the STUDENT who rated, then tried to
--  UPDATE playlists — a table students can't write (admin-only RLS). So the
--  update hit 0 rows and average_rating/ratings_count stayed 0. It needs to
--  run as its owner (bypassing RLS), i.e. SECURITY DEFINER — the same as
--  handle_new_user() already does.
--
--  Run once in the SQL Editor. Safe to re-run.
-- ============================================================

create or replace function public.refresh_playlist_rating()
returns trigger
language plpgsql
security definer                 -- <- the fix: run as owner, bypass RLS
set search_path = public         -- <- required hygiene for SECURITY DEFINER
as $$
declare
    pid bigint := coalesce(new.playlist_id, old.playlist_id);
begin
    update public.playlists
    set average_rating = (
            select coalesce(round(avg(rating)::numeric, 2), 0)
            from public.playlist_ratings
            where playlist_id = pid
        ),
        ratings_count = (
            select count(*)
            from public.playlist_ratings
            where playlist_id = pid
        )
    where id = pid;
    return null;
end;
$$;

-- The trigger already points at this function by name, so it doesn't need
-- recreating. But ratings inserted BEFORE this fix were never counted, so
-- recompute every playlist's average once, now.
update public.playlists p
set average_rating = coalesce(
        (select round(avg(rating)::numeric, 2)
           from public.playlist_ratings r where r.playlist_id = p.id), 0),
    ratings_count = (
        select count(*)
          from public.playlist_ratings r where r.playlist_id = p.id);

-- Check: playlist 1 should now show your test rating.
--   select id, title, average_rating, ratings_count from public.playlists where ratings_count > 0;
