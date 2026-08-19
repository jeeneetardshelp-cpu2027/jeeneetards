-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Content/teacher-evidence decision: f7992243-3b5b-4c39-bac9-433dd766a70a.
-- Scope: two new verified teachers, their reviewed aliases/context, and three
-- additive course-teacher links for production courses 426-428 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy sixteenth-batch faculty package: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 409
     or (select count(*) from public.videos) <> 4699
     or (select count(*) from public.playlist_videos) <> 4705
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 161
     or (select count(*) from public.playlist_quality_reviews) <> 32 then
    raise exception 'refusing Unacademy sixteenth-batch faculty package: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (426::bigint,
       'NEET: Applications Of Biotechnology | Live Daily 2.0 | Unacademy NEET | Seep Pahuja'::text,
       'Seep Pahuja'::text, 'PLsgHooHkqhhP1V_qdWDRNO0MczNtM6Q1m'::text,
       102::bigint, 4::bigint, '12th'::text, 'class-12'::text),
      (427::bigint,
       'NEET: The Living World - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur | Pradeep Singh'::text,
       'Dr. Sachin Kapur'::text, 'PLsgHooHkqhhNWiiYtSlpdjPEVYhHqtCkR'::text,
       127::bigint, 5::bigint, '11th'::text, 'class-11'::text),
      (428::bigint,
       'NEET: Reproductive Health - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'::text,
       'Dr. Sachin Kapur'::text, 'PLsgHooHkqhhPZfPFIHshnh3J0Nsod2uDw'::text,
       123::bigint, 7::bigint, '12th'::text, 'class-12'::text)
    ) expected(id, title, teacher, source_id, chapter_id, lesson_count, legacy_class, class_slug)
    where not exists (
      select 1 from public.playlists p
      where p.id = expected.id
        and p.title = expected.title
        and p.source_title is null
        and p.teacher = expected.teacher
        and p.youtube_playlist_id = expected.source_id
        and p.channel_id = 147 and p.category_id = 2 and p.subject_id = 4
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
    raise exception 'refusing Unacademy sixteenth-batch faculty package: course identity differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12') then
    raise exception 'refusing Unacademy sixteenth-batch faculty package: reference evidence differs';
  end if;

  if exists (
    select 1 from public.teachers
    where slug in ('seep-pahuja', 'sachin-kapur')
       or canonical_name in ('seep pahuja', 'sachin kapur')
  )
  or exists (
    select 1 from public.teacher_aliases
    where normalized_alias in ('seep pahuja', 'seep', 'sachin kapur', 'sachin')
  )
  or exists (select 1 from public.playlist_teachers where playlist_id in (426, 427, 428))
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (426, 427, 428)) then
    raise exception 'refusing Unacademy sixteenth-batch faculty package: faculty identity, course link, or review appeared';
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
    raise exception 'refusing Unacademy sixteenth-batch faculty package: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Seep Pahuja', '', 'seep-pahuja', true),
  ('Dr. Sachin Kapur', '', 'sachin-kapur', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('seep-pahuja', 'Seep Pahuja', 'seep pahuja'),
      ('sachin-kapur', 'Dr. Sachin Kapur', 'sachin kapur')
    ) expected(slug, display_name, canonical_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or t.canonical_name <> expected.canonical_name
       or not t.verified
  ) then
    raise exception 'Unacademy sixteenth-batch faculty identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('seep-pahuja', 'Seep Pahuja', 'full-name'),
  ('seep-pahuja', 'Seep Ma''am', 'short'),
  ('sachin-kapur', 'Dr. Sachin Kapur', 'full-name'),
  ('sachin-kapur', 'Sachin Sir', 'short')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, 147, true
from public.teachers t
where t.slug in ('seep-pahuja', 'sachin-kapur')
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, 4
from public.teachers t
where t.slug in ('seep-pahuja', 'sachin-kapur')
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, 2
from public.teachers t
where t.slug in ('seep-pahuja', 'sachin-kapur')
on conflict (teacher_id, learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (426::bigint, 'seep-pahuja'),
  (427::bigint, 'sachin-kapur'),
  (428::bigint, 'sachin-kapur')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 409
     or (select count(*) from public.videos) <> 4699
     or (select count(*) from public.playlist_videos) <> 4705
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 164
     or (select count(*) from public.playlist_quality_reviews) <> 32 then
    raise exception 'Unacademy sixteenth-batch faculty package postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (426, 427, 428)) <>
     array['426:seep-pahuja:1', '427:sachin-kapur:1', '428:sachin-kapur:1']::text[] then
    raise exception 'Unacademy sixteenth-batch faculty package course-link mismatch';
  end if;

  if (select array_agg(format('%s:%s', t.slug, ta.normalized_alias)
                       order by t.slug, ta.normalized_alias)
      from public.teacher_aliases ta
      join public.teachers t on t.id = ta.teacher_id
      where t.slug in ('seep-pahuja', 'sachin-kapur')) <>
     array[
       'sachin-kapur:sachin', 'sachin-kapur:sachin kapur',
       'seep-pahuja:seep', 'seep-pahuja:seep pahuja'
     ]::text[] then
    raise exception 'Unacademy sixteenth-batch faculty package alias mismatch';
  end if;

  if (select count(*) from public.teacher_institutes ti
      join public.teachers t on t.id = ti.teacher_id
      where t.slug in ('seep-pahuja', 'sachin-kapur')
        and ti.institute_id = 147 and ti.is_primary) <> 2
  or (select count(*) from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where t.slug in ('seep-pahuja', 'sachin-kapur') and ts.subject_id = 4) <> 2
  or (select count(*) from public.teacher_learning_goals tlg
      join public.teachers t on t.id = tlg.teacher_id
      where t.slug in ('seep-pahuja', 'sachin-kapur') and tlg.learning_goal_id = 2) <> 2 then
    raise exception 'Unacademy sixteenth-batch faculty package context-link mismatch';
  end if;

  if exists (
    select 1 from public.playlists
    where id in (426, 427, 428)
      and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  )
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (426, 427, 428)) then
    raise exception 'Unacademy sixteenth-batch faculty package changed review state';
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
    raise exception 'Unacademy sixteenth-batch faculty package protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (426, 427, 428)
order by p.id, pt.position;

commit;
