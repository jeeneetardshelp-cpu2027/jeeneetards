-- PREPARED ONLY. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL OF THIS HASH.
-- Owner evidence decision: b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6
-- Scope: preserve source titles and apply the canonical quality transition to
-- production courses 408-410 only. No catalogue rows are created or deleted.

begin;

do $preflight$
declare
  v_protected record;
begin
  if exists (select 1 from public.app_environment) then
    raise exception 'refusing Unacademy ninth-batch quality review: target is not production-empty';
  end if;

  if to_regprocedure(
       'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)'
     ) is null
     or to_regprocedure('public.playlist_quality_missing(bigint)') is null then
    raise exception 'refusing Unacademy ninth-batch quality review: canonical v10 review contract is absent';
  end if;

  if public.content_quality_capability() @> jsonb_build_object(
       'quality_review_supported', true,
       'source_title_supported', true,
       'faculty_identity_required_for_identified', true,
       'automatic_identity_resolution', false
     ) is not true then
    raise exception 'refusing Unacademy ninth-batch quality review: capability differs';
  end if;

  if (select count(*) from public.playlists) <> 391
     or (select count(*) from public.videos) <> 4566
     or (select count(*) from public.playlist_videos) <> 4572
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 146
     or (select count(*) from public.playlist_quality_reviews) <> 14 then
    raise exception 'refusing Unacademy ninth-batch quality review: exact baseline differs';
  end if;

  if exists (
    select 1
    from (values
      (
        408::bigint,
        'NEET: Sexual Reproduction in Flowering Plants - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
        'Pradeep Singh'::text, 'PLsgHooHkqhhNIEDFQnuZzTGUq9Nl2BANa'::text,
        4::bigint, 125::bigint, 12::bigint, 33::bigint
      ),
      (
        409::bigint,
        'Alternating Current - Playlist | Class 12 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
        'Mahendra Singh'::text, 'PLsgHooHkqhhNaF6JnP38ojTYkuAZ5YFvd'::text,
        1::bigint, 14::bigint, 6::bigint, 34::bigint
      ),
      (
        410::bigint,
        'NEET: Chemical Kinetics - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'::text,
        'Anoop Vashishtha'::text, 'PLsgHooHkqhhNWeJHJ0f68rVPOY81tbaJa'::text,
        2::bigint, 35::bigint, 9::bigint, 36::bigint
      )
    ) expected(
      playlist_id, title, legacy_teacher, youtube_playlist_id, subject_id,
      chapter_id, membership_count, teacher_id
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
       or p.class_levels is distinct from array['12th']::text[]
       or p.audience_focus is distinct from '12th'
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
            where pcl.playlist_id = expected.playlist_id) <> array['class-12']::text[]
       or public.playlist_quality_missing(expected.playlist_id)
            is distinct from array['title-review', 'source-title', 'faculty-credit']::text[]
  ) then
    raise exception 'refusing Unacademy ninth-batch quality review: reviewed course evidence differs';
  end if;

  if exists (
    select 1
    from (values
      (33::bigint, 'Pradeep Singh'::text, 'pradeep singh'::text, 'pradeep-singh'::text),
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
    raise exception 'refusing Unacademy ninth-batch quality review: verified teacher identities differ';
  end if;

  if exists (
    select 1
    from (values
      (408::bigint, 33::bigint),
      (409::bigint, 34::bigint),
      (410::bigint, 36::bigint)
    ) expected(playlist_id, teacher_id)
    left join public.playlist_teachers pt
      on pt.playlist_id = expected.playlist_id and pt.teacher_id = expected.teacher_id
    where pt.playlist_id is null
       or pt.role is distinct from 'instructor'
       or pt.position is distinct from 1
  )
  or (select count(*) from public.playlist_teachers
       where playlist_id in (408, 409, 410)) <> 3 then
    raise exception 'refusing Unacademy ninth-batch quality review: course-teacher links differ';
  end if;

  if exists (
    select 1 from public.playlist_quality_reviews
     where playlist_id in (408, 409, 410)
  ) then
    raise exception 'refusing Unacademy ninth-batch quality review: target already reviewed';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 147 and name = 'Unacademy NEET'
       and youtube_channel_id = 'UCdQwYksctqqiRwqp3PiJMWA'
  )
  or not exists (select 1 from public.subjects where id = 1 and slug = 'physics')
  or not exists (select 1 from public.subjects where id = 2 and slug = 'chemistry')
  or not exists (select 1 from public.subjects where id = 4 and slug = 'biology')
  or not exists (select 1 from public.learning_goals where id = 2 and slug = 'neet')
  or not exists (select 1 from public.class_levels where id = 3 and slug = 'class-12')
  or not exists (select 1 from public.chapters where id = 14 and name = 'Alternating Current' and subject_id = 1)
  or not exists (select 1 from public.chapters where id = 35 and name = 'Chemical Kinetics' and subject_id = 2)
  or not exists (select 1 from public.chapters where id = 125 and name = 'Sexual Reproduction in Flowering Plants' and subject_id = 4)
  or not exists (select 1 from public.chapters where id = 321 and name = 'Linear Programming' and subject_id = 3)
  or not exists (select 1 from public.chapters where id = 322 and name = 'Sets' and subject_id = 3)
  or not exists (select 1 from public.chapters where id = 323 and name = 'Linear Inequalities' and subject_id = 3) then
    raise exception 'refusing Unacademy ninth-batch quality review: reference data differs';
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
    raise exception 'refusing Unacademy ninth-batch quality review: protected JEE mismatch (%)',
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
      (408::bigint, 'NEET: Sexual Reproduction in Flowering Plants - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text),
      (409::bigint, 'Alternating Current - Playlist | Class 12 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text),
      (410::bigint, 'NEET: Chemical Kinetics - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'::text)
    ) expected(playlist_id, source_title)
   where p.id = expected.playlist_id
     and p.title = expected.source_title
     and p.source_title is null
     and p.source_title_changed is false;

  get diagnostics v_updated = row_count;
  if v_updated <> 3 then
    raise exception 'Unacademy ninth-batch quality review source-title capture mismatch (%)', v_updated;
  end if;
end
$capture_source_titles$;

do $review$
declare
  v_result jsonb;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6; Unacademy NEET ninth-batch quality transition prepared 2026-08-05.';
begin
  v_result := public.review_playlist_quality(
    408, 'Sexual Reproduction in Flowering Plants', array[33]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 408 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    409, 'Alternating Current', array[34]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 409 did not become quality-ready (%)', v_result;
  end if;

  v_result := public.review_playlist_quality(
    410, 'Chemical Kinetics', array[36]::bigint[],
    'identified', 'full-course', 'hinglish', 'intermediate', v_note
  );
  if (v_result->>'quality_ready')::boolean is distinct from true
     or v_result->'missing_fields' is distinct from '[]'::jsonb then
    raise exception 'course 410 did not become quality-ready (%)', v_result;
  end if;
end
$review$;

do $postflight$
declare
  v_protected record;
  v_note constant text :=
    'Owner-reviewed official-channel attribution decision b988e5f2-fbf5-4cba-bb7a-54d3dd35a3a6; Unacademy NEET ninth-batch quality transition prepared 2026-08-05.';
begin
  if (select count(*) from public.playlists) <> 391
     or (select count(*) from public.videos) <> 4566
     or (select count(*) from public.playlist_videos) <> 4572
     or (select count(*) from public.chapters) <> 263
     or (select count(*) from public.chapter_class_levels) <> 92
     or (select count(*) from public.teachers) <> 32
     or (select count(*) from public.teacher_aliases) <> 50
     or (select count(*) from public.teacher_institutes) <> 33
     or (select count(*) from public.teacher_subjects) <> 33
     or (select count(*) from public.teacher_learning_goals) <> 32
     or (select count(*) from public.playlist_teachers) <> 146
     or (select count(*) from public.playlist_quality_reviews) <> 17 then
    raise exception 'Unacademy ninth-batch quality review postflight total mismatch';
  end if;

  if exists (
    select 1
    from (values
      (408::bigint, 'Sexual Reproduction in Flowering Plants'::text,
       'NEET: Sexual Reproduction in Flowering Plants - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text, 33::bigint),
      (409::bigint, 'Alternating Current'::text,
       'Alternating Current - Playlist | Class 12 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text, 34::bigint),
      (410::bigint, 'Chemical Kinetics'::text,
       'NEET: Chemical Kinetics - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'::text, 36::bigint)
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
    raise exception 'Unacademy ninth-batch quality review course postflight mismatch';
  end if;

  if exists (
    select 1
    from (values
      (408::bigint,
       'NEET: Sexual Reproduction in Flowering Plants - Playlist | Class 12 | Unacademy NEET | Live Daily 2.0 | NEET Biology | Pradeep Singh'::text,
       'Sexual Reproduction in Flowering Plants'::text, 33::bigint),
      (409::bigint,
       'Alternating Current - Playlist | Class 12 | Unacademy NEET | LIVE DAILY | NEET Physics | Mahendra Singh'::text,
       'Alternating Current'::text, 34::bigint),
      (410::bigint,
       'NEET: Chemical Kinetics - Playlist | Class 12 | Unacademy NEET | Live Daily | NEET Chemistry | Anoop Vashishtha'::text,
       'Chemical Kinetics'::text, 36::bigint)
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
     where playlist_id in (408, 409, 410)
     group by playlist_id having count(*) <> 1
  ) then
    raise exception 'Unacademy ninth-batch quality review audit postflight mismatch';
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
    raise exception 'Unacademy ninth-batch quality review changed protected JEE (%)',
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
where p.id in (408, 409, 410)
order by p.id;
