-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: ae4a8549-84d5-4784-91ed-2f56e4208d88
-- Scope: preserve the source title and apply the canonical quality transition
-- to production course 429 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy seventeenth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy seventeenth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy seventeenth-batch quality review: capability differs';
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
     or (select count(*) from public.playlist_teachers) <> 165
     or (select count(*) from public.playlist_quality_reviews) <> 35 then
    raise exception 'refusing Unacademy seventeenth-batch quality review: exact baseline differs';
  end if;

  if not exists (
    select 1
    from public.playlists p
    where p.id = 429
      and p.title = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'
      and p.source_title is null
      and p.source_title_changed is false
      and p.title_review_status = 'pending'
      and p.faculty_credit_status = 'pending'
      and p.content_type = 'full-course'
      and p.language = 'hinglish'
      and p.difficulty = 'intermediate'
      and p.teacher = 'Dr. Sachin Kapur'
      and p.youtube_playlist_id = 'PLsgHooHkqhhMpUzdl2c1YMGYdrTxCCXFe'
      and p.channel_id = 147
      and p.category_id = 2
      and p.subject_id = 4
      and p.class_levels = array['11th']::text[]
      and p.audience_focus = '11th'
  )
  or (select count(*) from public.playlist_videos where playlist_id = 429) <> 6
  or (select count(distinct video_id) from public.playlist_videos where playlist_id = 429) <> 6
  or exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = 429 and v.chapter_id is distinct from 105
  )
  or (select array_agg(pv.position order by pv.position)
      from public.playlist_videos pv where pv.playlist_id = 429)
       <> array[1,2,3,4,5,6]::integer[]
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
      where pcl.playlist_id = 429) <> array['class-11']::text[]
  or public.playlist_quality_missing(429)
       is distinct from array['title-review', 'source-title', 'faculty-credit']::text[] then
    raise exception 'refusing Unacademy seventeenth-batch quality review: reviewed course evidence differs';
  end if;

  if not exists (
    select 1 from public.teachers
    where id = 38 and display_name = 'Dr. Sachin Kapur'
      and canonical_name = 'sachin kapur'
      and slug = 'sachin-kapur' and verified
  ) then
    raise exception 'refusing Unacademy seventeenth-batch quality review: verified teacher identity differs';
  end if;

  if not exists (
    select 1 from public.playlist_teachers
    where playlist_id = 429 and teacher_id = 38
      and role = 'instructor' and position = 1
  )
  or (select count(*) from public.playlist_teachers where playlist_id = 429) <> 1 then
    raise exception 'refusing Unacademy seventeenth-batch quality review: course-teacher link differs';
  end if;

  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 429) then
    raise exception 'refusing Unacademy seventeenth-batch quality review: target already reviewed';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 4 and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (
       select 1 from public.chapters
       where id = 105 and name = 'Breathing and Exchange of Gases' and subject_id = 4
     ) then
    raise exception 'refusing Unacademy seventeenth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy seventeenth-batch quality review: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

do $capture_source_title$
declare
  v_updated integer;
begin
  update public.playlists
     set source_title = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur',
         source_title_changed = false
   where id = 429
     and title = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'
     and source_title is null
     and source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Unacademy seventeenth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_title$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET seventeenth-batch evidence under decision ae4a8549-84d5-4784-91ed-2f56e4208d88; quality transition prepared 2026-08-07.';
begin
  v_result := public.review_playlist_quality(
    429, 'Breathing and Exchange of Gases', array[38]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 429 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET seventeenth-batch evidence under decision ae4a8549-84d5-4784-91ed-2f56e4208d88; quality transition prepared 2026-08-07.';
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
     or (select count(*) from public.playlist_quality_reviews) <> 36 then
    raise exception 'Unacademy seventeenth-batch quality review postflight total mismatch';
  end if;

  if not exists (
    select 1 from public.playlists
    where id = 429
      and title = 'Breathing and Exchange of Gases'
      and source_title = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'
      and title_review_status = 'approved'
      and faculty_credit_status = 'identified'
      and content_type = 'full-course'
      and language = 'hinglish'
      and difficulty = 'intermediate'
      and source_title_changed is false
      and public.playlist_quality_missing(429) = array[]::text[]
  )
  or (select array_agg(teacher_id order by position)
      from public.playlist_teachers where playlist_id = 429)
       is distinct from array[38]::bigint[] then
    raise exception 'Unacademy seventeenth-batch quality review course postflight mismatch';
  end if;

  if not exists (
    select 1 from public.playlist_quality_reviews q
    where q.playlist_id = 429
      and q.note = v_note
      and q.before_state->>'title' = 'NEET: Breathing & Exchange of Gases - Playlist | Class 11 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Dr Sachin Kapur'
      and q.before_state->>'title_review_status' = 'pending'
      and q.before_state->>'faculty_credit_status' = 'pending'
      and q.before_state->>'content_type' = 'full-course'
      and q.before_state->>'language' = 'hinglish'
      and q.before_state->>'difficulty' = 'intermediate'
      and q.before_state->'teacher_ids' = to_jsonb(array[38]::bigint[])
      and q.after_state->>'title' = 'Breathing and Exchange of Gases'
      and q.after_state->>'title_review_status' = 'approved'
      and q.after_state->>'faculty_credit_status' = 'identified'
      and q.after_state->>'content_type' = 'full-course'
      and q.after_state->>'language' = 'hinglish'
      and q.after_state->>'difficulty' = 'intermediate'
      and q.after_state->'teacher_ids' = to_jsonb(array[38]::bigint[])
  )
  or (select count(*) from public.playlist_quality_reviews where playlist_id = 429) <> 1 then
    raise exception 'Unacademy seventeenth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy seventeenth-batch quality review protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

select p.id as playlist_id, p.title, p.source_title, p.title_review_status,
       p.faculty_credit_status, p.content_type, p.language, p.difficulty,
       public.playlist_quality_missing(p.id) as missing_fields,
       q.note, q.before_state, q.after_state
from public.playlists p
join public.playlist_quality_reviews q on q.playlist_id = p.id
where p.id = 429;

commit;
