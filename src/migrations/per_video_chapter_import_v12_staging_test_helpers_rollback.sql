-- Remove the v12 staging-only verification helpers.
-- Refuses to run unless public.app_environment identifies staging/test.

begin;

do $rollback_guard$
declare
  v_environment text;
  v_fixture_rows bigint := 0;
begin
  if to_regclass('public.app_environment') is null then
    raise exception
      'refusing helper rollback: app_environment is missing';
  end if;
  execute
    'select name from public.app_environment where id = true limit 1'
    into v_environment;
  if v_environment is null or v_environment not in ('staging', 'test') then
    raise exception
      'refusing helper rollback: database is not staging/test (got %)',
      coalesce(v_environment, '<none>');
  end if;

  execute
    $count$
      select
        (select count(*)
         from public.playlist_import_audit
         where youtube_playlist_id like 'TESTV12%')
        + (select count(*)
           from public.playlists
           where youtube_playlist_id like 'TESTV12%')
        + (select count(*)
           from public.institutes_channels
           where youtube_channel_id like 'TESTV12%')
        + (select count(*)
           from public.chapters
           where slug like 'testv12-%')
        + (select count(*)
           from public.videos video
           join public.institutes_channels channel
             on channel.id = video.channel_id
           where channel.youtube_channel_id like 'TESTV12%')
        + (select count(*)
           from auth.users
           where email like 'v12-staging-%@example.com')
    $count$
    into v_fixture_rows;
  if v_fixture_rows > 0 then
    raise exception
      'refusing helper rollback: % TESTV12 fixture row(s) remain; run exact cleanup first',
      v_fixture_rows;
  end if;
end;
$rollback_guard$;

drop trigger if exists trg_v12_fail_chapter_remap_fixture
  on public.videos;

drop function if exists public.cleanup_v12_import_test_audit(text, uuid[]);
drop function if exists public.quiesce_v12_import_test_requests(text, uuid[]);
drop function if exists public.per_video_chapter_import_v12_test_capability();
drop function if exists public.__v12_fail_chapter_remap_fixture();

commit;
