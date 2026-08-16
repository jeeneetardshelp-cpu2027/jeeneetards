-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: fbf7b3a1-0a19-4dae-b5fe-d967b94f3a7c
-- Scope: three additive course-teacher links for production courses 441-443.
-- Existing verified teachers 34 and 36 are reused; no identity row is created.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twenty-second-batch faculty links: target is not production-empty';
  end if;

  if (select count(*) from public.playlists) <> 424
     or (select count(*) from public.videos) <> 4768
     or (select count(*) from public.playlist_videos) <> 4774
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 37
     or (select count(*) from public.teacher_aliases) <> 60
     or (select count(*) from public.teacher_institutes) <> 38
     or (select count(*) from public.teacher_subjects) <> 38
     or (select count(*) from public.teacher_learning_goals) <> 37
     or (select count(*) from public.playlist_teachers) <> 176
     or (select count(*) from public.playlist_quality_reviews) <> 47 then
    raise exception 'refusing Unacademy twenty-second-batch faculty links: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (441::bigint, 'Work, Energy and Power'::text, 'Mahendra Singh'::text,
       'PLsgHooHkqhhOHzoncmAMTU9UgJiN1gtcp'::text, 1::bigint, 21::bigint,
       34::bigint, 'mahendra-singh'::text, 'class-11'::text, '11th'::text,
       array['nNfVSQK__qo','tpTtsf8bUT0','1YBTvWxbyFU','A5qKIJCC_z4',
             '0Ffb8pVnssg','4D3YA2WwMpY','M6gBk4ItYXs','IlVdc4mNfoE',
             'gSPbfLfBuu8','h-lynBmTHN0','eI8iO8Ljqrk']::text[]),
      (442::bigint, 'Solutions'::text, 'Anoop Vashishtha'::text,
       'PLsgHooHkqhhOkrbz6-7e8cnZ5bvtre4pk'::text, 2::bigint, 33::bigint,
       36::bigint, 'anoop-vashishtha'::text, 'class-12'::text, '12th'::text,
       array['2i9pWHtw_Uk','N5BKG69t17I','yJuRUNWok54','mMCKg3YVBL0',
             'z3nnduK6K3w','tySjtCF7YQI']::text[]),
      (443::bigint, 'Periodic Table'::text, 'Anoop Vashishtha'::text,
       'PLsgHooHkqhhO9QF6HRyQYvV20hrDtCdKL'::text, 2::bigint, 41::bigint,
       36::bigint, 'anoop-vashishtha'::text, 'class-11'::text, '11th'::text,
       array['ZmBBuu4-rKU','DjU7kQNy1lM','ZVapFLksVjo','l01Idjq4TeM',
             'u7LCnFAbQDw']::text[])
    ) expected(id,title,legacy_teacher,source_id,subject_id,chapter_id,
               teacher_id,teacher_slug,class_slug,class_label,video_ids)
    left join public.playlists p on p.id = expected.id
    where p.id is null
       or p.title is distinct from expected.title
       or p.source_title is not null
       or p.source_title_changed is distinct from false
       or p.teacher is distinct from expected.legacy_teacher
       or p.youtube_playlist_id is distinct from expected.source_id
       or p.channel_id is distinct from 147
       or p.category_id is distinct from 2
       or p.subject_id is distinct from expected.subject_id
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.audience_focus is distinct from expected.class_label
       or p.class_levels is distinct from array[expected.class_label]::text[]
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or not exists (
         select 1 from public.teachers t
         where t.id = expected.teacher_id
           and t.slug = expected.teacher_slug
           and t.display_name = expected.legacy_teacher
           and t.verified
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
    raise exception 'refusing Unacademy twenty-second-batch faculty links: reviewed course differs';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 34 and institute_id = 147 and is_primary
     )
     or not exists (
       select 1 from public.teacher_institutes
       where teacher_id = 36 and institute_id = 147 and is_primary
     )
     or not exists (select 1 from public.teacher_subjects where teacher_id = 34 and subject_id = 1)
     or not exists (select 1 from public.teacher_subjects where teacher_id = 36 and subject_id = 2)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 34 and learning_goal_id = 2)
     or not exists (select 1 from public.teacher_learning_goals where teacher_id = 36 and learning_goal_id = 2) then
    raise exception 'refusing Unacademy twenty-second-batch faculty links: teacher context differs';
  end if;

  if exists (select 1 from public.playlist_teachers where playlist_id in (441,442,443))
     or exists (select 1 from public.playlist_quality_reviews where playlist_id in (441,442,443)) then
    raise exception 'refusing Unacademy twenty-second-batch faculty links: target link or review appeared';
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
          select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,
                 p.subject_id,p.class_levels,p.audience_focus,p.content_type,
                 p.language,p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167) x),'') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|' order by y.playlist_id,y.position,y.id) from (
          select pv.id,pv.playlist_id,pv.video_id,pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee')) y),'')
      ) as protected_fingerprint
  ) protected;
  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy twenty-second-batch faculty links: protected JEE mismatch (%)', row_to_json(v_protected);
  end if;
end
$preflight$;

insert into public.playlist_teachers (playlist_id,teacher_id,role,position)
values
  (441,34,'instructor',1),
  (442,36,'instructor',1),
  (443,36,'instructor',1)
on conflict (playlist_id,teacher_id) do nothing;

do $postflight$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 424
     or (select count(*) from public.videos) <> 4768
     or (select count(*) from public.playlist_videos) <> 4774
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 37
     or (select count(*) from public.teacher_aliases) <> 60
     or (select count(*) from public.teacher_institutes) <> 38
     or (select count(*) from public.teacher_subjects) <> 38
     or (select count(*) from public.teacher_learning_goals) <> 37
     or (select count(*) from public.playlist_teachers) <> 179
     or (select count(*) from public.playlist_quality_reviews) <> 47 then
    raise exception 'Unacademy twenty-second-batch faculty links postflight count mismatch';
  end if;

  if (select array_agg(format('%s:%s:%s',pt.playlist_id,t.slug,pt.position)
                       order by pt.playlist_id)
      from public.playlist_teachers pt
      join public.teachers t on t.id = pt.teacher_id
      where pt.playlist_id in (441,442,443)) <>
     array['441:mahendra-singh:1','442:anoop-vashishtha:1',
           '443:anoop-vashishtha:1']::text[] then
    raise exception 'Unacademy twenty-second-batch faculty links course-link mismatch';
  end if;

  if exists (
       select 1 from public.playlists where id in (441,442,443)
       and (faculty_credit_status <> 'pending' or title_review_status <> 'pending')
     )
     or exists (
       select 1 from public.playlist_quality_reviews where playlist_id in (441,442,443)
     ) then
    raise exception 'Unacademy twenty-second-batch faculty links changed review state';
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
        coalesce((select string_agg(row_to_json(x)::text,'|' order by x.id) from (
          select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,
                 p.subject_id,p.class_levels,p.audience_focus,p.content_type,
                 p.language,p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167) x),'') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text,'|' order by y.playlist_id,y.position,y.id) from (
          select pv.id,pv.playlist_id,pv.video_id,pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee')) y),'')
      ) as protected_fingerprint
  ) protected;
  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy twenty-second-batch faculty links protected JEE mismatch (%)', row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id,p.title,t.id as teacher_id,t.display_name,t.slug,
       t.verified,pt.role,pt.position
from public.playlists p
join public.playlist_teachers pt on pt.playlist_id = p.id
join public.teachers t on t.id = pt.teacher_id
where p.id in (441,442,443)
order by p.id,pt.position;

commit;
