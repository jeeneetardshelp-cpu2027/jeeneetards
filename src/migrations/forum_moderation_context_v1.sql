-- Forum moderation-context v1.
-- Atomic, deliberately non-idempotent, and not authorized for production by
-- the existence of this file. Run the read-only preflight and audit first.
begin;

drop function public.forum_admin_list_reports(integer);

create function public.forum_admin_list_reports(p_limit integer default 100)
returns table (
  id bigint,
  reporter_id uuid,
  target_type text,
  target_id bigint,
  reason text,
  note text,
  priority text,
  status text,
  created_at timestamptz,
  post_id bigint,
  topic_slug text,
  post_title text,
  target_author_username text,
  content_preview text,
  target_exists boolean,
  target_is_hidden boolean,
  target_is_deleted boolean,
  post_is_locked boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select
    r.id,
    r.reporter_id,
    r.target_type,
    r.target_id,
    r.reason,
    r.note,
    r.priority,
    r.status,
    r.created_at,
    case when r.target_type = 'post' then p.id else c.post_id end as post_id,
    t.slug as topic_slug,
    thread.title as post_title,
    author.username as target_author_username,
    case
      when r.target_type = 'post' and p.id is not null then
        left(regexp_replace(p.body, '[[:space:]]+', ' ', 'g'), 600)
      when r.target_type = 'comment' and c.id is not null then
        left(regexp_replace(c.body, '[[:space:]]+', ' ', 'g'), 600)
      else null
    end as content_preview,
    case when r.target_type = 'post' then p.id is not null else c.id is not null end
      as target_exists,
    case when r.target_type = 'post' then p.hidden_at is not null else c.hidden_at is not null end
      as target_is_hidden,
    case when r.target_type = 'post' then p.deleted_at is not null else c.deleted_at is not null end
      as target_is_deleted,
    thread.locked_at is not null as post_is_locked
  from public.forum_reports r
  left join public.forum_posts p
    on r.target_type = 'post' and p.id = r.target_id
  left join public.forum_comments c
    on r.target_type = 'comment' and c.id = r.target_id
  left join public.forum_posts thread
    on thread.id = case when r.target_type = 'post' then p.id else c.post_id end
  left join public.forum_topics t on t.id = thread.topic_id
  left join public.profiles author
    on author.id = case when r.target_type = 'post' then p.author_id else c.author_id end
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
