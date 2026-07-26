-- Code rollback only. Audit evidence and imported catalogue data are retained.
-- Do not use this as a substitute for a reviewed data rollback.
begin;

drop function if exists public.import_playlist_with_chapters(jsonb, text);
drop function if exists public.per_video_chapter_import_capability();
drop function if exists public.per_video_chapter_import_video_snapshot(bigint);
drop function if exists public.per_video_chapter_import_snapshot(bigint);

commit;
