-- Forum closed beta v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight and audit first.
begin;

alter table public.forum_settings
  drop constraint forum_settings_mode_check;
alter table public.forum_settings
  add constraint forum_settings_mode_check
  check (mode in ('off', 'read_only', 'beta', 'open'));

alter table public.forum_moderation_log
  drop constraint forum_moderation_log_action_check;
alter table public.forum_moderation_log
  add constraint forum_moderation_log_action_check
  check (action in (
    'hide', 'unhide', 'lock', 'unlock', 'remove', 'solve', 'unsolve',
    'auto_hide', 'suspend', 'unsuspend', 'set_mode', 'beta_add', 'beta_remove'
  ));

create table public.forum_beta_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references public.profiles(id) on delete set null
);

alter table public.forum_beta_members enable row level security;
revoke all on table public.forum_beta_members
  from public, anon, authenticated, service_role;

create function public.forum_is_beta_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    auth.uid() is not null and exists (
      select 1 from public.forum_beta_members m where m.user_id = auth.uid()
    ),
    false
  );
$$;

create or replace function public.forum_require_open()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.forum_mode() not in ('beta', 'open') then
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
  if public.forum_mode() = 'beta' and not public.forum_is_beta_member() then
    raise exception using errcode = '42501', message = 'closed beta access is required';
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
  if p_mode not in ('off', 'read_only', 'beta', 'open') then
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

create function public.forum_admin_set_beta_member(
  p_username text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  candidate text := btrim(coalesce(p_username, ''));
  target_user uuid;
  affected_rows integer := 0;
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_enabled is null then
    raise exception using errcode = '22023', message = 'beta membership state is required';
  end if;
  select p.id into target_user
  from public.profiles p
  where lower(btrim(p.username)) = lower(candidate)
    and public.forum_username_is_allowed(p.username);
  if target_user is null then
    raise exception using errcode = 'P0002', message = 'beta student username not found';
  end if;

  if p_enabled then
    insert into public.forum_beta_members (user_id, added_by)
    values (target_user, actor)
    on conflict (user_id) do nothing;
  else
    delete from public.forum_beta_members where user_id = target_user;
  end if;
  get diagnostics affected_rows = row_count;

  if affected_rows > 0 then
    insert into public.forum_moderation_log
      (actor_id, action, target_type, target_user_id, reason)
    values (
      actor,
      case when p_enabled then 'beta_add' else 'beta_remove' end,
      'user',
      target_user,
      'closed beta membership'
    );
  end if;
  return exists (
    select 1 from public.forum_beta_members where user_id = target_user
  );
end;
$$;

create function public.forum_admin_list_beta_members()
returns table (
  username text,
  added_at timestamptz,
  added_by_username text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select p.username, m.added_at, adder.username
  from public.forum_beta_members m
  join public.profiles p on p.id = m.user_id
  left join public.profiles adder on adder.id = m.added_by
  order by lower(p.username), p.id;
end;
$$;

revoke all on function public.forum_is_beta_member()
  from public, anon, authenticated;
revoke all on function public.forum_admin_set_beta_member(text,boolean)
  from public, anon, authenticated;
revoke all on function public.forum_admin_list_beta_members()
  from public, anon, authenticated;
grant execute on function public.forum_is_beta_member()
  to authenticated, service_role;
grant execute on function public.forum_admin_set_beta_member(text,boolean)
  to authenticated, service_role;
grant execute on function public.forum_admin_list_beta_members()
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
