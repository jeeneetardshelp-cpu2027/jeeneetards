-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 809b153c-b5ff-48e0-a869-02faa49b0e8f
-- Scope: additive normalized faculty links for production courses 405-407 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy eighth-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 388
     or (select count(*) from public.videos) <> 4539
     or (select count(*) from public.playlist_videos) <> 4545
     or (select count(*) from public.chapters) <> 247
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 140
     or (select count(*) from public.playlist_quality_reviews) <> 11 then
    raise exception 'refusing Unacademy eighth-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        405::bigint,
        'Redox Reactions | Class 11 | Unacademy NEET | Anoop Vashishtha'::text,
        'Anoop Vashishtha'::text,
        'PLsgHooHkqhhPnLRiFEOjuIGraO0odfi1I'::text,
        147::bigint, 2::bigint, 'class-11'::text, 7::bigint, 36::bigint,
        'anoop-vashishtha'::text
      ),
      (
        406::bigint,
        'NEET: Cell Organelles Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhNW-QJ3H58FESiVXdxHYoqw'::text,
        147::bigint, 4::bigint, 'class-11'::text, 9::bigint, 33::bigint,
        'pradeep-singh'::text
      ),
      (
        407::bigint,
        'NEET: Molecular Basis of Inheritance - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhOO8a8vMQLe_CVVzttQd_Dh'::text,
        147::bigint, 4::bigint, 'class-12'::text, 9::bigint, 33::bigint,
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
       or p.category_id is distinct from 2
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
    raise exception 'refusing Unacademy eighth-batch faculty links: reviewed evidence differs';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147
       and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (
    select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry'
  )
  or not exists (
    select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology'
  )
  or not exists (
    select 1 from public.learning_goals where id = 2 and slug = 'neet'
  ) then
    raise exception 'refusing Unacademy eighth-batch faculty links: reference data differs';
  end if;

  if not exists (
    select 1 from public.teacher_institutes
     where teacher_id = 33 and institute_id = 147 and is_primary
  )
  or not exists (
    select 1 from public.teacher_institutes
     where teacher_id = 36 and institute_id = 147 and is_primary
  )
  or not exists (
    select 1 from public.teacher_subjects where teacher_id = 33 and subject_id = 4
  )
  or not exists (
    select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2
  )
  or not exists (
    select 1 from public.teacher_learning_goals where teacher_id = 33 and learning_goal_id = 2
  )
  or not exists (
    select 1 from public.teacher_learning_goals where teacher_id = 36 and learning_goal_id = 2
  ) then
    raise exception 'refusing Unacademy eighth-batch faculty links: teacher context differs';
  end if;

  if exists (
    select 1 from public.playlist_teachers where playlist_id in (405, 406, 407)
  ) then
    raise exception 'refusing Unacademy eighth-batch faculty links: course link appeared';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews where playlist_id in (405, 406, 407)
  ) then
    raise exception 'refusing Unacademy eighth-batch faculty links: quality review appeared';
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
    raise exception 'refusing Unacademy eighth-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (405, 36, 'instructor', 1),
  (406, 33, 'instructor', 1),
  (407, 33, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 388
     or (select count(*) from public.videos) <> 4539
     or (select count(*) from public.playlist_videos) <> 4545
     or (select count(*) from public.chapters) <> 247
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 143
     or (select count(*) from public.playlist_quality_reviews) <> 11 then
    raise exception 'Unacademy eighth-batch faculty links postflight count mismatch';
  end if;

  if (
    select array_agg(
      format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
      order by pt.playlist_id, pt.position
    )
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id in (405, 406, 407)
  ) <> array[
    '405:anoop-vashishtha:1',
    '406:pradeep-singh:1',
    '407:pradeep-singh:1'
  ]::text[] then
    raise exception 'Unacademy eighth-batch faculty links course-link mismatch';
  end if;

  if exists (
    select 1 from public.playlists
     where id in (405, 406, 407)
       and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy eighth-batch faculty links changed review status';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews where playlist_id in (405, 406, 407)
  ) then
    raise exception 'Unacademy eighth-batch faculty links changed quality review state';
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
    raise exception 'Unacademy eighth-batch faculty links protected JEE mismatch (%)',
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
where p.id in (405, 406, 407)
order by p.id, pt.position;

commit;
