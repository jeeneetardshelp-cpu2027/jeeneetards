-- FORUM v1 staging-only HTTP/JWT fixture preparation helper.
-- It contains no credential and refuses every non-staging database.

begin;

do $forum_http_helper_guard$
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
    raise exception 'REFUSING: HTTP fixture helper requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_settings') is null
     or to_regclass('public.forum_posts') is null
     or to_regprocedure('public.forum_create_post(text,text,text)') is null then
    raise exception 'REFUSING: persistent forum schema is missing';
  end if;
  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'REFUSING: forum mode must be off before installing fixture helper';
  end if;
end;
$forum_http_helper_guard$;

create function public.forum_stage_prepare_http_fixtures(
  p_run_id text,
  p_user_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $forum_http_prepare$
declare
  fixture_user_count integer;
  fixture_profile_count integer;
  admin_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role required';
  end if;
  if not exists (
    select 1 from public.app_environment where id = true and name = 'staging'
  ) or exists (
    select 1 from public.app_environment where id = true and name <> 'staging'
  ) then
    raise exception 'REFUSING: HTTP fixture preparation is staging-only';
  end if;
  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'REFUSING: forum mode must remain off during fixture preparation';
  end if;
  if p_run_id !~ '^[a-f0-9]{8}$' then
    raise exception 'invalid fixture run id';
  end if;
  if cardinality(p_user_ids) <> 5
     or (select count(distinct user_id) from unnest(p_user_ids) user_id) <> 5 then
    raise exception 'exactly five distinct fixture user ids are required';
  end if;

  select count(*) into fixture_user_count
  from auth.users u
  where u.id = any(p_user_ids)
    and u.email like 'forum-http-' || p_run_id || '-%@staging.invalid'
    and u.raw_app_meta_data ->> 'forum_http_fixture' = p_run_id;
  if fixture_user_count <> 5 then
    raise exception 'fixture users do not match the exact staging marker';
  end if;

  select count(*) into fixture_profile_count
  from public.profiles p where p.id = any(p_user_ids);
  if fixture_profile_count <> 5 then
    raise exception 'five fixture profiles are required';
  end if;

  update auth.users
  set created_at = now() - interval '20 minutes'
  where id = any(p_user_ids)
    and raw_app_meta_data ->> 'forum_http_fixture' = p_run_id;

  update public.profiles p
  set username = format(
        'stage_http_%s_%s',
        p_run_id,
        array_position(p_user_ids, p.id)
      ),
      full_name = 'Forum HTTP staging fixture',
      avatar_url = null,
      is_admin = (p.id = p_user_ids[1]),
      created_at = now() - interval '20 minutes'
  where p.id = any(p_user_ids);

  select count(*) into admin_count
  from public.profiles p where p.id = any(p_user_ids) and p.is_admin;
  if admin_count <> 1 then
    raise exception 'fixture preparation expected exactly one admin';
  end if;

  return jsonb_build_object(
    'environment', 'staging',
    'users_prepared', fixture_user_count,
    'profiles_prepared', fixture_profile_count,
    'admins_prepared', admin_count,
    'cooldown_satisfied', not exists (
      select 1 from auth.users
      where id = any(p_user_ids)
        and created_at > now() - interval '10 minutes'
    )
  );
end;
$forum_http_prepare$;

revoke all on function public.forum_stage_prepare_http_fixtures(text,uuid[])
from public, anon, authenticated;
grant execute on function public.forum_stage_prepare_http_fixtures(text,uuid[])
to service_role;

notify pgrst, 'reload schema';

commit;

select
  (select name from public.app_environment where id = true) as environment_after,
  (select mode from public.forum_settings where id = true) as forum_mode,
  to_regprocedure('public.forum_stage_prepare_http_fixtures(text,uuid[])') is not null
    as fixture_helper_installed,
  has_function_privilege(
    'service_role',
    'public.forum_stage_prepare_http_fixtures(text,uuid[])',
    'EXECUTE'
  ) as service_role_can_execute,
  not has_function_privilege(
    'authenticated',
    'public.forum_stage_prepare_http_fixtures(text,uuid[])',
    'EXECUTE'
  ) as authenticated_cannot_execute;
