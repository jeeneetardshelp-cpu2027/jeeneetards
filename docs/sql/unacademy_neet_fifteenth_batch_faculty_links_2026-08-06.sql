-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Original batch decision: 5b4b1d41-b7dc-4f12-80cf-b490e72edd96
-- Refreshed remainder decision: 1412ca96-56dc-47ef-8bc0-18ce97f7dfb6
-- Scope: three additive normalized faculty links for production courses 423-425 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 406
     or (select count(*) from public.videos) <> 4683
     or (select count(*) from public.playlist_videos) <> 4689
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 158
     or (select count(*) from public.playlist_quality_reviews) <> 29 then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (423::bigint,
       'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP'::text,
       2::bigint, 92::bigint, 11::bigint, '12th'::text, 'class-12'::text),
      (424::bigint,
       'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
       'Mahendra Singh'::text, 'PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw'::text,
       1::bigint, 26::bigint, 11::bigint, '11th'::text, 'class-11'::text),
      (425::bigint,
       'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
       'Mahendra Singh'::text, 'PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX'::text,
       1::bigint, 1::bigint, 6::bigint, '11th'::text, 'class-11'::text)
    ) expected(id, title, teacher, source_id, subject_id, chapter_id, lesson_count, legacy_class, class_slug)
    where not exists (
      select 1 from public.playlists p
      where p.id = expected.id
        and p.title = expected.title
        and p.source_title is null
        and p.teacher = expected.teacher
        and p.youtube_playlist_id = expected.source_id
        and p.channel_id = 147 and p.category_id = 2
        and p.subject_id = expected.subject_id
        and p.content_type = 'full-course' and p.language = 'hinglish'
        and p.difficulty = 'intermediate' and p.audience_focus = expected.legacy_class
        and p.class_levels = array[expected.legacy_class]::text[]
        and p.title_review_status = 'pending'
        and p.faculty_credit_status = 'pending'
    )
    or (select count(*) from public.playlist_videos pv
        where pv.playlist_id = expected.id) <> expected.lesson_count
    or exists (
      select 1 from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
      where pv.playlist_id = expected.id
        and v.chapter_id is distinct from expected.chapter_id
    )
    or (select array_agg(lg.slug order by lg.slug)
        from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = expected.id) <> array['neet']::text[]
    or (select array_agg(cl.slug order by cl.slug)
        from public.playlist_class_levels pcl
        join public.class_levels cl on cl.id = pcl.class_level_id
        where pcl.playlist_id = expected.id) <> array[expected.class_slug]::text[]
  ) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: course identity differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
     or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
     or not exists (
       select 1 from public.teachers
       where id = 36 and display_name = 'Anoop Vashishtha'
         and canonical_name = 'anoop vashishtha'
         and slug = 'anoop-vashishtha' and verified
     )
     or not exists (
       select 1 from public.teachers
       where id = 34 and display_name = 'Mahendra Singh'
         and canonical_name = 'mahendra singh'
         and slug = 'mahendra-singh' and verified
     ) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: reference evidence differs';
  end if;

  if not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 36 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 36 and learning_goal_id = 2)
     or not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 34 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 34 and subject_id = 1)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 34 and learning_goal_id = 2) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id in (423, 424, 425)) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (423, 424, 425)) then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: quality review appeared';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee')) as protected_courses,
      (select count(*) from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee')) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee')) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy fifteenth-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (423, 36, 'instructor', 1),
  (424, 34, 'instructor', 1),
  (425, 34, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 406
     or (select count(*) from public.videos) <> 4683
     or (select count(*) from public.playlist_videos) <> 4689
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 161
     or (select count(*) from public.playlist_quality_reviews) <> 29 then
    raise exception 'Unacademy fifteenth-batch faculty links postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (423, 424, 425)) <>
     array['423:anoop-vashishtha:1', '424:mahendra-singh:1', '425:mahendra-singh:1']::text[] then
    raise exception 'Unacademy fifteenth-batch faculty links mismatch';
  end if;
  if exists (
    select 1 from public.playlists
    where id in (423, 424, 425)
      and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy fifteenth-batch faculty links changed review status';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (423, 424, 425)) then
    raise exception 'Unacademy fifteenth-batch faculty links changed quality review state';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where plg.playlist_id = p.id and lg.slug = 'jee')) as protected_courses,
      (select count(*) from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee')) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee')) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy fifteenth-batch faculty links protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (423, 424, 425)
order by p.id, pt.position;

commit;
