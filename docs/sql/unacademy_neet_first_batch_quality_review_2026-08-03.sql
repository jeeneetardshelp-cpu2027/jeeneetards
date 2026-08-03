-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: 6579f542-da9b-499f-bd46-3aa796ea4f27.
-- Scope: in-place quality-review transition for production courses 341-343 only.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 335
     or (select count(*) from public.videos) <> 4018
     or (select count(*) from public.playlist_videos) <> 4024
     or (select count(*) from public.chapters) <> 245
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 29
     or (select count(*) from public.teacher_aliases) <> 45
     or (select count(*) from public.teacher_institutes) <> 30
     or (select count(*) from public.teacher_subjects) <> 30
     or (select count(*) from public.teacher_learning_goals) <> 29
     or (select count(*) from public.playlist_teachers) <> 133
     or (select count(*) from public.playlist_quality_reviews) <> 0 then
    raise exception 'refusing Unacademy quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        341::bigint,
        'Chemical Bonding'::text,
        'Chemical Bonding - Playlist | Class 11 | Unacademy NEET | LIVE DAILY | NEET Chemistry | Ashwani Tyagi'::text,
        'Ashwani Tyagi'::text,
        'PLsgHooHkqhhOpvf0vvBRLS91fUm9T_eE1'::text,
        147::bigint,
        2::bigint,
        array['11th']::text[],
        '11th'::text,
        'class-11'::text,
        15::bigint,
        32::bigint
      ),
      (
        342::bigint,
        'Evolution'::text,
        'NEET: Evolution - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhOQCrgTeH7u28Es6agZtG_x'::text,
        147::bigint,
        4::bigint,
        array['12th']::text[],
        '12th'::text,
        'class-12'::text,
        15::bigint,
        33::bigint
      ),
      (
        343::bigint,
        'Principles of Inheritance and Variation'::text,
        'NEET: Principles of Inheritance and Variation - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
        'Pradeep Singh'::text,
        'PLsgHooHkqhhNoUZC_HaAwe9k_5crRH-Ig'::text,
        147::bigint,
        4::bigint,
        array['12th']::text[],
        '12th'::text,
        'class-12'::text,
        14::bigint,
        33::bigint
      )
    ) expected(
      playlist_id, title, source_title, legacy_teacher, youtube_playlist_id,
      channel_id, subject_id, legacy_class_levels, audience_focus, class_slug,
      membership_count, teacher_id
    )
    left join public.playlists p on p.id = expected.playlist_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.source_title is distinct from expected.source_title
       or p.source_title_changed is distinct from false
       or p.title_review_status is distinct from 'pending'
       or p.faculty_credit_status is distinct from 'pending'
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.teacher is distinct from expected.legacy_teacher
       or p.youtube_playlist_id is distinct from expected.youtube_playlist_id
       or p.channel_id is distinct from expected.channel_id
       or p.subject_id is distinct from expected.subject_id
       or p.class_levels is distinct from expected.legacy_class_levels
       or p.audience_focus is distinct from expected.audience_focus
       or (select count(*) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
       or (select count(distinct pv.video_id) from public.playlist_videos pv
            where pv.playlist_id = expected.playlist_id) <> expected.membership_count
       or exists (
            select 1
              from public.playlist_videos pv
              join public.videos v on v.id = pv.video_id
             where pv.playlist_id = expected.playlist_id
               and v.chapter_id is null
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
            is distinct from array['title-review', 'faculty-credit']::text[]
  ) then
    raise exception 'refusing Unacademy quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1
    from (values
      (32::bigint, 'Ashwani Tyagi'::text, 'ashwani tyagi'::text, 'ashwani-tyagi'::text),
      (33::bigint, 'Pradeep Singh'::text, 'pradeep singh'::text, 'pradeep-singh'::text)
    ) expected(teacher_id, display_name, canonical_name, slug)
    left join public.teachers t on t.id = expected.teacher_id
    where t.id is null
       or t.display_name is distinct from expected.display_name
       or t.canonical_name is distinct from expected.canonical_name
       or t.slug is distinct from expected.slug
       or t.verified is distinct from true
  ) then
    raise exception 'refusing Unacademy quality review: verified teacher identities differ';
  end if;

  if exists (
    select 1
    from (values
      (341::bigint, 32::bigint),
      (342::bigint, 33::bigint),
      (343::bigint, 33::bigint)
    ) expected(playlist_id, teacher_id)
    left join public.playlist_teachers pt
      on pt.playlist_id = expected.playlist_id
     and pt.teacher_id = expected.teacher_id
    where pt.playlist_id is null
       or pt.role is distinct from 'instructor'
       or pt.position is distinct from 1
  )
  or (select count(*) from public.playlist_teachers
       where playlist_id in (341, 342, 343)) <> 3 then
    raise exception 'refusing Unacademy quality review: course-teacher links differ';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147
       and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 2 and slug = 'chemistry')
  or not exists (select 1 from public.subjects where id = 4 and slug = 'biology')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
  or not exists (select 1 from public.class_levels where id = 2 and slug = 'class-11')
  or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12') then
    raise exception 'refusing Unacademy quality review: reference data differs';
  end if;

  select * into v_protected from (
    select
      (select count(*)
         from public.playlists p
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
              join public.learning_goals lg on lg.id = plg.learning_goal_id
             where plg.playlist_id = p.id and lg.slug = 'jee'
          )) as protected_courses,
      (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
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
             select 1
               from public.playlist_learning_goals plg
               join public.learning_goals lg on lg.id = plg.learning_goal_id
              where plg.playlist_id = p.id and lg.slug = 'jee'
           )
        ) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'refusing Unacademy quality review: protected JEE mismatch (%)',
      row_to_json(v_protected);
  end if;
end
$preflight$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 6579f542-da9b-499f-bd46-3aa796ea4f27; Unacademy NEET first-batch quality transition approved 2026-08-03.';
begin
  v_result := public.review_playlist_quality(
    341,
    'Chemical Bonding',
    array[32]::bigint[],
    'identified',
    'full-course',
    'hinglish',
    'intermediate',
    v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 341 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    342,
    'Evolution',
    array[33]::bigint[],
    'identified',
    'full-course',
    'hinglish',
    'intermediate',
    v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 342 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    343,
    'Principles of Inheritance and Variation',
    array[33]::bigint[],
    'identified',
    'full-course',
    'hinglish',
    'intermediate',
    v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 343 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision 6579f542-da9b-499f-bd46-3aa796ea4f27; Unacademy NEET first-batch quality transition approved 2026-08-03.';
begin
  if (select count(*) from public.playlists) <> 335
     or (select count(*) from public.videos) <> 4018
     or (select count(*) from public.playlist_videos) <> 4024
     or (select count(*) from public.chapters) <> 245
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 29
     or (select count(*) from public.teacher_aliases) <> 45
     or (select count(*) from public.teacher_institutes) <> 30
     or (select count(*) from public.teacher_subjects) <> 30
     or (select count(*) from public.teacher_learning_goals) <> 29
     or (select count(*) from public.playlist_teachers) <> 133
     or (select count(*) from public.playlist_quality_reviews) <> 3 then
    raise exception 'Unacademy quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (341::bigint, 'Chemical Bonding'::text, 32::bigint),
      (342::bigint, 'Evolution'::text, 33::bigint),
      (343::bigint, 'Principles of Inheritance and Variation'::text, 33::bigint)
    ) expected(playlist_id, title, teacher_id)
    left join public.playlists p on p.id = expected.playlist_id
    where p.id is null
       or p.title is distinct from expected.title
       or p.title_review_status is distinct from 'approved'
       or p.faculty_credit_status is distinct from 'identified'
       or p.content_type is distinct from 'full-course'
       or p.language is distinct from 'hinglish'
       or p.difficulty is distinct from 'intermediate'
       or p.source_title_changed is distinct from false
       or public.playlist_quality_missing(expected.playlist_id)
            is distinct from array[]::text[]
       or (select array_agg(pt.teacher_id order by pt.position)
             from public.playlist_teachers pt
            where pt.playlist_id = expected.playlist_id)
            is distinct from array[expected.teacher_id]::bigint[]
  ) then
    raise exception 'Unacademy quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (341::bigint, 'Chemical Bonding'::text, 32::bigint),
      (342::bigint, 'Evolution'::text, 33::bigint),
      (343::bigint, 'Principles of Inheritance and Variation'::text, 33::bigint)
    ) expected(playlist_id, title, teacher_id)
    left join public.playlist_quality_reviews q
      on q.playlist_id = expected.playlist_id
    where q.id is null
       or q.note is distinct from v_note
       or q.before_state->>'title' is distinct from expected.title
       or q.before_state->>'title_review_status' is distinct from 'pending'
       or q.before_state->>'faculty_credit_status' is distinct from 'pending'
       or q.before_state->>'content_type' is distinct from 'full-course'
       or q.before_state->>'language' is distinct from 'hinglish'
       or q.before_state->>'difficulty' is distinct from 'intermediate'
       or q.before_state->'teacher_ids'
            is distinct from to_jsonb(array[expected.teacher_id]::bigint[])
       or q.after_state->>'title' is distinct from expected.title
       or q.after_state->>'title_review_status' is distinct from 'approved'
       or q.after_state->>'faculty_credit_status' is distinct from 'identified'
       or q.after_state->>'content_type' is distinct from 'full-course'
       or q.after_state->>'language' is distinct from 'hinglish'
       or q.after_state->>'difficulty' is distinct from 'intermediate'
       or q.after_state->'teacher_ids'
            is distinct from to_jsonb(array[expected.teacher_id]::bigint[])
  )
  or exists (
    select playlist_id
      from public.playlist_quality_reviews
     group by playlist_id
    having count(*) <> 1
  ) then
    raise exception 'Unacademy quality review audit postflight mismatch';
  end if;

  select * into v_protected from (
    select
      (select count(*)
         from public.playlists p
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
              join public.learning_goals lg on lg.id = plg.learning_goal_id
             where plg.playlist_id = p.id and lg.slug = 'jee'
          )) as protected_courses,
      (select count(*)
         from public.playlist_videos pv
         join public.playlists p on p.id = pv.playlist_id
        where p.id < 167
          and exists (
            select 1
              from public.playlist_learning_goals plg
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
             select 1
               from public.playlist_learning_goals plg
               join public.learning_goals lg on lg.id = plg.learning_goal_id
              where plg.playlist_id = p.id and lg.slug = 'jee'
           )
        ) y), '')
      ) as protected_fingerprint
  ) protected;

  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'Unacademy quality review changed protected JEE (%)',
      row_to_json(v_protected);
  end if;
end
$postflight$;

commit;

select
  p.id as playlist_id,
  p.title,
  p.title_review_status,
  p.faculty_credit_status,
  p.content_type,
  p.language,
  p.difficulty,
  public.playlist_quality_missing(p.id) as missing_fields,
  (select count(*) from public.playlist_quality_reviews q
    where q.playlist_id = p.id) as quality_review_count
from public.playlists p
where p.id in (341, 342, 343)
order by p.id;
