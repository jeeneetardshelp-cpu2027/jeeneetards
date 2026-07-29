-- CBSE Class 10 Science: additive reviewed Alakh Pandey faculty binding.
-- Owner decision: 64523af2-60a9-4ead-b22c-b53531fb2bbe.
-- Run only after the reviewed mapped-v12 course import succeeds.

begin;

do $alakh_pandey_science_faculty$
declare
  v_teacher_id bigint;
  v_playlist_id bigint;
  v_channel_id bigint;
  created_teacher jsonb;
  v_jee_fingerprint text;
begin
  if exists (select 1 from public.app_environment) then
    raise exception
      'refusing Alakh Pandey faculty binding: app_environment is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 155
     or (select count(*) from public.videos) <> 1986
     or (select count(*) from public.playlist_videos) <> 1990
     or (select count(*) from public.chapters) <> 218
     or (select count(*) from public.teachers) <> 26
     or (select count(*) from public.playlist_teachers) <> 129 then
    raise exception
      'refusing Alakh Pandey faculty binding: post-import baseline differs';
  end if;

  select p.id, p.channel_id
    into v_playlist_id, v_channel_id
    from public.playlists p
   where p.youtube_playlist_id = 'PLSLNfEuYoURJqfhtU3rE-F7YXtyytJeya';

  if v_playlist_id is null or v_channel_id is null then
    raise exception
      'refusing Alakh Pandey faculty binding: reviewed course/channel is missing';
  end if;

  if exists (
    select 1 from public.teachers
    where slug = 'alakh-pandey'
       or lower(display_name) = lower('Alakh Pandey')
  ) then
    raise exception
      'refusing Alakh Pandey faculty binding: teacher appeared after preflight';
  end if;

  select md5(
    coalesce((
      select string_agg(row_to_json(x)::text, '|' order by x.id)
      from (
        select
          p.id,
          p.title,
          p.teacher,
          p.youtube_playlist_id,
          p.category_id,
          p.subject_id,
          p.class_levels,
          p.audience_focus,
          p.content_type,
          p.language,
          p.difficulty
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
  ) into v_jee_fingerprint;

  if v_jee_fingerprint <> 'd7aae3ce7635401ebeffe97e627048bc' then
    raise exception
      'refusing Alakh Pandey faculty binding: JEE fingerprint mismatch (%)',
      v_jee_fingerprint;
  end if;

  created_teacher := public.create_teacher(
    'Alakh Pandey',
    '[]'::jsonb,
    true,
    false
  );
  v_teacher_id := (created_teacher ->> 'teacher_id')::bigint;

  if v_teacher_id is null then
    raise exception
      'refusing Alakh Pandey faculty binding: teacher creation failed';
  end if;

  insert into public.teacher_institutes (teacher_id, institute_id, is_primary)
  values (v_teacher_id, v_channel_id, true);

  insert into public.teacher_subjects (teacher_id, subject_id)
  select v_teacher_id, s.id
    from public.subjects s
   where s.id = 10 and s.name = 'Science';

  insert into public.teacher_learning_goals (teacher_id, learning_goal_id)
  select v_teacher_id, lg.id
    from public.learning_goals lg
   where lg.slug = 'school';

  insert into public.playlist_teachers (
    playlist_id, teacher_id, role, position
  )
  values (v_playlist_id, v_teacher_id, 'instructor', 1);

  if (select count(*) from public.teachers) <> 27
     or (select count(*) from public.playlist_teachers) <> 130
     or not exists (
       select 1
         from public.playlist_teachers pt
         join public.teachers t on t.id = pt.teacher_id
        where pt.playlist_id = v_playlist_id
          and t.id = v_teacher_id
          and t.display_name = 'Alakh Pandey'
          and t.slug = 'alakh-pandey'
          and t.verified
     )
     or not exists (
       select 1
         from public.teacher_institutes ti
        where ti.teacher_id = v_teacher_id
          and ti.institute_id = v_channel_id
          and ti.is_primary
     )
     or not exists (
       select 1
         from public.teacher_subjects ts
        where ts.teacher_id = v_teacher_id
          and ts.subject_id = 10
     )
     or not exists (
       select 1
         from public.teacher_learning_goals tlg
         join public.learning_goals lg on lg.id = tlg.learning_goal_id
        where tlg.teacher_id = v_teacher_id
          and lg.slug = 'school'
     ) then
    raise exception
      'refusing Alakh Pandey faculty binding: postcondition failed';
  end if;
end
$alakh_pandey_science_faculty$;

select
  t.id as teacher_id,
  t.display_name,
  t.slug,
  t.verified,
  p.id as playlist_id,
  p.title,
  p.channel_id
from public.teachers t
join public.playlist_teachers pt on pt.teacher_id = t.id
join public.playlists p on p.id = pt.playlist_id
where p.youtube_playlist_id = 'PLSLNfEuYoURJqfhtU3rE-F7YXtyytJeya'
  and t.slug = 'alakh-pandey';

commit;
