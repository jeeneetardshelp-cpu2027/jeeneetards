-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 9443dd70-a2c6-4747-9a5e-a9022f7012cf
-- Scope: two verified teachers, reviewed aliases/context, and two additive
-- course-teacher links for production courses 439-440 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twenty-first-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 421
     or (select count(*) from public.videos) <> 4746
     or (select count(*) from public.playlist_videos) <> 4752
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 35
     or (select count(*) from public.teacher_aliases) <> 56
     or (select count(*) from public.teacher_institutes) <> 36
     or (select count(*) from public.teacher_subjects) <> 36
     or (select count(*) from public.teacher_learning_goals) <> 35
     or (select count(*) from public.playlist_teachers) <> 174
     or (select count(*) from public.playlist_quality_reviews) <> 45 then
    raise exception 'refusing Unacademy twenty-first-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (439::bigint, 'Kinetic Theory of Gases'::text, 'Shubham Kumar'::text,
       'PLsgHooHkqhhMZ0ocHynO-84oB0VVcuyoG'::text, 275::bigint,
       'class-11'::text, '11th'::text,
       array['v9q8mDQdXbM','NBwkv5Q-OK0']::text[]),
      (440::bigint, 'Electromagnetic Waves'::text, 'Samip Velani'::text,
       'PLsgHooHkqhhPkYyUO_zMJpEQZ5MST56fK'::text, 15::bigint,
       'class-12'::text, '12th'::text,
       array['hixsCud1ajA','BumQy7Ni8Gg','nwFN57p4x2o','I3hOh2-0uHI']::text[])
    ) expected(id, title, teacher, source_id, chapter_id, class_slug,
               class_label, video_ids)
    where not exists (
      select 1 from public.playlists p
      where p.id = expected.id
        and p.title = expected.title
        and p.source_title is null
        and p.source_title_changed is false
        and p.teacher = expected.teacher
        and p.youtube_playlist_id = expected.source_id
        and p.channel_id = 147 and p.category_id = 2 and p.subject_id = 1
        and p.content_type = 'full-course' and p.language = 'hinglish'
        and p.difficulty = 'intermediate'
        and p.audience_focus = expected.class_label
        and p.class_levels = array[expected.class_label]::text[]
        and p.title_review_status = 'pending'
        and p.faculty_credit_status = 'pending'
    )
    or (select count(*) from public.playlist_videos pv
        where pv.playlist_id = expected.id) <> cardinality(expected.video_ids)
    or (select array_agg(pv.position order by pv.position)
        from public.playlist_videos pv where pv.playlist_id = expected.id) <>
       (select array_agg(n order by n)
        from generate_series(1, cardinality(expected.video_ids)) n)
    or (select array_agg(v.youtube_video_id order by pv.position)
        from public.playlist_videos pv join public.videos v on v.id = pv.video_id
        where pv.playlist_id = expected.id) <> expected.video_ids
    or exists (
      select 1 from public.playlist_videos pv join public.videos v on v.id = pv.video_id
      where pv.playlist_id = expected.id and v.chapter_id is distinct from expected.chapter_id
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
    raise exception 'refusing Unacademy twenty-first-batch faculty links: reviewed course differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
     or not exists (select 1 from public.chapters where id = 275 and name = 'Kinetic Theory of Gases' and subject_id = 1)
     or not exists (select 1 from public.chapters where id = 15 and name = 'Electromagnetic Waves' and subject_id = 1) then
    raise exception 'refusing Unacademy twenty-first-batch faculty links: reference evidence differs';
  end if;

  if exists (
    select 1 from public.teachers
    where slug in ('shubham-kumar','samip-velani')
       or canonical_name in ('shubham kumar','samip velani')
  )
  or exists (
    select 1 from public.teacher_aliases
    where normalized_alias in ('shubham kumar','shubham','samip velani','samip')
  )
  or exists (select 1 from public.playlist_teachers where playlist_id in (439,440))
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (439,440)) then
    raise exception 'refusing Unacademy twenty-first-batch faculty links: identity, link, or review appeared';
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
          where lg.slug='jee' and p.id < 167) x),'') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|' order by y.playlist_id,y.position,y.id) from (
          select pv.id,pv.playlist_id,pv.video_id,pv.position
          from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id
            where plg.playlist_id=p.id and lg.slug='jee')) y),'')
      ) as protected_fingerprint
  ) protected;
  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy twenty-first-batch faculty links: protected JEE mismatch (%)', row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.teachers (display_name, canonical_name, slug, verified)
values
  ('Shubham Kumar', '', 'shubham-kumar', true),
  ('Samip Velani', '', 'samip-velani', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1 from (values
      ('Shubham Kumar'::text,'shubham kumar'::text,'shubham-kumar'::text),
      ('Samip Velani'::text,'samip velani'::text,'samip-velani'::text)
    ) expected(display_name,canonical_name,slug)
    where not exists (
      select 1 from public.teachers t where t.display_name=expected.display_name
        and t.canonical_name=expected.canonical_name and t.slug=expected.slug and t.verified
    )
  ) then raise exception 'Unacademy twenty-first-batch faculty identity conflict'; end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('shubham-kumar','Shubham Kumar','full-name'),
  ('shubham-kumar','Shubham','short'),
  ('samip-velani','Samip Velani','full-name'),
  ('samip-velani','Samip','short')
) expected(slug,alias,alias_type)
join public.teachers t on t.slug=expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id,institute_id,is_primary)
select id,147,true from public.teachers where slug in ('shubham-kumar','samip-velani')
on conflict (teacher_id,institute_id) do nothing;

insert into public.teacher_subjects (teacher_id,subject_id)
select id,1 from public.teachers where slug in ('shubham-kumar','samip-velani')
on conflict (teacher_id,subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id,learning_goal_id)
select id,2 from public.teachers where slug in ('shubham-kumar','samip-velani')
on conflict (teacher_id,learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id,teacher_id,role,position)
select expected.playlist_id,t.id,'instructor',1
from (values (439::bigint,'shubham-kumar'::text),(440::bigint,'samip-velani'::text)) expected(playlist_id,slug)
join public.teachers t on t.slug=expected.slug
on conflict (playlist_id,teacher_id) do nothing;

do $postflight$
declare v_protected record;
begin
  if (select count(*) from public.playlists) <> 421
     or (select count(*) from public.videos) <> 4746
     or (select count(*) from public.playlist_videos) <> 4752
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 37
     or (select count(*) from public.teacher_aliases) <> 60
     or (select count(*) from public.teacher_institutes) <> 38
     or (select count(*) from public.teacher_subjects) <> 38
     or (select count(*) from public.teacher_learning_goals) <> 37
     or (select count(*) from public.playlist_teachers) <> 176
     or (select count(*) from public.playlist_quality_reviews) <> 45 then
    raise exception 'Unacademy twenty-first-batch faculty links postflight count mismatch';
  end if;
  if (select array_agg(format('%s:%s:%s',pt.playlist_id,t.slug,pt.position) order by pt.playlist_id)
      from public.playlist_teachers pt join public.teachers t on t.id=pt.teacher_id
      where pt.playlist_id in (439,440)) <>
     array['439:shubham-kumar:1','440:samip-velani:1']::text[] then
    raise exception 'Unacademy twenty-first-batch faculty links course-link mismatch';
  end if;
  if exists (select 1 from public.playlists where id in (439,440)
             and (faculty_credit_status <> 'pending' or title_review_status <> 'pending'))
     or exists (select 1 from public.playlist_quality_reviews where playlist_id in (439,440)) then
    raise exception 'Unacademy twenty-first-batch faculty links changed review state';
  end if;
  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_courses,
      (select count(*) from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_memberships,
      md5(coalesce((select string_agg(row_to_json(x)::text,'|' order by x.id) from (select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,p.subject_id,p.class_levels,p.audience_focus,p.content_type,p.language,p.difficulty from public.playlists p join public.playlist_learning_goals plg on plg.playlist_id=p.id join public.learning_goals lg on lg.id=plg.learning_goal_id where lg.slug='jee' and p.id<167)x),'')||'|'||coalesce((select string_agg(row_to_json(y)::text,'|' order by y.playlist_id,y.position,y.id) from (select pv.id,pv.playlist_id,pv.video_id,pv.position from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee'))y),'')) protected_fingerprint
  ) protected;
  if v_protected.protected_courses<>82 or v_protected.protected_memberships<>1304 or v_protected.protected_fingerprint<>'30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy twenty-first-batch faculty links protected JEE mismatch (%)',row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id,p.title,t.id as teacher_id,t.display_name,t.slug,t.verified,pt.role,pt.position
from public.playlists p join public.playlist_teachers pt on pt.playlist_id=p.id
join public.teachers t on t.id=pt.teacher_id where p.id in (439,440)
order by p.id,pt.position;

commit;
