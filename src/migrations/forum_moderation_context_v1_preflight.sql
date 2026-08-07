-- Read-only preflight for the forum moderation-context delta.
begin transaction read only;

do $$
declare
  result_contract text;
begin
  if to_regprocedure('public.forum_admin_list_reports(integer)') is null then
    raise exception 'moderation context preflight: forum_admin_list_reports(integer) is missing';
  end if;
  if to_regclass('public.forum_reports') is null
     or to_regclass('public.forum_posts') is null
     or to_regclass('public.forum_comments') is null
     or to_regclass('public.forum_topics') is null then
    raise exception 'moderation context preflight: forum v1 tables are incomplete';
  end if;

  select pg_get_function_result('public.forum_admin_list_reports(integer)'::regprocedure)
    into result_contract;
  if result_contract not like 'TABLE(id bigint, reporter_id uuid, target_type text, target_id bigint,%'
     or result_contract like '%post_id bigint%'
     or result_contract like '%content_preview text%' then
    raise exception 'moderation context preflight: report-list contract drifted; review before retrying';
  end if;
end;
$$;

rollback;
