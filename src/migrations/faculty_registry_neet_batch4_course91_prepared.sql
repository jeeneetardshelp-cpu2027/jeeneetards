-- PREPARED ONLY. DO NOT RUN WITHOUT A FRESH REHEARSAL AND OWNER APPROVAL.
-- Source review: docs/faculty_identity_review_neet_batch_4_2026-07-28.md
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

  if not exists (
    select 1
    from public.playlists p
    join public.playlist_learning_goals plg on plg.playlist_id = p.id
    where p.id = 91
      and p.teacher = 'Tarun Sir & Samapti Ma''am'
      and plg.learning_goal_id = v_neet_id
  ) then
    raise exception 'reviewed NEET course 91 or teacher value changed';
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Tarun Kumar', '', 'tarun-kumar', true),
  ('Samapti Sinha', '', 'samapti-sinha', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('tarun-kumar', 'Tarun Kumar'),
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
  ('tarun-kumar', 'Tarun Kumar Sir', 'full-name'),
  ('tarun-kumar', 'Tarun Sir', 'short-name'),
  ('samapti-sinha', 'Samapti Sinha Ma''am', 'full-name'),
  ('samapti-sinha', 'Samapti Ma''am', 'short-name')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, ic.id, true
from public.teachers t
cross join public.institutes_channels ic
where t.slug in ('tarun-kumar', 'samapti-sinha')
  and ic.name = 'Competition Wallah'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, s.id
from public.teachers t
cross join public.subjects s
where t.slug in ('tarun-kumar', 'samapti-sinha')
  and s.name = 'Biology'
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, lg.id
from public.teachers t
cross join public.learning_goals lg
where t.slug in ('tarun-kumar', 'samapti-sinha')
  and lg.slug = 'neet'
on conflict (teacher_id, learning_goal_id) do nothing;

do $conflict_check$
begin
  if exists (
    select 1
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id = 91
      and t.slug not in ('tarun-kumar', 'samapti-sinha')
  ) then
    raise exception 'course 91 has a conflicting faculty link';
  end if;
end
$conflict_check$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select 91, t.id, 'instructor', expected.position
from (values
  ('tarun-kumar', 1),
  ('samapti-sinha', 2)
) expected(slug, position)
join public.teachers t on t.slug = expected.slug
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_fingerprint text;
begin
  if (
    select array_agg(t.slug order by pt.position)
    from public.playlist_teachers pt
    join public.teachers t on t.id = pt.teacher_id
    where pt.playlist_id = 91
  ) <> array['tarun-kumar', 'samapti-sinha']::text[] then
    raise exception 'course 91 must have exactly two ordered reviewed teachers';
  end if;

  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where lg.slug = 'jee'
      and pt.playlist_id = 91
  ) then
    raise exception 'course 91 unexpectedly belongs to JEE';
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
