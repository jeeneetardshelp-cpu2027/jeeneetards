-- PREPARED ONLY. DO NOT RUN WITHOUT A FRESH REHEARSAL AND OWNER APPROVAL.
-- Source review:
--   docs/drona-neet-faculty-readiness-2026-07-28.md
-- Additive package for the reviewed Drona course range 136-150.

begin;

do $preflight$
declare
  v_neet_id bigint;
begin
  select id into strict v_neet_id
  from public.learning_goals
  where slug = 'neet';

  perform 1
  from public.institutes_channels
  where name = 'Competition Wallah';
  if not found then
    raise exception 'Competition Wallah institute is missing';
  end if;

  if (select count(*)
      from public.playlist_learning_goals
      where learning_goal_id = v_neet_id) <> 60 then
    raise exception 'expected exactly 60 NEET courses';
  end if;

  if (select count(*) from public.teachers) <> 25
     or (select count(*) from public.teacher_aliases) <> 39
     or (select count(*) from public.playlist_teachers) <> 127 then
    raise exception 'faculty baseline differs from 25 teachers, 39 aliases, 127 links';
  end if;

  if exists (
    select 1
    from (values
      (136, 'Tanuj Bansal',    'PLJyab0VQDBGXzCh7NwnQEnXYLRMV9wSla'),
      (137, 'Dr. Roopali',     'PLJyab0VQDBGVqxcvq_VqtOHpoDfzfBoIB'),
      (138, 'Agrim Jain',      'PLJyab0VQDBGWCGQkb-8wrQJdh7EvXNdtM'),
      (139, 'Dr. Roopali',     'PLJyab0VQDBGWN8QnBrfxPmaX7WWBvi22V'),
      (140, 'Ashima Gupta',    'PLJyab0VQDBGXflguPIC4vklng-7D_wtts'),
      (141, 'Tanuj Bansal',    'PLJyab0VQDBGXLJYAQRLedz4iJjRxw4qEi'),
      (142, 'Dr. Roopali',     'PLJyab0VQDBGXa_iYaCbI5yJ25Kfvwz_dk'),
      (143, 'Ashima Gupta',    'PLJyab0VQDBGXhPpBCKHlCuR5qsWkZwCAT'),
      (144, 'Agrim Jain',      'PLJyab0VQDBGXGaYdcYBC8ZOQq-ZitUL-P'),
      (145, 'Tanuj Bansal',    'PLJyab0VQDBGVqDUpQ3xLlL2KFl0CZMYhA'),
      (146, 'Sudhanshu Kumar', 'PLJyab0VQDBGXOmXNsC_H6Ii6nQJPIILSb'),
      (147, 'Tanuj Bansal',    'PLJyab0VQDBGUFqZpshfgty11OX8WS0WvW'),
      (148, 'Agrim Jain',      'PLJyab0VQDBGW5tFTk-eCnDsl1wyH2UO9q'),
      (149, 'Dr. Roopali',     'PLJyab0VQDBGWlXkQ5QiSwCLqtxUgZXx4M'),
      (150, 'Tanuj Bansal',    'PLJyab0VQDBGX58f2BxRhi6yMSOVMqEro0')
    ) expected(id, teacher, youtube_playlist_id)
    left join public.playlists p
      on p.id = expected.id
     and p.teacher = expected.teacher
     and p.youtube_playlist_id = expected.youtube_playlist_id
    left join public.playlist_learning_goals plg
      on plg.playlist_id = p.id
     and plg.learning_goal_id = v_neet_id
    where p.id is null or plg.playlist_id is null
  ) then
    raise exception 'reviewed Drona course identity changed';
  end if;

  if exists (
    select 1
    from public.playlist_teachers
    where playlist_id between 136 and 150
  ) then
    raise exception 'Drona course range already has faculty links';
  end if;

  if exists (
    select 1
    from public.teachers
    where slug in ('tanuj-bansal', 'dr-roopali', 'agrim-jain', 'ashima-gupta')
  ) then
    raise exception 'a new Drona faculty slug already exists';
  end if;

  if not exists (
    select 1
    from public.teachers
    where slug = 'sudhanshu-kumar'
      and display_name = 'Sudhanshu Kumar'
      and verified
  ) then
    raise exception 'reviewed Sudhanshu Kumar identity is missing';
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Tanuj Bansal', '', 'tanuj-bansal', true),
  ('Dr. Roopali', '', 'dr-roopali', true),
  ('Agrim Jain', '', 'agrim-jain', true),
  ('Ashima Gupta', '', 'ashima-gupta', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('tanuj-bansal', 'Tanuj Bansal'),
      ('dr-roopali', 'Dr. Roopali'),
      ('agrim-jain', 'Agrim Jain'),
      ('ashima-gupta', 'Ashima Gupta'),
      ('sudhanshu-kumar', 'Sudhanshu Kumar')
    ) expected(slug, display_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or not t.verified
  ) then
    raise exception 'reviewed Drona teacher identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, ic.id, true
from public.teachers t
cross join public.institutes_channels ic
where t.slug in ('tanuj-bansal', 'dr-roopali', 'agrim-jain', 'ashima-gupta')
  and ic.name = 'Competition Wallah'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, s.id
from (values
  ('tanuj-bansal', 'Physics'),
  ('dr-roopali', 'Biology'),
  ('agrim-jain', 'Biology'),
  ('ashima-gupta', 'Chemistry')
) expected(slug, subject_name)
join public.teachers t on t.slug = expected.slug
join public.subjects s on s.name = expected.subject_name
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, lg.id
from public.teachers t
cross join public.learning_goals lg
where t.slug in ('tanuj-bansal', 'dr-roopali', 'agrim-jain', 'ashima-gupta')
  and lg.slug = 'neet'
on conflict (teacher_id, learning_goal_id) do nothing;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (136, 'tanuj-bansal'),
  (137, 'dr-roopali'),
  (138, 'agrim-jain'),
  (139, 'dr-roopali'),
  (140, 'ashima-gupta'),
  (141, 'tanuj-bansal'),
  (142, 'dr-roopali'),
  (143, 'ashima-gupta'),
  (144, 'agrim-jain'),
  (145, 'tanuj-bansal'),
  (146, 'sudhanshu-kumar'),
  (147, 'tanuj-bansal'),
  (148, 'agrim-jain'),
  (149, 'dr-roopali'),
  (150, 'tanuj-bansal')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_fingerprint text;
begin
  if (select count(*) from public.teachers) <> 29
     or (select count(*) from public.teacher_aliases) <> 39
     or (select count(*) from public.playlist_teachers) <> 142
     or (select count(*) from public.teacher_institutes) <> 29
     or (select count(*) from public.teacher_subjects) <> 29
     or (select count(*) from public.teacher_learning_goals) <> 29 then
    raise exception 'Drona faculty additive totals differ from expectation';
  end if;

  if (select count(*)
      from public.playlist_teachers
      where playlist_id between 136 and 150) <> 15 then
    raise exception 'expected exactly 15 Drona faculty links';
  end if;

  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where lg.slug = 'jee'
      and pt.playlist_id between 136 and 150
  ) then
    raise exception 'Drona faculty package unexpectedly linked a JEE course';
  end if;

  select md5(
    coalesce((
      select string_agg(row_to_json(x)::text, '|' order by x.id)
      from (
        select
          p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
          p.subject_id, p.class_levels, p.audience_focus, p.content_type,
          p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) x
    ), '')
    || '|'
    || coalesce((
      select string_agg(
        row_to_json(y)::text,
        '|' order by y.playlist_id, y.position, y.id
      )
      from (
        select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlist_learning_goals plg
          on plg.playlist_id = pv.playlist_id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
        where lg.slug = 'jee'
      ) y
    ), '')
  ) into v_fingerprint;

  if v_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc' then
    raise exception 'protected JEE fingerprint changed (%)', v_fingerprint;
  end if;
end
$postflight$;

commit;
