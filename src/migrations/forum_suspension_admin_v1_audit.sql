-- Read-only suspension audit. Counts only; no username, reason text,
-- moderator identity, or student content is returned.
begin transaction read only;

select
  count(*)::integer as suspension_rows,
  count(*) filter (where suspended_until > now())::integer as active_suspensions,
  count(*) filter (where suspended_until <= now())::integer as expired_rows_not_yet_lifted,
  count(*) filter (
    where suspended_until > now() + interval '365 days'
  )::integer as suspensions_beyond_the_wrapper_limit,
  count(*) filter (where created_by is null)::integer as rows_with_no_recorded_moderator
from public.forum_suspensions;

select
  count(*) filter (where action = 'suspend')::integer as suspend_log_entries,
  count(*) filter (where action = 'unsuspend')::integer as unsuspend_log_entries
from public.forum_moderation_log;

rollback;
