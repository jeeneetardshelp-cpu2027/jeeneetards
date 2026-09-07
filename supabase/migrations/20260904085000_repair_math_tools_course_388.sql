-- Awaiting owner approval. Do not apply directly.
--
-- Repairs the already-imported Mohit Tyagi channel playlist
-- PL_A4M5IAkMaev6ovGTwhfLLidWzCveoHZ (course 388):
--   * records the official YouTube playlist title as source_title;
--   * confirms existing faculty #1 Amit Bijarnia (ABJ Sir);
--   * removes the later-added NEET scope from this explicitly IIT-JEE course;
--   * preserves all 35 lessons, their order, chapter, JEE scope and
--     Class 11 + Dropper scopes.
--
-- The file is deliberately outside supabase/migrations. Move it into the
-- ordered chain with a fresh UTC timestamp only after an exact-hash approval
-- and a fresh `supabase migration list` showing no unrelated pending files.

begin;
do $repair_math_tools$
declare
  v_playlist_id bigint;
  v_teacher_id bigint;
  v_jee_id bigint;
  v_neet_id bigint;
  v_video_ids bigint[];
  v_goal_slugs text[];
  v_class_slugs text[];
  v_expected_youtube_ids constant text[] := array[
    'NAlLWcfQHrA', 'f8qQBzJOrro', 'oLEoCUsI_JM', 'mWV_ZstQFjs',
    'WNX89aIrtG0', '7dWQ9YZW1IY', 'vNIHUxsVO9o', '4i2uxEWoUzc',
    'eOc_-cj-E8E', 'Zhb_8ZhuoCk', 'nEFmIsjmUhw', '8TexFzMMmwc',
    'nqQ2MXQn6EE', '8tDXLa7YnzE', 'vjGgO55Za1M', 'RFSYpB9XbJU',
    'odjEcwc6puw', 'eqmZeDWw-vM', '6CQg42hcp3M', 'CV48M3NZLC8',
    'ZJ7R7htvCms', 'Locn5Y9Xp-0', 'AJMHRZJzFaI', 'C-4hhDLXDoo',
    'W0GzhprYsp4', '1Ok39Wx126M', '2Lwt4x6LEsM', 'cooR9L3wa7c',
    'IhE84X4oOkw', 'xb2ybnjDNRo', 'O1NmjdpBA9E', '3m-AKyC5lYY',
    'PAzUF3462a4', 'y89zyc7ESxo', '8vPsqiU66PQ'
  ];
begin
  -- The em dash in the reviewed display title must survive transport.
  if length('—') = octet_length('—') then
    raise exception 'REFUSING: this connection is not UTF-8';
  end if;

  select id into strict v_playlist_id
    from public.playlists
   where youtube_playlist_id = 'PL_A4M5IAkMaev6ovGTwhfLLidWzCveoHZ';
  if v_playlist_id <> 388 then
    raise exception 'REFUSING: expected course 388, found %', v_playlist_id;
  end if;

  if not exists (
    select 1 from public.playlists p
     where p.id = v_playlist_id
       and p.title = 'Mathematical Tools and Basic Maths — ABJ Sir'
       and p.teacher = 'ABJ Sir'
       and p.channel_id = 1
       and p.subject_id = 1
       and p.category_id = 1
       and p.content_type = 'full-course'
       and p.language = 'hinglish'
       and p.difficulty = 'advanced'
       and p.audience_focus = '11th'
       and p.class_levels = array['11th', 'Dropper']::text[]
       and (p.source_title is null or p.source_title =
         'Mathematical Tools - IIT JEE Physics by Best Kota Faculty')
       and p.title_review_status in ('pending', 'approved')
       and p.faculty_credit_status in ('pending', 'identified')
  ) then
    raise exception 'REFUSING: course 388 metadata drifted';
  end if;

  if not exists (
    select 1 from public.institutes_channels
     where id = 1
       and name = 'Mohit Tyagi'
       and youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw'
  ) then
    raise exception 'REFUSING: Mohit Tyagi channel identity drifted';
  end if;

  select id into strict v_teacher_id
    from public.teachers
   where id = 1
     and display_name = 'Amit Bijarnia'
     and slug = 'amit-bijarnia'
     and verified;
  if not exists (
    select 1 from public.teacher_aliases
     where teacher_id = v_teacher_id and alias = 'ABJ Sir' and status = 'verified'
  ) then
    raise exception 'REFUSING: verified ABJ Sir alias is missing';
  end if;
  if not exists (
    select 1 from public.teacher_institutes
     where teacher_id = v_teacher_id and institute_id = 1
  ) or not exists (
    select 1 from public.teacher_subjects
     where teacher_id = v_teacher_id and subject_id = 1
  ) then
    raise exception 'REFUSING: Amit Bijarnia channel or Physics context drifted';
  end if;

  select id into strict v_jee_id from public.learning_goals where slug = 'jee';
  select id into strict v_neet_id from public.learning_goals where slug = 'neet';
  if not exists (
    select 1 from public.teacher_learning_goals
     where teacher_id = v_teacher_id and learning_goal_id = v_jee_id
  ) then
    raise exception 'REFUSING: Amit Bijarnia JEE context is missing';
  end if;

  if not exists (
    select 1 from public.chapters
     where id = 80 and subject_id = 1
       and name = 'Basic Mathematics for Physics'
       and slug = 'basic-mathematics-for-physics'
  ) then
    raise exception 'REFUSING: Physics chapter 80 drifted';
  end if;

  if (
    select array_agg(v.youtube_video_id order by pv.position)
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
     where pv.playlist_id = v_playlist_id
  ) is distinct from v_expected_youtube_ids then
    raise exception 'REFUSING: course 388 video set or order drifted';
  end if;

  select array_agg(pv.video_id order by pv.position) into strict v_video_ids
    from public.playlist_videos pv where pv.playlist_id = v_playlist_id;

  if exists (
    select 1
      from public.videos v
     where v.id = any(v_video_ids)
       and (v.chapter_id <> 80 or v.subject_id <> 1 or v.category_id <> 1)
  ) then
    raise exception 'REFUSING: a course 388 lesson taxonomy row drifted';
  end if;
  if exists (
    select 1 from public.playlist_videos pv
     where pv.video_id = any(v_video_ids) and pv.playlist_id <> v_playlist_id
  ) then
    raise exception 'REFUSING: a course 388 video is now shared by another course';
  end if;

  select array_agg(lg.slug order by lg.slug) into v_goal_slugs
    from public.playlist_learning_goals plg
    join public.learning_goals lg on lg.id = plg.learning_goal_id
   where plg.playlist_id = v_playlist_id;
  if v_goal_slugs not in (array['jee']::text[], array['jee', 'neet']::text[]) then
    raise exception 'REFUSING: course 388 goal scope drifted: %', v_goal_slugs;
  end if;

  select array_agg(cl.slug order by cl.slug) into v_class_slugs
    from public.playlist_class_levels pcl
    join public.class_levels cl on cl.id = pcl.class_level_id
   where pcl.playlist_id = v_playlist_id;
  if v_class_slugs is distinct from array['class-11', 'dropper']::text[] then
    raise exception 'REFUSING: course 388 class scope drifted: %', v_class_slugs;
  end if;
  if exists (select 1 from public.playlist_boards where playlist_id = v_playlist_id) then
    raise exception 'REFUSING: course 388 unexpectedly has a board scope';
  end if;

  if exists (
    select 1 from public.playlist_teachers
     where playlist_id = v_playlist_id and teacher_id <> v_teacher_id
  ) or (select count(*) from public.playlist_teachers where playlist_id = v_playlist_id) > 1 then
    raise exception 'REFUSING: course 388 already has a different or multi-faculty credit';
  end if;

  -- Every video must currently be either the measured JEE+NEET state or the
  -- desired JEE-only state. Any third state means this package is stale.
  if exists (
    select 1
      from unnest(v_video_ids) expected(video_id)
     where (select array_agg(lg.slug order by lg.slug)
              from public.video_learning_goals vlg
              join public.learning_goals lg on lg.id = vlg.learning_goal_id
             where vlg.video_id = expected.video_id)
           not in (array['jee']::text[], array['jee', 'neet']::text[])
  ) then
    raise exception 'REFUSING: a course 388 video goal scope drifted';
  end if;
  if exists (
    select 1
      from unnest(v_video_ids) expected(video_id)
     where (select array_agg(cl.slug order by cl.slug)
              from public.video_class_levels vcl
              join public.class_levels cl on cl.id = vcl.class_level_id
             where vcl.video_id = expected.video_id)
           is distinct from array['class-11', 'dropper']::text[]
  ) then
    raise exception 'REFUSING: a course 388 video class scope drifted';
  end if;

  update public.playlists
     set source_title = 'Mathematical Tools - IIT JEE Physics by Best Kota Faculty'
   where id = v_playlist_id and source_title is null;

  if not exists (
    select 1 from public.playlists p
     where p.id = v_playlist_id
       and p.title_review_status = 'approved'
       and p.faculty_credit_status = 'identified'
  ) or not exists (
    select 1 from public.playlist_teachers
     where playlist_id = v_playlist_id and teacher_id = v_teacher_id
  ) then
    perform public.review_playlist_quality(
      v_playlist_id,
      'Mathematical Tools and Basic Maths — ABJ Sir',
      array[v_teacher_id],
      'identified',
      'full-course',
      'hinglish',
      'advanced',
      'Owner-reviewed source credit: all 35 playlist lessons explicitly attribute Amit Bijarnia (ABJ Sir).'
    );
  end if;

  delete from public.playlist_learning_goals
   where playlist_id = v_playlist_id and learning_goal_id = v_neet_id;
  delete from public.video_learning_goals
   where video_id = any(v_video_ids) and learning_goal_id = v_neet_id;

  -- Transactional postflight.
  if (select array_agg(lg.slug order by lg.slug)
        from public.playlist_learning_goals plg
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where plg.playlist_id = v_playlist_id)
     is distinct from array['jee']::text[] then
    raise exception 'postflight failed: course 388 is not JEE-only';
  end if;
  if exists (
    select 1
      from unnest(v_video_ids) expected(video_id)
     where (select array_agg(lg.slug order by lg.slug)
              from public.video_learning_goals vlg
              join public.learning_goals lg on lg.id = vlg.learning_goal_id
             where vlg.video_id = expected.video_id)
           is distinct from array['jee']::text[]
  ) then
    raise exception 'postflight failed: a course 388 video is not JEE-only';
  end if;
  if (select array_agg(v.youtube_video_id order by pv.position)
        from public.playlist_videos pv join public.videos v on v.id = pv.video_id
       where pv.playlist_id = v_playlist_id)
     is distinct from v_expected_youtube_ids then
    raise exception 'postflight failed: video order changed';
  end if;
  if (select array_agg(pt.teacher_id order by pt.position)
        from public.playlist_teachers pt where pt.playlist_id = v_playlist_id)
     is distinct from array[v_teacher_id] then
    raise exception 'postflight failed: faculty link is not exactly Amit Bijarnia';
  end if;
  if public.playlist_quality_missing(v_playlist_id) <> array[]::text[] then
    raise exception 'postflight failed: course 388 still has quality gaps: %',
      public.playlist_quality_missing(v_playlist_id);
  end if;

  raise notice 'course 388 repaired: 35 lessons preserved, Amit Bijarnia linked, JEE-only scope';
end
$repair_math_tools$;
commit;
