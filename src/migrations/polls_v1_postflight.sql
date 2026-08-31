-- POLLS v1 read-only postflight.
-- Run immediately after polls_v1.sql. It proves the four things that would be
-- silently wrong if the install had partially applied, and changes nothing.

begin transaction read only;

do $polls_postflight$
declare
  missing text[] := '{}'::text[];
  object_name text;
  current_mode text;
  leaked text[] := '{}'::text[];
  table_name_value text;
  live_polls integer;
begin
  foreach object_name in array array[
    'poll_settings', 'poll_image_hosts', 'polls', 'poll_options',
    'poll_votes', 'poll_comments', 'poll_reports', 'poll_rate_events'
  ] loop
    if to_regclass('public.' || object_name) is null then
      missing := array_append(missing, object_name);
    end if;
  end loop;

  foreach object_name in array array[
    'public.poll_mode()',
    'public.get_poll_topics()',
    'public.get_polls_feed(text,text,integer,integer)',
    'public.get_poll(text)',
    'public.get_poll_comments(bigint,integer,integer)',
    'public.poll_submit(text,text,text,jsonb)',
    'public.poll_cast_vote(bigint,bigint)',
    'public.poll_add_comment(bigint,text)',
    'public.poll_submit_report(text,bigint,text,text)',
    'public.poll_admin_list_pending(integer)',
    'public.poll_admin_review(bigint,text,text,timestamptz)',
    'public.poll_admin_set_mode(text)'
  ] loop
    if to_regprocedure(object_name) is null then
      missing := array_append(missing, object_name);
    end if;
  end loop;

  if cardinality(missing) > 0 then
    raise exception 'POLLS v1 POSTFLIGHT: install incomplete, missing: %',
      array_to_string(missing, ', ');
  end if;

  -- 1. It must have installed switched OFF. Installing is not releasing.
  select public.poll_mode() into current_mode;
  if current_mode <> 'off' then
    raise exception 'POLLS v1 POSTFLIGHT: expected mode off, found %', current_mode;
  end if;

  -- 2. Browser roles must have NO direct table access. If any grant leaked,
  --    every rule in the RPCs is bypassable with a crafted PostgREST query.
  foreach table_name_value in array array[
    'poll_settings', 'poll_image_hosts', 'polls', 'poll_options',
    'poll_votes', 'poll_comments', 'poll_reports', 'poll_rate_events'
  ] loop
    if exists (
      select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = table_name_value
        and grantee in ('anon', 'authenticated', 'PUBLIC')
    ) then
      leaked := array_append(leaked, table_name_value);
    end if;
  end loop;
  if cardinality(leaked) > 0 then
    raise exception 'POLLS v1 POSTFLIGHT: browser roles hold direct grants on: %',
      array_to_string(leaked, ', ');
  end if;

  -- 3. RLS must be enabled on all of them.
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('poll_settings', 'poll_image_hosts', 'polls', 'poll_options',
                        'poll_votes', 'poll_comments', 'poll_reports', 'poll_rate_events')
      and not c.relrowsecurity
  ) then
    raise exception 'POLLS v1 POSTFLIGHT: row level security is not enabled on every poll table';
  end if;

  -- 4. Nothing is published. A fresh install has no content at all.
  select count(*) into live_polls from public.polls;
  if live_polls <> 0 then
    raise exception 'POLLS v1 POSTFLIGHT: expected an empty polls table, found % rows', live_polls;
  end if;

  raise notice 'POLLS v1 POSTFLIGHT PASSED: mode off, no browser grants, RLS on, no content';
end;
$polls_postflight$;

commit;
