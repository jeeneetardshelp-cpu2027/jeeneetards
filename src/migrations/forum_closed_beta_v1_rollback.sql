-- Staging/test-only rollback for the forum closed-beta delta.
begin;

do $$
declare
  environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'forum closed-beta rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'forum closed-beta rollback refused for environment %', coalesce(environment_name, 'unmarked');
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'forum closed-beta rollback refused: forum mode must be off';
  end if;
end;
$$;

drop function public.forum_admin_list_beta_members();
drop function public.forum_admin_set_beta_member(text,boolean);
drop function public.forum_is_beta_member();
drop table public.forum_beta_members;

delete from public.forum_moderation_log
where action in ('beta_add', 'beta_remove');

alter table public.forum_moderation_log
  drop constraint forum_moderation_log_action_check;
alter table public.forum_moderation_log
  add constraint forum_moderation_log_action_check
  check (action in (
    'hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve',
    'auto_hide', 'suspend', 'unsuspend', 'set_mode'
  ));

alter table public.forum_settings
  drop constraint forum_settings_mode_check;
alter table public.forum_settings
  add constraint forum_settings_mode_check
  check (mode in ('off', 'read_only', 'open'));

create or replace function public.forum_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.forum_mode() <> 'open' then
    raise exception using errcode = '55000', message = 'forum is not open for contributions';
  end if;
end;
$$;

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
  if not public.forum_username_is_allowed(handle) then
    raise exception using errcode = '22023',
      message = 'choose a 3 to 30 character username before contributing';
  end if;
  if profile_created > now() - interval '10 minutes' then
    raise exception using errcode = 'P0001',
      message = 'new accounts can contribute after 10 minutes';
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

create or replace function public.forum_admin_set_mode(p_mode text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_mode not in ('off', 'read_only', 'open') then
    raise exception using errcode = '22023', message = 'invalid forum mode';
  end if;
  update public.forum_settings
  set mode = p_mode, updated_at = now(), updated_by = actor where id = true;
  insert into public.forum_moderation_log
    (actor_id, action, target_type, reason)
  values (actor, 'set_mode', 'forum', p_mode);
  return p_mode;
end;
$$;

notify pgrst, 'reload schema';
commit;
