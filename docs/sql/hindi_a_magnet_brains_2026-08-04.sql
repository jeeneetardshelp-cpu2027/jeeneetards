-- hindi_a_magnet_brains_2026-08-04.sql
--
-- Hindi A was the worst-served subject in the catalogue. Measured against
-- production before this file:
--
--     17 chapters, 17 lessons. EVERY chapter held exactly one lesson, all from
--     a single institute (Hindi Adhyapak). Median 27 minutes per chapter, and
--     the thinnest -- फसल -- was 9 minutes for a whole chapter.
--
-- Nothing to compare, nowhere to go if that one teacher does not click.
--
-- SOURCE: Magnet Brains (UC3HS6gQ79jjn4xHxogw0HiA), already in this catalogue
-- for English and Social Science. Its two Class 10 Hindi Course A playlists
-- mirror the NCERT books Kshitij and Kritika. Both were enumerated in full
-- (18 + 5 = 23 videos); 16 are imported here and 7 are deliberately held back.
--
-- WHAT IS HELD BACK, AND WHY THIS FILE WILL NOT DECIDE IT. Seven videos teach
-- chapters this catalogue does not have:
--     GQNP3d2KArY  Dev: Savaiya and Kavitt (देव)
--     8aJ__Aq-WL8  Chhaya Mat Chhuna (छाया मत छूना)
--     g3gz1eCxFeQ  Kanyadaan (कन्यादान)
--     zhyvLnBeQl0  Manviya Karuna Ki Divya Chamak (मानवीय करुणा की दिव्य चमक)
--     xQqqeF-CHrQ  Stri Shiksha ke Virodhi Kutarkon ka Khandan (स्त्री शिक्षा के विरोधी कुतर्कों का खंडन)
--     bCDZdhH_XsI  George Pancham Ki Naak (जॉर्ज पंचम की नाक)
--     oXf2k9FtpYE  Ehi Thaiya Jhulni Herani Ho Rama (एही ठैयाँ झुलनी हेरानी हो रामा)
-- They are real, reachable, Magnet Brains videos -- that much is verified. What
-- is NOT verified is whether these chapters are still on the CBSE Course A
-- syllabus. Every argument that they were rationalised out and survive only in
-- state-board syllabi comes from publisher video titles and coaching websites.
-- NOBODY HAS READ THE ACTUAL CBSE SYLLABUS DOCUMENT. Creating seven chapters on
-- that basis would put content in front of students that may not be examinable,
-- and deleting them later is worse than never adding them. Deepening chapters
-- that already exist needs no such ruling, so that is all this file does.
--
-- TWO CHAPTERS GET NO LESSON HERE, and it is a real limitation rather than an
-- oversight. NCERT groups Kshitij chapter 5 as उत्साह + अट नहीं रही है and
-- chapter 6 as यह दंतुरित मुसकान + फसल, and Magnet Brains teaches each pair in
-- one video. This catalogue splits all four into separate chapters, and a lesson
-- can carry only one chapter_id. Each combined video is therefore filed under
-- the first of its pair, with BOTH poems named in the display title -- so
-- अट नहीं रही है (262) and फसल (264) stay single-institute by chapter, but a
-- student searching either poem still reaches the lesson, because search matches
-- on title.
--
-- Result: 15 of 17 chapters gain a second independent teaching voice.
--
-- TITLES follow the convention this subject already uses -- transliteration
-- first, Devanagari in brackets, e.g. "Surdas Ke Pad (सूरदास के पद)" -- so both
-- scripts find the lesson. Note that Magnet Brains' own chapter NUMBERS are
-- unreliable and its English titles are sometimes machine-translated (one reads
-- "The family of scoundrels opposing women's education"); everything below is
-- mapped by chapter NAME, never by the publisher's numbering.
--
-- VERIFICATION: all 16 ids checked live -- oEmbed author_name "Magnet Brains",
-- playableInEmbed true, channel UC3HS6gQ79jjn4xHxogw0HiA, real durations,
-- and no id or display title already in the catalogue. The 7 held-back ids were
-- confirmed real too, so the decision above rests on syllabus doubt, not on bad
-- data. 7.4 hours of teaching.
--
-- language is 'hindi', not 'hinglish', matching the existing Hindi A course.
--
-- Idempotent and self-verifying, wrapped in a transaction.

begin;

do $hindi$
declare
  v_channel_id bigint;
  v_subject_id bigint := 13;  -- Hindi A
  v_category_id bigint := 4;  -- School Boards
  v_video_id bigint;
  v_kshitij bigint;
  v_kritika bigint;
  r record;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  -- Every lesson is pinned to a chapter by id; prove the ids still mean what
  -- they meant when this file was written.
  if not exists (select 1 from public.chapters where id = 258 and subject_id = v_subject_id and name = 'सूरदास के पद') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 258, 'सूरदास के पद';
  end if;
  if not exists (select 1 from public.chapters where id = 259 and subject_id = v_subject_id and name = 'राम-लक्ष्मण-परशुराम संवाद') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 259, 'राम-लक्ष्मण-परशुराम संवाद';
  end if;
  if not exists (select 1 from public.chapters where id = 260 and subject_id = v_subject_id and name = 'आत्मकथ्य') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 260, 'आत्मकथ्य';
  end if;
  if not exists (select 1 from public.chapters where id = 261 and subject_id = v_subject_id and name = 'उत्साह') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 261, 'उत्साह';
  end if;
  if not exists (select 1 from public.chapters where id = 263 and subject_id = v_subject_id and name = 'यह दंतुरित मुसकान') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 263, 'यह दंतुरित मुसकान';
  end if;
  if not exists (select 1 from public.chapters where id = 265 and subject_id = v_subject_id and name = 'संगतकार') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 265, 'संगतकार';
  end if;
  if not exists (select 1 from public.chapters where id = 266 and subject_id = v_subject_id and name = 'नेताजी का चश्मा') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 266, 'नेताजी का चश्मा';
  end if;
  if not exists (select 1 from public.chapters where id = 267 and subject_id = v_subject_id and name = 'बालगोबिन भगत') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 267, 'बालगोबिन भगत';
  end if;
  if not exists (select 1 from public.chapters where id = 268 and subject_id = v_subject_id and name = 'लखनवी अंदाज़') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 268, 'लखनवी अंदाज़';
  end if;
  if not exists (select 1 from public.chapters where id = 269 and subject_id = v_subject_id and name = 'एक कहानी यह भी') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 269, 'एक कहानी यह भी';
  end if;
  if not exists (select 1 from public.chapters where id = 270 and subject_id = v_subject_id and name = 'नौबतखाने में इबादत') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 270, 'नौबतखाने में इबादत';
  end if;
  if not exists (select 1 from public.chapters where id = 271 and subject_id = v_subject_id and name = 'संस्कृति') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 271, 'संस्कृति';
  end if;
  if not exists (select 1 from public.chapters where id = 272 and subject_id = v_subject_id and name = 'माता का आँचल') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 272, 'माता का आँचल';
  end if;
  if not exists (select 1 from public.chapters where id = 273 and subject_id = v_subject_id and name = 'साना-साना हाथ जोड़ि') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 273, 'साना-साना हाथ जोड़ि';
  end if;
  if not exists (select 1 from public.chapters where id = 274 and subject_id = v_subject_id and name = 'मैं क्यों लिखता हूँ') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 274, 'मैं क्यों लिखता हूँ';
  end if;

  -- ---- Kshitij ----
  select id into v_kshitij from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Hindi Kshitij (क्षितिज) — Full Chapters';
  if v_kshitij is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Hindi Kshitij (क्षितिज) — Full Chapters', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hindi', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhW4sWRUHXJPSM8Nv14aA-O_');
    select id into v_kshitij from public.playlists
     where channel_id = v_channel_id and title = 'Class 10 Hindi Kshitij (क्षितिज) — Full Chapters';

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_kshitij, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_kshitij, id from public.class_levels where slug = 'class-10';
    -- Without this the course is invisible on every board-scoped Browse page.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_kshitij, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'tDAiwZHBSTQ', 'Surdas Ke Pad (सूरदास के पद) — Full Chapter', 'Surdas Ke Pad Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kshitij Part 2 Chapter 1 (2022-23)', 258, 2466),
      (2, '27iv4oSV0Wg', 'Ram Lakshman Parshuram Samvad (राम-लक्ष्मण-परशुराम संवाद) — Full Chapter', 'Ram Lakshman Parshuram Samvad Full Ch Class 10 Hindi | CBSE Class 10 Kshitij Part 2 Ch 2 (2022-23)', 259, 3255),
      (3, 'EvyO_nB04tQ', 'Aatmkathya (आत्मकथ्य) — Full Chapter', 'Aatmkathya Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kshitij Part 2 Chapter 4 (2022-23)', 260, 1382),
      (4, '3muelsKohRA', 'Utsah aur At Nahi Rahi Hai (उत्साह और अट नहीं रही है) — Full Chapter', 'Utsah Aur At Nahi Rahi Full Chapter Class 10 Hindi | Class 10 Hindi Kshitij Part 2 Ch 5 (2022-23)', 261, 1146),
      (5, 'd1jMx7TCy5w', 'Yah Danturit Muskan aur Fasal (यह दंतुरित मुसकान और फसल) — Full Chapter', 'Yah Danturit Muskan Aur Fasal Full Chapter Class 10 Hindi | Class 10 Kshitij Part 2 Ch 6 (2022-23)', 263, 1261),
      (6, 'SlPX0RjMmUY', 'Sangatkar (संगतकार) — Full Chapter', 'Sangatkar - Full Chapter | CBSE Class 10 Hindi Kshitij Part 2 Chapter 9 (2022-23)', 265, 1349),
      (7, 'VKHeYdpDOoY', 'Netaji Ka Chashma (नेताजी का चश्मा) — Full Chapter', 'Netaji Ka Chashma Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kshitij Part 2 Ch10 (2022-23)', 266, 1301),
      (8, 'kn-7XBza4yY', 'Netaji Ka Chashma (नेताजी का चश्मा) — Questions and Answers', 'Netaji Ka Chashma - MCQs and Question Answers | Class 10 Hindi Chapter 10 (2022-23)', 266, 1321),
      (9, 'x_BAV7bA1TQ', 'Balgobin Bhagat (बालगोबिन भगत) — Full Chapter', 'Balgobin Bhagat Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kshitij Part 2 Chapter 11(2022-23)', 267, 1618),
      (10, '6gq2d1a9M9Y', 'Lakhnavi Andaaz (लखनवी अंदाज़) — Full Chapter', 'Class 10 Hindi Chapter 12 | Lakhnavi Andaaz Full Chapter Explanation & Exercise 2022-23 2022-23', 268, 967),
      (11, '6O27fSmr-G8', 'Ek Kahani Yah Bhi (एक कहानी यह भी) — Full Chapter', 'Ek Kahani Yeh Bhi Full Chapter Class 10 Hindi | Class 10 Hindi Kshitij Part 2 Chapter 14 (2022-23)', 269, 1173),
      (12, 'XqkOaEAod7M', 'Naubatkhane Mein Ibadat (नौबतखाने में इबादत) — Full Chapter', 'Naubat khane Me Ibadat Full Chapter Class 10 Hindi | Class 10 Hindi Kshitij Part 2 Ch 16 (2022-23)', 270, 1526),
      (13, '8PJf2Oz5mM8', 'Sanskriti (संस्कृति) — Full Chapter', 'Sanskriti - Full Chapter | Class 10 Hindi Kshitij Part 2 Chapter 17 (2022-23)', 271, 1459)
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
    values (v_kshitij, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_kshitij
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_kshitij
    on conflict do nothing;
  end loop;

  -- ---- Kritika ----
  select id into v_kritika from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Hindi Kritika (कृतिका) — Full Chapters';
  if v_kritika is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Hindi Kritika (कृतिका) — Full Chapters', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hindi', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhWCYR_NgEsb0XBeepcTpbrd');
    select id into v_kritika from public.playlists
     where channel_id = v_channel_id and title = 'Class 10 Hindi Kritika (कृतिका) — Full Chapters';

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_kritika, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_kritika, id from public.class_levels where slug = 'class-10';
    -- Without this the course is invisible on every board-scoped Browse page.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_kritika, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'bgPgLxc2aV8', 'Mata Ka Aanchal (माता का आँचल) — Full Chapter', 'Mata ka Aanchal Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kritika Part 2 Chapter 1 (2022-23)', 272, 1945),
      (2, 'mKXY5pPoQ64', 'Sana Sana Hath Jodi (साना-साना हाथ जोड़ि) — Full Chapter', 'Sana Sana Haath Jodi Full Chapter Class 10 Hindi | Class 10 Hindi Kritika Part 2 Chapter 3 (2022-23)', 273, 2841),
      (3, 'E8yV9hs4zSU', 'Main Kyon Likhta Hun (मैं क्यों लिखता हूँ) — Full Chapter', 'Main Kyon Likhta Hun Full Chapter Class 10 Hindi | CBSE Class 10 Hindi Kritika Part 2 Ch 5 (2022-23)', 274, 1734)
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
    values (v_kritika, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_kritika
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_kritika
    on conflict do nothing;
  end loop;

end
$hindi$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_mb bigint;
  v_lessons int;
  v_courses int;
  v_boardless int;
  v_unfiled int;
  v_badchan int;
  v_two int;
  v_held int;
begin
  select id into strict v_mb from public.institutes_channels where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  select count(*) into v_lessons from public.videos where subject_id = 13 and channel_id = v_mb;
  if v_lessons <> 16 then raise exception 'expected 16 Magnet Brains Hindi A lessons, found %', v_lessons; end if;

  select count(*) into v_courses from public.playlists where subject_id = 13 and channel_id = v_mb;
  if v_courses <> 2 then raise exception 'expected 2 courses, found %', v_courses; end if;

  select count(*) into v_boardless
    from public.playlists p
   where p.subject_id = 13 and p.channel_id = v_mb
     and not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id);
  if v_boardless <> 0 then raise exception '% course(s) have no board row and would be invisible on Browse', v_boardless; end if;

  select count(*) into v_unfiled
    from public.videos v
   where v.channel_id = v_mb and v.subject_id = 13
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then raise exception '% lesson(s) are unfiled and invisible to search', v_unfiled; end if;

  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then raise exception '% lesson(s) sit in a course from another institute', v_badchan; end if;

  -- The point of the exercise.
  select count(*) into v_two from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 13
     group by c.id having count(distinct v.channel_id) >= 2
  ) s;
  if v_two <> 15 then raise exception 'expected exactly 15 Hindi A chapters with two institutes, found %', v_two; end if;

  -- The chapter count must NOT have changed. This file deliberately creates no
  -- chapter, and a future edit that quietly adds one should fail here.
  if (select count(*) from public.chapters where subject_id = 13) <> 17 then
    raise exception 'Hindi A no longer has exactly 17 chapters - this file must not create any';
  end if;

  -- None of the seven held-back videos may have been imported.
  select count(*) into v_held from public.videos
   where youtube_video_id in ('GQNP3d2KArY', '8aJ__Aq-WL8', 'g3gz1eCxFeQ', 'zhyvLnBeQl0', 'xQqqeF-CHrQ', 'bCDZdhH_XsI', 'oXf2k9FtpYE');
  if v_held <> 0 then
    raise exception '% held-back lesson(s) were imported - those chapters are unverified against the CBSE syllabus', v_held;
  end if;

  raise notice 'SELF-TEST PASSED: % lessons across 2 boarded courses; % of 17 chapters now offer two institutes; 17 chapters unchanged; 0 held-back videos imported.',
    v_lessons, v_two;
end
$verify$;

commit;
