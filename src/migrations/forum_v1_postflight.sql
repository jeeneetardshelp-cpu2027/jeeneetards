-- FORUM v1 read-only structural postflight.
-- It creates no fixtures and changes no forum state.

begin transaction read only;

do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.forum_settings') is null then missing := array_append(missing, 'forum_settings'); end if;
  if to_regclass('public.forum_topics') is null then missing := array_append(missing, 'forum_topics'); end if;
  if to_regclass('public.forum_posts') is null then missing := array_append(missing, 'forum_posts'); end if;
  if to_regclass('public.forum_comments') is null then missing := array_append(missing, 'forum_comments'); end if;
  if to_regclass('public.forum_votes') is null then missing := array_append(missing, 'forum_votes'); end if;
  if to_regclass('public.forum_user_stats') is null then missing := array_append(missing, 'forum_user_stats'); end if;
  if to_regclass('public.forum_reports') is null then missing := array_append(missing, 'forum_reports'); end if;
  if to_regclass('public.forum_moderation_log') is null then missing := array_append(missing, 'forum_moderation_log'); end if;
  if to_regclass('public.forum_suspensions') is null then missing := array_append(missing, 'forum_suspensions'); end if;
  if to_regclass('public.forum_rate_events') is null then missing := array_append(missing, 'forum_rate_events'); end if;

  if to_regprocedure('public.forum_mode()') is null then missing := array_append(missing, 'forum_mode()'); end if;
  if to_regprocedure('public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)') is null then
    missing := array_append(missing, 'get_forum_feed()');
  end if;
  if to_regprocedure('public.forum_create_post(text,text,text)') is null then missing := array_append(missing, 'forum_create_post()'); end if;
  if to_regprocedure('public.forum_cast_vote(text,bigint,smallint)') is null then missing := array_append(missing, 'forum_cast_vote()'); end if;
  if to_regprocedure('public.forum_submit_report(text,bigint,text,text)') is null then missing := array_append(missing, 'forum_submit_report()'); end if;
  if to_regprocedure('public.forum_admin_moderate(text,bigint,text,text,bigint)') is null then missing := array_append(missing, 'forum_admin_moderate()'); end if;
  if to_regprocedure('public.forum_recount_karma(boolean)') is null then missing := array_append(missing, 'forum_recount_karma()'); end if;

  if cardinality(missing) > 0 then
    raise exception 'FORUM v1 POSTFLIGHT: missing: %', array_to_string(missing, ', ');
  end if;

  if (select mode from public.forum_settings where id = true) <> 'off' then
    raise exception 'FORUM v1 POSTFLIGHT: forum did not fail closed';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'FORUM v1 POSTFLIGHT: expected six active launch topics';
  end if;
  if exists (
    select 1 from public.forum_topics where slug in ('motivation', 'general') and is_active
  ) then raise exception 'FORUM v1 POSTFLIGHT: deferred topics are active'; end if;

  if has_table_privilege('anon', 'public.forum_posts', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_posts', 'INSERT')
     or has_table_privilege('authenticated', 'public.forum_votes', 'SELECT')
     or has_table_privilege('authenticated', 'public.forum_moderation_log', 'UPDATE') then
    raise exception 'FORUM v1 POSTFLIGHT: direct browser table privilege leaked';
  end if;
  if not has_function_privilege(
    'anon',
    'public.get_forum_feed(text,text,text,double precision,integer,timestamp with time zone,bigint,integer)',
    'EXECUTE'
  ) then raise exception 'FORUM v1 POSTFLIGHT: anonymous feed RPC missing'; end if;
  if has_function_privilege('anon', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous create RPC leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_create_post(text,text,text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: authenticated create RPC missing';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_set_mode(text)', 'EXECUTE') then
    raise exception 'FORUM v1 POSTFLIGHT: anonymous mode control leaked';
  end if;
end;
$$;

select
  (select mode from public.forum_settings where id = true) as forum_mode,
  (select count(*) from public.forum_topics where is_active) as active_topics,
  (select count(*) from public.forum_posts) as posts,
  (select count(*) from public.forum_comments) as comments,
  (select count(*) from public.forum_reports where status = 'pending') as pending_reports,
  false as database_changed;

commit;
