-- ============================================================
--  PLAYLIST IDEMPOTENCY  —  run once, after the earlier scripts.
--  Safe to run more than once.
--
--  Problem this solves: re-importing the same YouTube playlist used
--  to create a SECOND identical course, because playlists had no way
--  to say "this course already came from that YouTube playlist".
--
--  Fix: remember each course's source YouTube playlist id, and make it
--  unique. The importer then reuses the existing course instead of
--  inserting a duplicate.
-- ============================================================

-- The source YouTube playlist id (e.g. "PLbSKDtjiYtQw...").
-- Courses you created by hand simply leave this NULL.
alter table public.playlists
    add column if not exists youtube_playlist_id text;

-- One course per source playlist. Postgres allows many NULLs under a
-- UNIQUE constraint, so hand-made courses (NULL) are unaffected — only
-- imported ones are deduplicated.
create unique index if not exists uq_playlists_youtube_playlist_id
    on public.playlists (youtube_playlist_id)
    where youtube_playlist_id is not null;
