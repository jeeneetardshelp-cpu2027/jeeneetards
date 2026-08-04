-- phys_mohit_tyagi_math_tools_2026-08-04.sql
--
-- Adds Mohit Tyagi's 35-lecture "Mathematical tools / Basic Math" series to
-- Physics chapter 80, Basic Mathematics for Physics. Requested by the site owner,
-- who pointed at the playlist directly:
--   https://youtube.com/playlist?list=PL_A4M5IAkMaev6ovGTwhfLLidWzCveoHZ
--
-- WHY IT MATTERS. Chapter 80 already holds 17 lessons, but they come from only
-- three institutes -- Physics Wallah (JEE Wallah and Competition Wallah are the
-- same operation), ALLEN, and eSaral. Mohit Tyagi is Competishun, a fourth, and
-- has no course in this chapter today. It is also the most granular treatment of
-- the chapter here by a wide margin: every other course teaches it as a handful
-- of long one-shots, where this is 35 short topic-sized lectures a student can
-- pick a single idea out of -- "Chain Rule of Differentiation" on its own,
-- "Unit Vector" on its own.
--
-- 35 lessons, 12.6 hours.
--
-- TITLES ARE REWRITTEN, and they had to be. The source titles look like
--   "#7- Equation of Straight Line | Mathematical tools | Physics for IIT-JEE Main and Advanced"
-- which src/titleQuality.js rejects twice over: a leading episode number, and a
-- pipe-separated keyword tail. Only the topic is kept. Every original is
-- preserved verbatim in videos.source_title, so the rewrite is reversible with
--   update public.videos set title = source_title where <this course's lessons>;
--
-- This is JEE content, so it takes the JEE learning goal and NO board row --
-- src/migrations/import_playlist_v4.sql:169 rejects a board on non-school
-- content, and the School Boards journey is the only thing boards scope.
--
-- Class levels follow this channel's own convention for Class 11 chapters:
-- 11th + Dropper, matching e.g. course 29 (Work, Power and Energy).
--
-- VERIFICATION: all 35 ids checked live and independently of the playlist
-- scrape -- oEmbed returns 200 with author_name "Mohit Tyagi", the watch page
-- reports playableInEmbed true and channel UCpyc1eTpM1cA3P0ZWym4clw,
-- durations are real, and neither the ids nor the rewritten titles already exist
-- in the catalogue.
--
-- Idempotent and self-verifying, wrapped in a transaction.

begin;

do $mathtools$
declare
  v_channel_id bigint;
  v_chapter_id bigint := 80;
  v_subject_id bigint := 1;   -- Physics
  v_category_id bigint := 1;  -- JEE
  v_playlist_id bigint;
  v_video_id bigint;
  r record;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';

  if not exists (select 1 from public.chapters
                  where id = v_chapter_id and subject_id = v_subject_id
                    and name = 'Basic Mathematics for Physics') then
    raise exception 'chapter 80 is not the Physics chapter "Basic Mathematics for Physics" - refusing to file lessons against a stale id';
  end if;

  select id into v_playlist_id from public.playlists
   where channel_id = v_channel_id and title = 'Mathematical Tools and Basic Maths — ABJ Sir';
  if v_playlist_id is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Mathematical Tools and Basic Maths — ABJ Sir', 'ABJ Sir', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hinglish', 'advanced', array['11th', 'Dropper'], '11th', 'PL_A4M5IAkMaev6ovGTwhfLLidWzCveoHZ')
    returning id into v_playlist_id;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_playlist_id, id from public.learning_goals where slug = 'jee';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_playlist_id, id from public.class_levels where slug in ('class-11', 'dropper');
    -- Deliberately NO playlist_boards row: boards apply only to School Boards
    -- content and import_playlist_v4.sql rejects the combination.
  end if;

  for r in
    select * from (values
      (1, 'NAlLWcfQHrA', 'Introduction to Functions', '#1-Mathematical tools/Basic Math | Introduction of functions | Physics for IIT JEE main / Advance', 1504),
      (2, 'f8qQBzJOrro', 'Examples on Functions', '#2-Example on Functions | Mathematical tools/Basic mathematics  |  Physics for IIT-JEE Main Advanced', 1326),
      (3, 'oLEoCUsI_JM', 'Basics of Trigonometry', '#3- Basics of trigonometry  | Mathematical tools /Basic Math | Physics for IIT-JEE Main and Advanced', 1296),
      (4, 'mWV_ZstQFjs', 'Trigonometric Ratios of Higher Angles', '#4-Trigonometric Ratios of Higher Angles |Mathematical tools | Physics for IIT-JEE Main and Advanced', 2236),
      (5, 'WNX89aIrtG0', 'General Trigonometric Formulae', '#5- General Trigonometric Formula Sin 15 | Mathematical tools |Physics for IIT-JEE Main and Advanced', 1360),
      (6, '7dWQ9YZW1IY', 'Sine Law and Cosine Law', '#6 sine law & cosine law in trigonometry | Mathematical tools |Physics for IIT-JEE Main and Advanced', 956),
      (7, 'vNIHUxsVO9o', 'Equation of a Straight Line', '#7- Equation of Straight Line | Mathematical tools | Physics for IIT-JEE Main and Advanced', 1063),
      (8, '4i2uxEWoUzc', 'Concept of Differentiation', '#8- Concept of differentiation | Mathematical tools | Physics for IIT-JEE Main and Advanced', 1386),
      (9, 'eOc_-cj-E8E', 'Geometrical Representation of Differentiation', '#9- Geometrical representation of differentiation | Mathematical tools | IITJEE Main/Advanced', 768),
      (10, 'Zhb_8ZhuoCk', 'Notations Used in Differentiation', '#10-Notations | Mathematical tools| basic maths | mathematical tools | physics | IIT-JEE', 145),
      (11, 'nEFmIsjmUhw', 'Differentiation Formulae with Derivation', '#11- Differentiation formulas with derivation | basic maths | mathematical tools | physics | IIT-JEE', 1651),
      (12, '8TexFzMMmwc', 'All Differentiation Formulae', '#12-Differentiation all formula | basic maths | mathematical tools| physics | IIT-advanced, JEE main', 920),
      (13, 'nqQ2MXQn6EE', 'Rules of Differentiation (Part 1)', '#13- Rules of differentiation basic maths | mathematical tools | physics| JEE-main | IIT advanced', 763),
      (14, '8tDXLa7YnzE', 'Rules of Differentiation (Part 2)', '#14- Rules of differentiation | mathematical tools | Basic Maths  | JEE main advance NEET | Class11', 1413),
      (15, 'vjGgO55Za1M', 'Chain Rule of Differentiation', '#15 - Chain Rule Differentiation | Basic Maths | Mathematical tools| IIT Advance | JEE Main', 1657),
      (16, 'RFSYpB9XbJU', 'Double Differentiation', '#16 - Double Differentiation | Basic Maths | mathematical tools | JEE main | IIT advance | IIT JEE', 390),
      (17, 'odjEcwc6puw', 'Differentiation Value at a Point', '#17- Differentiation value at a point | Basic Maths | Mathematical tools | IIT advanced | JEE main', 509),
      (18, 'eqmZeDWw-vM', 'Differentiation of an Implicit Function', '#18- Differentiation of implicit function | Basic Math | Mathematical tools | IIT Advanced', 635),
      (19, '6CQg42hcp3M', 'Differentiation as Rate of Change', '#19 - Differentiation as rate of change | Basic math | mathematical tools | IIT advanced | JEE main', 790),
      (20, 'CV48M3NZLC8', 'Differentiation as Rate of Change: Examples', '#20- Differentiation as rate of change examples | Basic math | mathematical tools | IIT advanced', 919),
      (21, 'ZJ7R7htvCms', 'Increasing and Decreasing Functions', '#21 - Increasing Decreasing Functions | mathematical tools | basic maths | physics | IIT advanced', 504),
      (22, 'Locn5Y9Xp-0', 'Maxima and Minima', '#22- maxima and minima | mathematical tools | basic math | physics | IIT advanced|JEE main | CBSE', 2538),
      (23, 'AJMHRZJzFaI', 'Maxima and Minima: Examples', '#23 - Example on  maxima | mathematical tools | basic math | Physics | IIT advanced | JEE Main', 742),
      (24, 'C-4hhDLXDoo', 'Introduction to Integration', '#24 - Integration | Mathematical tools | basic math | physics | IIT advanced| JEE main | NCERT', 1574),
      (25, 'W0GzhprYsp4', 'Constant Multiplication Rule in Integration', '#25- Constant multiplication rule integration | mathematical tools | basic math | Physics', 349),
      (26, '1Ok39Wx126M', 'Integration by Substitution', '#26 - Integration by substitution | mathematical tools | basic math | Physics | IIT advanced | JEE', 1744),
      (27, '2Lwt4x6LEsM', 'Definite Integration and Area Under the Curve', '#27 - Definite integration | area under the curve | mathematical tools | IIT advanced | JEE main', 1317),
      (28, 'cooR9L3wa7c', 'Properties of Vectors', '#28 - Properties of vectors | mathematical tools | basic math | physics | IIT advanced | JEE main', 1961),
      (29, 'IhE84X4oOkw', 'Unit Vector', '#29 - Unit vector | Basic math | Mathematical tools | Physics | IIT advanced | JEE main | CBSE', 607),
      (30, 'xb2ybnjDNRo', 'Multiplying a Vector by a Scalar', '#30 - Multiplication of vector with scalar | Basic math | Mathematical tools | IIT advanced', 427),
      (31, 'O1NmjdpBA9E', 'Addition of Vectors', '#31- Addition of vectors | basic math | mathematical tools | physics | IIT advanced | JEE main', 3861),
      (32, '3m-AKyC5lYY', 'Subtraction of Vectors', '#32- Subtraction of vectors | mathematical tools | basic math | physics | IIT advanced | JEE main', 1689),
      (33, 'PAzUF3462a4', 'Components of a Vector and Resolution of Vectors', '#33 - components of vector | resolution of vectors | Mathematical tools | IIT advanced | JEE main', 2586),
      (34, 'y89zyc7ESxo', 'Dot Product (Scalar Product)', '#34 - Dot product | scalar product | basic math | mathematical tools | physics | IIT advanced | JEE', 1688),
      (35, '8vPsqiU66PQ', 'Vector Product (Cross Product)', '#35 - Vector product | cross product | Basic math | Mathematical tools | IIT advanced | JEE main', 1911)
    ) as t(pos, yt_id, title, source_title, secs)
  loop
    insert into public.videos
      (youtube_video_id, title, source_title, channel_id, subject_id, chapter_id,
       category_id, duration_seconds, embedding_status, last_verified_at)
    values
      (r.yt_id, r.title, r.source_title, v_channel_id, v_subject_id, v_chapter_id,
       v_category_id, r.secs, 'embeddable', now())
    on conflict (youtube_video_id) do update set last_verified_at = now()
    returning id into v_video_id;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    -- Without these two the lesson is invisible to goal-scoped search:
    -- src/useScopedSearch.js inner-joins video_learning_goals.
    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_playlist_id
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_playlist_id
    on conflict do nothing;
  end loop;
end
$mathtools$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_ch bigint;
  v_course bigint;
  v_lessons int;
  v_pos int;
  v_unfiled int;
  v_badchan int;
  v_boards int;
  v_inst int;
begin
  select id into strict v_ch from public.institutes_channels where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';
  select id into strict v_course from public.playlists
   where channel_id = v_ch and title = 'Mathematical Tools and Basic Maths — ABJ Sir';

  select count(*) into v_lessons from public.playlist_videos where playlist_id = v_course;
  if v_lessons <> 35 then raise exception 'expected 35 lessons in the course, found %', v_lessons; end if;

  -- positions must be a clean 1..n run, in the order the series teaches
  select count(*) into v_pos from public.playlist_videos
   where playlist_id = v_course and position between 1 and 35;
  if v_pos <> 35 then raise exception 'course positions are not a clean 1..35 run'; end if;

  -- every lesson must sit in chapter 80
  if exists (select 1 from public.playlist_videos pv
             join public.videos v on v.id = pv.video_id
             where pv.playlist_id = v_course and v.chapter_id <> 80) then
    raise exception 'a lesson in this course is not filed under chapter 80';
  end if;

  select count(*) into v_unfiled
    from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
   where pv.playlist_id = v_course
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then raise exception '% lesson(s) are unfiled and invisible to search', v_unfiled; end if;

  -- exam content must NOT carry a board
  select count(*) into v_boards from public.playlist_boards where playlist_id = v_course;
  if v_boards <> 0 then raise exception 'a JEE course gained a board row'; end if;

  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then raise exception '% lesson(s) sit in a course from another institute', v_badchan; end if;

  -- the point: chapter 80 now offers a fourth institute.
  select count(distinct v.channel_id) into v_inst from public.videos v where v.chapter_id = 80;
  raise notice 'SELF-TEST PASSED: % lessons added to Basic Mathematics for Physics; the chapter now draws on % channels.',
    v_lessons, v_inst;
end
$verify$;

commit;
