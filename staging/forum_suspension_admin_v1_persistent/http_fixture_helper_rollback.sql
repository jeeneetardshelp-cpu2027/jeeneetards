-- Remove the staging-only suspension HTTP/JWT fixture helper.
begin;

do $forum_suspension_http_helper_rollback_guard$
declare
  true_markers integer;
  staging_markers integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select
    count(*) filter (where id = true),
    count(*) filter (where id = true and lower(btrim(name)) = 'staging')
  into true_markers, staging_markers
  from public.app_environment;
  if true_markers <> 1 or staging_markers <> 1 then
    raise exception 'REFUSING: suspension helper rollback is staging-only';
  end if;
  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'REFUSING: forum must remain off during helper rollback';
  end if;
end;
$forum_suspension_http_helper_rollback_guard$;

drop function if exists public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[]);
notify pgrst, 'reload schema';
commit;

select
  (select lower(btrim(name)) from public.app_environment where id = true)
    as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regprocedure(
    'public.forum_stage_prepare_suspension_admin_fixtures(text,uuid[])'
  ) is null as fixture_helper_removed;
