-- Staging/test-only rollback for the forum suspension-admin delta.
--
-- This removes only the two wrappers added by this delta. It deliberately does
-- NOT delete forum_suspensions rows or moderation-log entries: a suspension
-- recorded against a real student is moderation history, and the reviewed
-- forum_admin_set_suspension(uuid, ...) can still lift one after rollback.
begin;

do $$
declare
  environment_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'suspension admin rollback refused: app_environment is missing';
  end if;
  execute 'select name from public.app_environment where id = true limit 1'
    into environment_name;
  -- NULL NOT IN (...) is NULL rather than true. Reject a missing marker row
  -- explicitly so an unmarked database cannot pass this destructive guard.
  if environment_name is null
     or environment_name not in ('staging', 'test') then
    raise exception 'suspension admin rollback refused for environment %',
      coalesce(environment_name, 'unmarked');
  end if;
end;
$$;

drop function public.forum_admin_list_suspensions();
drop function public.forum_admin_set_suspension_by_username(text,integer,text);

notify pgrst, 'reload schema';
commit;

select
  to_regprocedure('public.forum_admin_set_suspension_by_username(text,integer,text)') is null
    as set_suspension_by_username_removed,
  to_regprocedure('public.forum_admin_list_suspensions()') is null
    as list_suspensions_removed,
  to_regprocedure('public.forum_admin_set_suspension(uuid,timestamptz,text)') is not null
    as reviewed_suspension_rpc_retained;
