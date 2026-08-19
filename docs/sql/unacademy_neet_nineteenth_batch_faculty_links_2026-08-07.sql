-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: e6539ac8-512b-4e76-8bd1-774c1a3c4bdc
-- Scope: three additive normalized faculty links for production courses 433-435 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 416
     or (select count(*) from public.videos) <> 4731
     or (select count(*) from public.playlist_videos) <> 4737
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 168
     or (select count(*) from public.playlist_quality_reviews) <> 39 then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (433::bigint,
       'D and F Block Elements - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhNKfP8VeJvlmz5qO-RgNqzQ'::text,
       45::bigint, 3::bigint, 'class-12'::text, '12th'::text,
       array['0BwLckcTdUA','3ZlCJ1keY6s']::text[]),
      (434::bigint,
       'Amines | Playlist | Class 12 | Unacademy NEET | Live Daily | Chemistry | Anoop SIr'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhNPE4mZf-DoUlsANEdkP0ik'::text,
       48::bigint, 3::bigint, 'class-12'::text, '12th'::text,
       array['MQ-3hQrodgU','I91sc6HdzF0','5YTW3Cn198A']::text[]),
      (435::bigint,
       'Thermochemistry - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text,
       'Ashwani Tyagi'::text, 'PLsgHooHkqhhMSvDuuO5dL3-iba7hfWB6F'::text,
       29::bigint, 2::bigint, 'class-11'::text, '11th'::text,
       array['xpTqTM1fk1c','iQ-a7mYRBEk','7_lzRbhRJYA']::text[])
    ) expected(id, title, teacher, source_id, chapter_id, class_id,
               class_slug, class_label, video_ids)
    where not exists (
      select 1 from public.playlists p
      where p.id = expected.id
        and p.title = expected.title
        and p.source_title is null
        and p.teacher = expected.teacher
        and p.youtube_playlist_id = expected.source_id
        and p.channel_id = 147
        and p.category_id = 2
        and p.subject_id = 2
        and p.content_type = 'full-course'
        and p.language = 'hinglish'
        and p.difficulty = 'intermediate'
        and p.audience_focus = expected.class_label
        and p.class_levels = array[expected.class_label]::text[]
        and p.title_review_status = 'pending'
        and p.faculty_credit_status = 'pending'
    )
    or (select count(*) from public.playlist_videos pv
        where pv.playlist_id = expected.id) <> cardinality(expected.video_ids)
    or (select array_agg(pv.position order by pv.position)
        from public.playlist_videos pv
        where pv.playlist_id = expected.id) <>
       (select array_agg(n order by n)
        from generate_series(1, cardinality(expected.video_ids)) n)
    or (select array_agg(v.youtube_video_id order by pv.position)
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
        where pv.playlist_id = expected.id) <> expected.video_ids
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
    raise exception 'refusing Unacademy nineteenth-batch faculty links: reviewed course differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12') then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: reference evidence differs';
  end if;

  if exists (
    select 1
    from (values
      (32::bigint, 'Ashwani Tyagi'::text, 'ashwani tyagi'::text, 'ashwani-tyagi'::text),
      (36::bigint, 'Anoop Vashishtha'::text, 'anoop vashishtha'::text, 'anoop-vashishtha'::text)
    ) expected(id, display_name, canonical_name, slug)
    left join public.teachers t on t.id = expected.id
    where t.id is null
       or t.display_name <> expected.display_name
       or t.canonical_name <> expected.canonical_name
       or t.slug <> expected.slug
       or not t.verified
       or not exists (
         select 1 from public.teacher_institutes ti
         where ti.teacher_id = expected.id and ti.institute_id = 147 and ti.is_primary
       )
       or not exists (
         select 1 from public.teacher_subjects ts
         where ts.teacher_id = expected.id and ts.subject_id = 2
       )
       or not exists (
         select 1 from public.teacher_learning_goals tlg
         where tlg.teacher_id = expected.id and tlg.learning_goal_id = 2
       )
  ) then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: teacher evidence differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id in (433, 434, 435)) then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (433, 434, 435)) then
    raise exception 'refusing Unacademy nineteenth-batch faculty links: quality review appeared';
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
    raise exception 'refusing Unacademy nineteenth-batch faculty links: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values
  (433, 36, 'instructor', 1),
  (434, 36, 'instructor', 1),
  (435, 32, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 416
     or (select count(*) from public.videos) <> 4731
     or (select count(*) from public.playlist_videos) <> 4737
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 171
     or (select count(*) from public.playlist_quality_reviews) <> 39 then
    raise exception 'Unacademy nineteenth-batch faculty links postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (433, 434, 435)) <>
     array['433:anoop-vashishtha:1','434:anoop-vashishtha:1','435:ashwani-tyagi:1']::text[] then
    raise exception 'Unacademy nineteenth-batch faculty links course-link mismatch';
  end if;

  if exists (
    select 1 from public.playlists
    where id in (433, 434, 435)
      and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  )
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (433, 434, 435)) then
    raise exception 'Unacademy nineteenth-batch faculty links changed review state';
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
    raise exception 'Unacademy nineteenth-batch faculty links protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (433, 434, 435)
order by p.id, pt.position;

commit;
