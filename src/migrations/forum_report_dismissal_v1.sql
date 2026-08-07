-- Forum report dismissal v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight and audit first.
begin;

create function public.forum_admin_dismiss_report(p_report_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  update public.forum_reports
  set status = 'dismissed', resolved_at = now(), resolved_by = actor
  where id = p_report_id and status = 'pending';

  if not found then
    raise exception using errcode = 'P0002', message = 'pending report not found';
  end if;
end;
$$;

revoke all on function public.forum_admin_dismiss_report(bigint)
  from public, anon, authenticated;
grant execute on function public.forum_admin_dismiss_report(bigint)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
