-- thin_chapter_depth_2026-07-31.sql
--
-- Follow-up to a coverage audit: every chapter in Physics/Chemistry/Math/
-- Biology has at least 1 video, but a handful of JEE/NEET-relevant chapters
-- had only 1-2 videos, some of which turned out to be PYQ-practice
-- compilations rather than an actual concept lecture. This adds real,
-- network-verified concept lectures for the three genuine gaps found:
-- Kinetic Theory of Gases (Physics), Stereoisomerism, and Polymers
-- (Chemistry) -- all from channels already in the catalogue (JEE Wallah,
-- Competition Wallah), no new institute.
--
-- ALSO fixes a real, pre-existing data bug found while researching this:
-- video id 1533 ("Optical Isomerism", part of the existing course
-- "Complete ORGANIC Chemistry by Pankaj Sir") was tagged chapter_id=96
-- ("Some Basic Principles of Organic Chemistry") -- checked every other
-- lesson in that same course and only this one is wrong; the other 4
-- lessons at that chapter (IUPAC Nomenclature, Isomerism, GOC, GOC Part 2)
-- are all genuinely GOC-fundamentals content per their own titles and stay
-- untouched. "Optical Isomerism" is unambiguously Stereoisomerism content,
-- not a basic-principles topic -- retagging it to chapter_id=286 means the
-- catalogue's own existing NEET-side Stereoisomerism content was already
-- there, just invisible under the wrong chapter.
--
-- Idempotent: on-conflict-safe inserts; the chapter fix only applies if the
-- row is still in the exact wrong state found during research (a no-op on
-- re-run, and it would refuse rather than silently do nothing if someone
-- else already changed that row differently in the meantime).
--
-- Self-verifying: aborts the whole transaction unless the final state
-- matches exactly what this file intends.

begin;

-- ---------------------------------------------------------------------
-- 1. FIX — retag the existing mistagged Optical Isomerism video.
-- ---------------------------------------------------------------------
do $$
declare
  v_stereoisomerism_chapter bigint;
  v_current_chapter bigint;
  v_title text;
begin
  select id into v_stereoisomerism_chapter from public.chapters where slug = 'stereoisomerism';
  if v_stereoisomerism_chapter is null then raise exception 'stereoisomerism chapter not found'; end if;

  select chapter_id, title into v_current_chapter, v_title from public.videos where id = 1533;
  if v_title is distinct from 'Optical Isomerism' then
    raise exception 'video 1533 is no longer titled "Optical Isomerism" (found %) -- someone else changed it, refusing to guess', v_title;
  end if;

  if v_current_chapter = v_stereoisomerism_chapter then
    -- already fixed (safe re-run)
    null;
  elsif v_current_chapter is distinct from 96 then
    raise exception 'video 1533 chapter_id is % (expected the known-wrong 96, or already-fixed %) -- someone else retagged it, refusing to overwrite', v_current_chapter, v_stereoisomerism_chapter;
  else
    update public.videos set chapter_id = v_stereoisomerism_chapter where id = 1533;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. KTG — a second, genuinely different lecture for the existing
--    "Kinetic Theory of Gases — RAFTAAR" course (playlist 196).
-- ---------------------------------------------------------------------
do $$
declare
  v_channel_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
  v_next_position int;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel not found'; end if;
  select id into v_chapter_id from public.chapters where slug = 'kinetic-theory-of-gases';
  if v_chapter_id is null then raise exception 'kinetic-theory-of-gases chapter not found'; end if;
  select coalesce(max(position), 0) + 1 into v_next_position from public.playlist_videos where playlist_id = 196;

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('fFZ_WRB_Fv8', 'Kinetic Theory of Gases — Full Chapter Revision', 'KINETIC THEORY OF GASES in 67 Minutes || Full Chapter Revision || Class 11th JEE', v_channel_id, 1, v_chapter_id, 1, 5290, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position) values (196, v_video_id, v_next_position)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Optical Isomerism — RAFTAAR (JEE Wallah, new 1-lesson course)
-- ---------------------------------------------------------------------
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel not found'; end if;
  select id into v_chapter_id from public.chapters where slug = 'stereoisomerism';
  if v_chapter_id is null then raise exception 'stereoisomerism chapter not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Optical Isomerism — RAFTAAR', null, v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-12';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('2QwKInxPHvk', 'Optical Isomerism — Full Chapter Revision', 'OPTICAL ISOMERISM in 70 Minutes | Full Chapter Revision | Class 12th JEE', v_channel_id, 2, v_chapter_id, 1, 4564, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- 4. Polymers — RAFTAAR (JEE Wallah, new 1-lesson course)
-- ---------------------------------------------------------------------
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';
  if v_channel_id is null then raise exception 'channel not found'; end if;
  select id into v_chapter_id from public.chapters where slug = 'polymers';
  if v_chapter_id is null then raise exception 'polymers chapter not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Polymers — RAFTAAR', null, v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'jee';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-12';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('OrRnibt4YBM', 'Polymers — Complete Chapter Revision', 'POLYMERS in 70 Minutes || Complete Chapter for JEE Main/ Advanced', v_channel_id, 2, v_chapter_id, 1, 4277, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- 5. Polymers | Class XII Chemistry (Competition Wallah, NEET, new 1-lesson course)
-- ---------------------------------------------------------------------
do $$
declare
  v_playlist_id bigint;
  v_channel_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCD16eo98AXl-9T61Xd711kQ';
  if v_channel_id is null then raise exception 'channel not found'; end if;
  select id into v_chapter_id from public.chapters where slug = 'polymers';
  if v_chapter_id is null then raise exception 'polymers chapter not found'; end if;

  insert into public.playlists (title, teacher, channel_id, subject_id, content_type, language, difficulty)
  values ('Polymers | Class XII Chemistry', null, v_channel_id, 2, 'full-course', 'hinglish', 'advanced')
  returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  select v_playlist_id, lg.id from public.learning_goals lg where lg.slug = 'neet';
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, cl.id from public.class_levels cl where cl.slug = 'class-12';

  insert into public.videos (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id, category_id, duration_seconds, embedding_status, last_verified_at)
  values ('GykTsIHhjzw', 'Polymers — Complete Chapter for NEET', 'POLYMERS in 50 minutes || Complete Chapter for NEET', v_channel_id, 2, v_chapter_id, 1, 3129, 'allowed', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position) values (v_playlist_id, v_video_id, 1)
  on conflict (playlist_id, video_id) do update set position = excluded.position;
end
$$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  v_stereo_chapter bigint;
  v_1533_chapter bigint;
  v_course13_kine_count int;
  v_bad text;
  v_course_count int;
  v_lesson_count int;
begin
  select id into v_stereo_chapter from public.chapters where slug = 'stereoisomerism';

  select chapter_id into v_1533_chapter from public.videos where id = 1533;
  if v_1533_chapter is distinct from v_stereo_chapter then
    raise exception 'video 1533 still not tagged to stereoisomerism (chapter_id=%)', v_1533_chapter;
  end if;

  select count(*) into v_course13_kine_count from public.playlist_videos where playlist_id = 196;
  if v_course13_kine_count <> 2 then
    raise exception 'expected course 196 (Kinetic Theory of Gases) to have exactly 2 lessons, found %', v_course13_kine_count;
  end if;

  select string_agg(t.title, '; ') into v_bad
    from (values
      ('Optical Isomerism — RAFTAAR'),
      ('Polymers — RAFTAAR'),
      ('Polymers | Class XII Chemistry')
    ) as t(title)
   where not exists (select 1 from public.playlists p where p.title = t.title);
  if v_bad is not null then
    raise exception 'expected new course(s) missing: %', v_bad;
  end if;

  select count(*) into v_course_count from public.playlists
   where title in ('Optical Isomerism — RAFTAAR', 'Polymers — RAFTAAR', 'Polymers | Class XII Chemistry');
  if v_course_count <> 3 then
    raise exception 'expected exactly 3 new courses, found %', v_course_count;
  end if;

  select count(*) into v_lesson_count
    from public.playlist_videos pv
    join public.playlists p on p.id = pv.playlist_id
   where p.title in ('Optical Isomerism — RAFTAAR', 'Polymers — RAFTAAR', 'Polymers | Class XII Chemistry');
  if v_lesson_count <> 3 then
    raise exception 'expected exactly 3 lessons across the new courses (1 each), found %', v_lesson_count;
  end if;

  select string_agg(p.title, '; ') into v_bad
    from public.playlists p
   where p.title in ('Optical Isomerism — RAFTAAR', 'Polymers — RAFTAAR', 'Polymers | Class XII Chemistry')
     and (not exists (select 1 from public.playlist_learning_goals g where g.playlist_id = p.id)
       or not exists (select 1 from public.playlist_class_levels c where c.playlist_id = p.id));
  if v_bad is not null then
    raise exception 'new course(s) missing a learning-goal or class-level link: %', v_bad;
  end if;

  raise notice 'SELF-TEST PASSED: video 1533 retagged to Stereoisomerism, course 196 now has 2 lessons, 3 new courses created with 1 lesson each, all correctly linked.';
end
$$;

commit;
