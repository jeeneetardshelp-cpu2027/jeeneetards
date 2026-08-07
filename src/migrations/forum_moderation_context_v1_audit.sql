-- Read-only report-context audit. It returns counts only and exposes no report
-- text, reporter identity, or student content.
begin transaction read only;

select
  count(*) filter (where r.status = 'pending')::integer as pending_reports,
  count(*) filter (
    where r.status = 'pending' and r.reason = 'self_harm'
  )::integer as pending_urgent_self_harm_reports,
  count(*) filter (
    where r.status = 'pending'
      and ((r.target_type = 'post' and p.id is null)
        or (r.target_type = 'comment' and c.id is null))
  )::integer as pending_reports_with_missing_targets,
  count(*) filter (
    where r.status = 'pending' and r.target_type = 'comment'
      and c.id is not null and cp.id is null
  )::integer as pending_comment_reports_with_missing_posts
from public.forum_reports r
left join public.forum_posts p
  on r.target_type = 'post' and p.id = r.target_id
left join public.forum_comments c
  on r.target_type = 'comment' and c.id = r.target_id
left join public.forum_posts cp
  on cp.id = c.post_id;

rollback;
