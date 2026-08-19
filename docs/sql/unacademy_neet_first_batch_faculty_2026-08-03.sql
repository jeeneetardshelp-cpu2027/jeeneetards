-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 6579f542-da9b-499f-bd46-3aa796ea4f27.
-- Scope: additive faculty-registry links for production courses 341-343 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy faculty package: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 334
     or (select count(*) from public.videos) <> 3955
     or (select count(*) from public.playlist_videos) <> 3961
     or (select count(*) from public.chapters) <> 245
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 27
     or (select count(*) from public.teacher_aliases) <> 41
     or (select count(*) from public.teacher_institutes) <> 28
     or (select count(*) from public.teacher_subjects) <> 28
     or (select count(*) from public.teacher_learning_goals) <> 27
     or (select count(*) from public.playlist_teachers) <> 130 then
    raise exception 'refusing Unacademy faculty package: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        341::bigint,
        'Chemical Bonding'::text,
        'Ashwani Tyagi'::text,
        'PLsgHooHkqhhOpvf0vvBRLS91fUm9T_eE1'::text,
        147::bigint,
        2::bigint,
        'class-11'::text,
        15::bigint
      ),
      (
        342::bigint,
        'Evolution'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhOQCrgTeH7u28Es6agZtG_x'::text,
        147::bigint,
        4::bigint,
        'class-12'::text,
        15::bigint
      ),
      (
        343::bigint,
        'Principles of Inheritance and Variation'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhNoUZC_HaAwe9k_5crRH-Ig'::text,
        147::bigint,
        4::bigint,
        'class-12'::text,
        14::bigint
      )
    ) expected(
      playlist_id, title, teacher, youtube_playlist_id, channel_id,
      subject_id, class_slug, membership_count
    )
    left join public.playlists p on p.id = expected.playlist_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.teacher is distinct from expected.teacher
       or p.youtube_playlist_id is distinct from expected.youtube_playlist_id
       or p.channel_id is distinct from expected.channel_id
       or p.subject_id is distinct from expected.subject_id
       or p.faculty_credit_status is distinct from 'pending'
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
    raise exception 'refusing Unacademy faculty package: reviewed course evidence differs';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147
       and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
  or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet') then
    raise exception 'refusing Unacademy faculty package: reference data differs';
  end if;

  if exists (
    select 1 from public.teachers
     where slug in ('ashwani-tyagi', 'pradeep-singh')
        or lower(display_name) in ('ashwani tyagi', 'pradeep singh')
  )
  or exists (
    select 1 from public.teacher_aliases
     where normalized_alias in (
       'ashwani tyagi', 'ashwani', 'pradeep singh', 'pradeep'
     )
  )
  or exists (
    select 1 from public.playlist_teachers where playlist_id in (341, 342, 343)
  ) then
    raise exception 'refusing Unacademy faculty package: faculty identity or course link appeared';
  end if;

  select * into v_protected from (
    select
      (select count(*)
         from public.playlists p
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
              join public.learning_goals lg on lg.id = plg.learning_goal_id
             where plg.playlist_id = p.id and lg.slug = 'jee'
          )) as protected_courses,
      (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
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
             select 1
               from public.playlist_learning_goals plg
               join public.learning_goals lg on lg.id = plg.learning_goal_id
              where plg.playlist_id = p.id and lg.slug = 'jee'
           )
        ) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'refusing Unacademy faculty package: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Ashwani Tyagi', '', 'ashwani-tyagi', true),
  ('Pradeep Singh', '', 'pradeep-singh', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('ashwani-tyagi', 'Ashwani Tyagi'),
      ('pradeep-singh', 'Pradeep Singh')
    ) expected(slug, display_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or not t.verified
  ) then
    raise exception 'Unacademy faculty identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('ashwani-tyagi', 'Ashwani Tyagi', 'full-name'),
  ('ashwani-tyagi', 'Ashwani Sir', 'short'),
  ('pradeep-singh', 'Pradeep Singh', 'full-name'),
  ('pradeep-singh', 'Pradeep Sir', 'short')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, 147, true
from public.teachers t
where t.slug in ('ashwani-tyagi', 'pradeep-singh')
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, expected.subject_id
from (values
  ('ashwani-tyagi', 2::bigint),
  ('pradeep-singh', 4::bigint)
) expected(slug, subject_id)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, 2
from public.teachers t
where t.slug in ('ashwani-tyagi', 'pradeep-singh')
on conflict (teacher_id, learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (341::bigint, 'ashwani-tyagi'),
  (342::bigint, 'pradeep-singh'),
  (343::bigint, 'pradeep-singh')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 334
     or (select count(*) from public.videos) <> 3955
     or (select count(*) from public.playlist_videos) <> 3961
     or (select count(*) from public.chapters) <> 245
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 29
     or (select count(*) from public.teacher_aliases) <> 45
     or (select count(*) from public.teacher_institutes) <> 30
     or (select count(*) from public.teacher_subjects) <> 30
     or (select count(*) from public.teacher_learning_goals) <> 29
     or (select count(*) from public.playlist_teachers) <> 133 then
    raise exception 'Unacademy faculty package postflight count mismatch';
  end if;

  if (
    select array_agg(
      format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
      order by pt.playlist_id, pt.position
    )
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id in (341, 342, 343)
  ) <> array[
    '341:ashwani-tyagi:1',
    '342:pradeep-singh:1',
    '343:pradeep-singh:1'
  ]::text[] then
    raise exception 'Unacademy faculty package course-link mismatch';
  end if;

  if (
    select array_agg(format('%s:%s', t.slug, ta.normalized_alias)
                     order by t.slug, ta.normalized_alias)
    from public.teacher_aliases ta
    join public.teachers t on t.id = ta.teacher_id
    where t.slug in ('ashwani-tyagi', 'pradeep-singh')
  ) <> array[
    'ashwani-tyagi:ashwani',
    'ashwani-tyagi:ashwani tyagi',
    'pradeep-singh:pradeep',
    'pradeep-singh:pradeep singh'
  ]::text[] then
    raise exception 'Unacademy faculty package alias mismatch';
  end if;

  if exists (
    select 1 from public.playlists
     where id in (341, 342, 343)
       and faculty_credit_status <> 'pending'
  ) then
    raise exception 'Unacademy faculty package changed faculty credit status';
  end if;

  if (select count(*) from public.teacher_institutes ti
      join public.teachers t on t.id = ti.teacher_id
      where t.slug in ('ashwani-tyagi', 'pradeep-singh')
        and ti.institute_id = 147 and ti.is_primary) <> 2
  or (select count(*) from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where (t.slug = 'ashwani-tyagi' and ts.subject_id = 2)
         or (t.slug = 'pradeep-singh' and ts.subject_id = 4)) <> 2
  or (select count(*) from public.teacher_learning_goals tlg
      join public.teachers t on t.id = tlg.teacher_id
      where t.slug in ('ashwani-tyagi', 'pradeep-singh')
        and tlg.learning_goal_id = 2) <> 2 then
    raise exception 'Unacademy faculty package context-link mismatch';
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

  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'Unacademy faculty package protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select
  p.id as playlist_id,
  p.title,
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
where p.id in (341, 342, 343)
order by p.id, pt.position;

commit;
