-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Refreshed batch decision: b98191cb-c0be-4d3c-9e15-95905da4fffc
-- Original Cell/Anatomy teacher evidence: b19eaa58-7931-4c84-8cea-8b6622230b4d
-- Scope: three additive normalized faculty links for production courses 420-422 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 403
     or (select count(*) from public.videos) <> 4655
     or (select count(*) from public.playlist_videos) <> 4661
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 155
     or (select count(*) from public.playlist_quality_reviews) <> 26 then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (420::bigint,
       'NEET: Friction - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Mahendra Singh'::text,
       'Mahendra Singh'::text, 'PLsgHooHkqhhM5-Ujy03Tn7YjofINdftRM'::text,
       1::bigint, 7::bigint, 4::bigint),
      (421::bigint,
       'NEET: The Unit of Life - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
       'Pradeep Singh'::text, 'PLsgHooHkqhhM6fzJQ3Vhv7s6iOglsVJw2'::text,
       4::bigint, 107::bigint, 4::bigint),
      (422::bigint,
       'Plant Anatomy - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
       'Pradeep Singh'::text, 'PLsgHooHkqhhPkkXnKHj60aao7jClkwioE'::text,
       4::bigint, 97::bigint, 6::bigint)
    ) expected(id, title, teacher, source_id, subject_id, chapter_id, lesson_count)
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
        and p.difficulty = 'intermediate' and p.audience_focus = '11th'
        and p.class_levels = array['11th']::text[]
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
        where pcl.playlist_id = expected.id) <> array['class-11']::text[]
  ) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: course identity differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
     or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (
       select 1 from public.teachers
       where id = 33 and display_name = 'Pradeep Singh'
         and canonical_name = 'pradeep singh'
         and slug = 'pradeep-singh' and verified
     )
     or not exists (
       select 1 from public.teachers
       where id = 34 and display_name = 'Mahendra Singh'
         and canonical_name = 'mahendra singh'
         and slug = 'mahendra-singh' and verified
     ) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: reference evidence differs';
  end if;

  if not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 33 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 33 and subject_id = 4)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 33 and learning_goal_id = 2)
     or not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 34 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 34 and subject_id = 1)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 34 and learning_goal_id = 2) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id in (420, 421, 422)) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (420, 421, 422)) then
    raise exception 'refusing Unacademy fourteenth-batch faculty links: quality review appeared';
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
    raise exception 'refusing Unacademy fourteenth-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (420, 34, 'instructor', 1),
  (421, 33, 'instructor', 1),
  (422, 33, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 403
     or (select count(*) from public.videos) <> 4655
     or (select count(*) from public.playlist_videos) <> 4661
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 158
     or (select count(*) from public.playlist_quality_reviews) <> 26 then
    raise exception 'Unacademy fourteenth-batch faculty links postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (420, 421, 422)) <>
     array['420:mahendra-singh:1', '421:pradeep-singh:1', '422:pradeep-singh:1']::text[] then
    raise exception 'Unacademy fourteenth-batch faculty links mismatch';
  end if;
  if exists (
    select 1 from public.playlists
    where id in (420, 421, 422)
      and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy fourteenth-batch faculty links changed review status';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (420, 421, 422)) then
    raise exception 'Unacademy fourteenth-batch faculty links changed quality review state';
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
    raise exception 'Unacademy fourteenth-batch faculty links protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (420, 421, 422)
order by p.id, pt.position;

commit;
