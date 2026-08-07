-- Remove the closed-beta staging-only HTTP/JWT fixture helper.

begin;

do $forum_beta_http_helper_rollback_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and lower(name) = 'staging';
  if environment_count <> 1
     or exists (
       select 1 from public.app_environment where id = true and lower(name) <> 'staging'
     ) then
    raise exception 'REFUSING: beta HTTP fixture helper rollback is staging-only';
  end if;
  if to_regclass('public.forum_beta_members') is null
     or public.forum_mode() <> 'off' then
    raise exception 'REFUSING: persistent closed beta must exist in off mode';
  end if;
end;
$forum_beta_http_helper_rollback_guard$;

drop function if exists public.forum_stage_prepare_beta_http_fixtures(text,uuid[]);
notify pgrst, 'reload schema';

commit;

select
  (select lower(name) from public.app_environment where id = true) = 'staging'
    as environment_is_staging,
  public.forum_mode() = 'off' as forum_mode_is_off,
  to_regprocedure('public.forum_stage_prepare_beta_http_fixtures(text,uuid[])') is null
    as fixture_helper_removed;
