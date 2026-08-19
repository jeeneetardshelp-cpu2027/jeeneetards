-- Guarded CREATE-ONLY Gate 1 artifact for the reviewed Mathematics Olympiad
-- qualifier chapter. Production baseline observed at 2026-08-03T10:31:15.897Z.
-- Review package SHA-256:
--   74a36d79fbf709c5a9ade7c3fca74dfeccbfa8f5e410928e84e2fe8df36c6d3f
begin;

do $prmo_ioqm_chapter$
declare
  v_chapter_id bigint;
  v_display_order integer;
  v_fingerprint text;
begin
  if (select count(*) from public.playlists) <> 310
     or (select count(*) from public.videos) <> 3637
     or (select count(*) from public.playlist_videos) <> 3643
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90 then
    raise exception 'PRMO/IOQM chapter baseline changed';
  end if;

  if not exists (
    select 1 from public.subjects
    where id = 3 and name = 'Mathematics' and slug = 'mathematics'
  ) or not exists (
    select 1 from public.learning_goals
    where id = 3 and name = 'Olympiad' and slug = 'olympiad'
  ) or (
    select count(*) from public.class_levels
    where (id, slug) in (
      (2, 'class-11'),
      (3, 'class-12'),
      (4, 'dropper')
    )
  ) <> 3 then
    raise exception 'PRMO/IOQM chapter reference data mismatch';
  end if;

  if exists (
    select 1 from public.chapters
    where subject_id = 3
      and (name = 'PRMO and IOQM Solutions'
           or slug = 'prmo-and-ioqm-solutions')
  ) then
    raise exception 'PRMO/IOQM chapter already exists';
  end if;
  if exists (
    select 1 from public.playlists
    where title = 'PRMO & IOQM Solutions (2018–2022)'
  ) then
    raise exception 'PRMO/IOQM course already exists';
  end if;
  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'dows6wBBk3A', '3YvuUlM2OHY', '2qm5UjRyIcs', 'X3BWR79DtyU'
    ])
  ) then
    raise exception 'PRMO/IOQM video reuse detected before chapter creation';
  end if;

  select md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
      from public.playlist_videos pv
      join public.playlists p on p.id = pv.playlist_id
      where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee'
      )
    ) y), '')
  ) into v_fingerprint;
  if v_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'protected JEE fingerprint mismatch before chapter creation (%)',
      v_fingerprint;
  end if;

  select coalesce(max(display_order), 0) + 1
  into v_display_order
  from public.chapters
  where subject_id = 3;

  insert into public.chapters (name, slug, subject_id, display_order)
  values (
    'PRMO and IOQM Solutions',
    'prmo-and-ioqm-solutions',
    3,
    v_display_order
  )
  returning id into v_chapter_id;

  insert into public.chapter_class_levels (
    chapter_id, class_level_id, source_url, scope_note, reviewed_on
  )
  select
    v_chapter_id,
    cl.id,
    'https://olympiads.hbcse.tifr.res.in/how-to-prepare/past-papers/',
    concat(
      'Owner-reviewed PRMO/IOQM historical solution chapter; ',
      cl.name,
      ' catalogue scope'
    ),
    date '2026-08-03'
  from public.class_levels cl
  where cl.slug in ('class-11', 'class-12');

  if (select count(*) from public.playlists) <> 310
     or (select count(*) from public.videos) <> 3637
     or (select count(*) from public.playlist_videos) <> 3643
     or (select count(*) from public.chapters) <> 242
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.chapter_class_levels
         where chapter_id = v_chapter_id) <> 2
     or exists (
       select 1
       from public.chapter_class_levels ccl
       join public.class_levels cl on cl.id = ccl.class_level_id
       where ccl.chapter_id = v_chapter_id and cl.slug = 'dropper'
     ) then
    raise exception 'PRMO/IOQM chapter postflight mismatch';
  end if;

  select md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
      from public.playlist_videos pv
      join public.playlists p on p.id = pv.playlist_id
      where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee'
      )
    ) y), '')
  ) into v_fingerprint;
  if v_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'protected JEE fingerprint changed after chapter creation (%)',
      v_fingerprint;
  end if;
end
$prmo_ioqm_chapter$;

commit;
