-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE REHEARSAL AND OWNER APPROVAL.
-- Source review: docs/faculty_identity_review_neet_batch_1_2026-07-28.md
-- Additive and idempotent: no existing row is updated or deleted.

begin;

do $preflight$
declare
  v_neet_id bigint;
  v_institute_id bigint;
begin
  select id into strict v_neet_id
  from public.learning_goals
  where slug = 'neet';

  select id into strict v_institute_id
  from public.institutes_channels
  where name = 'Competition Wallah';

  if (select count(*)
      from public.playlist_learning_goals plg
      where plg.learning_goal_id = v_neet_id) <> 45 then
    raise exception 'expected exactly 45 NEET courses';
  end if;

  if (select count(*)
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      where plg.learning_goal_id = v_neet_id
        and p.teacher = 'Diksha Sharma Ma''am') <> 8
     or (select count(*)
         from public.playlists p
         join public.playlist_learning_goals plg on plg.playlist_id = p.id
         where plg.learning_goal_id = v_neet_id
           and p.teacher = 'Yashika Singh Ma''am') <> 8 then
    raise exception 'NEET faculty coverage differs from the reviewed 8/8 split';
  end if;

  if (
    select array_agg(p.id order by p.id)
    from public.playlists p
    join public.playlist_learning_goals plg on plg.playlist_id = p.id
    where plg.learning_goal_id = v_neet_id
      and p.teacher in ('Diksha Sharma Ma''am', 'Yashika Singh Ma''am')
  ) <> array[105,106,107,123,124,125,126,127,128,129,130,131,132,133,134,135]::bigint[] then
    raise exception 'reviewed NEET course IDs changed';
  end if;
end
$preflight$;

insert into public.teachers
  (display_name, canonical_name, slug, verified)
values
  ('Diksha Sharma', '', 'diksha-sharma', true),
  ('Yashika Singh', '', 'yashika-singh', true)
on conflict (slug) do nothing;

do $identity_check$
begin
  if exists (
    select 1
    from (values
      ('diksha-sharma', 'Diksha Sharma'),
      ('yashika-singh', 'Yashika Singh')
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
  ('diksha-sharma', 'Diksha Sharma Ma''am', 'full-name'),
  ('yashika-singh', 'Yashika Singh Ma''am', 'full-name'),
  ('yashika-singh', 'Yashika Ma''am', 'short-name')
) expected(slug, alias, alias_type)
join public.teachers t on t.slug = expected.slug
on conflict (teacher_id, normalized_alias) do nothing;

insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
select t.id, ic.id, true
from public.teachers t
cross join public.institutes_channels ic
where t.slug in ('diksha-sharma', 'yashika-singh')
  and ic.name = 'Competition Wallah'
on conflict (teacher_id, institute_id) do nothing;

insert into public.teacher_subjects (teacher_id, subject_id)
select t.id, s.id
from public.teachers t
cross join public.subjects s
where t.slug in ('diksha-sharma', 'yashika-singh')
  and s.name = 'Biology'
on conflict (teacher_id, subject_id) do nothing;

insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
select t.id, lg.id
from public.teachers t
cross join public.learning_goals lg
where t.slug in ('diksha-sharma', 'yashika-singh')
  and lg.slug = 'neet'
on conflict (teacher_id, learning_goal_id) do nothing;

do $conflict_check$
begin
  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlists p on p.id = pt.playlist_id
    join public.teachers t on t.id = pt.teacher_id
    where p.id in (105,106,107,123,124,125,126,127,128,129,130,131,132,133,134,135)
      and t.slug <> case p.teacher
        when 'Diksha Sharma Ma''am' then 'diksha-sharma'
        when 'Yashika Singh Ma''am' then 'yashika-singh'
      end
  ) then
    raise exception 'existing NEET faculty link conflicts with reviewed mapping';
  end if;
end
$conflict_check$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
select p.id, t.id, 'instructor', 1
from public.playlists p
join public.teachers t on t.slug = case p.teacher
  when 'Diksha Sharma Ma''am' then 'diksha-sharma'
  when 'Yashika Singh Ma''am' then 'yashika-singh'
end
where p.id in (105,106,107,123,124,125,126,127,128,129,130,131,132,133,134,135)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_fingerprint text;
begin
  if (select count(*)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where t.slug in ('diksha-sharma', 'yashika-singh')) <> 16 then
    raise exception 'expected exactly 16 reviewed NEET faculty links';
  end if;

  if exists (
    select 1
    from public.playlist_teachers pt
    join public.playlist_learning_goals plg on plg.playlist_id = pt.playlist_id
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    join public.teachers t on t.id = pt.teacher_id
    where lg.slug = 'jee'
      and t.slug in ('diksha-sharma', 'yashika-singh')
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
