-- Staging/test-only rollback for the username-claim delta.
begin;

do $$
declare environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'username claim rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'username claim rollback refused for environment %', coalesce(environment_name, 'unmarked');
  end if;
end;
$$;

drop function if exists public.forum_claim_username(text);
drop function if exists public.forum_get_my_identity();
drop index if exists public.forum_profiles_username_ci_idx;

-- Restore the v1 writer gate exactly.
create or replace function public.forum_require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  profile_created timestamptz;
  handle text;
begin
  perform public.forum_require_open();
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to contribute';
  end if;
  select u.created_at, btrim(p.username) into profile_created, handle
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = uid;
  if profile_created is null then
    raise exception using errcode = '42501', message = 'student profile is missing';
  end if;
  if handle is null or handle !~ '^[A-Za-z0-9_]{3,30}$' then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before contributing';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001', message = 'new accounts can contribute after 10 minutes';
  end if;
  if exists (
    select 1 from public.forum_suspensions s
    where s.user_id = uid and s.suspended_until > now()
  ) then
    raise exception using errcode = '42501', message = 'forum posting is temporarily suspended';
  end if;
  return uid;
end;
$$;

drop function if exists public.forum_username_is_allowed(text);
revoke insert (id, full_name, avatar_url) on table public.profiles from authenticated;
revoke update (full_name, avatar_url) on table public.profiles from authenticated;
grant insert, update on table public.profiles to anon, authenticated;
notify pgrst, 'reload schema';
commit;
