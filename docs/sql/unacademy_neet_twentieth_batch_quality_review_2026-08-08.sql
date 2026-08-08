-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 8de024c6-7317-4901-a91e-5006a5efcd7e
-- Scope: preserve source titles and apply the canonical quality transition to
-- production courses 436-438 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy twentieth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy twentieth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy twentieth-batch quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 419
     or (select count(*) from public.videos) <> 4740
     or (select count(*) from public.playlist_videos) <> 4746
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 35
     or (select count(*) from public.teacher_aliases) <> 56
     or (select count(*) from public.teacher_institutes) <> 36
     or (select count(*) from public.teacher_subjects) <> 36
     or (select count(*) from public.teacher_learning_goals) <> 35
     or (select count(*) from public.playlist_teachers) <> 174
     or (select count(*) from public.playlist_quality_reviews) <> 42 then
    raise exception 'refusing Unacademy twentieth-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (436::bigint,
       'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhMzQKgCZ2vyX2bh3ejb1eIQ'::text,
       55::bigint, 36::bigint, 'anoop-vashishtha'::text,
       'class-12'::text, '12th'::text,
       array['tZWyg6ewJb8','inlxrwae1Ys','X24X5wXFUno']::text[]),
      (437::bigint,
       'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir'::text,
       'Anoop Vashishtha'::text, 'PLsgHooHkqhhMRv85qlHflI5j8SoA8yZ0n'::text,
       46::bigint, 36::bigint, 'anoop-vashishtha'::text,
       'class-11'::text, '11th'::text,
       array['CdCL4s9L4F8','4-LZNHTDJaE','1pEXZvaack4']::text[]),
      (438::bigint,
       'Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir'::text,
       'Indrajeet Singh Sangtani'::text, 'PLsgHooHkqhhNhMBc1PNiIav8Kv_O7NPIT'::text,
       17::bigint, 39::bigint, 'indrajeet-singh-sangtani'::text,
       'class-12'::text, '12th'::text,
       array['6r2dj5wPfMk','OLymGXjoLUQ','q_Yji3EdXfg']::text[])
    ) expected(
      playlist_id, title, legacy_teacher, youtube_playlist_id, chapter_id,
      teacher_id, teacher_slug, class_slug, class_label, video_ids
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
       or p.subject_id is distinct from case expected.playlist_id when 438 then 1 else 2 end
       or p.class_levels is distinct from array[expected.class_label]::text[]
       or p.audience_focus is distinct from expected.class_label
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
            where pcl.playlist_id = expected.playlist_id) <> array[expected.class_slug]::text[]
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
    raise exception 'refusing Unacademy twentieth-batch quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews
    where playlist_id in (436, 437, 438)
  ) then
    raise exception 'refusing Unacademy twentieth-batch quality review: target already reviewed';
  end if;

  if not exists (
       select 1 from public.institutes_channels
       where id = 147 and name = 'Unacademy NEET'
         and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
     )
     or not exists (select 1 from public.subjects where id = 1 and name = 'Physics' and slug = 'physics')
     or not exists (select 1 from public.subjects where id = 2 and name = 'Chemistry' and slug = 'chemistry')
     or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
     or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
     or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
     or not exists (select 1 from public.chapters where id = 17 and name = 'Semiconductor Electronics' and subject_id = 1)
     or not exists (select 1 from public.chapters where id = 55 and name = 'Metallurgy' and subject_id = 2)
     or not exists (select 1 from public.chapters where id = 46 and name = 'The s-Block Elements' and subject_id = 2) then
    raise exception 'refusing Unacademy twentieth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy twentieth-batch quality review: protected JEE mismatch (%)',
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
      (436::bigint, 'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text),
      (437::bigint, 'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir'::text),
      (438::bigint, 'Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir'::text)
    ) expected(playlist_id, source_title)
   where p.id = expected.playlist_id
     and p.title = expected.source_title
     and p.source_title is null
     and p.source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 3 then
    raise exception 'Unacademy twentieth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET twentieth-batch evidence under decision 8de024c6-7317-4901-a91e-5006a5efcd7e; quality transition prepared 2026-08-08.';
begin
  v_result := public.review_playlist_quality(
    436, 'Metallurgy', array[36]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 436 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    437, 'The s-Block Elements', array[36]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 437 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    438, 'Semiconductor Electronics', array[39]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 438 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET twentieth-batch evidence under decision 8de024c6-7317-4901-a91e-5006a5efcd7e; quality transition prepared 2026-08-08.';
begin
  if (select count(*) from public.playlists) <> 419
     or (select count(*) from public.videos) <> 4740
     or (select count(*) from public.playlist_videos) <> 4746
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 35
     or (select count(*) from public.teacher_aliases) <> 56
     or (select count(*) from public.teacher_institutes) <> 36
     or (select count(*) from public.teacher_subjects) <> 36
     or (select count(*) from public.teacher_learning_goals) <> 35
     or (select count(*) from public.playlist_teachers) <> 174
     or (select count(*) from public.playlist_quality_reviews) <> 45 then
    raise exception 'Unacademy twentieth-batch quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (436::bigint, 'Metallurgy'::text,
       'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text, 36::bigint),
      (437::bigint, 'The s-Block Elements'::text,
       'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir'::text, 36::bigint),
      (438::bigint, 'Semiconductor Electronics'::text,
       'Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir'::text, 39::bigint)
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
    raise exception 'Unacademy twentieth-batch quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (436::bigint,
       'Metallurgy - Playlist | Class 12 | Unacademy NEET | NEET Live Daily | NEET Chemistry | Anoop Sir'::text,
       'Metallurgy'::text, 36::bigint),
      (437::bigint,
       'S Block Elements - Playlist | Class 11 | Unacademy NEET | Chemistry | Anoop Sir'::text,
       'The s-Block Elements'::text, 36::bigint),
      (438::bigint,
       'Semiconductors - Playlist | Class 12 |  Unacademy NEET | LIVE DAILY | NEET Physics | Indrajeet Sir'::text,
       'Semiconductor Electronics'::text, 39::bigint)
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
    where playlist_id in (436, 437, 438)
    group by playlist_id having count(*) <> 1
  ) then
    raise exception 'Unacademy twentieth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy twentieth-batch quality review protected JEE mismatch (%)',
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
where p.id in (436, 437, 438)
order by p.id;

commit;
