-- PREPARED ONLY. DO NOT RUN WITHOUT SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 9443dd70-a2c6-4747-9a5e-a9022f7012cf
-- Prerequisite: the separately approved twenty-first-batch faculty-link artifact.

begin;

do $preflight$
declare v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twenty-first-batch quality review: target is not production-empty';
  end if;
  if public.catalog_manage_capability()->>'version' is distinct from '11' then
    raise exception 'refusing Unacademy twenty-first-batch quality review: catalogue capability differs';
  end if;
  if (select count(*) from public.playlists) <> 421
     or (select count(*) from public.videos) <> 4746
     or (select count(*) from public.playlist_videos) <> 4752
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 37
     or (select count(*) from public.teacher_aliases) <> 60
     or (select count(*) from public.teacher_institutes) <> 38
     or (select count(*) from public.teacher_subjects) <> 38
     or (select count(*) from public.teacher_learning_goals) <> 37
     or (select count(*) from public.playlist_teachers) <> 176
     or (select count(*) from public.playlist_quality_reviews) <> 45 then
    raise exception 'refusing Unacademy twenty-first-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1 from (values
      (439::bigint,'Kinetic Theory of Gases'::text,'Shubham Kumar'::text,
       'PLsgHooHkqhhMZ0ocHynO-84oB0VVcuyoG'::text,275::bigint,
       'shubham-kumar'::text,'class-11'::text,'11th'::text,
       array['v9q8mDQdXbM','NBwkv5Q-OK0']::text[]),
      (440::bigint,'Electromagnetic Waves'::text,'Samip Velani'::text,
       'PLsgHooHkqhhPkYyUO_zMJpEQZ5MST56fK'::text,15::bigint,
       'samip-velani'::text,'class-12'::text,'12th'::text,
       array['hixsCud1ajA','BumQy7Ni8Gg','nwFN57p4x2o','I3hOh2-0uHI']::text[])
    ) expected(playlist_id,title,legacy_teacher,source_id,chapter_id,teacher_slug,
               class_slug,class_label,video_ids)
    left join public.playlists p on p.id=expected.playlist_id
    where p.id is null or p.title is distinct from expected.title
       or p.source_title is not null or p.source_title_changed is distinct from false
       or p.teacher is distinct from expected.legacy_teacher
       or p.youtube_playlist_id is distinct from expected.source_id
       or p.channel_id is distinct from 147 or p.category_id is distinct from 2
       or p.subject_id is distinct from 1 or p.class_levels is distinct from array[expected.class_label]::text[]
       or p.audience_focus is distinct from expected.class_label
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or p.content_type is distinct from 'full-course' or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or public.playlist_quality_missing(expected.playlist_id)
            is distinct from array['title-review','source-title','faculty-credit']::text[]
       or (select count(*) from public.playlist_videos pv where pv.playlist_id=expected.playlist_id) <> cardinality(expected.video_ids)
       or (select array_agg(pv.position order by pv.position) from public.playlist_videos pv where pv.playlist_id=expected.playlist_id)
            <> (select array_agg(n order by n) from generate_series(1,cardinality(expected.video_ids)) n)
       or (select array_agg(v.youtube_video_id order by pv.position) from public.playlist_videos pv join public.videos v on v.id=pv.video_id where pv.playlist_id=expected.playlist_id) <> expected.video_ids
       or exists (select 1 from public.playlist_videos pv join public.videos v on v.id=pv.video_id where pv.playlist_id=expected.playlist_id and v.chapter_id is distinct from expected.chapter_id)
       or (select array_agg(lg.slug order by lg.slug) from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=expected.playlist_id) <> array['neet']::text[]
       or (select array_agg(cl.slug order by cl.slug) from public.playlist_class_levels pcl join public.class_levels cl on cl.id=pcl.class_level_id where pcl.playlist_id=expected.playlist_id) <> array[expected.class_slug]::text[]
       or not exists (select 1 from public.teachers t join public.playlist_teachers pt on pt.teacher_id=t.id where pt.playlist_id=expected.playlist_id and t.slug=expected.teacher_slug and t.verified and pt.role='instructor' and pt.position=1)
       or (select count(*) from public.playlist_teachers pt where pt.playlist_id=expected.playlist_id) <> 1
  ) then
    raise exception 'refusing Unacademy twenty-first-batch quality review: reviewed course evidence differs';
  end if;
  if exists (select 1 from public.playlist_quality_reviews where playlist_id in (439,440)) then
    raise exception 'refusing Unacademy twenty-first-batch quality review: target already reviewed';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_courses,
      (select count(*) from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_memberships,
      md5(coalesce((select string_agg(row_to_json(x)::text,'|' order by x.id) from (select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,p.subject_id,p.class_levels,p.audience_focus,p.content_type,p.language,p.difficulty from public.playlists p join public.playlist_learning_goals plg on plg.playlist_id=p.id join public.learning_goals lg on lg.id=plg.learning_goal_id where lg.slug='jee' and p.id<167)x),'')||'|'||coalesce((select string_agg(row_to_json(y)::text,'|' order by y.playlist_id,y.position,y.id) from (select pv.id,pv.playlist_id,pv.video_id,pv.position from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee'))y),'')) protected_fingerprint
  ) protected;
  if v_protected.protected_courses<>82 or v_protected.protected_memberships<>1304 or v_protected.protected_fingerprint<>'30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy twenty-first-batch quality review: protected JEE mismatch (%)',row_to_json(v_protected);
  end if;
end
$preflight$;

do $capture_source_titles$
declare v_updated integer;
begin
  update public.playlists p set source_title=expected.source_title,source_title_changed=false
  from (values
    (439::bigint,'Kinetic Theory of Gases'::text),
    (440::bigint,'Electromagnetic Waves'::text)
  ) expected(playlist_id,source_title)
  where p.id=expected.playlist_id and p.title=expected.source_title
    and p.source_title is null and p.source_title_changed is false;
  get diagnostics v_updated=row_count;
  if v_updated<>2 then raise exception 'Unacademy twenty-first-batch quality source-title capture mismatch (%)',v_updated; end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_shubham bigint;
  v_samip bigint;
  v_note constant text := 'Owner-reviewed Unacademy NEET twenty-first-batch evidence under decision 9443dd70-a2c6-4747-9a5e-a9022f7012cf; quality transition prepared 2026-08-13.';
begin
  select id into strict v_shubham from public.teachers where slug='shubham-kumar' and verified;
  select id into strict v_samip from public.teachers where slug='samip-velani' and verified;
  v_result:=public.review_playlist_quality(439,'Kinetic Theory of Gases',array[v_shubham]::bigint[],'identified','full-course','hinglish','intermediate',v_note);
  if (v_result->>'quality_ready')::boolean is distinct from true or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 439 did not become quality-ready (%)',v_result;
  end if;
  v_result:=public.review_playlist_quality(440,'Electromagnetic Waves',array[v_samip]::bigint[],'identified','full-course','hinglish','intermediate',v_note);
  if (v_result->>'quality_ready')::boolean is distinct from true or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 440 did not become quality-ready (%)',v_result;
  end if;
end
$review$;

do $postflight$
declare v_protected record;
begin
  if (select count(*) from public.playlists)<>421 or (select count(*) from public.videos)<>4746
     or (select count(*) from public.playlist_videos)<>4752 or (select count(*) from public.chapters)<>263
     or (select count(*) from public.chapter_class_levels)<>92 or (select count(*) from public.teachers)<>37
     or (select count(*) from public.teacher_aliases)<>60 or (select count(*) from public.teacher_institutes)<>38
     or (select count(*) from public.teacher_subjects)<>38 or (select count(*) from public.teacher_learning_goals)<>37
     or (select count(*) from public.playlist_teachers)<>176 or (select count(*) from public.playlist_quality_reviews)<>47 then
    raise exception 'Unacademy twenty-first-batch quality review postflight total mismatch';
  end if;
  if exists(select 1 from public.playlists p where p.id in (439,440)
    and (p.source_title is distinct from p.title or p.source_title_changed is distinct from false
      or p.title_review_status is distinct from 'approved' or p.faculty_credit_status is distinct from 'identified'
      or public.playlist_quality_missing(p.id) is distinct from array[]::text[])) then
    raise exception 'Unacademy twenty-first-batch quality review course postflight mismatch';
  end if;
  if exists(select playlist_id from public.playlist_quality_reviews where playlist_id in (439,440) group by playlist_id having count(*)<>1) then
    raise exception 'Unacademy twenty-first-batch quality review audit postflight mismatch';
  end if;
  select * into v_protected from (
    select
      (select count(*) from public.playlists p where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_courses,
      (select count(*) from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee')) protected_memberships,
      md5(coalesce((select string_agg(row_to_json(x)::text,'|' order by x.id) from (select p.id,p.title,p.teacher,p.youtube_playlist_id,p.category_id,p.subject_id,p.class_levels,p.audience_focus,p.content_type,p.language,p.difficulty from public.playlists p join public.playlist_learning_goals plg on plg.playlist_id=p.id join public.learning_goals lg on lg.id=plg.learning_goal_id where lg.slug='jee' and p.id<167)x),'')||'|'||coalesce((select string_agg(row_to_json(y)::text,'|' order by y.playlist_id,y.position,y.id) from (select pv.id,pv.playlist_id,pv.video_id,pv.position from public.playlist_videos pv join public.playlists p on p.id=pv.playlist_id where p.id<167 and exists(select 1 from public.playlist_learning_goals plg join public.learning_goals lg on lg.id=plg.learning_goal_id where plg.playlist_id=p.id and lg.slug='jee'))y),'')) protected_fingerprint
  ) protected;
  if v_protected.protected_courses<>82 or v_protected.protected_memberships<>1304 or v_protected.protected_fingerprint<>'30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy twenty-first-batch quality review protected JEE mismatch (%)',row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id,p.title,p.source_title,p.title_review_status,p.faculty_credit_status,
       public.playlist_quality_missing(p.id) missing_fields,q.note,q.before_state,q.after_state
from public.playlists p join public.playlist_quality_reviews q on q.playlist_id=p.id
where p.id in (439,440) order by p.id;

commit;
