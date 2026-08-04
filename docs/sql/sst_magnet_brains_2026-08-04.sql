-- sst_magnet_brains_2026-08-04.sql
--
-- Social Science gets a third institute and, more importantly, depth. Measured
-- against production before this file:
--
--     22 chapters, 29 lessons. EIGHTEEN chapters hold exactly one lesson.
--     Three of those are stubs standing in for a whole chapter:
--       Development 10m, Sectors of the Indian Economy 11m, Money and Credit 11m.
--     Two institutes teach it: Digraj Singh Rajput (65), Competishun via NEEV (77).
--
-- A chapter with one 10-minute lesson is worse than an empty one: it looks
-- served and is not.
--
-- SOURCE: Magnet Brains (UC3HS6gQ79jjn4xHxogw0HiA), added to this catalogue
-- earlier today for Class 10 English. Its four "Full Chapter Videos" playlists
-- mirror the four NCERT books. All 54 videos in them were enumerated with full
-- continuation paging; 34 were selected and 20 dropped.
--
-- SELECTION RULE: the fullest on-chapter teach per chapter, plus the short
-- revision cut where one exists. Dropped were older duplicate recordings of a
-- chapter already covered, four videos spanning a whole book rather than one
-- chapter, and three chapters the catalogue does not have.
--
-- WHY NOT MORE. The catalogue files every lesson under exactly one chapter, so a
-- video teaching several cannot be filed honestly. That check is the reason one
-- pick changed late: u2ltN8M7KvU (8h32) is titled "Nationalism in India - One
-- Shot Revision" and looks like the fullest chapter-130 lesson available, but its
-- own markers open with "Introduction: All Chapters Complete Revision" and split
-- into three chapters -- ch130 to 2:54:13, then The Making of a Global World to
-- 5:50:41, then The Age of Industrialisation to 8:31:15. Only 34% is on-chapter.
-- Filing it under Nationalism in India would have put 5h38 of two other chapters
-- behind that heading. dEbZhso1Zhk (4h00) is used instead: fewer total minutes,
-- but all of them on the chapter, and more of them than u2ltN8M7KvU's 2h54.
--
-- Every one of the 34 selected lessons was then swept for the same defect by
-- matching its markers against all 22 chapter signatures. None carries
-- significant off-chapter content.
--
-- A LABELLING QUIRK, recorded so nobody "fixes" it later: this publisher
-- sometimes mislabels its OPENING marker. TfBVTRtgEHk opens "Introduction: Rise
-- of Nationalism in Europe" and KrYsuQpXHj4 opens "Introduction: Federalism",
-- yet every subsequent marker in each is correct for the chapter it is filed
-- under. Titles here come from the chapter, never from the video description.
--
-- VERIFICATION: all 34 ids checked live and independently of the playlist
-- scrape -- oEmbed returns 200 with author_name "Magnet Brains", the watch page
-- reports playableInEmbed true and channel UC3HS6gQ79jjn4xHxogw0HiA,
-- durations are the real ones, no id or display title already exists in the
-- catalogue, and every chapter id below still carries the name it had when this
-- was written. 86.2 hours of teaching in total.
--
-- CONSUMER RIGHTS (chapter 150) IS NOT DEEPENED and that is deliberate: Magnet
-- Brains publishes no Class 10 Consumer Rights chapter. It is also the least
-- affected chapter, already holding 5 lessons -- more than any other in this
-- subject.
--
-- Per book: History 9, Geography 10, Civics 10, Economics 5.
--
-- Idempotent: channel, courses and lessons are each looked up or upserted, so a
-- re-run changes nothing. Self-verifying, and wrapped in a transaction.

begin;

do $sst$
declare
  v_channel_id bigint;
  v_subject_id bigint := 5;   -- Social Science
  v_category_id bigint := 4;  -- School Boards
  v_video_id bigint;
  v_history bigint;
  v_geography bigint;
  v_civics bigint;
  v_economics bigint;
  r record;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  -- Every lesson is pinned to a chapter by hard-coded id. Prove the ids still
  -- mean what they meant when this file was written.
  if not exists (select 1 from public.chapters where id = 129 and subject_id = v_subject_id and name = 'The Rise of Nationalism in Europe') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 129, 'The Rise of Nationalism in Europe';
  end if;
  if not exists (select 1 from public.chapters where id = 130 and subject_id = v_subject_id and name = 'Nationalism in India') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 130, 'Nationalism in India';
  end if;
  if not exists (select 1 from public.chapters where id = 131 and subject_id = v_subject_id and name = 'The Making of a Global World') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 131, 'The Making of a Global World';
  end if;
  if not exists (select 1 from public.chapters where id = 132 and subject_id = v_subject_id and name = 'The Age of Industrialisation') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 132, 'The Age of Industrialisation';
  end if;
  if not exists (select 1 from public.chapters where id = 133 and subject_id = v_subject_id and name = 'Print Culture and the Modern World') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 133, 'Print Culture and the Modern World';
  end if;
  if not exists (select 1 from public.chapters where id = 134 and subject_id = v_subject_id and name = 'Resources and Development') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 134, 'Resources and Development';
  end if;
  if not exists (select 1 from public.chapters where id = 135 and subject_id = v_subject_id and name = 'Forest and Wildlife Resources') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 135, 'Forest and Wildlife Resources';
  end if;
  if not exists (select 1 from public.chapters where id = 136 and subject_id = v_subject_id and name = 'Water Resources') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 136, 'Water Resources';
  end if;
  if not exists (select 1 from public.chapters where id = 137 and subject_id = v_subject_id and name = 'Agriculture') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 137, 'Agriculture';
  end if;
  if not exists (select 1 from public.chapters where id = 138 and subject_id = v_subject_id and name = 'Minerals and Energy Resources') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 138, 'Minerals and Energy Resources';
  end if;
  if not exists (select 1 from public.chapters where id = 139 and subject_id = v_subject_id and name = 'Manufacturing Industries') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 139, 'Manufacturing Industries';
  end if;
  if not exists (select 1 from public.chapters where id = 140 and subject_id = v_subject_id and name = 'Lifelines of National Economy') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 140, 'Lifelines of National Economy';
  end if;
  if not exists (select 1 from public.chapters where id = 141 and subject_id = v_subject_id and name = 'Power Sharing') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 141, 'Power Sharing';
  end if;
  if not exists (select 1 from public.chapters where id = 142 and subject_id = v_subject_id and name = 'Federalism') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 142, 'Federalism';
  end if;
  if not exists (select 1 from public.chapters where id = 143 and subject_id = v_subject_id and name = 'Gender, Religion and Caste') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 143, 'Gender, Religion and Caste';
  end if;
  if not exists (select 1 from public.chapters where id = 144 and subject_id = v_subject_id and name = 'Political Parties') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 144, 'Political Parties';
  end if;
  if not exists (select 1 from public.chapters where id = 145 and subject_id = v_subject_id and name = 'Outcomes of Democracy') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 145, 'Outcomes of Democracy';
  end if;
  if not exists (select 1 from public.chapters where id = 146 and subject_id = v_subject_id and name = 'Development') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 146, 'Development';
  end if;
  if not exists (select 1 from public.chapters where id = 147 and subject_id = v_subject_id and name = 'Sectors of the Indian Economy') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 147, 'Sectors of the Indian Economy';
  end if;
  if not exists (select 1 from public.chapters where id = 148 and subject_id = v_subject_id and name = 'Money and Credit') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 148, 'Money and Credit';
  end if;
  if not exists (select 1 from public.chapters where id = 149 and subject_id = v_subject_id and name = 'Globalisation and the Indian Economy') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 149, 'Globalisation and the Indian Economy';
  end if;

  -- ---- History ----
  select id into v_history from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 History — Full Chapters and Quick Revision';
  if v_history is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 History — Full Chapters and Quick Revision', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hinglish', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhXJMA8ncxvxljn3dcyVLc4H')
    returning id into v_history;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_history, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_history, id from public.class_levels where slug = 'class-10';
    -- WITHOUT THIS the course is invisible on every board-scoped Browse page.
    -- src/usePlaylistBrowse.js inner-joins playlist_boards, and the School Boards
    -- journey always carries a board. Omitting it is the defect that shipped in
    -- english_magnet_brains_2026-08-04.sql and needed a backfill.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_history, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'mrBc5Mht410', 'The Rise of Nationalism in Europe — Full Chapter Explanation', 'The Rise of Nationalism in Europe - One Shot Revision | Class 10 History Chapter 1 | CBSE 2024-25', 129, 21136),
      (2, '_U3s6qb2bRw', 'The Rise of Nationalism in Europe — Quick Revision', 'Full Chapter Revision Series | Rise of Nationalism in Europe | Class 10 History Chapter 1 | 2023-24', 129, 5237),
      (3, 'dEbZhso1Zhk', 'Nationalism in India — Full Chapter Explanation', 'Nationalism in India Full Chapter Class 10 History | CBSE History Class 10 Chapter 2 (2022-23)', 130, 14448),
      (4, 'n9SK6vX2j8k', 'Nationalism in India — Quick Revision', 'Full Chapter Nationalism in India | Revision Series | Class 10 History Chapter 2 | 2023-24 NCERT', 130, 5243),
      (5, 'W1Gx4FjKJTo', 'The Making of a Global World — Full Chapter Explanation', 'The Making of a Global World Full Chapter Class 10 History | CBSE History Class 10 Ch 3 (2022-23)', 131, 27684),
      (6, 'l5B5yd90sco', 'The Age of Industrialisation — Full Chapter Explanation and NCERT Solutions', 'The Age of Industrialisation- Full Chapter Explanation, NCERT Solutions | Class 10 History Chapter 4', 132, 21898),
      (7, 'wcD3yESHnGg', 'The Age of Industrialisation — Quick Revision', 'The Age of Industrialisation (Full Chapter) | CBSE Class 10 History | Revision Series| NCERT|2023-24', 132, 5717),
      (8, 'ZB89Sz9A-hM', 'Print Culture and the Modern World — Full Chapter Explanation', 'Print Culture and the Modern World Full Ch. Class 10 History | CBSE History Class 10 Ch 5 (2022-23)', 133, 20959),
      (9, 'sD4C6NAR3J0', 'Print Culture and the Modern World — Quick Revision', 'Print Culture & the Modern World (Full Chapter) | Revision Class10 Social Science Chapter 5 |2023-24', 133, 6660)
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
    values (v_history, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_history
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_history
    on conflict do nothing;
  end loop;

  -- ---- Geography ----
  select id into v_geography from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Geography — Full Chapters and Quick Revision';
  if v_geography is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Geography — Full Chapters and Quick Revision', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hinglish', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhWTMCmKVQENOML-eJilisJz')
    returning id into v_geography;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_geography, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_geography, id from public.class_levels where slug = 'class-10';
    -- WITHOUT THIS the course is invisible on every board-scoped Browse page.
    -- src/usePlaylistBrowse.js inner-joins playlist_boards, and the School Boards
    -- journey always carries a board. Omitting it is the defect that shipped in
    -- english_magnet_brains_2026-08-04.sql and needed a backfill.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_geography, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, '7s6_Of6tPBc', 'Resources and Development — Full Chapter Explanation and NCERT Solutions', 'Resources and Development - Full Chapter Explanation | Class 10 Geography Chapter 1 | 2022-23', 134, 12226),
      (2, 'TfBVTRtgEHk', 'Resources and Development — Quick Revision', 'Full Chapter Revision Series | Resources and Development | Class 10 Geography Chapter 1 | 2023-24', 134, 3562),
      (3, 'W6sJdIoNXVM', 'Forest and Wildlife Resources — Full Chapter Explanation', 'Forest and Wildlife Resources Full Chapter | CBSE Geography Class 10 Chapter 2 (2022-23)', 135, 8510),
      (4, '7oH7-Mum21I', 'Water Resources — Full Chapter Explanation', 'Water Resources Full Chapter Class 10 Geography | CBSE Geography Class 10 Chapter 3 (2022-23)', 136, 6492),
      (5, 'PeSlhEiM2yU', 'Agriculture — Full Chapter Explanation', 'Class 10th Geography Chapter 4 | Agriculture Full Chapter Explanation (2022-23)', 137, 9793),
      (6, 'Uy0219XKLbA', 'Minerals and Energy Resources — Full Chapter Explanation and NCERT Solutions', 'Class 10 Social Science Chapter 5 | Minerals and Energy Resources Full Chapter Explanation 2022-23', 138, 11152),
      (7, 'mcG294HwU0Y', 'Minerals and Energy Resources — Quick Revision', 'Minerals & Energy Resources Class 10 Full Chapter | Geography | Revision Series Chapter 5 | 2023-24', 138, 4619),
      (8, 'MSJ6qxRnKU0', 'Manufacturing Industries — Full Chapter Explanation', 'Manufacturing Industries Full Chapter Class 10 Geography | CBSE Geography Class 10 Ch 6 (2022-23)', 139, 13552),
      (9, 'f4cOLCTH-tY', 'Manufacturing Industries — Quick Revision', 'Manufacturing Industries (Full Chapter) | Class 10 Geography | SST Ch 6 | Revision Series 2023-24', 139, 5793),
      (10, 'BOa2uA4rMlU', 'Lifelines of National Economy — Full Chapter Explanation', 'Lifelines of National Economy Full Chapter | CBSE Geography Class 10 Chapter 7 (2022-23)', 140, 9285)
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
    values (v_geography, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_geography
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_geography
    on conflict do nothing;
  end loop;

  -- ---- Civics ----
  select id into v_civics from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Civics — Full Chapters and Quick Revision';
  if v_civics is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Civics — Full Chapters and Quick Revision', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hinglish', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhUn6X7fiL7eVqd2l38YrdjL')
    returning id into v_civics;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_civics, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_civics, id from public.class_levels where slug = 'class-10';
    -- WITHOUT THIS the course is invisible on every board-scoped Browse page.
    -- src/usePlaylistBrowse.js inner-joins playlist_boards, and the School Boards
    -- journey always carries a board. Omitting it is the defect that shipped in
    -- english_magnet_brains_2026-08-04.sql and needed a backfill.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_civics, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'dqDJ4GeU0FY', 'Power Sharing — Full Chapter Explanation and NCERT Solutions', 'Power Sharing - Full Chapter Explanation and NCERT Solutions | Class 10 Civics Chapter 1 | 2022-23', 141, 13075),
      (2, 'DHet25Now1c', 'Power Sharing — Quick Revision', 'Full Chapter Revision Series | Power Sharing | Class 10 Civics | Chapter 1 | (2023-24) NCERT', 141, 2078),
      (3, 'c4V7mmDV6MU', 'Federalism — Full Chapter Explanation', 'Class 10 Civics Chapter 2 | Federalism - Full Chapter Explanation 2022-23', 142, 8622),
      (4, 'UhS1s4kNwUY', 'Federalism — Quick Revision', 'Full Chapter Revision Series | Federalism | Class 10 Civics | Chapter 2 | 2023-24 NCERT', 142, 2876),
      (5, 'KrYsuQpXHj4', 'Gender, Religion and Caste — Full Chapter Explanation', 'Gender, Religion and Caste Full Chapter Class 10 Civics | CBSE Civics Class 10 Chapter 4 (2022-23)', 143, 9407),
      (6, 'mP3t6RvUNk4', 'Gender, Religion and Caste — Quick Revision', 'Gender, Religion and Caste Class 10 (Full Chapter) | Civics | Quick Revision Series Chap 3 | 2023-24', 143, 3567),
      (7, 'O6g7hGwtXY8', 'Political Parties — Full Chapter Explanation', 'Political Parties Full Chapter Class 10 Civics | CBSE Civics Class 10 Chapter 6 (2022-23)', 144, 8309),
      (8, 'AdAX4CFm7xs', 'Political Parties — Quick Revision', 'Political Parties Class 10 (Full Chapter) | CBSE Civics | Quick Revision Series | Chapter 4 |2023-24', 144, 3497),
      (9, 'b7tcIf2_PpQ', 'Outcomes of Democracy — Full Chapter Explanation and NCERT Solutions', 'Outcomes Of Democracy - Full Chapter Explanation & NCERT Solutions | Class 10 Civics Chapter 7| 2025', 145, 6765),
      (10, 'j_MNEX9pKMg', 'Outcomes of Democracy — Quick Revision', 'Outcomes of Democracy Class 10 (Full Chapter) | CBSE Civics | Quick Revision Series Chap 5 | 2023-24', 145, 2757)
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
    values (v_civics, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_civics
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_civics
    on conflict do nothing;
  end loop;

  -- ---- Economics ----
  select id into v_economics from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Economics — Full Chapters and Quick Revision';
  if v_economics is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Economics — Full Chapters and Quick Revision', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hinglish', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhVccNtUdBoW-1S2X1MWJRQG')
    returning id into v_economics;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_economics, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_economics, id from public.class_levels where slug = 'class-10';
    -- WITHOUT THIS the course is invisible on every board-scoped Browse page.
    -- src/usePlaylistBrowse.js inner-joins playlist_boards, and the School Boards
    -- journey always carries a board. Omitting it is the defect that shipped in
    -- english_magnet_brains_2026-08-04.sql and needed a backfill.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_economics, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'jCYwHv_7vyY', 'Development — Full Chapter Explanation', 'Development - Full Chapter | Board Exam 2023 | Class 10 Economics Chapter 1 (2022-23)', 146, 6085),
      (2, 'fTnX3oNQOSU', 'Development — Quick Revision', 'Full Chapter Revision Series | Development | Class 10 Economics Chapter 1| 2023-24 NCERT', 146, 2249),
      (3, 'sh_K3At_QDA', 'Sectors of the Indian Economy — Full Chapter Explanation', 'Class 10 Economics Chapter 2 | Sectors of the Indian Economy Full Chapter 2022-23', 147, 8936),
      (4, 'rnoec6Fl1uo', 'Money and Credit — Full Chapter Explanation and NCERT Solutions', 'Class 10 Social Science Chapter 3 | Money and Credit Full Chapter Explanation 2022-23', 148, 8837),
      (5, '7Wie7slhDCo', 'Globalisation and the Indian Economy — Full Chapter Explanation and NCERT Solutions', 'Class 10 Social Science Ch 4 | Globalisation & The Indian Economy Full Chapter Explanation 2022-23', 149, 9227)
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
    values (v_economics, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_economics
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_economics
    on conflict do nothing;
  end loop;

end
$sst$;

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
  v_three int;
  v_stubs int;
  v_singles int;
begin
  select id into strict v_mb from public.institutes_channels where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  select count(*) into v_lessons from public.videos where subject_id = 5 and channel_id = v_mb;
  if v_lessons <> 34 then raise exception 'expected 34 Magnet Brains Social Science lessons, found %', v_lessons; end if;

  select count(*) into v_courses from public.playlists where subject_id = 5 and channel_id = v_mb;
  if v_courses <> 4 then raise exception 'expected 4 courses, found %', v_courses; end if;

  -- The defect that shipped with the English import: a course with no board row
  -- is invisible on every board-scoped Browse page.
  select count(*) into v_boardless
    from public.playlists p
   where p.channel_id = v_mb
     and not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id);
  if v_boardless <> 0 then raise exception '% Magnet Brains course(s) have no board row and would be invisible', v_boardless; end if;

  -- ...and the one that left 670 lessons unsearchable.
  select count(*) into v_unfiled
    from public.videos v
   where v.channel_id = v_mb and v.subject_id = 5
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then raise exception '% lesson(s) are unfiled and invisible to search', v_unfiled; end if;

  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then raise exception '% lesson(s) sit in a course from another institute', v_badchan; end if;

  -- The point of the exercise, stated as an outcome rather than a row count.
  --
  -- Note what this does and does NOT claim. Social Science gains a THIRD
  -- institute at subject level, but most individual chapters had only ONE
  -- teacher before today, so per chapter the gain is one institute to two.
  -- Only Nationalism in India, Political Parties and Globalisation reach three,
  -- because only those already had both Digraj and NEEV. Measured, not assumed.
  select count(*) into v_two from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 5
     group by c.id having count(distinct v.channel_id) >= 2
  ) s;
  if v_two < 21 then raise exception 'expected at least 21 chapters with two or more institutes, found %', v_two; end if;

  select count(*) into v_three from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 5
     group by c.id having count(distinct v.channel_id) >= 3
  ) s;
  if v_three < 3 then raise exception 'expected at least 3 chapters with three institutes, found %', v_three; end if;

  -- No chapter may still be a single-lesson dead end except Consumer Rights,
  -- which this import cannot reach and which already holds five lessons.
  select count(*) into v_singles from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 5
     group by c.id having count(*) = 1
  ) s;
  if v_singles <> 0 then raise exception '% Social Science chapter(s) still hold exactly one lesson', v_singles; end if;

  -- The three ten-minute stubs must no longer be a chapter's only offering.
  select count(*) into v_stubs from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 5 and c.id in (146, 147, 148)
     group by c.id having sum(v.duration_seconds) < 3600
  ) s;
  if v_stubs <> 0 then raise exception '% stub chapter(s) still hold under an hour of teaching', v_stubs; end if;

  raise notice 'SELF-TEST PASSED: % lessons across 4 boarded courses; % of 22 chapters now offer two or more institutes (% offer three); zero single-lesson chapters; the three stubs are gone.',
    v_lessons, v_two, v_three;
end
$verify$;

commit;
