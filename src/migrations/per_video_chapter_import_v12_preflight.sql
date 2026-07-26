-- Read-only prerequisites for per_video_chapter_import_v12.sql.
begin read only;

do $preflight$
begin
  if to_regprocedure('public.import_playlist(jsonb,text)') is null
     or to_regprocedure(
       'public.validate_import_payload(jsonb,text,boolean)'
     ) is null
     or to_regprocedure(
       'public.catalog_playlist_snapshot(bigint)'
     ) is null
     or to_regprocedure(
       'public.catalog_video_taxonomy_snapshot(bigint)'
     ) is null
     or to_regclass('public.playlists') is null
     or to_regclass('public.videos') is null
     or to_regclass('public.playlist_videos') is null
     or to_regclass('public.playlist_boards') is null
     or to_regclass('public.app_environment') is null then
    raise exception
      'v12 preflight failed: required v6/v11 functions or tables are missing';
  end if;
end;
$preflight$;

select
  to_regprocedure('public.import_playlist(jsonb,text)') is not null
    as base_import_exists,
  to_regprocedure('public.validate_import_payload(jsonb,text,boolean)') is not null
    as base_validator_exists,
  to_regprocedure('public.catalog_playlist_snapshot(bigint)') is not null
    as playlist_snapshot_exists,
  to_regprocedure('public.catalog_video_taxonomy_snapshot(bigint)') is not null
    as video_snapshot_exists,
  to_regclass('public.playlists') is not null
    as playlists_exists,
  to_regclass('public.videos') is not null
    as videos_exists,
  to_regclass('public.playlist_videos') is not null
    as playlist_videos_exists,
  to_regclass('public.playlist_boards') is not null
    as playlist_boards_exists,
  to_regclass('public.app_environment') is not null
    as environment_marker_exists;

select name as environment_name
from public.app_environment
where id = true;

rollback;
