-- Staging/test-only rollback for the moderation-context delta.
begin;

do $$
declare environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'moderation context rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  if environment_name not in ('staging', 'test') then
    raise exception 'moderation context rollback refused for environment %', coalesce(environment_name, 'unmarked');
  end if;
end;
$$;

drop function public.forum_admin_list_reports(integer);

create function public.forum_admin_list_reports(p_limit integer default 100)
returns table (
  id bigint, reporter_id uuid, target_type text, target_id bigint,
  reason text, note text, priority text, status text, created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception using errcode = '42501', message = 'not authorized'; end if;
  return query select r.id, r.reporter_id, r.target_type, r.target_id,
    r.reason, r.note, r.priority, r.status, r.created_at
  from public.forum_reports r
  where r.status = 'pending'
  order by case r.priority when 'urgent' then 0 else 1 end, r.created_at, r.id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
end;
$$;

revoke all on function public.forum_admin_list_reports(integer)
  from public, anon, authenticated;
grant execute on function public.forum_admin_list_reports(integer)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
