-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1
-- Scope: additive normalized faculty links for production courses 411-413 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy tenth-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 394
     or (select count(*) from public.videos) <> 4578
     or (select count(*) from public.playlist_videos) <> 4584
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 146
     or (select count(*) from public.playlist_quality_reviews) <> 17 then
    raise exception 'refusing Unacademy tenth-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (411::bigint,
       'NEET: Thermal Properties of Matter | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra S.'::text,
       'Mahendra Singh'::text, 'PLsgHooHkqhhNB7vXo5H5J-QsBotPAPYUR'::text,
       1::bigint, 4::bigint, 25::bigint, 2::bigint, '11th'::text,
       'class-11'::text, 34::bigint, 'mahendra-singh'::text),
      (412::bigint,
       'NEET: Electromagnetic Induction | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text,
       'Anu Gupta'::text, 'PLsgHooHkqhhNvpnnFH79_2cZGiXgI3zlt'::text,
       1::bigint, 3::bigint, 13::bigint, 3::bigint, '12th'::text,
       'class-12'::text, 35::bigint, 'anu-gupta'::text),
      (413::bigint,
       'Plant Growth and Development - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
       'Pradeep Singh'::text, 'PLsgHooHkqhhOn3bqr2nMVYEGq3Zh5bMDF'::text,
       4::bigint, 5::bigint, 120::bigint, 2::bigint, '11th'::text,
       'class-11'::text, 33::bigint, 'pradeep-singh'::text)
    ) expected(playlist_id, title, teacher, youtube_playlist_id, subject_id,
               membership_count, chapter_id, class_level_id, class_label,
               class_slug, teacher_id, teacher_slug)
    left join public.playlists p on p.id = expected.playlist_id
    left join public.teachers t on t.id = expected.teacher_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.teacher is distinct from expected.teacher
       or p.youtube_playlist_id is distinct from expected.youtube_playlist_id
       or p.channel_id is distinct from 147
       or p.category_id is distinct from 2
       or p.subject_id is distinct from expected.subject_id
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.audience_focus is distinct from expected.class_label
       or p.class_levels is distinct from array[expected.class_label]::text[]
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or t.id is null
       or t.slug is distinct from expected.teacher_slug
       or t.display_name is distinct from expected.teacher
       or t.canonical_name is distinct from lower(expected.teacher)
       or not t.verified
       or (select count(*) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
       or exists (
         select 1 from public.playlist_videos pv
         join public.videos v on v.id = pv.video_id
         where pv.playlist_id = expected.playlist_id
           and v.chapter_id is distinct from expected.chapter_id)
       or (select array_agg(lg.slug order by lg.slug)
             from public.playlist_learning_goals plg
             join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = expected.playlist_id) <> array['neet']::text[]
       or (select array_agg(cl.slug order by cl.slug)
             from public.playlist_class_levels pcl
             join public.class_levels cl on cl.id = pcl.class_level_id
            where pcl.playlist_id = expected.playlist_id) <> array[expected.class_slug]::text[]
  ) then
    raise exception 'refusing Unacademy tenth-batch faculty links: reviewed evidence differs';
  end if;

  if not exists (select 1 from public.institutes_channels
                  where id = 147 and name = 'Unacademy NEET'
                    and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA')
     or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
     or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12') then
    raise exception 'refusing Unacademy tenth-batch faculty links: reference data differs';
  end if;

  if exists (
    select 1 from (values
      (34::bigint, 1::bigint), (35::bigint, 1::bigint), (33::bigint, 4::bigint)
    ) expected(teacher_id, subject_id)
    where not exists (select 1 from public.teacher_institutes ti
                       where ti.teacher_id = expected.teacher_id
                         and ti.institute_id = 147 and ti.is_primary)
       or not exists (select 1 from public.teacher_subjects ts
                       where ts.teacher_id = expected.teacher_id
                         and ts.subject_id = expected.subject_id)
       or not exists (select 1 from public.teacher_learning_goals tlg
                       where tlg.teacher_id = expected.teacher_id
                         and tlg.learning_goal_id = 2)
  ) then
    raise exception 'refusing Unacademy tenth-batch faculty links: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id in (411, 412, 413)) then
    raise exception 'refusing Unacademy tenth-batch faculty links: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (411, 412, 413)) then
    raise exception 'refusing Unacademy tenth-batch faculty links: quality review appeared';
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
          from public.playlist_videos pv join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee')) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy tenth-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (411, 34, 'instructor', 1),
  (412, 35, 'instructor', 1),
  (413, 33, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 394
     or (select count(*) from public.videos) <> 4578
     or (select count(*) from public.playlist_videos) <> 4584
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 149
     or (select count(*) from public.playlist_quality_reviews) <> 17 then
    raise exception 'Unacademy tenth-batch faculty links postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (411, 412, 413)) <> array[
        '411:mahendra-singh:1',
        '412:anu-gupta:1',
        '413:pradeep-singh:1'
      ]::text[] then
    raise exception 'Unacademy tenth-batch faculty links course-link mismatch';
  end if;
  if exists (select 1 from public.playlists where id in (411, 412, 413)
             and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')) then
    raise exception 'Unacademy tenth-batch faculty links changed review status';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (411, 412, 413)) then
    raise exception 'Unacademy tenth-batch faculty links changed quality review state';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id < 167 and exists (
        select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id
        where plg.playlist_id=p.id and lg.slug='jee')) as protected_courses,
      (select count(*) from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id
          where plg.playlist_id=p.id and lg.slug='jee')) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,p.subject_id,
                 p.class_levels,p.audience_focus,p.content_type,p.language,p.difficulty
          from public.playlists p join public.playlist_learning_goals plg on plg.playlist_id=p.id
          join public.learning_goals lg on lg.id=plg.learning_goal_id
          where lg.slug='jee' and p.id<167) x),'') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text,'|' order by y.playlist_id,y.position,y.id) from (
          select pv.id,pv.playlist_id,pv.video_id,pv.position
          from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id
          where p.id<167 and exists (
            select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id
            where plg.playlist_id=p.id and lg.slug='jee')) y),'')
      ) as protected_fingerprint
  ) protected;
  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy tenth-batch faculty links protected JEE mismatch (%)', row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (411, 412, 413)
order by p.id, pt.position;

commit;
