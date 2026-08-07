-- Destructive rollback for FORUM v1.
-- It is intentionally staging/test-only and refuses an unmarked or production
-- database. Never bundle this file into a normal deployment.

begin;

do $$
declare environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'FORUM v1 rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'FORUM v1 rollback refused for environment %', coalesce(environment_name, 'unmarked');
  end if;
end;
$$;

drop trigger if exists trg_forum_anonymize_profile on public.profiles;

drop function if exists public.get_forum_topics();
drop function if exists public.get_forum_feed(text,text,text,double precision,integer,timestamptz,bigint,integer);
drop function if exists public.get_forum_post(bigint);
drop function if exists public.get_forum_comments(bigint);
drop function if exists public.forum_create_post(text,text,text);
drop function if exists public.forum_edit_post(bigint,text,text);
drop function if exists public.forum_delete_post(bigint);
drop function if exists public.forum_toggle_solved(bigint);
drop function if exists public.forum_create_comment(bigint,bigint,text);
drop function if exists public.forum_edit_comment(bigint,text);
drop function if exists public.forum_delete_comment(bigint);
drop function if exists public.forum_cast_vote(text,bigint,smallint);
drop function if exists public.forum_submit_report(text,bigint,text,text);
drop function if exists public.forum_admin_set_mode(text);
drop function if exists public.forum_admin_moderate(text,bigint,text,text,bigint);
drop function if exists public.forum_admin_set_suspension(uuid,timestamptz,text);
drop function if exists public.forum_admin_list_reports(integer);
drop function if exists public.forum_recount_metrics(boolean);
drop function if exists public.forum_recount_karma(boolean);

drop table if exists public.forum_rate_events;
drop table if exists public.forum_suspensions;
drop table if exists public.forum_moderation_log;
drop table if exists public.forum_reports;
drop table if exists public.forum_votes;
drop table if exists public.forum_comments;
drop table if exists public.forum_posts;
drop table if exists public.forum_user_stats;
drop table if exists public.forum_topics;
drop table if exists public.forum_settings;

drop function if exists public.forum_anonymize_profile_content();
drop function if exists public.forum_apply_vote_delta();
drop function if exists public.forum_prepare_vote();
drop function if exists public.forum_adjust_karma(uuid,integer);
drop function if exists public.forum_apply_comment_count_delta();
drop function if exists public.forum_apply_user_content_delta();
drop function if exists public.forum_prepare_comment();
drop function if exists public.forum_prepare_post();
drop function if exists public.forum_record_rate_event(uuid,text,bigint,integer,integer);
drop function if exists public.forum_require_reporter();
drop function if exists public.forum_require_writer();
drop function if exists public.forum_require_open();
drop function if exists public.forum_mode();
drop function if exists public.forum_hot_rank(integer,timestamptz);

notify pgrst, 'reload schema';

commit;
