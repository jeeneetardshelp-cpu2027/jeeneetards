begin;

create table if not exists public.catalog_management_audit (
  id bigint generated always as identity primary key,
  action text not null check (
    action in (
      'update-playlist',
      'set-video-taxonomy',
      'clear-video-taxonomy',
      'reassign-video-chapter',
      'delete-playlist'
    )
  ),
  playlist_id bigint,
  video_id bigint,
  before_state jsonb not null,
  after_state jsonb,
  actor_id uuid,
  occurred_at timestamptz not null default now()
);

alter table public.catalog_management_audit enable row level security;
revoke all on table public.catalog_management_audit
  from public, anon, authenticated, service_role;
drop policy if exists "admin reads catalog management audit"
  on public.catalog_management_audit;
create policy "admin reads catalog management audit"
  on public.catalog_management_audit
  for select to authenticated
  using (public.is_admin());
grant select on table public.catalog_management_audit
  to authenticated, service_role;

create or replace function public.catalog_playlist_snapshot(p_playlist_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(p) || jsonb_build_object(
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(plg.learning_goal_id order by plg.learning_goal_id)
        from public.playlist_learning_goals plg
        where plg.playlist_id = p.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(pcl.class_level_id order by pcl.class_level_id)
        from public.playlist_class_levels pcl
        where pcl.playlist_id = p.id
      ), '[]'::jsonb),
    'video_links',
      coalesce((
        select jsonb_agg(to_jsonb(pv) order by pv.position, pv.id)
        from public.playlist_videos pv
        where pv.playlist_id = p.id
      ), '[]'::jsonb),
    'ratings',
      coalesce((
        select jsonb_agg(to_jsonb(pr) order by pr.created_at, pr.id)
        from public.playlist_ratings pr
        where pr.playlist_id = p.id
      ), '[]'::jsonb)
  )
  from public.playlists p
  where p.id = p_playlist_id;
$$;

create or replace function public.catalog_video_taxonomy_snapshot(p_video_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(v) || jsonb_build_object(
    'learning_goal_ids',
      coalesce((
        select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
        from public.video_learning_goals vlg
        where vlg.video_id = v.id
      ), '[]'::jsonb),
    'class_level_ids',
      coalesce((
        select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
        from public.video_class_levels vcl
        where vcl.video_id = v.id
      ), '[]'::jsonb)
  )
  from public.videos v
  where v.id = p_video_id;
$$;

revoke all on function public.catalog_playlist_snapshot(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.catalog_video_taxonomy_snapshot(bigint)
  from public, anon, authenticated, service_role;

create or replace function public.catalog_manage_capability()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'version', 11,
    'paginated_playlist_list', true,
    'playlist_metadata_and_taxonomy', true,
    'video_taxonomy', true,
    'video_chapter_reassignment', true,
    'playlist_deletion', true,
    'audit_snapshots', true
  );
end;
$$;

create or replace function public.get_manage_playlists(
  p_search text default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  total_count bigint,
  playlist_id bigint,
  title text,
  teacher text,
  youtube_playlist_id text,
  channel_id bigint,
  channel_name text,
  category_id bigint,
  category_name text,
  subject_id bigint,
  subject_name text,
  content_type text,
  language text,
  difficulty text,
  audience_focus text,
  display_order int,
  learning_goal_ids bigint[],
  class_level_ids bigint[],
  videos jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid pagination bounds';
  end if;

  return query
  select
    count(*) over() as total_count,
    p.id,
    p.title,
    p.teacher,
    p.youtube_playlist_id,
    p.channel_id,
    ic.name,
    p.category_id,
    c.name,
    p.subject_id,
    s.name,
    p.content_type,
    p.language,
    p.difficulty,
    p.audience_focus,
    p.display_order,
    coalesce((
      select array_agg(plg.learning_goal_id order by lg.display_order, lg.id)
      from public.playlist_learning_goals plg
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where plg.playlist_id = p.id
    ), '{}'::bigint[]),
    coalesce((
      select array_agg(pcl.class_level_id order by cl.display_order, cl.id)
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = p.id
    ), '{}'::bigint[]),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'membership_id', pv.id,
          'position', pv.position,
          'video_id', v.id,
          'title', v.title,
          'youtube_video_id', v.youtube_video_id,
          'chapter_id', v.chapter_id,
          'chapter_name', ch.name,
          'shared_playlist_count', (
            select count(*)
            from public.playlist_videos shared
            where shared.video_id = v.id
          ),
          'learning_goal_ids', coalesce((
            select jsonb_agg(vlg.learning_goal_id order by vlg.learning_goal_id)
            from public.video_learning_goals vlg
            where vlg.video_id = v.id
          ), '[]'::jsonb),
          'class_level_ids', coalesce((
            select jsonb_agg(vcl.class_level_id order by vcl.class_level_id)
            from public.video_class_levels vcl
            where vcl.video_id = v.id
          ), '[]'::jsonb)
        )
        order by pv.position, pv.id
      )
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
      left join public.chapters ch on ch.id = v.chapter_id
      where pv.playlist_id = p.id
    ), '[]'::jsonb)
  from public.playlists p
  join public.institutes_channels ic on ic.id = p.channel_id
  join public.categories c on c.id = p.category_id
  left join public.subjects s on s.id = p.subject_id
  where nullif(btrim(coalesce(p_search, '')), '') is null
     or p.title ilike '%' || btrim(p_search) || '%'
     or coalesce(p.teacher, '') ilike '%' || btrim(p_search) || '%'
     or coalesce(p.youtube_playlist_id, '') ilike '%' || btrim(p_search) || '%'
  order by p.display_order, p.id
  limit p_limit offset p_offset;
end;
$$;

create or replace function public.update_managed_playlist(
  p_playlist_id bigint,
  p_expected_title text,
  p_title text,
  p_teacher text,
  p_channel_id bigint,
  p_learning_goal_ids bigint[],
  p_class_level_ids bigint[],
  p_content_type text,
  p_language text,
  p_difficulty text,
  p_audience_focus text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_playlist public.playlists%rowtype;
  v_title text := regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g');
  v_teacher text := nullif(regexp_replace(btrim(coalesce(p_teacher, '')), '\s+', ' ', 'g'), '');
  v_content_type text := nullif(btrim(coalesce(p_content_type, '')), '');
  v_language text := nullif(btrim(coalesce(p_language, '')), '');
  v_difficulty text := nullif(btrim(coalesce(p_difficulty, '')), '');
  v_audience_focus text := nullif(btrim(coalesce(p_audience_focus, '')), '');
  v_category_slug text;
  v_before jsonb;
  v_after jsonb;
  v_legacy_classes text[];
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_playlist
  from public.playlists
  where id = p_playlist_id
  for update;
  if not found then
    raise exception 'unknown playlist_id %', p_playlist_id;
  end if;
  if v_playlist.title is distinct from p_expected_title then
    raise exception 'expected title does not match current playlist title';
  end if;
  if char_length(v_title) < 3 or char_length(v_title) > 160 then
    raise exception 'title must contain 3 to 160 characters';
  end if;
  if not exists (
    select 1 from public.institutes_channels where id = p_channel_id
  ) then
    raise exception 'unknown channel_id %', p_channel_id;
  end if;
  if coalesce(cardinality(p_learning_goal_ids), 0) = 0 then
    raise exception 'at least one learning goal is required';
  end if;
  if coalesce(cardinality(p_class_level_ids), 0) = 0 then
    raise exception 'at least one class level is required';
  end if;
  if (
    select count(*) from unnest(p_learning_goal_ids) as goals(goal_id)
  ) <> (
    select count(distinct goal_id)
    from unnest(p_learning_goal_ids) as goals(goal_id)
  ) then
    raise exception 'duplicate learning goal ids are not allowed';
  end if;
  if (
    select count(*) from unnest(p_class_level_ids) as classes(class_id)
  ) <> (
    select count(distinct class_id)
    from unnest(p_class_level_ids) as classes(class_id)
  ) then
    raise exception 'duplicate class level ids are not allowed';
  end if;
  if exists (
    select 1
    from unnest(p_learning_goal_ids) as goals(goal_id)
    where not exists (
      select 1 from public.learning_goals where id = goals.goal_id
    )
  ) then
    raise exception 'unknown learning goal id';
  end if;
  if exists (
    select 1
    from unnest(p_class_level_ids) as classes(class_id)
    where not exists (
      select 1 from public.class_levels where id = classes.class_id
    )
  ) then
    raise exception 'unknown class level id';
  end if;

  select c.slug
  into v_category_slug
  from public.categories c
  where c.id = v_playlist.category_id;
  if exists (
    select 1
    from public.learning_goals lg
    where lg.id = any(p_learning_goal_ids)
      and lg.slug is distinct from v_category_slug
  ) then
    raise exception 'learning goal does not match the playlist category';
  end if;
  if v_category_slug in ('jee', 'neet') and exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and cl.slug not in ('class-11', 'class-12', 'dropper')
  ) then
    raise exception 'class level does not match the playlist category';
  end if;
  if v_content_type is not null and v_content_type not in (
    'full-course', 'one-shot', 'revision', 'pyq', 'practice'
  ) then
    raise exception 'invalid content type';
  end if;
  if v_language is not null and v_language not in (
    'hindi', 'english', 'hinglish'
  ) then
    raise exception 'invalid language';
  end if;
  if v_difficulty is not null and v_difficulty not in (
    'beginner', 'intermediate', 'advanced'
  ) then
    raise exception 'invalid difficulty';
  end if;
  if v_audience_focus is not null and not exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and v_audience_focus = case cl.slug
        when 'class-10' then '10th'
        when 'class-11' then '11th'
        when 'class-12' then '12th'
        when 'dropper' then 'dropper'
        else cl.slug
      end
  ) then
    raise exception 'audience focus must match a selected class level';
  end if;

  v_before := public.catalog_playlist_snapshot(p_playlist_id);

  update public.playlists
  set title = v_title,
      teacher = v_teacher,
      channel_id = p_channel_id,
      content_type = v_content_type,
      language = v_language,
      difficulty = v_difficulty,
      audience_focus = v_audience_focus
  where id = p_playlist_id;

  delete from public.playlist_learning_goals
  where playlist_id = p_playlist_id;
  insert into public.playlist_learning_goals (
    playlist_id, learning_goal_id
  )
  select p_playlist_id, goals.goal_id
  from unnest(p_learning_goal_ids) as goals(goal_id);

  delete from public.playlist_class_levels
  where playlist_id = p_playlist_id;
  insert into public.playlist_class_levels (
    playlist_id, class_level_id
  )
  select p_playlist_id, classes.class_id
  from unnest(p_class_level_ids) as classes(class_id);

  select coalesce(array_agg(
    case cl.slug
      when 'class-10' then '10th'
      when 'class-11' then '11th'
      when 'class-12' then '12th'
      when 'dropper' then 'dropper'
      else cl.slug
    end
    order by cl.display_order, cl.id
  ), '{}'::text[])
  into v_legacy_classes
  from public.class_levels cl
  where cl.id = any(p_class_level_ids);

  update public.playlists
  set class_levels = v_legacy_classes
  where id = p_playlist_id;

  v_after := public.catalog_playlist_snapshot(p_playlist_id);
  insert into public.catalog_management_audit (
    action, playlist_id, before_state, after_state, actor_id
  ) values (
    'update-playlist', p_playlist_id, v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'title', v_title,
    'learning_goals', cardinality(p_learning_goal_ids),
    'class_levels', cardinality(p_class_level_ids)
  );
end;
$$;

create or replace function public.set_managed_video_taxonomy(
  p_playlist_id bigint,
  p_video_id bigint,
  p_learning_goal_ids bigint[],
  p_class_level_ids bigint[],
  p_allow_shared boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shared int;
  v_category_slug text;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.playlist_videos
    where playlist_id = p_playlist_id and video_id = p_video_id
  ) then
    raise exception 'video is not linked to this playlist';
  end if;
  if coalesce(cardinality(p_learning_goal_ids), 0) = 0
     or coalesce(cardinality(p_class_level_ids), 0) = 0 then
    raise exception 'learning goals and class levels are required';
  end if;
  if (
    select count(*) from unnest(p_learning_goal_ids) as goals(goal_id)
  ) <> (
    select count(distinct goal_id)
    from unnest(p_learning_goal_ids) as goals(goal_id)
  ) or (
    select count(*) from unnest(p_class_level_ids) as classes(class_id)
  ) <> (
    select count(distinct class_id)
    from unnest(p_class_level_ids) as classes(class_id)
  ) then
    raise exception 'duplicate taxonomy ids are not allowed';
  end if;
  if exists (
    select 1 from unnest(p_learning_goal_ids) as goals(goal_id)
    where not exists (
      select 1 from public.learning_goals where id = goals.goal_id
    )
  ) or exists (
    select 1 from unnest(p_class_level_ids) as classes(class_id)
    where not exists (
      select 1 from public.class_levels where id = classes.class_id
    )
  ) then
    raise exception 'unknown taxonomy id';
  end if;

  select c.slug
  into v_category_slug
  from public.videos v
  join public.categories c on c.id = v.category_id
  where v.id = p_video_id
  for update of v;
  if not found then
    raise exception 'unknown video_id %', p_video_id;
  end if;
  if exists (
    select 1
    from public.learning_goals lg
    where lg.id = any(p_learning_goal_ids)
      and lg.slug is distinct from v_category_slug
  ) then
    raise exception 'learning goal does not match the video category';
  end if;
  if v_category_slug in ('jee', 'neet') and exists (
    select 1
    from public.class_levels cl
    where cl.id = any(p_class_level_ids)
      and cl.slug not in ('class-11', 'class-12', 'dropper')
  ) then
    raise exception 'class level does not match the video category';
  end if;

  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels where video_id = p_video_id;
  insert into public.video_learning_goals (video_id, learning_goal_id)
  select p_video_id, goals.goal_id
  from unnest(p_learning_goal_ids) as goals(goal_id);
  insert into public.video_class_levels (video_id, class_level_id)
  select p_video_id, classes.class_id
  from unnest(p_class_level_ids) as classes(class_id);
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'set-video-taxonomy', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'shared_playlist_count', v_shared,
    'learning_goals', cardinality(p_learning_goal_ids),
    'class_levels', cardinality(p_class_level_ids)
  );
end;
$$;

create or replace function public.clear_managed_video_taxonomy(
  p_playlist_id bigint,
  p_video_id bigint,
  p_allow_shared boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shared int;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.playlist_videos
    where playlist_id = p_playlist_id and video_id = p_video_id
  ) then
    raise exception 'video is not linked to this playlist';
  end if;
  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  delete from public.video_learning_goals where video_id = p_video_id;
  delete from public.video_class_levels where video_id = p_video_id;
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'clear-video-taxonomy', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'shared_playlist_count', v_shared,
    'learning_goals', 0,
    'class_levels', 0
  );
end;
$$;

create or replace function public.reassign_video_chapter(
  p_playlist_id bigint,
  p_video_id bigint,
  p_chapter_id bigint,
  p_expected_current_chapter_id bigint,
  p_allow_shared boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video_subject_id bigint;
  v_current_chapter_id bigint;
  v_chapter_subject_id bigint;
  v_shared int;
  v_before jsonb;
  v_after jsonb;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select v.subject_id, v.chapter_id
  into v_video_subject_id, v_current_chapter_id
  from public.videos v
  where v.id = p_video_id
    and exists (
      select 1
      from public.playlist_videos pv
      where pv.playlist_id = p_playlist_id
        and pv.video_id = v.id
    )
  for update;
  if not found then
    raise exception 'video is not linked to this playlist';
  end if;
  if v_current_chapter_id is distinct from p_expected_current_chapter_id then
    raise exception 'expected chapter does not match current video chapter';
  end if;

  select subject_id
  into v_chapter_subject_id
  from public.chapters
  where id = p_chapter_id;
  if not found then
    raise exception 'unknown chapter_id %', p_chapter_id;
  end if;
  if v_chapter_subject_id is distinct from v_video_subject_id then
    raise exception 'chapter subject does not match video subject';
  end if;

  select count(*) into v_shared
  from public.playlist_videos
  where video_id = p_video_id;
  if v_shared > 1 and not p_allow_shared then
    raise exception 'video is shared by % playlists; explicit confirmation is required', v_shared;
  end if;

  v_before := public.catalog_video_taxonomy_snapshot(p_video_id);
  update public.videos
  set chapter_id = p_chapter_id
  where id = p_video_id;
  v_after := public.catalog_video_taxonomy_snapshot(p_video_id);

  insert into public.catalog_management_audit (
    action, playlist_id, video_id, before_state, after_state, actor_id
  ) values (
    'reassign-video-chapter', p_playlist_id, p_video_id,
    v_before, v_after, auth.uid()
  );

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'video_id', p_video_id,
    'chapter_id', p_chapter_id,
    'shared_playlist_count', v_shared
  );
end;
$$;

create or replace function public.delete_managed_playlist(
  p_playlist_id bigint,
  p_expected_title text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_playlist public.playlists%rowtype;
  v_before jsonb;
  v_links int;
  v_orphans int;
  v_deleted int;
begin
  if not (
    public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select *
  into v_playlist
  from public.playlists
  where id = p_playlist_id
  for update;
  if not found then
    raise exception 'unknown playlist_id %', p_playlist_id;
  end if;
  if v_playlist.title is distinct from p_expected_title then
    raise exception 'expected title does not match current playlist title';
  end if;

  v_before := public.catalog_playlist_snapshot(p_playlist_id);
  select count(*) into v_links
  from public.playlist_videos
  where playlist_id = p_playlist_id;
  select count(*) into v_orphans
  from public.playlist_videos target
  where target.playlist_id = p_playlist_id
    and not exists (
      select 1
      from public.playlist_videos other
      where other.video_id = target.video_id
        and other.playlist_id <> p_playlist_id
    );

  insert into public.catalog_management_audit (
    action, playlist_id, before_state, after_state, actor_id
  ) values (
    'delete-playlist',
    p_playlist_id,
    v_before,
    jsonb_build_object(
      'playlist_deleted', true,
      'video_rows_retained', v_links,
      'videos_without_another_playlist', v_orphans
    ),
    auth.uid()
  );

  delete from public.playlists where id = p_playlist_id;
  get diagnostics v_deleted = row_count;
  if v_deleted <> 1 then
    raise exception 'playlist delete affected % rows', v_deleted;
  end if;

  return jsonb_build_object(
    'playlist_id', p_playlist_id,
    'deleted_playlists', v_deleted,
    'deleted_videos', 0,
    'video_rows_retained', v_links,
    'videos_without_another_playlist', v_orphans
  );
end;
$$;

revoke all on function public.catalog_manage_capability()
  from public, anon;
revoke all on function public.get_manage_playlists(text, int, int)
  from public, anon;
revoke all on function public.update_managed_playlist(
  bigint, text, text, text, bigint, bigint[], bigint[], text, text, text, text
) from public, anon;
revoke all on function public.set_managed_video_taxonomy(
  bigint, bigint, bigint[], bigint[], boolean
) from public, anon;
revoke all on function public.clear_managed_video_taxonomy(
  bigint, bigint, boolean
) from public, anon;
revoke all on function public.reassign_video_chapter(
  bigint, bigint, bigint, bigint, boolean
) from public, anon;
revoke all on function public.delete_managed_playlist(bigint, text)
  from public, anon;

grant execute on function public.catalog_manage_capability()
  to authenticated, service_role;
grant execute on function public.get_manage_playlists(text, int, int)
  to authenticated, service_role;
grant execute on function public.update_managed_playlist(
  bigint, text, text, text, bigint, bigint[], bigint[], text, text, text, text
) to authenticated, service_role;
grant execute on function public.set_managed_video_taxonomy(
  bigint, bigint, bigint[], bigint[], boolean
) to authenticated, service_role;
grant execute on function public.clear_managed_video_taxonomy(
  bigint, bigint, boolean
) to authenticated, service_role;
grant execute on function public.reassign_video_chapter(
  bigint, bigint, bigint, bigint, boolean
) to authenticated, service_role;
grant execute on function public.delete_managed_playlist(bigint, text)
  to authenticated, service_role;

commit;
