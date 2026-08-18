-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1
-- Scope: preserve source titles and apply the canonical quality transition to
-- production courses 411-413 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy tenth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy tenth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy tenth-batch quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 394
     or (select count(*) from public.videos) <> 4578
     or (select count(*) from public.playlist_videos) <> 4584
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 149
     or (select count(*) from public.playlist_quality_reviews) <> 17 then
    raise exception 'refusing Unacademy tenth-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        411::bigint,
        'NEET: Thermal Properties of Matter | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra S.'::text,
        'Mahendra Singh'::text, 'PLsgHooHkqhhNB7vXo5H5J-QsBotPAPYUR'::text,
        1::bigint, 25::bigint, 4::bigint, 34::bigint,
        '11th'::text, 'class-11'::text
      ),
      (
        412::bigint,
        'NEET: Electromagnetic Induction | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text,
        'Anu Gupta'::text, 'PLsgHooHkqhhNvpnnFH79_2cZGiXgI3zlt'::text,
        1::bigint, 13::bigint, 3::bigint, 35::bigint,
        '12th'::text, 'class-12'::text
      ),
      (
        413::bigint,
        'Plant Growth and Development - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
        'Pradeep Singh'::text, 'PLsgHooHkqhhOn3bqr2nMVYEGq3Zh5bMDF'::text,
        4::bigint, 120::bigint, 5::bigint, 33::bigint,
        '11th'::text, 'class-11'::text
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
    raise exception 'refusing Unacademy tenth-batch quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1
    from (values
      (33::bigint, 'Pradeep Singh'::text, 'pradeep singh'::text, 'pradeep-singh'::text),
      (34::bigint, 'Mahendra Singh'::text, 'mahendra singh'::text, 'mahendra-singh'::text),
      (35::bigint, 'Anu Gupta'::text, 'anu gupta'::text, 'anu-gupta'::text)
    ) expected(teacher_id, display_name, canonical_name, slug)
    left join public.teachers t on t.id = expected.teacher_id
    where t.id is null
       or t.display_name is distinct from expected.display_name
       or t.canonical_name is distinct from expected.canonical_name
       or t.slug is distinct from expected.slug
       or t.verified is distinct from true
  ) then
    raise exception 'refusing Unacademy tenth-batch quality review: verified teacher identities differ';
  end if;

  if exists (
    select 1
    from (values
      (411::bigint, 34::bigint),
      (412::bigint, 35::bigint),
      (413::bigint, 33::bigint)
    ) expected(playlist_id, teacher_id)
    left join public.playlist_teachers pt
      on pt.playlist_id = expected.playlist_id and pt.teacher_id = expected.teacher_id
    where pt.playlist_id is null
       or pt.role is distinct from 'instructor'
       or pt.position is distinct from 1
  )
  or (select count(*) from public.playlist_teachers
       where playlist_id in (411, 412, 413)) <> 3 then
    raise exception 'refusing Unacademy tenth-batch quality review: course-teacher links differ';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews
     where playlist_id in (411, 412, 413)
  ) then
    raise exception 'refusing Unacademy tenth-batch quality review: target already reviewed';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147 and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 1 and slug = 'physics')
  or not exists (select 1 from public.subjects where id = 4 and slug = 'biology')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
  or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
  or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
  or not exists (select 1 from public.chapters where id = 13 and name = 'Electromagnetic Induction' and subject_id = 1)
  or not exists (select 1 from public.chapters where id = 25 and name = 'Thermal Properties of Matter' and subject_id = 1)
  or not exists (select 1 from public.chapters where id = 120 and name = 'Plant Growth and Development' and subject_id = 4) then
    raise exception 'refusing Unacademy tenth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy tenth-batch quality review: protected JEE mismatch (%)',
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
      (411::bigint, 'NEET: Thermal Properties of Matter | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra S.'::text),
      (412::bigint, 'NEET: Electromagnetic Induction | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text),
      (413::bigint, 'Plant Growth and Development - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text)
    ) expected(playlist_id, source_title)
   where p.id = expected.playlist_id
     and p.title = expected.source_title
     and p.source_title is null
     and p.source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 3 then
    raise exception 'Unacademy tenth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1; Unacademy NEET tenth-batch quality transition prepared 2026-08-06.';
begin
  v_result := public.review_playlist_quality(
    411, 'Thermal Properties of Matter', array[34]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 411 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    412, 'Electromagnetic Induction', array[35]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 412 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    413, 'Plant Growth and Development', array[33]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 413 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 0fab6ecf-934f-46ae-bb8a-05cbd6b9cea1; Unacademy NEET tenth-batch quality transition prepared 2026-08-06.';
begin
  if (select count(*) from public.playlists) <> 394
     or (select count(*) from public.videos) <> 4578
     or (select count(*) from public.playlist_videos) <> 4584
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 149
     or (select count(*) from public.playlist_quality_reviews) <> 20 then
    raise exception 'Unacademy tenth-batch quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (411::bigint, 'Thermal Properties of Matter'::text,
       'NEET: Thermal Properties of Matter | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra S.'::text, 34::bigint),
      (412::bigint, 'Electromagnetic Induction'::text,
       'NEET: Electromagnetic Induction | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text, 35::bigint),
      (413::bigint, 'Plant Growth and Development'::text,
       'Plant Growth and Development - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text, 33::bigint)
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
    raise exception 'Unacademy tenth-batch quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (411::bigint,
       'NEET: Thermal Properties of Matter | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra S.'::text,
       'Thermal Properties of Matter'::text, 34::bigint),
      (412::bigint,
       'NEET: Electromagnetic Induction | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Physics | Anu Gupta'::text,
       'Electromagnetic Induction'::text, 35::bigint),
      (413::bigint,
       'Plant Growth and Development - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Biology | Pradeep Singh'::text,
       'Plant Growth and Development'::text, 33::bigint)
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
     where playlist_id in (411, 412, 413)
     group by playlist_id having count(*) <> 1
  ) then
    raise exception 'Unacademy tenth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy tenth-batch quality review changed protected JEE (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

commit;

select
  p.id,
  p.title,
  p.source_title,
  p.title_review_status,
  p.faculty_credit_status,
  public.playlist_quality_missing(p.id) as missing_fields
from public.playlists p
where p.id in (411, 412, 413)
order by p.id;


