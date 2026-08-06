-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Scope: preserve source titles and apply the canonical quality transition to
-- production courses 423-425 only. No catalogue rows are created or deleted.
-- Original batch decision: 5b4b1d41-b7dc-4f12-80cf-b490e72edd96
-- Refreshed remainder decision: 1412ca96-56dc-47ef-8bc0-18ce97f7dfb6

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy fifteenth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy fifteenth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy fifteenth-batch quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 406
     or (select count(*) from public.videos) <> 4683
     or (select count(*) from public.playlist_videos) <> 4689
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 161
     or (select count(*) from public.playlist_quality_reviews) <> 29 then
    raise exception 'refusing Unacademy fifteenth-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        423::bigint,
        'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.'::text,
        'Anoop Vashishtha'::text, 'PLsgHooHkqhhNnQ7F6-Wfril1wn1_JrWNP'::text,
        2::bigint, 92::bigint, 11::bigint, 36::bigint, '12th'::text, 'class-12'::text
      ),
      (
        424::bigint,
        'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
        'Mahendra Singh'::text, 'PLsgHooHkqhhMMPfEYr7m_ofP61K_YScyw'::text,
        1::bigint, 26::bigint, 11::bigint, 34::bigint, '11th'::text, 'class-11'::text
      ),
      (
        425::bigint,
        'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
        'Mahendra Singh'::text, 'PLsgHooHkqhhM5m3xbTdZ2cDX8S_22jdSX'::text,
        1::bigint, 1::bigint, 6::bigint, 34::bigint, '11th'::text, 'class-11'::text
      )
    ) expected(
      playlist_id, title, legacy_teacher, youtube_playlist_id, subject_id,
      chapter_id, membership_count, teacher_id, class_label, class_slug
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
       or p.class_levels is distinct from array[expected.class_label]::text[]
       or p.audience_focus is distinct from expected.class_label
       or (select count(*) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
       or (select count(distinct pv.video_id) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
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
            where pcl.playlist_id = expected.playlist_id)
            <> array[expected.class_slug]::text[]
       or public.playlist_quality_missing(expected.playlist_id)
            is distinct from array['title-review', 'source-title', 'faculty-credit']::text[]
  ) then
    raise exception 'refusing Unacademy fifteenth-batch quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1
    from (values
      (34::bigint, 'Mahendra Singh'::text, 'mahendra singh'::text, 'mahendra-singh'::text),
      (36::bigint, 'Anoop Vashishtha'::text, 'anoop vashishtha'::text, 'anoop-vashishtha'::text)
    ) expected(teacher_id, display_name, canonical_name, slug)
    left join public.teachers t on t.id = expected.teacher_id
    where t.id is null
       or t.display_name is distinct from expected.display_name
       or t.canonical_name is distinct from expected.canonical_name
       or t.slug is distinct from expected.slug
       or t.verified is distinct from true
  ) then
    raise exception 'refusing Unacademy fifteenth-batch quality review: verified teacher identities differ';
  end if;

  if exists (
    select 1
    from (values
      (423::bigint, 36::bigint),
      (424::bigint, 34::bigint),
      (425::bigint, 34::bigint)
    ) expected(playlist_id, teacher_id)
    left join public.playlist_teachers pt
      on pt.playlist_id = expected.playlist_id and pt.teacher_id = expected.teacher_id
    where pt.playlist_id is null
       or pt.role is distinct from 'instructor'
       or pt.position is distinct from 1
  )
  or (select count(*) from public.playlist_teachers
       where playlist_id in (423, 424, 425)) <> 3 then
    raise exception 'refusing Unacademy fifteenth-batch quality review: course-teacher links differ';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews
     where playlist_id in (423, 424, 425)
  ) then
    raise exception 'refusing Unacademy fifteenth-batch quality review: target already reviewed';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147 and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 1 and slug = 'physics')
  or not exists (select 1 from public.subjects where id = 2 and slug = 'chemistry')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
  or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
  or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
  or not exists (select 1 from public.chapters where id = 92 and name = 'Organic Compounds Containing Oxygen' and subject_id = 2)
  or not exists (select 1 from public.chapters where id = 26 and name = 'Mechanical Properties of Fluids' and subject_id = 1)
  or not exists (select 1 from public.chapters where id = 1 and name = 'Kinematics' and subject_id = 1) then
    raise exception 'refusing Unacademy fifteenth-batch quality review: reference data differs';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_courses,
      (select count(*) from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167
        ) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee'
          )
        ) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'refusing Unacademy fifteenth-batch quality review: protected JEE mismatch (%)',
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
      (423::bigint, 'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.'::text),
      (424::bigint, 'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text),
      (425::bigint, 'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text)
    ) expected(playlist_id, source_title)
   where p.id = expected.playlist_id
     and p.title = expected.source_title
     and p.source_title is null
     and p.source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 3 then
    raise exception 'Unacademy fifteenth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET fifteenth-batch evidence under decisions 5b4b1d41-b7dc-4f12-80cf-b490e72edd96 and 1412ca96-56dc-47ef-8bc0-18ce97f7dfb6; quality transition prepared 2026-08-06.';
begin
  v_result := public.review_playlist_quality(
    423, 'Alcohols, Phenols & Ethers', array[36]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 423 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    424, 'Fluid Mechanics', array[34]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 424 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    425, 'Kinematics 1D', array[34]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 425 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed Unacademy NEET fifteenth-batch evidence under decisions 5b4b1d41-b7dc-4f12-80cf-b490e72edd96 and 1412ca96-56dc-47ef-8bc0-18ce97f7dfb6; quality transition prepared 2026-08-06.';
begin
  if (select count(*) from public.playlists) <> 406
     or (select count(*) from public.videos) <> 4683
     or (select count(*) from public.playlist_videos) <> 4689
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 161
     or (select count(*) from public.playlist_quality_reviews) <> 32 then
    raise exception 'Unacademy fifteenth-batch quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (423::bigint, 'Alcohols, Phenols & Ethers'::text, 'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.'::text, 36::bigint),
      (424::bigint, 'Fluid Mechanics'::text, 'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text, 34::bigint),
      (425::bigint, 'Kinematics 1D'::text, 'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text, 34::bigint)
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
    raise exception 'Unacademy fifteenth-batch quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (423::bigint, 'NEET: Alcohols, Phenols & Ethers | Class 12 | Unacademy NEET | Anoop V.'::text, 'Alcohols, Phenols & Ethers'::text, 36::bigint),
      (424::bigint, 'Fluid Mechanics -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text, 'Fluid Mechanics'::text, 34::bigint),
      (425::bigint, 'Kinematics 1D -  Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text, 'Kinematics 1D'::text, 34::bigint)
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
     where playlist_id in (423, 424, 425)
     group by playlist_id having count(*) <> 1
  ) then
    raise exception 'Unacademy fifteenth-batch quality review audit postflight mismatch';
  end if;

  select * into v_protected from (
    select
      (select count(*) from public.playlists p
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_courses,
      (select count(*) from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
        where p.id < 167 and exists (
          select 1 from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
        )) as protected_memberships,
      md5(
        coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
          select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
                 p.subject_id, p.class_levels, p.audience_focus, p.content_type,
                 p.language, p.difficulty
          from public.playlists p
          join public.playlist_learning_goals plg on plg.playlist_id = p.id
          join public.learning_goals lg on lg.id = plg.learning_goal_id
          where lg.slug = 'jee' and p.id < 167
        ) x), '') || '|' ||
        coalesce((select string_agg(row_to_json(y)::text, '|'
                                    order by y.playlist_id, y.position, y.id) from (
          select pv.id, pv.playlist_id, pv.video_id, pv.position
          from public.playlist_videos pv
          join public.playlists p on p.id = pv.playlist_id
          where p.id < 167 and exists (
            select 1 from public.playlist_learning_goals plg
            join public.learning_goals lg on lg.id = plg.learning_goal_id
            where plg.playlist_id = p.id and lg.slug = 'jee'
          )
        ) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 82
     or v_protected.protected_memberships <> 1304
     or v_protected.protected_fingerprint <> '30eee4a4a6842e5beeb7c97083d7f812' then
    raise exception 'Unacademy fifteenth-batch quality review protected JEE mismatch (%)',
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
where p.id in (423, 424, 425)
order by p.id;

commit;
