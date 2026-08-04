-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 4555712a-b4ea-446c-8f57-04d2257562f9.
-- Scope: additive faculty-registry links for production courses 374-376 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy second-batch faculty package: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 358
     or (select count(*) from public.videos) <> 4222
     or (select count(*) from public.playlist_videos) <> 4228
     or (select count(*) from public.chapters) <> 250
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 29
     or (select count(*) from public.teacher_aliases) <> 45
     or (select count(*) from public.teacher_institutes) <> 30
     or (select count(*) from public.teacher_subjects) <> 30
     or (select count(*) from public.teacher_learning_goals) <> 29
     or (select count(*) from public.playlist_teachers) <> 133 then
    raise exception 'refusing Unacademy second-batch faculty package: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        374::bigint,
        'Rotational Motion -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
        'Mahendra Singh'::text,
        'PLsgHooHkqhhM1W_NWZnLgqMDysIuHrMXu'::text,
        147::bigint, 1::bigint, 'class-11'::text, 14::bigint
      ),
      (
        375::bigint,
        'NEET: Current Electricity | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text,
        'Anu Gupta'::text,
        'PLsgHooHkqhhNmUjrOF64b49WSKp93PsKZ'::text,
        147::bigint, 1::bigint, 'class-12'::text, 11::bigint
      ),
      (
        376::bigint,
        'NEET: Electrochemistry - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'::text,
        'Anoop Vashishtha'::text,
        'PLsgHooHkqhhPx8PUmYV2q6n6IbpGnCDlg'::text,
        147::bigint, 2::bigint, 'class-12'::text, 9::bigint
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
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.title_review_status is distinct from 'pending'
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
    raise exception 'refusing Unacademy second-batch faculty package: reviewed course evidence differs';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147
       and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
  or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet') then
    raise exception 'refusing Unacademy second-batch faculty package: reference data differs';
  end if;

  if exists (
    select 1 from public.teachers
     where slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
        or lower(display_name) in ('mahendra singh', 'anu gupta', 'anoop vashishtha')
  )
  or exists (
    select 1 from public.teacher_aliases
     where normalized_alias in (
       'mahendra singh', 'mahendra', 'anu gupta', 'anoop vashishtha', 'anoop'
     )
  )
  or exists (
    select 1 from public.playlist_teachers where playlist_id in (374, 375, 376)
  ) then
    raise exception 'refusing Unacademy second-batch faculty package: faculty identity or course link appeared';
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
    raise exception 'refusing Unacademy second-batch faculty package: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Mahendra Singh', '', 'mahendra-singh', true),
  ('Anu Gupta', '', 'anu-gupta', true),
  ('Anoop Vashishtha', '', 'anoop-vashishtha', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('mahendra-singh', 'Mahendra Singh'),
      ('anu-gupta', 'Anu Gupta'),
      ('anoop-vashishtha', 'Anoop Vashishtha')
    ) expected(slug, display_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or not t.verified
  ) then
    raise exception 'Unacademy second-batch faculty identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('mahendra-singh', 'Mahendra Singh', 'full-name'),
  ('mahendra-singh', 'Mahendra Sir', 'short'),
  ('anu-gupta', 'Anu Gupta', 'full-name'),
  ('anu-gupta', 'Anu Gupta Sir', 'short'),
  ('anoop-vashishtha', 'Anoop Vashishtha', 'full-name'),
  ('anoop-vashishtha', 'Anoop Sir', 'short')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, 147, true
from public.teachers t
where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, expected.subject_id
from (values
  ('mahendra-singh', 1::bigint),
  ('anu-gupta', 1::bigint),
  ('anoop-vashishtha', 2::bigint)
) expected(slug, subject_id)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, 2
from public.teachers t
where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
on conflict (teacher_id, learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (374::bigint, 'mahendra-singh'),
  (375::bigint, 'anu-gupta'),
  (376::bigint, 'anoop-vashishtha')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 358
     or (select count(*) from public.videos) <> 4222
     or (select count(*) from public.playlist_videos) <> 4228
     or (select count(*) from public.chapters) <> 250
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 136 then
    raise exception 'Unacademy second-batch faculty package postflight count mismatch';
  end if;

  if (
    select array_agg(
      format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
      order by pt.playlist_id, pt.position
    )
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id in (374, 375, 376)
  ) <> array[
    '374:mahendra-singh:1',
    '375:anu-gupta:1',
    '376:anoop-vashishtha:1'
  ]::text[] then
    raise exception 'Unacademy second-batch faculty package course-link mismatch';
  end if;

  if (
    select array_agg(format('%s:%s', t.slug, ta.normalized_alias)
                     order by t.slug, ta.normalized_alias)
    from public.teacher_aliases ta
    join public.teachers t on t.id = ta.teacher_id
    where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
  ) <> array[
    'anoop-vashishtha:anoop',
    'anoop-vashishtha:anoop vashishtha',
    'anu-gupta:anu gupta',
    'mahendra-singh:mahendra',
    'mahendra-singh:mahendra singh'
  ]::text[] then
    raise exception 'Unacademy second-batch faculty package alias mismatch';
  end if;

  if exists (
    select 1 from public.playlists
     where id in (374, 375, 376)
       and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy second-batch faculty package changed review status';
  end if;

  if (select count(*) from public.teacher_institutes ti
      join public.teachers t on t.id = ti.teacher_id
      where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
        and ti.institute_id = 147 and ti.is_primary) <> 3
  or (select count(*) from public.teacher_subjects ts
      join public.teachers t on t.id = ts.teacher_id
      where (t.slug in ('mahendra-singh', 'anu-gupta') and ts.subject_id = 1)
         or (t.slug = 'anoop-vashishtha' and ts.subject_id = 2)) <> 3
  or (select count(*) from public.teacher_learning_goals tlg
      join public.teachers t on t.id = tlg.teacher_id
      where t.slug in ('mahendra-singh', 'anu-gupta', 'anoop-vashishtha')
        and tlg.learning_goal_id = 2) <> 3 then
    raise exception 'Unacademy second-batch faculty package context-link mismatch';
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
    raise exception 'Unacademy second-batch faculty package protected JEE mismatch (%)',
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
where p.id in (374, 375, 376)
order by p.id, pt.position;

commit;
