-- PREPARED ONLY. DO NOT RUN WITHOUT A FRESH REHEARSAL AND OWNER APPROVAL.
-- Source reviews:
--   docs/faculty_identity_review_neet_batch_2_2026-07-28.md
--   docs/faculty_identity_review_neet_batch_3_2026-07-28.md
-- Additive and idempotent: no existing row is modified or removed.

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
      where learning_goal_id = v_neet_id) <> 45 then
    raise exception 'expected exactly 45 NEET courses';
  end if;

  if exists (
    select 1
    from (values
      (92,  'Manish Raj'),
      (93,  'Pawan Kumar Pandey'),
      (94,  'Mohit Dadheech Sir'),
      (95,  'Pankaj Sijariya'),
      (96,  'Amit Mahajan'),
      (97,  'Mohit Dadheech'),
      (98,  'Nikhil Saini Sir'),
      (99,  'Vipin Sharma Sir'),
      (100, 'Pratham Nahata Sir'),
      (101, 'Vipin Sharma Sir'),
      (102, 'Vipin Sharma Sir'),
      (103, 'Swagata Mukherjee Ma''am'),
      (104, 'Tulika Jha Ma''am'),
      (108, 'Pankaj Sijariya'),
      (109, 'Amit Mahajan'),
      (110, 'Manish Raj'),
      (111, 'Saleem Sir'),
      (112, 'SKC Sir'),
      (113, 'Pankaj Sijariya'),
      (114, 'Aayudh Sir'),
      (115, 'Abhishek Verma Sir'),
      (116, 'Sudhanshu Sir'),
      (117, 'Siddharth Sir'),
      (120, 'Vipin Sharma Sir'),
      (121, 'Harshit Thakuria Sir'),
      (122, 'Samapti Ma''am')
    ) expected(id, teacher)
    left join public.playlists p
      on p.id = expected.id and p.teacher = expected.teacher
    left join public.playlist_learning_goals plg
      on plg.playlist_id = p.id and plg.learning_goal_id = v_neet_id
    where p.id is null or plg.playlist_id is null
  ) then
    raise exception 'reviewed NEET course IDs or teacher values changed';
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Vipin Sharma', '', 'vipin-sharma', true),
  ('Pankaj Sijariya', '', 'pankaj-sijariya', true),
  ('Amit Mahajan', '', 'amit-mahajan', true),
  ('Manish Raj', '', 'manish-raj', true),
  ('Pawan Kumar Pandey', '', 'pawan-kumar-pandey', true),
  ('Mohit Dadheech', '', 'mohit-dadheech', true),
  ('Nikhil Saini', '', 'nikhil-saini', true),
  ('Pratham Nahata', '', 'pratham-nahata', true),
  ('Swagata Mukherjee', '', 'swagata-mukherjee', true),
  ('Tulika Jha', '', 'tulika-jha', true),
  ('Saleem Ahmad', '', 'saleem-ahmad', true),
  ('Shubh Karan Choudhary', '', 'shubh-karan-choudhary', true),
  ('Aayudh Yashlaha', '', 'aayudh-yashlaha', true),
  ('Abhishek Verma', '', 'abhishek-verma', true),
  ('Sudhanshu Kumar', '', 'sudhanshu-kumar', true),
  ('Siddharth Sharma', '', 'siddharth-sharma', true),
  ('Harshit Thakuria', '', 'harshit-thakuria', true),
  ('Samapti Sinha', '', 'samapti-sinha', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('vipin-sharma', 'Vipin Sharma'),
      ('pankaj-sijariya', 'Pankaj Sijariya'),
      ('amit-mahajan', 'Amit Mahajan'),
      ('manish-raj', 'Manish Raj'),
      ('pawan-kumar-pandey', 'Pawan Kumar Pandey'),
      ('mohit-dadheech', 'Mohit Dadheech'),
      ('nikhil-saini', 'Nikhil Saini'),
      ('pratham-nahata', 'Pratham Nahata'),
      ('swagata-mukherjee', 'Swagata Mukherjee'),
      ('tulika-jha', 'Tulika Jha'),
      ('saleem-ahmad', 'Saleem Ahmad'),
      ('shubh-karan-choudhary', 'Shubh Karan Choudhary'),
      ('aayudh-yashlaha', 'Aayudh Yashlaha'),
      ('abhishek-verma', 'Abhishek Verma'),
      ('sudhanshu-kumar', 'Sudhanshu Kumar'),
      ('siddharth-sharma', 'Siddharth Sharma'),
      ('harshit-thakuria', 'Harshit Thakuria'),
      ('samapti-sinha', 'Samapti Sinha')
    ) expected(slug, display_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or not t.verified
  ) then
    raise exception 'reviewed NEET teacher identity conflict';
  end if;
end
$identity_check$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('vipin-sharma', 'Vipin Sharma Sir', 'full-name'),
  ('vipin-sharma', 'Vipin Sir', 'short'),
  ('pankaj-sijariya', 'Pankaj Sijariya Sir', 'full-name'),
  ('pankaj-sijariya', 'Pankaj Sir', 'short'),
  ('amit-mahajan', 'Amit Mahajan Sir', 'full-name'),
  ('manish-raj', 'Manish Raj Sir', 'full-name'),
  ('pawan-kumar-pandey', 'Pawan Kumar Pandey Sir', 'full-name'),
  ('mohit-dadheech', 'Mohit Dadheech Sir', 'full-name'),
  ('nikhil-saini', 'Nikhil Saini Sir', 'full-name'),
  ('pratham-nahata', 'Pratham Nahata Sir', 'full-name'),
  ('swagata-mukherjee', 'Swagata Mukherjee Ma''am', 'full-name'),
  ('tulika-jha', 'Tulika Jha Ma''am', 'full-name'),
  ('saleem-ahmad', 'Saleem Ahmad Sir', 'full-name'),
  ('saleem-ahmad', 'Saleem Sir', 'short'),
  ('shubh-karan-choudhary', 'Shubh Karan Choudhary Sir', 'full-name'),
  ('shubh-karan-choudhary', 'SKC Sir', 'initials'),
  ('aayudh-yashlaha', 'Aayudh Yashlaha Sir', 'full-name'),
  ('aayudh-yashlaha', 'Aayudh Sir', 'short'),
  ('abhishek-verma', 'Abhishek Verma Sir', 'full-name'),
  ('sudhanshu-kumar', 'Sudhanshu Kumar Sir', 'full-name'),
  ('sudhanshu-kumar', 'Sudhanshu Sir', 'short'),
  ('siddharth-sharma', 'Siddharth Sharma Sir', 'full-name'),
  ('siddharth-sharma', 'Siddharth Sir', 'short'),
  ('harshit-thakuria', 'Harshit Thakuria Sir', 'full-name'),
  ('samapti-sinha', 'Samapti Sinha Ma''am', 'full-name'),
  ('samapti-sinha', 'Samapti Ma''am', 'short')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, ic.id, true
from public.teachers t
cross join public.institutes_channels ic
where t.slug in (
  'vipin-sharma', 'pankaj-sijariya', 'amit-mahajan', 'manish-raj',
  'pawan-kumar-pandey', 'mohit-dadheech', 'nikhil-saini', 'pratham-nahata',
  'swagata-mukherjee', 'tulika-jha', 'saleem-ahmad',
  'shubh-karan-choudhary', 'aayudh-yashlaha', 'abhishek-verma',
  'sudhanshu-kumar', 'siddharth-sharma', 'harshit-thakuria', 'samapti-sinha'
)
  and ic.name = 'Competition Wallah'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, s.id
from (values
  ('vipin-sharma', 'Biology'),
  ('pankaj-sijariya', 'Chemistry'),
  ('amit-mahajan', 'Chemistry'),
  ('manish-raj', 'Physics'),
  ('pawan-kumar-pandey', 'Physics'),
  ('mohit-dadheech', 'Chemistry'),
  ('nikhil-saini', 'Chemistry'),
  ('pratham-nahata', 'Biology'),
  ('swagata-mukherjee', 'Biology'),
  ('tulika-jha', 'Biology'),
  ('saleem-ahmad', 'Physics'),
  ('shubh-karan-choudhary', 'Chemistry'),
  ('aayudh-yashlaha', 'Physics'),
  ('abhishek-verma', 'Physics'),
  ('sudhanshu-kumar', 'Chemistry'),
  ('siddharth-sharma', 'Physics'),
  ('harshit-thakuria', 'Biology'),
  ('samapti-sinha', 'Biology')
) expected(slug, subject_name)
join public.teachers t on t.slug = expected.slug
join public.subjects s on s.name = expected.subject_name
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, lg.id
from public.teachers t
cross join public.learning_goals lg
where t.slug in (
  'vipin-sharma', 'pankaj-sijariya', 'amit-mahajan', 'manish-raj',
  'pawan-kumar-pandey', 'mohit-dadheech', 'nikhil-saini', 'pratham-nahata',
  'swagata-mukherjee', 'tulika-jha', 'saleem-ahmad',
  'shubh-karan-choudhary', 'aayudh-yashlaha', 'abhishek-verma',
  'sudhanshu-kumar', 'siddharth-sharma', 'harshit-thakuria', 'samapti-sinha'
)
  and lg.slug = 'neet'
on conflict (teacher_id, learning_goal_id) do nothing;

do $conflict_check$
begin
  if exists (
    select 1
    from public.playlist_teachers pt
    join public.teachers actual on actual.id = pt.teacher_id
    join (values
      (92, 'manish-raj'), (93, 'pawan-kumar-pandey'),
      (94, 'mohit-dadheech'), (95, 'pankaj-sijariya'),
      (96, 'amit-mahajan'), (97, 'mohit-dadheech'),
      (98, 'nikhil-saini'), (99, 'vipin-sharma'),
      (100, 'pratham-nahata'), (101, 'vipin-sharma'),
      (102, 'vipin-sharma'), (103, 'swagata-mukherjee'),
      (104, 'tulika-jha'), (108, 'pankaj-sijariya'),
      (109, 'amit-mahajan'), (110, 'manish-raj'),
      (111, 'saleem-ahmad'), (112, 'shubh-karan-choudhary'),
      (113, 'pankaj-sijariya'), (114, 'aayudh-yashlaha'),
      (115, 'abhishek-verma'), (116, 'sudhanshu-kumar'),
      (117, 'siddharth-sharma'), (120, 'vipin-sharma'),
      (121, 'harshit-thakuria'), (122, 'samapti-sinha')
    ) expected(playlist_id, slug) on expected.playlist_id = pt.playlist_id
    where actual.slug <> expected.slug
  ) then
    raise exception 'existing NEET faculty link conflicts with reviewed mapping';
  end if;
end
$conflict_check$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select expected.playlist_id, t.id, 'instructor', 1
from (values
  (92, 'manish-raj'), (93, 'pawan-kumar-pandey'),
  (94, 'mohit-dadheech'), (95, 'pankaj-sijariya'),
  (96, 'amit-mahajan'), (97, 'mohit-dadheech'),
  (98, 'nikhil-saini'), (99, 'vipin-sharma'),
  (100, 'pratham-nahata'), (101, 'vipin-sharma'),
  (102, 'vipin-sharma'), (103, 'swagata-mukherjee'),
  (104, 'tulika-jha'), (108, 'pankaj-sijariya'),
  (109, 'amit-mahajan'), (110, 'manish-raj'),
  (111, 'saleem-ahmad'), (112, 'shubh-karan-choudhary'),
  (113, 'pankaj-sijariya'), (114, 'aayudh-yashlaha'),
  (115, 'abhishek-verma'), (116, 'sudhanshu-kumar'),
  (117, 'siddharth-sharma'), (120, 'vipin-sharma'),
  (121, 'harshit-thakuria'), (122, 'samapti-sinha')
) expected(playlist_id, slug)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_fingerprint text;
begin
  if (select count(*)
      from public.playlist_teachers pt
      where pt.playlist_id in (
        92,93,94,95,96,97,98,99,100,101,102,103,104,
        108,109,110,111,112,113,114,115,116,117,120,121,122
      )) <> 26 then
    raise exception 'expected exactly 26 reviewed NEET faculty links';
  end if;

  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where lg.slug = 'jee'
      and pt.playlist_id in (
        92,93,94,95,96,97,98,99,100,101,102,103,104,
        108,109,110,111,112,113,114,115,116,117,120,121,122
      )
  ) then
    raise exception 'NEET batch unexpectedly linked a JEE course';
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
