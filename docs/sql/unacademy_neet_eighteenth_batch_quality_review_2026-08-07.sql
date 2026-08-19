-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 8f19ac66-a1b4-4304-8a6f-468131f63732
-- Scope: preserve source titles and apply the canonical quality transition to
-- production courses 430-432 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy eighteenth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy eighteenth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy eighteenth-batch quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 413
     or (select count(*) from public.videos) <> 4723
     or (select count(*) from public.playlist_videos) <> 4729
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 168
     or (select count(*) from public.playlist_quality_reviews) <> 36 then
    raise exception 'refusing Unacademy eighteenth-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (430::bigint,
       'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
       'Pradeep Singh'::text, 'PLsgHooHkqhhOnifSHdglxvopt3ZmRFQ5-'::text,
       4::bigint, 119::bigint, 33::bigint, 'pradeep-singh'::text,
       array['5jycoZ1eYKE','XI1FNUWIDvs','EhVOh2x8KRU']::text[]),
      (431::bigint,
       'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text,
       'Ashwani Tyagi'::text, 'PLsgHooHkqhhN29ebCtU31NQc4RSZQDJ0z'::text,
       2::bigint, 38::bigint, 32::bigint, 'ashwani-tyagi'::text,
       array['cmkw7yEt9aM','RNOT5OZRsto','rz7hyHgXRng','Ef0E436QV_g','P1iYtGppf7w','P4XHbcrBsyQ','O_4qhTPCLcI','EbAahd3ecJc']::text[]),
      (432::bigint,
       'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur'::text,
       'Dr. Sachin Kapur'::text, 'PLsgHooHkqhhPG_PVhW2TE7Ll_Rw2QUdu5'::text,
       4::bigint, 111::bigint, 38::bigint, 'sachin-kapur'::text,
       array['1u3F_NiQ7WY','bzI9ss05Rms','FD-DbUnla_o','M_BaySNiTfY','TjuciK33QmU','m7KXt6x_-PM','gTlmFUV9mhA']::text[])
    ) expected(
      playlist_id, title, legacy_teacher, youtube_playlist_id, subject_id,
      chapter_id, teacher_id, teacher_slug, video_ids
    )
    left join public.playlists p on p.id = expected.playlist_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.source_title is not null
       or p.source_title_changed is distinct from false
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.teacher is distinct from expected.legacy_teacher
       or p.youtube_playlist_id is distinct from expected.youtube_playlist_id
       or p.channel_id is distinct from 147
       or p.category_id is distinct from 2
       or p.subject_id is distinct from expected.subject_id
       or p.class_levels is distinct from array['11th']::text[]
       or p.audience_focus is distinct from '11th'
       or (select count(*) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> cardinality(expected.video_ids)
       or (select count(distinct pv.video_id) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> cardinality(expected.video_ids)
       or (select array_agg(pv.position order by pv.position)
             from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <>
          (select array_agg(n order by n)
             from generate_series(1, cardinality(expected.video_ids)) n)
       or (select array_agg(v.youtube_video_id order by pv.position)
             from public.playlist_videos pv
             join public.videos v on v.id = pv.video_id
            where pv.playlist_id = expected.playlist_id) <> expected.video_ids
       or exists (
            select 1 from public.playlist_videos pv
            join public.videos v on v.id = pv.video_id
            where pv.playlist_id = expected.playlist_id
              and v.chapter_id is distinct from expected.chapter_id
          )
       or (select array_agg(lg.slug order by lg.slug)
             from public.playlist_learning_goals plg
             join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = expected.playlist_id) <> array['neet']::text[]
       or (select array_agg(cl.slug order by cl.slug)
             from public.playlist_class_levels pcl
             join public.class_levels cl on cl.id = pcl.class_level_id
            where pcl.playlist_id = expected.playlist_id) <> array['class-11']::text[]
       or public.playlist_quality_missing(expected.playlist_id)
            is distinct from array['title-review','source-title','faculty-credit']::text[]
       or not exists (
            select 1 from public.teachers t
            where t.id = expected.teacher_id and t.slug = expected.teacher_slug
              and t.verified
          )
       or not exists (
            select 1 from public.playlist_teachers pt
            where pt.playlist_id = expected.playlist_id
              and pt.teacher_id = expected.teacher_id
              and pt.role = 'instructor' and pt.position = 1
          )
       or (select count(*) from public.playlist_teachers pt
            where pt.playlist_id = expected.playlist_id) <> 1
  ) then
    raise exception 'refusing Unacademy eighteenth-batch quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews
    where playlist_id in (430, 431, 432)
  ) then
    raise exception 'refusing Unacademy eighteenth-batch quality review: target already reviewed';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 2 and slug = 'chemistry')
     or not exists (select 1 from public.subjects where id = 4 and slug = 'biology')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.chapters where id = 38 and name = 'Ionic Equilibrium' and subject_id = 2)
     or not exists (select 1 from public.chapters where id = 111 and name = 'Excretory Products and Their Elimination' and subject_id = 4)
     or not exists (select 1 from public.chapters where id = 119 and name = 'Photosynthesis in Higher Plants' and subject_id = 4) then
    raise exception 'refusing Unacademy eighteenth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy eighteenth-batch quality review: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

do $capture_source_titles$
declare
  v_updated integer;
begin
  update public.playlists p
     set source_title = expected.source_title,
         source_title_changed = false
    from (values
      (430::bigint, 'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text),
      (431::bigint, 'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text),
      (432::bigint, 'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur'::text)
    ) expected(playlist_id, source_title)
   where p.id = expected.playlist_id
     and p.title = expected.source_title
     and p.source_title is null
     and p.source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 3 then
    raise exception 'Unacademy eighteenth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET eighteenth-batch evidence under decision 8f19ac66-a1b4-4304-8a6f-468131f63732; quality transition prepared 2026-08-07.';
begin
  v_result := public.review_playlist_quality(
    430, 'Photosynthesis in Higher Plants', array[33]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 430 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    431, 'Ionic Equilibrium', array[32]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 431 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    432, 'Excretory Products and Their Elimination', array[38]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 432 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET eighteenth-batch evidence under decision 8f19ac66-a1b4-4304-8a6f-468131f63732; quality transition prepared 2026-08-07.';
begin
  if (select count(*) from public.playlists) <> 413
     or (select count(*) from public.videos) <> 4723
     or (select count(*) from public.playlist_videos) <> 4729
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 34
     or (select count(*) from public.teacher_aliases) <> 54
     or (select count(*) from public.teacher_institutes) <> 35
     or (select count(*) from public.teacher_subjects) <> 35
     or (select count(*) from public.teacher_learning_goals) <> 34
     or (select count(*) from public.playlist_teachers) <> 168
     or (select count(*) from public.playlist_quality_reviews) <> 39 then
    raise exception 'Unacademy eighteenth-batch quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (430::bigint, 'Photosynthesis in Higher Plants'::text,
       'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text, 33::bigint),
      (431::bigint, 'Ionic Equilibrium'::text,
       'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text, 32::bigint),
      (432::bigint, 'Excretory Products and Their Elimination'::text,
       'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur'::text, 38::bigint)
    ) expected(playlist_id, title, source_title, teacher_id)
    left join public.playlists p on p.id = expected.playlist_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.source_title is distinct from expected.source_title
       or p.title_review_status is distinct from 'approved'
       or p.faculty_credit_status is distinct from 'identified'
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.source_title_changed is distinct from false
       or public.playlist_quality_missing(expected.playlist_id) is distinct from array[]::text[]
       or (select array_agg(pt.teacher_id order by pt.position)
             from public.playlist_teachers pt
            where pt.playlist_id = expected.playlist_id)
            is distinct from array[expected.teacher_id]::bigint[]
  ) then
    raise exception 'Unacademy eighteenth-batch quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (430::bigint,
       'Photosynthesis - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
       'Photosynthesis in Higher Plants'::text, 33::bigint),
      (431::bigint,
       'Ionic Equilibrium - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text,
       'Ionic Equilibrium'::text, 32::bigint),
      (432::bigint,
       'Excretory Products And Their Elimination | Human Physiology - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Dr. Sachin Kapur'::text,
       'Excretory Products and Their Elimination'::text, 38::bigint)
    ) expected(playlist_id, source_title, title, teacher_id)
    left join public.playlist_quality_reviews q on q.playlist_id = expected.playlist_id
    where q.id is null
       or q.note is distinct from v_note
       or q.before_state->>'title' is distinct from expected.source_title
       or q.before_state->>'title_review_status' is distinct from 'pending'
       or q.before_state->>'faculty_credit_status' is distinct from 'pending'
       or q.before_state->>'content_type' is distinct from 'full-course'
       or q.before_state->>'language' is distinct from 'hinglish'
       or q.before_state->>'difficulty' is distinct from 'intermediate'
       or q.before_state->'teacher_ids' is distinct from to_jsonb(array[expected.teacher_id]::bigint[])
       or q.after_state->>'title' is distinct from expected.title
       or q.after_state->>'title_review_status' is distinct from 'approved'
       or q.after_state->>'faculty_credit_status' is distinct from 'identified'
       or q.after_state->>'content_type' is distinct from 'full-course'
       or q.after_state->>'language' is distinct from 'hinglish'
       or q.after_state->>'difficulty' is distinct from 'intermediate'
       or q.after_state->'teacher_ids' is distinct from to_jsonb(array[expected.teacher_id]::bigint[])
  )
  or exists (
    select playlist_id from public.playlist_quality_reviews
    where playlist_id in (430, 431, 432)
    group by playlist_id having count(*) <> 1
  ) then
    raise exception 'Unacademy eighteenth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy eighteenth-batch quality review protected JEE mismatch (%)',
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
where p.id in (430, 431, 432)
order by p.id;

commit;
