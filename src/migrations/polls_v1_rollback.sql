-- Destructive rollback for POLLS v1.
-- Staging/test only. It refuses an unmarked or production database, and must
-- never be bundled into a normal deployment.
--
-- Because polls_v1 writes nothing outside its own tables, this really is a
-- pure drop: no forum row, no profile and no catalogue row is touched. The
-- only shared objects it reads (forum_topics, forum_suspensions, profiles)
-- are left exactly as they were.

begin;

do $polls_rollback_guard$
declare environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'POLLS v1 rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'POLLS v1 rollback refused for environment %',
      coalesce(environment_name, 'unmarked');
  end if;
end;
$polls_rollback_guard$;

drop function if exists public.get_poll_topics();
drop function if exists public.get_polls_feed(text, text, integer, integer);
drop function if exists public.get_poll(text);
drop function if exists public.get_poll_comments(bigint, integer, integer);
drop function if exists public.get_my_poll_submissions();
drop function if exists public.poll_submit(text, text, text, jsonb);
drop function if exists public.poll_cast_vote(bigint, bigint);
drop function if exists public.poll_clear_vote(bigint);
drop function if exists public.poll_add_comment(bigint, text);
drop function if exists public.poll_edit_comment(bigint, text);
drop function if exists public.poll_delete_comment(bigint);
drop function if exists public.poll_submit_report(text, bigint, text, text);
drop function if exists public.poll_admin_set_mode(text);
drop function if exists public.poll_admin_list_pending(integer);
drop function if exists public.poll_admin_review(bigint, text, text, timestamptz);
drop function if exists public.poll_admin_set_status(bigint, text);
drop function if exists public.poll_admin_set_option_image(bigint, text);
drop function if exists public.poll_admin_set_comment_removed(bigint, boolean);
drop function if exists public.poll_admin_list_reports(integer);
drop function if exists public.poll_admin_resolve_report(bigint, text);
drop function if exists public.poll_recount_metrics(boolean);

-- Helpers. poll_options_json and poll_results_visible must go before the
-- tables, because they are declared over public.polls.
drop function if exists public.poll_options_json(bigint, uuid);
drop function if exists public.poll_results_visible(bigint, uuid);
drop function if exists public.poll_image_host_allowed(text);
drop function if exists public.poll_slugify(text);
drop function if exists public.poll_record_rate_event(uuid, text, bigint, integer, integer);
drop function if exists public.poll_require_reporter();
drop function if exists public.poll_require_voter();
drop function if exists public.poll_require_writer();
drop function if exists public.poll_require_open();
drop function if exists public.poll_mode();

-- Child tables first; the cascades would handle it, but an explicit order
-- makes a partial failure readable.
drop table if exists public.poll_rate_events;
drop table if exists public.poll_reports;
drop table if exists public.poll_comments;
drop table if exists public.poll_votes;
drop table if exists public.poll_options;
drop table if exists public.polls;
drop table if exists public.poll_image_hosts;
drop table if exists public.poll_settings;

-- Trigger functions last: their triggers went with the tables.
drop function if exists public.poll_apply_comment_delta();
drop function if exists public.poll_apply_vote_delta();
drop function if exists public.poll_touch_updated_at();

commit;
