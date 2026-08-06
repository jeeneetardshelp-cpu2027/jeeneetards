-- Remove the staging-only HTTP/JWT fixture preparation helper.

begin;

do $forum_http_helper_rollback_guard$
declare
  environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment
  where id = true and name = 'staging';
  if environment_count <> 1
     or exists (
       select 1 from public.app_environment where id = true and name <> 'staging'
     ) then
    raise exception 'REFUSING: HTTP fixture helper rollback is staging-only';
  end if;
  if to_regclass('public.forum_settings') is null
     or (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'REFUSING: persistent forum must exist in off mode';
  end if;
end;
$forum_http_helper_rollback_guard$;

drop function if exists public.forum_stage_prepare_http_fixtures(text,uuid[]);
notify pgrst, 'reload schema';

commit;

select
  (select name from public.app_environment where id = true) as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regprocedure('public.forum_stage_prepare_http_fixtures(text,uuid[])') is null
    as fixture_helper_removed;
