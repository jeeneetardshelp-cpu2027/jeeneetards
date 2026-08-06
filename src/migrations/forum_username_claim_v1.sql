-- Forum username claim v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight first.
begin;

create function public.forum_username_is_allowed(p_username text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select
    p_username = btrim(p_username)
    and btrim(coalesce(p_username, '')) ~ '^[A-Za-z0-9_-]{3,30}$'
    and lower(btrim(p_username)) !~
      '^(admin|administrator|mod|moderator|staff|support|official|system|root|automod)([-_]?[0-9]+)?$'
    and lower(btrim(p_username)) not in (
      'anonymous', 'deleted_student', 'deleted-student',
      'fuck', 'fucker', 'bitch', 'chutiya', 'madarchod', 'bhenchod'
    )
    and lower(btrim(p_username)) !~ '^jeeneetards?(help)?([-_].*)?$'
$$;

create unique index forum_profiles_username_ci_idx
  on public.profiles (lower(btrim(username)))
  where username is not null;

create function public.forum_get_my_identity()
returns table (username text, needs_username boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_username text;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to continue';
  end if;
  select p.username into current_username
  from public.profiles p where p.id = uid;
  return query select
    case when public.forum_username_is_allowed(current_username)
      then current_username else null end,
    not public.forum_username_is_allowed(current_username);
end;
$$;

create function public.forum_claim_username(p_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  candidate text := btrim(coalesce(p_username, ''));
  current_username text;
begin
  if uid is null then
    raise exception using errcode = '42501', message = 'sign in to choose a username';
  end if;
  if not exists (select 1 from auth.users u where u.id = uid) then
    raise exception using errcode = '42501', message = 'student account is missing';
  end if;
  if not public.forum_username_is_allowed(candidate) then
    raise exception using errcode = '22023',
      message = 'username must be 3 to 30 letters, numbers, underscores or hyphens and cannot be reserved';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('forum-username:' || lower(candidate), 0));
  if exists (
    select 1 from public.profiles p
    where lower(btrim(p.username)) = lower(candidate) and p.id <> uid
  ) then
    raise exception using errcode = '23505', message = 'username is already taken';
  end if;

  select p.username into current_username
  from public.profiles p where p.id = uid for update;
  if public.forum_username_is_allowed(current_username) then
    if lower(btrim(current_username)) = lower(candidate) then return current_username; end if;
    raise exception using errcode = '55000', message = 'username has already been claimed';
  end if;

  insert into public.profiles (id, username)
  values (uid, candidate)
  on conflict (id) do update set username = excluded.username;
  return candidate;
end;
$$;

-- Keep the publishing gate aligned with the claim contract, including hyphens
-- and server-side reserved-name rejection.
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

-- RLS identifies the row, but cannot enforce the claim policy for a direct
-- update. Preserve ordinary profile editing as column-scoped grants while all
-- username writes move behind forum_claim_username().
revoke insert, update on table public.profiles from public, anon, authenticated;
grant insert (id, full_name, avatar_url) on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

revoke all on function public.forum_username_is_allowed(text) from public, anon, authenticated;
revoke all on function public.forum_get_my_identity() from public, anon, authenticated;
revoke all on function public.forum_claim_username(text) from public, anon, authenticated;
grant execute on function public.forum_get_my_identity() to authenticated, service_role;
grant execute on function public.forum_claim_username(text) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
