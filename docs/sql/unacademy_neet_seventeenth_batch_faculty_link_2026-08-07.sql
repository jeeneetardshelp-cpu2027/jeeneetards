-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: ae4a8549-84d5-4784-91ed-2f56e4208d88
-- Scope: one additive normalized faculty link for production course 429 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 410
     or (select count(*) from public.videos) <> 4705
     or (select count(*) from public.playlist_videos) <> 4711
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 164
     or (select count(*) from public.playlist_quality_reviews) <> 35 then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: exact baseline differs';
  end if;

  if not exists (
    select 1
    from public.playlists p
    where p.id = 429
      and p.title = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'
      and p.source_title is null
      and p.teacher = 'Dr. Sachin Kapur'
      and p.youtube_playlist_id = 'PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe'
      and p.channel_id = 147
      and p.category_id = 2
      and p.subject_id = 4
      and p.content_type = 'full-course'
      and p.language = 'hinglish'
      and p.difficulty = 'intermediate'
      and p.audience_focus = '11th'
      and p.class_levels = array['11th']::text[]
      and p.title_review_status = 'pending'
      and p.faculty_credit_status = 'pending'
  )
  or (select count(*) from public.playlist_videos where playlist_id = 429) <> 6
  or exists (
    select 1
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = 429 and v.chapter_id is distinct from 105
  )
  or (select array_agg(pv.position order by pv.position)
      from public.playlist_videos pv
      where pv.playlist_id = 429) <> array[1,2,3,4,5,6]::integer[]
  or (select array_agg(v.youtube_video_id order by pv.position)
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
      where pv.playlist_id = 429) <>
      array['bmF2tmenuMI','fG72ty2A2tg','at_rKPlIXoo','5Jls9m-jDjM','Ev3t9nip0PU','zNpJSgVOR1M']::text[]
  or (select array_agg(lg.slug order by lg.slug)
      from public.playlist_learning_goals plg
      join public.learning_goals lg on lg.id = plg.learning_goal_id
      where plg.playlist_id = 429) <> array['neet']::text[]
  or (select array_agg(cl.slug order by cl.slug)
      from public.playlist_class_levels pcl
      join public.class_levels cl on cl.id = pcl.class_level_id
      where pcl.playlist_id = 429) <> array['class-11']::text[] then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: reviewed course differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 4 and name = 'Biology' and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (
       select 1 from public.teachers
       where id = 38 and display_name = 'Dr. Sachin Kapur'
         and canonical_name = 'sachin kapur'
         and slug = 'sachin-kapur' and verified
     ) then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: reference evidence differs';
  end if;

  if not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 38 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 38 and subject_id = 4)
     or not exists (
       select 1 from public.teacher_learning_goals
       where teacher_id = 38 and learning_goal_id = 2
     ) then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id = 429) then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: course link appeared';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 429) then
    raise exception 'refusing Unacademy seventeenth-batch faculty link: quality review appeared';
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
    raise exception 'refusing Unacademy seventeenth-batch faculty link: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
values (429, 38, 'instructor', 1)
on conflict (playlist_id, teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 410
     or (select count(*) from public.videos) <> 4705
     or (select count(*) from public.playlist_videos) <> 4711
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 165
     or (select count(*) from public.playlist_quality_reviews) <> 35 then
    raise exception 'Unacademy seventeenth-batch faculty link postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s', pt.playlist_id, t.slug, pt.position)
                       order by pt.playlist_id, pt.position)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id = 429) <> array['429:sachin-kapur:1']::text[] then
    raise exception 'Unacademy seventeenth-batch faculty link mismatch';
  end if;
  if exists (
    select 1 from public.playlists
    where id = 429 and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
  ) then
    raise exception 'Unacademy seventeenth-batch faculty link changed review status';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 429) then
    raise exception 'Unacademy seventeenth-batch faculty link changed quality review state';
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
    raise exception 'Unacademy seventeenth-batch faculty link protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.title_review_status, p.faculty_credit_status,
       t.id as teacher_id, t.display_name, t.slug, t.verified, pt.role, pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id = 429
order by pt.position;

commit;
