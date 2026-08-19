-- english_magnet_brains_2026-08-04.sql
--
-- Class 10 English was the catalogue's thinnest subject by a wide margin. The
-- measurement that prompted this, run against production:
--
--     subject          chapters  lessons  1-lesson chapters  median min/chapter  channels
--     Science                13       49                  0                 226         4
--     Social Science         22       29                 18                  74         2
--     Hindi B                16       32                 15                  19         2
--     English                16       18                 15                   9         1
--
-- So a student revising "A Letter to God" got a nine-minute animation, from the
-- single channel teaching the subject, with no second voice to compare against.
-- Science -- four channels, every chapter multi-voice -- is what the rest of the
-- catalogue looks like.
--
-- This file fixes depth and diversity together, and closes a completeness hole
-- I did not know was there until the books were enumerated.
--
-- SOURCE: Magnet Brains (UC3HS6gQ79jjn4xHxogw0HiA), a new institute here. It was
-- chosen by measurement, not reputation: searching four Class 10 English
-- chapters and keeping only results over twenty minutes, Magnet Brains was the
-- only channel present for all four, averaging 73 minutes against the
-- catalogue's 9. Its two playlists mirror the two NCERT books exactly.
--
-- The already-trusted board channels were checked first and none teaches Class
-- 10 English: Shobhit Nirwan (6 playlists), ExpHub (8), Digraj Singh Rajput
-- (28), NEEV Competishun (219, whose only English playlist is Class 9).
--
-- FIVE MISSING CHAPTERS. Enumerating the books showed the catalogue never had
-- NCERT First Flight 5 and 6 or Footprints 6, 8 and 10 at all:
--   The Hundred Dresses I, The Hundred Dresses II, The Making of a Scientist,
--   The Hack Driver, The Book That Saved the Earth.
-- They are created here and filled, and display_order is rewritten so all 21
-- chapters read in the order the two books print them.
--
-- VERIFICATION. Every one of the 29 ids was checked live and independently of
-- the scrape: oEmbed returns 200 with author_name "Magnet Brains" for all of
-- them, none is already in the catalogue, and each was confirmed
-- "playableInEmbed":true -- the site is an embedded player, so a video that
-- exists but refuses to embed would be a dead lesson. Durations are the real
-- ones. Display titles are hand-written and pass src/titleQuality.js.
--
-- TWO VIDEOS DELIBERATELY LEFT OUT: "Amanda" (Hgga0X9_yG0) and "Animals"
-- (0lgsPSZd1RE) are poem-only question-and-answer videos. Every chapter here is
-- named after its prose piece, so filing them would show a student a chapter
-- title that does not describe the video. The paired poems are covered anyway by
-- the combined full-chapter videos, which is how NCERT groups them.
--
-- Idempotent: the channel, chapters and courses are each looked up before being
-- created, videos upsert on youtube_video_id, and positions upsert. Re-running
-- changes nothing. Self-verifying, and wrapped in a transaction so a failed
-- assertion rolls the whole thing back.

begin;

do $magnet$
declare
  v_channel_id bigint;
  v_subject_id bigint := 11;   -- English
  v_category_id bigint := 4;   -- School Boards
  v_ff bigint;                 -- First Flight course
  v_fp bigint;                 -- Footprints Without Feet course
  v_video_id bigint;
  v_hd1 bigint;
  v_hd2 bigint;
  v_sci bigint;
  v_hack bigint;
  v_book bigint;
  r record;
begin
  -- ------------------------------------------------------------------
  -- 1. The institute
  -- ------------------------------------------------------------------
  select id into v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('Magnet Brains', 'UC3HS6gQ79jjn4xHxogw0HiA')
    returning id into v_channel_id;
  end if;

  -- Guard the premise: English really is a one-channel subject today. If a
  -- second institute already arrived, this file's rationale is stale and the
  -- numbers in the header are wrong, so stop and let a human re-read it.
  if (select count(distinct channel_id) from public.videos
       where subject_id = v_subject_id and channel_id <> v_channel_id) > 1 then
    raise exception 'English already has more than one other institute - re-check this file''s premise';
  end if;

  -- ------------------------------------------------------------------
  -- 2. The five chapters the catalogue never had
  -- ------------------------------------------------------------------
  -- Every lesson below is pinned to a chapter by hard-coded id, and section 2
  -- renumbers those ids. So prove the ids still mean what they meant when this
  -- file was written, before writing anything that depends on them.
  if not exists (select 1 from public.chapters where id = 226 and subject_id = v_subject_id and name = 'A Letter to God') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 226, 'A Letter to God';
  end if;
  if not exists (select 1 from public.chapters where id = 227 and subject_id = v_subject_id and name = 'Nelson Mandela: Long Walk to Freedom') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 227, 'Nelson Mandela: Long Walk to Freedom';
  end if;
  if not exists (select 1 from public.chapters where id = 228 and subject_id = v_subject_id and name = 'Two Stories about Flying') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 228, 'Two Stories about Flying';
  end if;
  if not exists (select 1 from public.chapters where id = 229 and subject_id = v_subject_id and name = 'From the Diary of Anne Frank') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 229, 'From the Diary of Anne Frank';
  end if;
  if not exists (select 1 from public.chapters where id = 230 and subject_id = v_subject_id and name = 'Glimpses of India') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 230, 'Glimpses of India';
  end if;
  if not exists (select 1 from public.chapters where id = 231 and subject_id = v_subject_id and name = 'Mijbil the Otter') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 231, 'Mijbil the Otter';
  end if;
  if not exists (select 1 from public.chapters where id = 232 and subject_id = v_subject_id and name = 'Madam Rides the Bus') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 232, 'Madam Rides the Bus';
  end if;
  if not exists (select 1 from public.chapters where id = 233 and subject_id = v_subject_id and name = 'The Sermon at Benares') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 233, 'The Sermon at Benares';
  end if;
  if not exists (select 1 from public.chapters where id = 234 and subject_id = v_subject_id and name = 'The Proposal') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 234, 'The Proposal';
  end if;
  if not exists (select 1 from public.chapters where id = 235 and subject_id = v_subject_id and name = 'A Triumph of Surgery') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 235, 'A Triumph of Surgery';
  end if;
  if not exists (select 1 from public.chapters where id = 236 and subject_id = v_subject_id and name = 'The Thief''s Story') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 236, 'The Thief''s Story';
  end if;
  if not exists (select 1 from public.chapters where id = 237 and subject_id = v_subject_id and name = 'The Midnight Visitor') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 237, 'The Midnight Visitor';
  end if;
  if not exists (select 1 from public.chapters where id = 238 and subject_id = v_subject_id and name = 'A Question of Trust') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 238, 'A Question of Trust';
  end if;
  if not exists (select 1 from public.chapters where id = 239 and subject_id = v_subject_id and name = 'Footprints Without Feet') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 239, 'Footprints Without Feet';
  end if;
  if not exists (select 1 from public.chapters where id = 240 and subject_id = v_subject_id and name = 'The Necklace') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 240, 'The Necklace';
  end if;
  if not exists (select 1 from public.chapters where id = 241 and subject_id = v_subject_id and name = 'Bholi') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 241, 'Bholi';
  end if;

  select id into v_hd1 from public.chapters
   where subject_id = v_subject_id and name = 'The Hundred Dresses I';
  if v_hd1 is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'The Hundred Dresses I', 'the-hundred-dresses-i', 5)
    returning id into v_hd1;
  end if;

  select id into v_hd2 from public.chapters
   where subject_id = v_subject_id and name = 'The Hundred Dresses II';
  if v_hd2 is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'The Hundred Dresses II', 'the-hundred-dresses-ii', 6)
    returning id into v_hd2;
  end if;

  select id into v_sci from public.chapters
   where subject_id = v_subject_id and name = 'The Making of a Scientist';
  if v_sci is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'The Making of a Scientist', 'the-making-of-a-scientist', 17)
    returning id into v_sci;
  end if;

  select id into v_hack from public.chapters
   where subject_id = v_subject_id and name = 'The Hack Driver';
  if v_hack is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'The Hack Driver', 'the-hack-driver', 19)
    returning id into v_hack;
  end if;

  select id into v_book from public.chapters
   where subject_id = v_subject_id and name = 'The Book That Saved the Earth';
  if v_book is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'The Book That Saved the Earth', 'the-book-that-saved-the-earth', 21)
    returning id into v_book;
  end if;

  -- Reading order of the two NCERT books, with the new chapters slotted in.
  update public.chapters set display_order = 1 where id = 226;
  update public.chapters set display_order = 2 where id = 227;
  update public.chapters set display_order = 3 where id = 228;
  update public.chapters set display_order = 4 where id = 229;
  update public.chapters set display_order = 5 where id = v_hd1;
  update public.chapters set display_order = 6 where id = v_hd2;
  update public.chapters set display_order = 7 where id = 230;
  update public.chapters set display_order = 8 where id = 231;
  update public.chapters set display_order = 9 where id = 232;
  update public.chapters set display_order = 10 where id = 233;
  update public.chapters set display_order = 11 where id = 234;
  update public.chapters set display_order = 12 where id = 235;
  update public.chapters set display_order = 13 where id = 236;
  update public.chapters set display_order = 14 where id = 237;
  update public.chapters set display_order = 15 where id = 238;
  update public.chapters set display_order = 16 where id = 239;
  update public.chapters set display_order = 17 where id = v_sci;
  update public.chapters set display_order = 18 where id = 240;
  update public.chapters set display_order = 19 where id = v_hack;
  update public.chapters set display_order = 20 where id = 241;
  update public.chapters set display_order = 21 where id = v_book;

  -- ------------------------------------------------------------------
  -- 3. The two courses, one per book
  -- ------------------------------------------------------------------
  select id into v_ff from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 English First Flight — Full Chapters';
  if v_ff is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 English First Flight — Full Chapters', 'Magnet Brains', v_channel_id,
       v_subject_id, v_category_id, 'full-course', 'hinglish', 'beginner',
       array['10th'], '10th', 'PLVLoWQFkZbhXv7Sj5rlnDgy2V-sV8E6Vc')
    returning id into v_ff;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_ff, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_ff, id from public.class_levels where slug = 'class-10';
  end if;

  select id into v_fp from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 English Footprints Without Feet — Full Chapters';
  if v_fp is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 English Footprints Without Feet — Full Chapters', 'Magnet Brains', v_channel_id,
       v_subject_id, v_category_id, 'full-course', 'hinglish', 'beginner',
       array['10th'], '10th', 'PLVLoWQFkZbhUPs5wpjgLlq2fEhWWDGHi6')
    returning id into v_fp;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_fp, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_fp, id from public.class_levels where slug = 'class-10';
  end if;

  -- ------------------------------------------------------------------
  -- 4. First Flight lessons
  -- ------------------------------------------------------------------
  for r in
    select * from (values
      (1, 'JhqV9jIVVYg', 'A Letter to God — Full Chapter Explanation and Summary', 'A Letter to God Full Chapter Explanation & Summary | Class 10 English Chapter 1 (2025-26)', 226, 8059),
      (2, 'VfRZ2gUKmIY', 'A Letter to God, Dust of Snow and Fire and Ice — Full Chapter', 'A Letter to God, Dust of Snow, Fire and Ice - Full Chapter | Class 10 English Chapter 1 | 2025-26', 226, 22520),
      (3, 'NKim-KNBd5g', 'Nelson Mandela: Long Walk to Freedom with A Tiger in the Zoo — Full Chapter', 'Nelson Mandela: Long Walk to Freedom, A Tiger in the Zoo - Full Chapter | Class 10 English Chapter 2', 227, 28162),
      (4, 'ps42mTP9Jws', 'Two Stories about Flying — Full Chapter Explanation', 'Two Stories About Flying Full Chapter Explanation | Class 10 English Chapter 3 (2025-26)', 228, 9573),
      (5, 'bQfH9cL2GHA', 'Two Stories about Flying — Questions and Answers (Part 1)', 'Two Stories About Flying Full Chapter (Question & Answers Part 1) | Class 10 English Ch3 (2025-26)', 228, 13634),
      (6, '_qd2VY1_UVM', 'Two Stories about Flying — Questions and Answers (Part 2)', 'Two Stories About Flying Full Chapter Que & Ans (Part 2) | Class 10 English Chapter 3 | CBSE 2025-26', 228, 7866),
      (7, 'EATUz5joXB0', 'Two Stories about Flying with How to Tell Wild Animals and The Ball Poem', 'Two Stories About Flying, How to Tell Wild Animals, The Ball Poem - Full Chapter | Class 10 English', 228, 29648),
      (8, '1Z8M6uG6eb0', 'From the Diary of Anne Frank — Full Chapter Explanation', 'From the Diary of Anne Frank Full Chapter Explanation | Class 10 English Chapter 4 (2025-26)', 229, 6897),
      (9, 'WaAsGamLUrM', 'From the Diary of Anne Frank — Questions and Answers', 'From the Diary of Anne Frank-Full Chapter Question & Answers | Class 10 English Chapter 4 (2025-26)', 229, 13544),
      (10, 'PF_eFZcfC_4', 'From the Diary of Anne Frank with Amanda — Full Chapter Explanation', 'From The Diary of Anne Frank, Amanda! - Full Chapter Explanation | Class 10 English Ch 4 | 2025-26', 229, 23133),
      (11, 'xVAem2AWNgk', 'The Hundred Dresses I — Full Chapter Explanation and NCERT Solutions', 'The Hundred Dresses I - Full Chapter Explanation & NCERT Solutions | Class 10 English Ch 5 | 2025-26', v_hd1, 14050),
      (12, 'uV0MsRmnXoA', 'The Hundred Dresses I — Questions and Answers', 'The Hundred Dresses -I Full Chapter Question & Answers | Class 10 English Chapter 5 (2025-26)', v_hd1, 9319),
      (13, 'Hw4IHPhEl9Q', 'The Hundred Dresses II — Full Chapter Explanation', 'The Hundred Dresses - II Full Chapter Explanation | Class 10 English Chapter 6 (2025-26)', v_hd2, 6673),
      (14, 'pFVvu24gPW8', 'The Hundred Dresses II — Questions and Answers', 'The Hundred Dresses - II Full Chapter Question Answers | Class 10 English Chapter 6 | CBSE 2025-26', v_hd2, 13574),
      (15, 'bjwlKArJl4Q', 'Glimpses of India with The Trees — Full Chapter Explanation', 'Glimpses of India, The Trees - Full Chapter Explanation  | Class 10 English Chapter 7 | 2025-26', 230, 35193),
      (16, 'Dvwr3LQU1QA', 'Mijbil the Otter with Fog — Full Chapter Explanation and NCERT Solutions', 'Mijbil the Otter, Fog - Full Chapter Explanation & NCERT Solutions | Class 10 English Ch 8 | 2025-26', 231, 18972),
      (17, '0eAshUtHdAg', 'Madam Rides the Bus with The Tale of Custard the Dragon — Full Chapter', 'Madam Rides the Bus, The Tale of Custard the Dragon - Full Chapter | Class 10 English Ch 9 | 2025-26', 232, 25176),
      (18, 'yBYjNIw9O38', 'The Sermon at Benares with For Anne Gregory — Full Chapter Explanation', 'The Sermon at Benares & For Anne Gregory - Full Chapter Explanation & NCERT Sol | Class 10 (2025-26)', 233, 22575),
      (19, 'oKZPYlJecco', 'The Proposal — Full Chapter Explanation and NCERT Solutions', 'The Proposal - Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 11 | 2025-26', 234, 24774)
    ) as t(pos, yt_id, title, source_title, chapter_id, secs)
  loop
    insert into public.videos
      (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
       category_id, duration_seconds, embedding_status, last_verified_at)
    values
      (r.yt_id, r.title, r.source_title, v_channel_id, v_subject_id, r.chapter_id,
       v_category_id, r.secs, 'embeddable', now())
    on conflict (youtube_video_id) do update set last_verified_at = now()
    returning id into v_video_id;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_ff, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    -- Without these two junction rows the lesson is invisible to goal-scoped
    -- search: src/useScopedSearch.js inner-joins video_learning_goals. This is
    -- the defect that left 670 lessons unsearchable
    -- (backfill_video_taxonomy_junctions_2026-08-03.sql), and
    -- src/importTaxonomyCompleteness.test.js now guards against repeating it.
    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_ff
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_ff
    on conflict do nothing;
  end loop;

  -- ------------------------------------------------------------------
  -- 5. Footprints Without Feet lessons
  -- ------------------------------------------------------------------
  for r in
    select * from (values
      (1, 'Dsv4lMSbBEc', 'A Triumph of Surgery — Full Chapter Explanation and NCERT Solutions', 'A Triumph of Surgery Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 1 2022-23', 235, 15190),
      (2, 'KCiBvwJYPhM', 'The Thief''s Story — Full Chapter Explanation and NCERT Solutions', 'The Thief’s Story Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 2 (2022-23)', 236, 10950),
      (3, 'PDdcPWPEv8M', 'The Midnight Visitor — Full Chapter Explanation and NCERT Solutions', 'The Midnight Visitor - Full Cha. Explanation & NCERT Solutions | Class 10 English Chapter 3 -2022-23', 237, 13441),
      (4, 'nwSyBBiwC_U', 'A Question of Trust — Full Chapter Explanation and NCERT Solutions', 'A Question of Trust - Full Chapter Explanation & NCERT Solutions | Class 10 English Ch 4 (2022-23)', 238, 15921),
      (5, 'VQQZxDlEmUE', 'Footprints Without Feet — Full Chapter Explanation and NCERT Solutions', 'Footprints Without Feet Full Chapter Explanation & NCERT Solutions | Class 10 English Ch 5 (2022-23)', 239, 14691),
      (6, 'M_Xb9owaNtY', 'The Making of a Scientist — Full Chapter Explanation and NCERT Solutions', 'The Making of a Scientist Full Chapter Explanation & NCERT Sol | Class 10 English Cha 6 (2022-23)', v_sci, 16031),
      (7, 'Z-xrWrmud0o', 'The Necklace — Full Chapter Explanation and NCERT Solutions', 'The Necklace Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 7 (2022-23)', 240, 17426),
      (8, 'kYeZxsNKVgw', 'The Hack Driver — Full Chapter Explanation and NCERT Solutions', 'The Hack Driver Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 8 | CBSE 2024', v_hack, 19565),
      (9, 'dcaMkIDU4Uk', 'Bholi — Full Chapter Explanation and NCERT Solutions', 'Bholi Full Chapter Explanation & NCERT Solutions | Class 10 English Chapter 9 (2022-23)', 241, 17155),
      (10, 'tXI2MVY5STo', 'The Book That Saved the Earth — Full Chapter Explanation', 'The Book That Saved the Earth Full Chapter Explanation,Que Ans | Class 10 English Chapter 10-2022-23', v_book, 14312)
    ) as t(pos, yt_id, title, source_title, chapter_id, secs)
  loop
    insert into public.videos
      (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
       category_id, duration_seconds, embedding_status, last_verified_at)
    values
      (r.yt_id, r.title, r.source_title, v_channel_id, v_subject_id, r.chapter_id,
       v_category_id, r.secs, 'embeddable', now())
    on conflict (youtube_video_id) do update set last_verified_at = now()
    returning id into v_video_id;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_fp, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_fp
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_fp
    on conflict do nothing;
  end loop;
end
$magnet$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_subject_id bigint := 11;
  v_mb bigint;
  v_chapters int;
  v_lessons int;
  v_two int;
  v_empty int;
  v_unfiled int;
  v_badchan int;
  v_orders int;
  v_median int;
begin
  select id into strict v_mb from public.institutes_channels where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  select count(*) into v_chapters from public.chapters where subject_id = v_subject_id;
  if v_chapters <> 21 then raise exception 'expected 21 English chapters, found %', v_chapters; end if;

  select count(*) into v_lessons from public.videos where subject_id = v_subject_id and channel_id = v_mb;
  if v_lessons <> 29 then raise exception 'expected 29 Magnet Brains English lessons, found %', v_lessons; end if;

  -- No English chapter may be left empty -- including the five just created.
  select count(*) into v_empty
    from public.chapters c
   where c.subject_id = v_subject_id
     and not exists (select 1 from public.videos v where v.chapter_id = c.id);
  if v_empty <> 0 then raise exception '% English chapter(s) have no lessons', v_empty; end if;

  -- The point of the exercise: chapters a student can compare two institutes in.
  select count(*) into v_two from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = v_subject_id
     group by c.id having count(distinct v.channel_id) >= 2
  ) s;
  if v_two < 16 then raise exception 'expected at least 16 English chapters with two institutes, found %', v_two; end if;

  -- Every new lesson must be reachable by goal-scoped search and by class level.
  select count(*) into v_unfiled
    from public.videos v
   where v.channel_id = v_mb
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then raise exception '% Magnet Brains lesson(s) are unfiled', v_unfiled; end if;

  -- Institute-consistency guard must still hold.
  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then raise exception '% lesson(s) sit in a course from another institute', v_badchan; end if;

  -- display_order must be exactly 1..21, each used once.
  select count(*) into v_orders from (
    select display_order from public.chapters where subject_id = v_subject_id
     group by display_order having count(*) > 1
  ) d;
  if v_orders <> 0 then raise exception 'English chapters share a display_order'; end if;
  select count(*) into v_orders from public.chapters
   where subject_id = v_subject_id and display_order between 1 and 21;
  if v_orders <> 21 then raise exception 'English display_order is not a clean 1..21 run'; end if;

  select percentile_disc(0.5) within group (order by mins)::int into v_median from (
    select coalesce(sum(v.duration_seconds), 0) / 60 as mins
      from public.chapters c left join public.videos v on v.chapter_id = c.id
     where c.subject_id = v_subject_id group by c.id
  ) m;

  raise notice 'SELF-TEST PASSED: English now % chapters, % with two institutes, median % minutes per chapter (was 9).',
    v_chapters, v_two, v_median;
end
$verify$;

commit;
