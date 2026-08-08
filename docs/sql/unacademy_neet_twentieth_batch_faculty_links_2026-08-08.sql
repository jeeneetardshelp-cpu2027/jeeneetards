-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Content/teacher-evidence decision: 8de024c6-7317-4901-a91e-5006a5efcd7e.
-- Scope: one new verified teacher with reviewed aliases/context, one existing
-- verified teacher, and three additive course-teacher links for courses 436-438.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twentieth-batch faculty package: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 419
     or (select count(*) from public.videos) <> 4740
     or (select count(*) from public.playlist_videos) <> 4746
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 171
     or (select count(*) from public.playlist_quality_reviews) <> 42 then
    raise exception 'refusing Unacademy twentieth-batch faculty package: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (436::bigint,
       'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhMzQKgCZ2vyX2bh3ejb1eIQ'::text,
       2::bigint, 55::bigint, 'class-12'::text, '12th'::text,
       array['tZWyg6ewJb8','inlxrwae1Ys','X24X5wXFUno']::text[]),
      (437::bigint,
       'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhMRv85qlHflI5j8SoA8yZ0n'::text,
       2::bigint, 46::bigint, 'class-11'::text, '11th'::text,
       array['CdCL4s9L4F8','4-LZNHTDJaE','1pEXZvaack4']::text[]),
      (438::bigint,
       'Semiconductors - Playlist | Class 12 | Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir'::text,
       'Indrajeet Singh Sangtani'::text, 'PLsgHooHkqhhNhMBc1PNiIav8Kv_O7NPIT'::text,
       1::bigint, 17::bigint, 'class-12'::text, '12th'::text,
       array['6r2dj5wPfMk','OLymGXjoLUQ','q_Yji3EdXfg']::text[])
    ) expected(id, title, teacher, source_id, subject_id, chapter_id,
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
        and p.subject_id = expected.subject_id
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
        from public.playlist_videos pv where pv.playlist_id = expected.id) <>
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
    raise exception 'refusing Unacademy twentieth-batch faculty package: reviewed course differs';
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
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12') then
    raise exception 'refusing Unacademy twentieth-batch faculty package: reference evidence differs';
  end if;

  if not exists (
       select 1 from public.teachers t
       where t.id = 36 and t.display_name = 'Anoop Vashishtha'
         and t.canonical_name = 'anoop vashishtha'
         and t.slug = 'anoop-vashishtha' and t.verified
     )
     or not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 36 and institute_id = 147 and is_primary
     )
     or not exists (
       select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2
     )
     or not exists (
       select 1 from public.teacher_learning_goals
       where teacher_id = 36 and learning_goal_id = 2
     ) then
    raise exception 'refusing Unacademy twentieth-batch faculty package: Anoop evidence differs';
  end if;

  if exists (
    select 1 from public.teachers
    where slug = 'indrajeet-singh-sangtani'
       or canonical_name = 'indrajeet singh sangtani'
  )
  or exists (
    select 1 from public.teacher_aliases
    where normalized_alias in ('indrajeet singh sangtani', 'indrajeet')
  )
  or exists (select 1 from public.playlist_teachers where playlist_id in (436, 437, 438))
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (436, 437, 438)) then
    raise exception 'refusing Unacademy twentieth-batch faculty package: faculty identity, course link, or review appeared';
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
    raise exception 'refusing Unacademy twentieth-batch faculty package: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values ('Indrajeet Singh Sangtani', '', 'indrajeet-singh-sangtani', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if not exists (
    select 1 from public.teachers
    where display_name = 'Indrajeet Singh Sangtani'
      and canonical_name = 'indrajeet singh sangtani'
      and slug = 'indrajeet-singh-sangtani'
      and verified
  ) then
    raise exception 'Unacademy twentieth-batch faculty identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('Indrajeet Singh Sangtani', 'full-name'),
  ('Indrajeet Sir', 'short')
) expected(alias, alias_type)
cross join public.teachers t
where t.slug = 'indrajeet-singh-sangtani'
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select id, 147, true from public.teachers where slug = 'indrajeet-singh-sangtani'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select id, 1 from public.teachers where slug = 'indrajeet-singh-sangtani'
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select id, 2 from public.teachers where slug = 'indrajeet-singh-sangtani'
on conflict (teacher_id, learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (436::bigint, 'anoop-vashishtha'),
  (437::bigint, 'anoop-vashishtha'),
  (438::bigint, 'indrajeet-singh-sangtani')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 419
     or (select count(*) from public.videos) <> 4740
     or (select count(*) from public.playlist_videos) <> 4746
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 35
     or (select count(*) from public.teacher_aliases) <> 56
     or (select count(*) from public.teacher_institutes) <> 36
     or (select count(*) from public.teacher_subjects) <> 36
     or (select count(*) from public.teacher_learning_goals) <> 35
     or (select count(*) from public.playlist_teachers) <> 174
     or (select count(*) from public.playlist_quality_reviews) <> 42 then
    raise exception 'Unacademy twentieth-batch faculty package postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (436, 437, 438)) <>
     array[
       '436:anoop-vashishtha:1',
       '437:anoop-vashishtha:1',
       '438:indrajeet-singh-sangtani:1'
     ]::text[] then
    raise exception 'Unacademy twentieth-batch faculty package course-link mismatch';
  end if;

  if (select array_agg(ta.normalized_alias order by ta.normalized_alias)
      from public.teacher_aliases ta
      join public.teachers t on t.id = ta.teacher_id
      where t.slug = 'indrajeet-singh-sangtani') <>
     array['indrajeet', 'indrajeet singh sangtani']::text[] then
    raise exception 'Unacademy twentieth-batch faculty package alias mismatch';
  end if;

  if not exists (
       select 1 from public.teacher_institutes ti
       join public.teachers t on t.id = ti.teacher_id
       where t.slug = 'indrajeet-singh-sangtani'
         and ti.institute_id = 147 and ti.is_primary
     )
     or not exists (
       select 1 from public.teacher_subjects ts
       join public.teachers t on t.id = ts.teacher_id
       where t.slug = 'indrajeet-singh-sangtani' and ts.subject_id = 1
     )
     or not exists (
       select 1 from public.teacher_learning_goals tlg
       join public.teachers t on t.id = tlg.teacher_id
       where t.slug = 'indrajeet-singh-sangtani' and tlg.learning_goal_id = 2
     ) then
    raise exception 'Unacademy twentieth-batch faculty package context-link mismatch';
  end if;

  if exists (
    select 1 from public.playlists
    where id in (436, 437, 438)
      and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  )
  or exists (select 1 from public.playlist_quality_reviews where playlist_id in (436, 437, 438)) then
    raise exception 'Unacademy twentieth-batch faculty package changed review state';
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
    raise exception 'Unacademy twentieth-batch faculty package protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (436, 437, 438)
order by p.id, pt.position;

commit;
