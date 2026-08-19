-- english_lesson_clarity_2026-08-04.sql
--
-- Two corrections to today's Magnet Brains English import, both about telling a
-- student the truth on the lesson list.
--
-- ---------------------------------------------------------------------
-- 1. SAY WHICH LESSON IS THE "EVERYTHING IN ONE VIDEO" CUT
-- ---------------------------------------------------------------------
-- Three chapters hold both a short cut and a long one that re-teaches the same
-- ground. On the course page a student currently sees, under "Two Stories about
-- Flying", four lessons adding up to 16h 52m -- and reasonably concludes that is
-- 16h 52m of distinct teaching. It is not.
--
-- Verified from YouTube's own chapter markers, not inferred from titles:
--
--   1Z8M6uG6eb0 (1h55m) vs PF_eFZcfC_4 (6h26m)
--     markers align to the second from 0:00 to 1:14:00
--     ("Reading" 4:12/4:13, "Summary" 51:48/51:49, next block 1:14:00/1:14:00)
--   JhqV9jIVVYg (2h14m) vs VfRZ2gUKmIY (6h15m)
--     "Summary: A Letter to God" sits at 59:40 in BOTH
--   ps42mTP9Jws (2h40m) vs EATUz5joXB0 (8h14m)
--     "His First Flight" 4:40/4:40, "Summary" 49:01/49:01
--
-- Being precise about what that does and does NOT show: the openings are the
-- same recording, then the videos diverge -- the long cuts continue into hours
-- of NCERT solutions and re-teach the poems at different lengths. So the short
-- lessons are NOT wholly contained in the long ones, and none of them is
-- redundant enough to remove. What is wrong is only that nothing on screen tells
-- a student the long one is the single-sitting version of the same chapter.
--
-- So: rename the three long cuts, and leave every other lesson alone. No lesson
-- is deleted, no duration is edited, and the summed chapter minutes stay honest
-- because the overlap is now visible in the titles rather than hidden.
--
-- ---------------------------------------------------------------------
-- 2. ADD THE MISSING POEM "ANIMALS"
-- ---------------------------------------------------------------------
-- The import deliberately excluded two poem-only videos on the grounds that
-- every chapter is named after its prose piece. For "Amanda" that was right:
-- PF_eFZcfC_4 already teaches it. For "Animals" it was wrong -- Walt Whitman's
-- poem now has ZERO coverage anywhere in the catalogue's 4,188 lessons, and a
-- student searching "Animals" in English is handed "How to Tell Wild Animals",
-- a different poem from a different chapter.
--
-- 0lgsPSZd1RE goes to The Hundred Dresses II, which is NCERT First Flight
-- Chapter 6 -- the chapter this poem is printed in, per the publisher's own
-- title "Class 10 English Chapter 6 (2025-26)". Verified live: 3499s,
-- playableInEmbed true, channel UC3HS6gQ79jjn4xHxogw0HiA, oEmbed author_name
-- "Magnet Brains", not already in the catalogue.
--
-- Its display title names the poem AND says why it is filed here, so the
-- chapter-title mismatch that motivated the original exclusion does not bite.
--
-- It is inserted at position 15, in reading order right after the two Hundred
-- Dresses II lessons, and the later lessons shift down by one. Appending it at
-- position 20 would have parked a Hundred Dresses II lesson after The Proposal,
-- because the course page groups by chapter in position order.
--
-- No playlist_boards insert is needed: this file creates no course, and course
-- 372 gets its board row from backfill_playlist_boards_2026-08-04.sql, which
-- must be run first.
--
-- Idempotent and self-verifying. Safe to re-run.

begin;

do $clarity$
declare
  v_channel_id bigint;
  v_course_id bigint;
  v_chapter_id bigint;
  v_video_id bigint;
  v_renamed int := 0;
  r record;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  select id into strict v_course_id from public.playlists
   where channel_id = v_channel_id
     and title = 'Class 10 English First Flight — Full Chapters';

  select id into strict v_chapter_id from public.chapters
   where subject_id = 11 and name = 'The Hundred Dresses II';

  -- ---- 1. rename the three single-sitting cuts ----
  for r in
    select * from (values
      ('VfRZ2gUKmIY', 'A Letter to God, Dust of Snow and Fire and Ice — Complete Chapter in One Video'),
      ('EATUz5joXB0', 'Two Stories about Flying and Its Poems — Complete Chapter in One Video'),
      ('PF_eFZcfC_4', 'From the Diary of Anne Frank with Amanda — Complete Chapter in One Video')
    ) as t(yt_id, title)
  loop
    update public.videos set title = r.title
     where youtube_video_id = r.yt_id and channel_id = v_channel_id;
    if not found then
      raise exception 'lesson % not found on the Magnet Brains channel', r.yt_id;
    end if;
    v_renamed := v_renamed + 1;
  end loop;
  raise notice 'renamed % lesson(s)', v_renamed;

  -- ---- 2. make room at position 15, then add "Animals" ----
  -- Shift first so the new lesson lands in reading order. Guarded by the
  -- existence check below so a re-run does not shift twice.
  if not exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_course_id and v.youtube_video_id = '0lgsPSZd1RE'
  ) then
    update public.playlist_videos
       set position = position + 1
     where playlist_id = v_course_id and position >= 15;
  end if;

  insert into public.videos
    (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
     category_id, duration_seconds, embedding_status, last_verified_at)
  values
    ('0lgsPSZd1RE',
     'Animals — The Poem in This Chapter, Questions and Answers',
     'Animals Complete Question & Answers | Class 10 English Chapter 6 (2025-26)| Class 10 English Animals',
     v_channel_id, 11, v_chapter_id, 4, 3499, 'embeddable', now())
  on conflict (youtube_video_id) do update set last_verified_at = now()
  returning id into v_video_id;

  insert into public.playlist_videos (playlist_id, video_id, position)
  values (v_course_id, v_video_id, 15)
  on conflict (playlist_id, video_id) do update set position = excluded.position;

  -- Without these the lesson cannot be returned by goal-scoped search.
  insert into public.video_learning_goals (video_id, learning_goal_id)
  select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_course_id
  on conflict do nothing;

  insert into public.video_class_levels (video_id, class_level_id)
  select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_course_id
  on conflict do nothing;
end
$clarity$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_channel_id bigint;
  v_course_id bigint;
  v_named int;
  v_animals int;
  v_lessons int;
  v_positions int;
  v_unfiled int;
  v_long int;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';
  select id into strict v_course_id from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 English First Flight — Full Chapters';

  -- 1. All three long cuts now say so.
  select count(*) into v_named from public.videos
   where youtube_video_id in ('VfRZ2gUKmIY', 'EATUz5joXB0', 'PF_eFZcfC_4')
     and title like '%Complete Chapter in One Video';
  if v_named <> 3 then
    raise exception 'expected 3 lessons labelled as the single-sitting cut, found %', v_named;
  end if;

  -- ...and nothing else claims to be one.
  select count(*) into v_long from public.videos
   where title like '%Complete Chapter in One Video'
     and youtube_video_id not in ('VfRZ2gUKmIY', 'EATUz5joXB0', 'PF_eFZcfC_4');
  if v_long <> 0 then
    raise exception '% unexpected lesson(s) claim to be the single-sitting cut', v_long;
  end if;

  -- No title may exceed the 90-character limit src/titleQuality.js enforces.
  if exists (select 1 from public.videos where channel_id = v_channel_id and length(title) > 90) then
    raise exception 'a Magnet Brains title is longer than 90 characters';
  end if;

  -- 2. "Animals" exists, in the right chapter, and is reachable.
  select count(*) into v_animals from public.videos v
   join public.chapters c on c.id = v.chapter_id
   where v.youtube_video_id = '0lgsPSZd1RE'
     and c.subject_id = 11 and c.name = 'The Hundred Dresses II';
  if v_animals <> 1 then
    raise exception 'the Animals lesson is not filed under The Hundred Dresses II';
  end if;

  select count(*) into v_unfiled from public.videos v
   where v.youtube_video_id = '0lgsPSZd1RE'
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then
    raise exception 'the Animals lesson is unfiled and would be invisible to search';
  end if;

  -- 3. The course is a clean 1..20 run with no gaps or ties, so the lesson list
  --    still reads in chapter order.
  select count(*) into v_lessons from public.playlist_videos where playlist_id = v_course_id;
  if v_lessons <> 20 then
    raise exception 'expected 20 lessons in the First Flight course, found %', v_lessons;
  end if;
  select count(*) into v_positions from (
    select position from public.playlist_videos where playlist_id = v_course_id
     group by position having count(*) > 1
  ) d;
  if v_positions <> 0 then raise exception 'the First Flight course has duplicate positions'; end if;
  select count(*) into v_positions from public.playlist_videos
   where playlist_id = v_course_id and position between 1 and 20;
  if v_positions <> 20 then raise exception 'First Flight positions are not a clean 1..20 run'; end if;

  raise notice 'SELF-TEST PASSED: 3 single-sitting cuts labelled, Animals added to The Hundred Dresses II, course is a clean 1..20 run.';
end
$verify$;

commit;
