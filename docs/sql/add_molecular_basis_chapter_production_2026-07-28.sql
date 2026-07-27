-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL AND A FRESH,
-- RECORDED PITR RESTORE-POINT TIMESTAMP.
--
-- Create-only production plan for one canonical Biology chapter. The
-- transaction fails closed if the catalogue has drifted from the read-only
-- baseline used to prepare it or if any name/slug conflict already exists.
-- It contains no UPDATE, DELETE, ALTER, DROP, or content import.

begin;

do $chapter_plan$
declare
  v_subject_id bigint;
  v_rows integer;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing chapter plan: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 97
     or (select count(*) from public.videos) <> 1461
     or (select count(*) from public.playlist_videos) <> 1465
     or (select count(*) from public.chapters) <> 123 then
    raise exception 'refusing chapter plan: catalogue baseline drifted';
  end if;

  if (
    select count(*)
    from public.playlist_learning_goals plg
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where lg.slug = 'jee'
  ) <> 83 then
    raise exception 'refusing chapter plan: JEE course count drifted';
  end if;

  select md5(
    coalesce((
      select string_agg(row_to_json(x)::text, '|' order by x.id)
      from (
        select
          p.id,
          p.title,
          p.teacher,
          p.youtube_playlist_id,
          p.category_id,
          p.subject_id,
          p.class_levels,
          p.audience_focus,
          p.content_type,
          p.language,
          p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) x
    ), '')
    || '|'
    || coalesce((
      select string_agg(
        row_to_json(y)::text,
        '|' order by y.playlist_id, y.position, y.id
      )
      from (
        select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlist_learning_goals plg
          on plg.playlist_id = pv.playlist_id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) y
    ), '')
  ) into v_jee_fingerprint;

  if v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc' then
    raise exception
      'refusing chapter plan: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  select id into v_subject_id
  from public.subjects
  where slug = 'biology';

  if v_subject_id is null then
    raise exception 'refusing chapter plan: Biology subject is missing';
  end if;

  if exists (
    select 1
    from public.chapters
    where subject_id = v_subject_id
      and (
        name = 'Molecular Basis of Inheritance'
        or slug = 'molecular-basis-of-inheritance'
      )
  ) then
    raise exception 'refusing chapter plan: chapter name or slug already exists';
  end if;

  insert into public.chapters (subject_id, name, slug, display_order)
  values (
    v_subject_id,
    'Molecular Basis of Inheritance',
    'molecular-basis-of-inheritance',
    0
  );
  get diagnostics v_rows = row_count;

  if v_rows <> 1 then
    raise exception 'refusing chapter plan: expected one insert, received %', v_rows;
  end if;

  if (select count(*) from public.chapters) <> 124 then
    raise exception 'refusing chapter plan: unexpected chapter post-count';
  end if;
end
$chapter_plan$;

select
  c.id,
  c.name,
  c.slug,
  c.display_order,
  s.name as subject_name,
  s.slug as subject_slug
from public.chapters c
join public.subjects s on s.id = c.subject_id
where s.slug = 'biology'
  and c.name = 'Molecular Basis of Inheritance'
  and c.slug = 'molecular-basis-of-inheritance';

commit;
