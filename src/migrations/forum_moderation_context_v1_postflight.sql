-- Read-only structural and grant verification for moderation context v1.
begin transaction read only;

do $$
declare
  result_contract text;
begin
  if to_regprocedure('public.forum_admin_list_reports(integer)') is null then
    raise exception 'moderation context postflight: report-list RPC is missing';
  end if;
  select pg_get_function_result('public.forum_admin_list_reports(integer)'::regprocedure)
    into result_contract;
  if result_contract not like '%post_id bigint%'
     or result_contract not like '%content_preview text%'
     or result_contract not like '%target_exists boolean%'
     or result_contract not like '%post_is_locked boolean%' then
    raise exception 'moderation context postflight: enriched result contract is incomplete';
  end if;
  if has_function_privilege('anon', 'public.forum_admin_list_reports(integer)', 'execute') then
    raise exception 'moderation context postflight: anonymous execute grant leaked';
  end if;
  if not has_function_privilege('authenticated', 'public.forum_admin_list_reports(integer)', 'execute') then
    raise exception 'moderation context postflight: authenticated execute grant is missing';
  end if;
end;
$$;

rollback;
