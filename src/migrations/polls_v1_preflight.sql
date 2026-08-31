-- POLLS v1 read-only preflight.
-- Run against the intended target before polls_v1.sql. It changes nothing and
-- refuses a partial or previous poll installation rather than guessing at
-- drift.

begin transaction read only;

do $polls_preflight$
declare
  missing text[] := '{}'::text[];
  existing text[] := '{}'::text[];
  object_name text;
  active_topics integer;
begin
  -- Identity and the admin boundary.
  if to_regclass('public.profiles') is null then
    missing := array_append(missing, 'public.profiles');
  end if;
  if to_regprocedure('public.is_admin()') is null then
    missing := array_append(missing, 'public.is_admin()');
  end if;
  if to_regprocedure('auth.uid()') is null then
    missing := array_append(missing, 'auth.uid()');
  end if;
  if to_regclass('auth.users') is null then
    missing := array_append(missing, 'auth.users');
  end if;

  -- The two forum tables this module reads rather than duplicating. Polls are
  -- a separate feature with a separate mode switch, but they are NOT a
  -- standalone install: forum_v1 must already be present.
  if to_regclass('public.forum_topics') is null then
    missing := array_append(missing, 'public.forum_topics (install forum_v1 first)');
  end if;
  if to_regclass('public.forum_suspensions') is null then
    missing := array_append(missing, 'public.forum_suspensions (install forum_v1 first)');
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
        and column_name = 'is_admin'
    ) then missing := array_append(missing, 'profiles.is_admin'); end if;
  end if;

  foreach object_name in array array[
    'poll_settings', 'poll_image_hosts', 'polls', 'poll_options',
    'poll_votes', 'poll_comments', 'poll_reports', 'poll_rate_events'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;

  if to_regprocedure('public.poll_mode()') is not null then
    existing := array_append(existing, 'poll_mode()');
  end if;

  if cardinality(missing) > 0 then
    raise exception 'POLLS v1 PREFLIGHT: missing dependencies: %',
      array_to_string(missing, ', ');
  end if;
  if cardinality(existing) > 0 then
    raise exception 'POLLS v1 PREFLIGHT: these objects already exist; review drift before retrying: %',
      array_to_string(existing, ', ');
  end if;

  -- A poll must be filed under a subject, and the subject list is the forum's.
  -- Installing with no active topic would leave every submission impossible.
  select count(*) into active_topics from public.forum_topics where is_active;
  if active_topics = 0 then
    raise exception 'POLLS v1 PREFLIGHT: no active forum_topics, so no poll could be filed';
  end if;

  raise notice 'POLLS v1 PREFLIGHT PASSED: % active subjects available', active_topics;
end;
$polls_preflight$;

commit;
