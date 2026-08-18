-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 227d1fa5-a7b9-4af2-b6b7-305e90edb412
-- Scope: preserve the source title and apply the canonical quality transition
-- to production course 417 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twelfth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy twelfth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy twelfth-batch quality review: capability differs';
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
     or (select count(*) from public.playlist_teachers) <> 153
     or (select count(*) from public.playlist_quality_reviews) <> 23 then
    raise exception 'refusing Unacademy twelfth-batch quality review: exact baseline differs';
  end if;

  if not exists (
    select 1
    from public.playlists p
    where p.id = 417
      and p.title = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'
      and p.source_title is null
      and p.source_title_changed is false
      and p.title_review_status = 'pending'
      and p.faculty_credit_status = 'pending'
      and p.content_type = 'full-course'
      and p.language = 'hinglish'
      and p.difficulty = 'intermediate'
      and p.teacher = 'Anoop Vashishtha'
      and p.youtube_playlist_id = 'PLsgHooHkqhhNW5IzFI54d-RGuxgvOpfn3'
      and p.channel_id = 147
      and p.category_id = 2
      and p.subject_id = 2
      and p.class_levels = array['11th']::text[]
      and p.audience_focus = '11th'
  )
  or (select count(*) from public.playlist_videos where playlist_id = 417) <> 14
  or (select count(distinct video_id) from public.playlist_videos where playlist_id = 417) <> 14
  or exists (
    select 1 from public.playlist_videos pv
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
      where pcl.playlist_id = 417) <> array['class-11']::text[]
  or public.playlist_quality_missing(417)
       is distinct from array['title-review', 'source-title', 'faculty-credit']::text[] then
    raise exception 'refusing Unacademy twelfth-batch quality review: reviewed course evidence differs';
  end if;

  if not exists (
    select 1 from public.teachers
    where id = 36 and display_name = 'Anoop Vashishtha'
      and canonical_name = 'anoop vashishtha'
      and slug = 'anoop-vashishtha' and verified
  ) then
    raise exception 'refusing Unacademy twelfth-batch quality review: verified teacher identity differs';
  end if;

  if not exists (
    select 1 from public.playlist_teachers
    where playlist_id = 417 and teacher_id = 36
      and role = 'instructor' and position = 1
  )
  or (select count(*) from public.playlist_teachers where playlist_id = 417) <> 1 then
    raise exception 'refusing Unacademy twelfth-batch quality review: course-teacher link differs';
  end if;

  if exists (select 1 from public.playlist_quality_reviews where playlist_id = 417) then
    raise exception 'refusing Unacademy twelfth-batch quality review: target already reviewed';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 2 and slug = 'chemistry')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (
       select 1 from public.chapters
       where id = 37 and name = 'Atomic Structure' and subject_id = 2
     ) then
    raise exception 'refusing Unacademy twelfth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy twelfth-batch quality review: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

do $capture_source_title$
declare
  v_updated integer;
begin
  update public.playlists
     set source_title = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha',
         source_title_changed = false
   where id = 417
     and title = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'
     and source_title is null
     and source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'Unacademy twelfth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_title$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 227d1fa5-a7b9-4af2-b6b7-305e90edb412; Unacademy NEET twelfth-batch quality transition prepared 2026-08-06.';
begin
  v_result := public.review_playlist_quality(
    417, 'Atomic Structure', array[36]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 417 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 227d1fa5-a7b9-4af2-b6b7-305e90edb412; Unacademy NEET twelfth-batch quality transition prepared 2026-08-06.';
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
     or (select count(*) from public.playlist_quality_reviews) <> 24 then
    raise exception 'Unacademy twelfth-batch quality review postflight total mismatch';
  end if;

  if not exists (
    select 1 from public.playlists
    where id = 417
      and title = 'Atomic Structure'
      and source_title = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'
      and title_review_status = 'approved'
      and faculty_credit_status = 'identified'
      and content_type = 'full-course'
      and language = 'hinglish'
      and difficulty = 'intermediate'
      and source_title_changed is false
      and public.playlist_quality_missing(417) = array[]::text[]
  )
  or (select array_agg(teacher_id order by position)
      from public.playlist_teachers where playlist_id = 417)
       is distinct from array[36]::bigint[] then
    raise exception 'Unacademy twelfth-batch quality review course postflight mismatch';
  end if;

  if not exists (
    select 1 from public.playlist_quality_reviews q
    where q.playlist_id = 417
      and q.note = v_note
      and q.before_state->>'title' = 'NEET: Atomic Structure - Playlist | Class 11 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'
      and q.before_state->>'title_review_status' = 'pending'
      and q.before_state->>'faculty_credit_status' = 'pending'
      and q.before_state->>'content_type' = 'full-course'
      and q.before_state->>'language' = 'hinglish'
      and q.before_state->>'difficulty' = 'intermediate'
      and q.before_state->'teacher_ids' = to_jsonb(array[36]::bigint[])
      and q.after_state->>'title' = 'Atomic Structure'
      and q.after_state->>'title_review_status' = 'approved'
      and q.after_state->>'faculty_credit_status' = 'identified'
      and q.after_state->>'content_type' = 'full-course'
      and q.after_state->>'language' = 'hinglish'
      and q.after_state->>'difficulty' = 'intermediate'
      and q.after_state->'teacher_ids' = to_jsonb(array[36]::bigint[])
  )
  or (select count(*) from public.playlist_quality_reviews where playlist_id = 417) <> 1 then
    raise exception 'Unacademy twelfth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy twelfth-batch quality review protected JEE mismatch (%)',
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
where p.id = 417;

commit;
