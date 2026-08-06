-- FORUM v1 read-only preflight.
-- Run against the intended target before forum_v1.sql. It changes nothing and
-- refuses a partial/previous forum installation rather than guessing at drift.

begin transaction read only;

do $$
declare
  missing text[] := '{}'::text[];
  existing text[] := '{}'::text[];
  object_name text;
begin
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'public.profiles');
  end if;
  if to_regprocedure('public.is_admin()') is null then
    missing := array_append(missing, 'public.is_admin()');
  end if;
  if to_regprocedure('auth.uid()') is null then
    missing := array_append(missing, 'auth.uid()');
  end if;
  if to_regprocedure('auth.role()') is null then
    missing := array_append(missing, 'auth.role()');
  end if;
  if to_regclass('auth.users') is null then
    missing := array_append(missing, 'auth.users');
  end if;

  if to_regclass('public.profiles') is not null then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'id' and udt_name = 'uuid'
    ) then missing := array_append(missing, 'profiles.id uuid'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'username'
    ) then missing := array_append(missing, 'profiles.username'); end if;
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and column_name = 'created_at'
    ) then missing := array_append(missing, 'profiles.created_at'); end if;
  end if;

  foreach object_name in array array[
    'forum_settings', 'forum_topics', 'forum_posts', 'forum_comments',
    'forum_votes', 'forum_user_stats', 'forum_reports',
    'forum_moderation_log', 'forum_suspensions', 'forum_rate_events'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: missing dependencies: %',
      array_to_string(missing, ', ');
  end if;
  if cardinality(existing) > 0 then
    raise exception 'FORUM v1 PREFLIGHT: existing forum objects require drift review: %',
      array_to_string(existing, ', ');
  end if;
end;
$$;

select
  current_database() as database_name,
  to_regclass('public.profiles') is not null as profiles_ready,
  to_regprocedure('public.is_admin()') is not null as admin_guard_ready,
  false as database_changed;

commit;
