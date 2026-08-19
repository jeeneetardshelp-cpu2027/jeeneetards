-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 227d1fa5-a7b9-4af2-b6b7-305e90edb412
-- Scope: one additive normalized faculty link for production course 417 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twelfth-batch faculty link: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 398
     or (select count(*) from public.videos) <> 4617
     or (select count(*) from public.playlist_videos) <> 4623
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 152
     or (select count(*) from public.playlist_quality_reviews) <> 23 then
    raise exception 'refusing Unacademy twelfth-batch faculty link: exact baseline differs';
  end if;

  if not exists (
    select 1
    from public.playlists p
    where p.id = 417
      and p.title = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'
      and p.teacher = 'Anoop Vashishtha'
      and p.youtube_playlist_id = 'PLsgHooHkqhhNW5IzFI54d-RGuxgvOpfn3'
      and p.channel_id = 147
      and p.category_id = 2
      and p.subject_id = 2
      and p.content_type = 'full-course'
      and p.language = 'hinglish'
      and p.difficulty = 'intermediate'
      and p.audience_focus = '11th'
      and p.class_levels = array['11th']::text[]
      and p.title_review_status = 'pending'
      and p.faculty_credit_status = 'pending'
  )
  or (select count(*) from public.playlist_videos where playlist_id = 417) <> 14
  or exists (
    select 1
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = 417 and v.chapter_id is distinct from 37
  )
  or (select array_agg(lg.slug order by lg.slug)
      from public.playlist_learning_goals plg
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where plg.playlist_id = 417) <> array['neet']::text[]
  or (select array_agg(cl.slug order by cl.slug)
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = 417) <> array['class-11']::text[] then
    raise exception 'refusing Unacademy twelfth-batch faculty link: reviewed course differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (
       select 1 from public.teachers
       where id = 36 and display_name = 'Anoop Vashishtha'
         and canonical_name = 'anoop vashishtha'
         and slug = 'anoop-vashishtha' and verified
     ) then
    raise exception 'refusing Unacademy twelfth-batch faculty link: reference evidence differs';
  end if;

  if not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 36 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2)
     or not exists (
       select 1 from public.teacher_learning_goals
       where teacher_id = 36 and learning_goal_id = 2
     ) then
    raise exception 'refusing Unacademy twelfth-batch faculty link: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id = 417) then
    raise exception 'refusing Unacademy twelfth-batch faculty link: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 417) then
    raise exception 'refusing Unacademy twelfth-batch faculty link: quality review appeared';
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
    raise exception 'refusing Unacademy twelfth-batch faculty link: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values (417, 36, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 398
     or (select count(*) from public.videos) <> 4617
     or (select count(*) from public.playlist_videos) <> 4623
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 153
     or (select count(*) from public.playlist_quality_reviews) <> 23 then
    raise exception 'Unacademy twelfth-batch faculty link postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id = 417) <> array['417:anoop-vashishtha:1']::text[] then
    raise exception 'Unacademy twelfth-batch faculty link mismatch';
  end if;
  if exists (
    select 1 from public.playlists
    where id = 417 and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy twelfth-batch faculty link changed review status';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 417) then
    raise exception 'Unacademy twelfth-batch faculty link changed quality review state';
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
    raise exception 'Unacademy twelfth-batch faculty link protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id = 417
order by pt.position;

commit;
