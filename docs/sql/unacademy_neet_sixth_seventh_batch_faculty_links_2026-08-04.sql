-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decisions:
--   sixth batch: 1d0ea7b9-8cac-4f3b-968d-82b4307f264a
--   seventh batch: cf45d7d5-43ef-4311-abd7-5297ec2ea3b6
-- Scope: additive normalized faculty links for production courses 400-404 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 385
     or (select count(*) from public.videos) <> 4514
     or (select count(*) from public.playlist_videos) <> 4520
     or (select count(*) from public.chapters) <> 247
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 135 then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        400::bigint,
        'NEET: Hydrogen | Class 11 | Unacademy NEET | Anoop V.'::text,
        'Anoop Vashishtha'::text,
        'PLsgHooHkqhhP65sAqtkbWpVVSrK7FlTWA'::text,
        147::bigint, 2::bigint, 'class-11'::text, 6::bigint, 36::bigint,
        'anoop-vashishtha'::text
      ),
      (
        401::bigint,
        'NEET: Modern Physics | Class 12 | Live Daily 2.0 | Unacademy NEET | Anu Gupta'::text,
        'Anu Gupta'::text,
        'PLsgHooHkqhhMQWo55rneDci-gmYynS9Za'::text,
        147::bigint, 1::bigint, 'class-12'::text, 11::bigint, 35::bigint,
        'anu-gupta'::text
      ),
      (
        402::bigint,
        'NEET: Biodiversity & Conservation | LIVE Daily 2.0 | Unacademy NEET | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhOLWySbDetaU3Z-KiEBLE63'::text,
        147::bigint, 4::bigint, 'class-12'::text, 5::bigint, 33::bigint,
        'pradeep-singh'::text
      ),
      (
        403::bigint,
        'NEET: Cell Cycle & Cell Division | Class 11 | Live Daily 2.0 | Unacademy NEET | Pradeep Sir'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhMbUvz0HhRZwLrpa4--2M1F'::text,
        147::bigint, 4::bigint, 'class-11'::text, 7::bigint, 33::bigint,
        'pradeep-singh'::text
      ),
      (
        404::bigint,
        'NEET: Microbes in Human Welfare | Class 12 | Unacademy NEET | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhMeV7vEcqRc91GnmR15_eHw'::text,
        147::bigint, 4::bigint, 'class-12'::text, 4::bigint, 33::bigint,
        'pradeep-singh'::text
      )
    ) expected(
      playlist_id, title, teacher, youtube_playlist_id, channel_id,
      subject_id, class_slug, membership_count, teacher_id, teacher_slug
    )
    left join public.playlists p on p.id = expected.playlist_id
    left join public.teachers t on t.id = expected.teacher_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.teacher is distinct from expected.teacher
       or p.youtube_playlist_id is distinct from expected.youtube_playlist_id
       or p.channel_id is distinct from expected.channel_id
       or p.subject_id is distinct from expected.subject_id
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or t.id is null
       or t.slug is distinct from expected.teacher_slug
       or t.display_name is distinct from expected.teacher
       or t.canonical_name is distinct from lower(expected.teacher)
       or not t.verified
       or (select count(*) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
       or (select array_agg(lg.slug order by lg.slug)
             from public.playlist_learning_goals plg
             join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = expected.playlist_id) <> array['neet']::text[]
       or (select array_agg(cl.slug order by cl.slug)
             from public.playlist_class_levels pcl
             join public.class_levels cl on cl.id = pcl.class_level_id
            where pcl.playlist_id = expected.playlist_id) <> array[expected.class_slug]::text[]
  ) then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: reviewed evidence differs';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147
       and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
  or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
  or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet') then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: reference data differs';
  end if;

  if not exists (
    select 1 from public.teacher_institutes
     where teacher_id = 33 and institute_id = 147 and is_primary
  )
  or not exists (
    select 1 from public.teacher_institutes
     where teacher_id = 35 and institute_id = 147 and is_primary
  )
  or not exists (
    select 1 from public.teacher_institutes
     where teacher_id = 36 and institute_id = 147 and is_primary
  )
  or not exists (select 1 from public.teacher_subjects where teacher_id = 33 and subject_id = 4)
  or not exists (select 1 from public.teacher_subjects where teacher_id = 35 and subject_id = 1)
  or not exists (select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2)
  or not exists (select 1 from public.teacher_learning_goals where teacher_id = 33 and learning_goal_id = 2)
  or not exists (select 1 from public.teacher_learning_goals where teacher_id = 35 and learning_goal_id = 2)
  or not exists (select 1 from public.teacher_learning_goals where teacher_id = 36 and learning_goal_id = 2) then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: teacher context differs';
  end if;

  if exists (
    select 1 from public.playlist_teachers where playlist_id in (400, 401, 402, 403, 404)
  ) then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: course link appeared';
  end if;

  select * into v_protected from (
    select
      (select count(*)
         from public.playlists p
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_courses,
      (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_memberships,
      md5(
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
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy sixth/seventh-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (400, 36, 'instructor', 1),
  (401, 35, 'instructor', 1),
  (402, 33, 'instructor', 1),
  (403, 33, 'instructor', 1),
  (404, 33, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 385
     or (select count(*) from public.videos) <> 4514
     or (select count(*) from public.playlist_videos) <> 4520
     or (select count(*) from public.chapters) <> 247
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 140 then
    raise exception 'Unacademy sixth/seventh-batch faculty links postflight count mismatch';
  end if;

  if (
    select array_agg(
      format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
      order by pt.playlist_id, pt.position
    )
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id in (400, 401, 402, 403, 404)
  ) <> array[
    '400:anoop-vashishtha:1',
    '401:anu-gupta:1',
    '402:pradeep-singh:1',
    '403:pradeep-singh:1',
    '404:pradeep-singh:1'
  ]::text[] then
    raise exception 'Unacademy sixth/seventh-batch faculty links course-link mismatch';
  end if;

  if exists (
    select 1 from public.playlists
     where id in (400, 401, 402, 403, 404)
       and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy sixth/seventh-batch faculty links changed review status';
  end if;

  select * into v_protected from (
    select
      (select count(*)
         from public.playlists p
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_courses,
      (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_memberships,
      md5(
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
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy sixth/seventh-batch faculty links protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select
  p.id as playlist_id,
  p.title,
  p.title_review_status,
  p.faculty_credit_status,
  t.id as teacher_id,
  t.display_name,
  t.slug,
  t.verified,
  pt.role,
  pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (400, 401, 402, 403, 404)
order by p.id, pt.position;

commit;
