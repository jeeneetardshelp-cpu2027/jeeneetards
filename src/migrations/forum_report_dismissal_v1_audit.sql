-- Read-only report-dismissal audit. Counts only; no report text, reporter
-- identity, or student content is returned.
begin transaction read only;

select
  count(*) filter (where status = 'pending')::integer as pending_reports,
  count(*) filter (
    where status = 'pending' and priority = 'urgent'
  )::integer as pending_urgent_reports,
  count(*) filter (where status = 'dismissed')::integer as dismissed_reports,
  count(*) filter (
    where (status = 'pending' and (resolved_at is not null or resolved_by is not null))
       or (status <> 'pending' and resolved_at is null)
  )::integer as inconsistent_resolution_rows
from public.forum_reports;

rollback;
