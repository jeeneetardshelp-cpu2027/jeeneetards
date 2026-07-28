-- CLONE REHEARSAL ONLY.
-- Source review: docs/faculty_identity_review_batch_1_2026-07-28.md
-- Additive and idempotent: no existing row is updated or deleted.

begin;

do $$
declare
  v_jee_id bigint;
  v_institute_id bigint;
begin
  select id into strict v_jee_id
  from public.learning_goals
  where slug = 'jee';

  select id into strict v_institute_id
  from public.institutes_channels
  where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw'
    and name = 'Mohit Tyagi';

  if (select count(*)
      from public.playlist_learning_goals plg
      where plg.learning_goal_id = v_jee_id) <> 83 then
    raise exception 'expected exactly 83 JEE courses';
  end if;

  if exists (
    select 1
    from public.playlists p
    join public.playlist_learning_goals plg on plg.playlist_id = p.id
    where plg.learning_goal_id = v_jee_id
      and p.teacher not in ('ABJ Sir', 'ALK Sir', 'NS Sir', 'Mohit Tyagi')
  ) then
    raise exception 'unexpected JEE teacher value';
  end if;

  if (select count(*)
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      where plg.learning_goal_id = v_jee_id
        and p.teacher = 'ABJ Sir') <> 33
     or (select count(*)
         from public.playlists p
         join public.playlist_learning_goals plg on plg.playlist_id = p.id
         where plg.learning_goal_id = v_jee_id
           and p.teacher = 'ALK Sir') <> 23
     or (select count(*)
         from public.playlists p
         join public.playlist_learning_goals plg on plg.playlist_id = p.id
         where plg.learning_goal_id = v_jee_id
           and p.teacher = 'NS Sir') <> 4
     or (select count(*)
         from public.playlists p
         join public.playlist_learning_goals plg on plg.playlist_id = p.id
         where plg.learning_goal_id = v_jee_id
           and p.teacher = 'Mohit Tyagi') <> 23 then
    raise exception 'JEE teacher coverage differs from the reviewed 33/23/4/23 split';
  end if;
end $$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Amit Bijarnia', '', 'amit-bijarnia', true),
  ('Alok Kumar', '', 'alok-kumar', true),
  ('Neeraj Saini', '', 'neeraj-saini', true),
  ('Mohit Tyagi', '', 'mohit-tyagi', true)
on conflict (slug) do nothing;

do $$
begin
  if exists (
    select 1
    from (values
      ('amit-bijarnia', 'Amit Bijarnia'),
      ('alok-kumar', 'Alok Kumar'),
      ('neeraj-saini', 'Neeraj Saini'),
      ('mohit-tyagi', 'Mohit Tyagi')
    ) expected(slug, display_name)
    left join public.teachers t on t.slug = expected.slug
    where t.id is null
       or t.display_name <> expected.display_name
       or not t.verified
  ) then
    raise exception 'reviewed teacher identity conflict';
  end if;
end $$;

insert into public.teacher_aliases
  (teacher_id, alias, normalized_alias, alias_type, status, source, verified_at)
select t.id, expected.alias, '', expected.alias_type, 'verified', 'manual', now()
from (values
  ('amit-bijarnia', 'ABJ Sir', 'initials'),
  ('amit-bijarnia', 'Amit Bijarnia Sir', 'full-name'),
  ('alok-kumar', 'ALK Sir', 'initials'),
  ('alok-kumar', 'Alok Kumar Sir', 'full-name'),
  ('neeraj-saini', 'NS Sir', 'initials'),
  ('neeraj-saini', 'Neeraj Saini Sir', 'full-name'),
  ('mohit-tyagi', 'MT Sir', 'initials'),
  ('mohit-tyagi', 'Mohit Tyagi Sir', 'full-name')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, ic.id, true
from public.teachers t
cross join public.institutes_channels ic
where t.slug in ('amit-bijarnia', 'alok-kumar', 'neeraj-saini', 'mohit-tyagi')
  and ic.youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw'
  and ic.name = 'Mohit Tyagi'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, s.id
from (values
  ('amit-bijarnia', 'Physics'),
  ('alok-kumar', 'Chemistry'),
  ('neeraj-saini', 'Chemistry'),
  ('mohit-tyagi', 'Mathematics')
) expected(slug, subject_name)
join public.teachers t on t.slug = expected.slug
join public.subjects s on s.name = expected.subject_name
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, lg.id
from public.teachers t
cross join public.learning_goals lg
where t.slug in ('amit-bijarnia', 'alok-kumar', 'neeraj-saini', 'mohit-tyagi')
  and lg.slug = 'jee'
on conflict (teacher_id, learning_goal_id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlists p on p.id = pt.playlist_id
    join public.teachers t on t.id = pt.teacher_id
    where p.teacher in ('ABJ Sir', 'ALK Sir', 'NS Sir', 'Mohit Tyagi')
      and t.slug <> case p.teacher
        when 'ABJ Sir' then 'amit-bijarnia'
        when 'ALK Sir' then 'alok-kumar'
        when 'NS Sir' then 'neeraj-saini'
        when 'Mohit Tyagi' then 'mohit-tyagi'
      end
  ) then
    raise exception 'existing JEE faculty link conflicts with reviewed mapping';
  end if;
end $$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select p.id, t.id, 'instructor', 1
from public.playlists p
join public.teachers t on t.slug = case p.teacher
  when 'ABJ Sir' then 'amit-bijarnia'
  when 'ALK Sir' then 'alok-kumar'
  when 'NS Sir' then 'neeraj-saini'
  when 'Mohit Tyagi' then 'mohit-tyagi'
end
where p.teacher in ('ABJ Sir', 'ALK Sir', 'NS Sir', 'Mohit Tyagi')
on conflict (playlist_id, teacher_id) do nothing;

do $$
declare
  v_jee_id bigint;
begin
  select id into strict v_jee_id
  from public.learning_goals
  where slug = 'jee';

  if (select count(*)
      from public.playlist_teachers pt
      join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
      join public.teachers t on t.id = pt.teacher_id
      where plg.learning_goal_id = v_jee_id
        and t.slug in ('amit-bijarnia', 'alok-kumar', 'neeraj-saini', 'mohit-tyagi'))
      <> 83 then
    raise exception 'expected exactly 83 reviewed JEE faculty links';
  end if;

  if exists (
    select 1
    from public.playlist_learning_goals plg
    join public.playlist_teachers pt on pt.playlist_id = plg.playlist_id
    where plg.learning_goal_id = v_jee_id
    group by plg.playlist_id
    having count(*) <> 1
  ) then
    raise exception 'every JEE course must have exactly one faculty link';
  end if;

  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    join public.teachers t on t.id = pt.teacher_id
    where lg.slug = 'neet'
      and t.slug in ('amit-bijarnia', 'alok-kumar', 'neeraj-saini', 'mohit-tyagi')
  ) then
    raise exception 'JEE batch unexpectedly linked a NEET course';
  end if;
end $$;

commit;
