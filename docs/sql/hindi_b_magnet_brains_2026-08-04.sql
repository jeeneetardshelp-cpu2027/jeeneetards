-- hindi_b_magnet_brains_2026-08-04.sql
--
-- The last thin board subject. Hindi B held 16 chapters and 32 lessons, fifteen
-- of them one-lesson dead ends from a single institute, median 19 minutes per
-- chapter -- the thinnest in the catalogue after Hindi A.
--
-- This adds 17 lessons and 17.5 hours from Magnet Brains across the two NCERT
-- Course B books, and creates the one chapter CBSE prescribes that the catalogue
-- never had.
--
-- THE MISSING CHAPTER: तीसरी कसम के शिल्पकार शैलेंद्र (Sparsh chapter 11).
-- Unlike this morning's English mistake, this is not inferred from a publisher's
-- playlist. It was read out of the primary documents:
--   * https://ncert.nic.in/textbook/pdf/jhsp111.pdf is Sparsh chapter 11. Its
--     running header reads "तीसरी कसम के शिल्पकार शैलेंद्र / 81", the facing page
--     is headed "80 / स्पर्श", the author page names प्रहलाद अग्रवाल (1947), and
--     every page carries "Reprint 2026-27". jhsp114.pdf exists and jhsp115.pdf
--     404s, so the rationalised Sparsh has exactly 14 chapters.
--   * The catalogue held 13 of them, so exactly one was missing, and the gap sat
--     at position 11 -- between तताँरा वामीरो कथा and अब कहाँ दूसरे के दुख से
--     दुखी होने वाले.
-- Magnet Brains' own video for it is titled "Shailendra: The Craftsman of Teesri
-- Kasam ... Class 10 Hindi Ch 13", which corroborates the identity independently
-- of the PDF while using the pre-rationalisation chapter number -- which is why
-- everything here is mapped by NAME, never by the publisher's numbering.
--
-- THREE VIDEOS ARE DELIBERATELY NOT IMPORTED. Magnet Brains teaches the
-- un-rationalised 17-chapter Sparsh. CBSE's own 2026-27 Hindi B curriculum
-- (https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Hindi_B_SecP1_2026-27.pdf)
-- states, under "निर्धारित पुस्तकें", the note
--   "निम्नलिखित पाठों से प्रश्न नहीं पूछे जाएँगे। पाठ्य पुस्तक स्पर्श, भाग-2:
--    बिहारी - दोहे (पूरा पाठ) / महादेवी वर्मा - मधुर-मधुर मेरे दीपक जल (पूरा पाठ)
--    / अंतोन चेखव - गिरगिट (पूरा पाठ)"
-- and for Sanchayan, "पुस्तक में कोई परिवर्तन नहीं। कोई भी पाठ नहीं हटाया गया है।"
-- So these are held back, and the catalogue is right not to have the chapters:
--     Tw1AF2Inosc  बिहारी के दोहे
--     LmOwi3jTnvw  मधुर-मधुर मेरे दीपक जल
--     ssIHAYolEcw  गिरगिट
-- They are real, reachable Magnet Brains videos; they are simply off-syllabus.
-- The self-test fails if any of them is ever imported.
--
-- Result: 16 chapters -> 17, 32 lessons -> 49, and 16 of 17 chapters gain a
-- second independent teaching voice. display_order is rewritten so all 17 read
-- in the order the two books print them.
--
-- Titles follow this subject's convention -- transliteration first, Devanagari in
-- brackets -- so either script finds the lesson.
--
-- VERIFICATION: all 17 ids checked live -- oEmbed author_name "Magnet Brains",
-- playableInEmbed true, channel UC3HS6gQ79jjn4xHxogw0HiA, real durations,
-- and no id or display title already in the catalogue. The 3 held-back ids were
-- confirmed real too, so the exclusion rests on the syllabus, not on bad data.
--
-- language is 'hindi', matching the existing Hindi B course.
-- Idempotent and self-verifying.

begin;

do $hindib$
declare
  v_channel_id bigint;
  v_subject_id bigint := 12;  -- Hindi B
  v_category_id bigint := 4;  -- School Boards
  v_video_id bigint;
  v_new bigint;
  v_sparsh bigint;
  v_sanchayan bigint;
  r record;
begin
  select id into strict v_channel_id from public.institutes_channels
   where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  if not exists (select 1 from public.chapters where id = 242 and subject_id = v_subject_id and name = 'कबीर की साखी') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 242, 'कबीर की साखी';
  end if;
  if not exists (select 1 from public.chapters where id = 243 and subject_id = v_subject_id and name = 'मीरा के पद') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 243, 'मीरा के पद';
  end if;
  if not exists (select 1 from public.chapters where id = 244 and subject_id = v_subject_id and name = 'मनुष्यता') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 244, 'मनुष्यता';
  end if;
  if not exists (select 1 from public.chapters where id = 245 and subject_id = v_subject_id and name = 'पर्वत प्रदेश में पावस') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 245, 'पर्वत प्रदेश में पावस';
  end if;
  if not exists (select 1 from public.chapters where id = 246 and subject_id = v_subject_id and name = 'तोप') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 246, 'तोप';
  end if;
  if not exists (select 1 from public.chapters where id = 247 and subject_id = v_subject_id and name = 'कर चले हम फ़िदा') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 247, 'कर चले हम फ़िदा';
  end if;
  if not exists (select 1 from public.chapters where id = 248 and subject_id = v_subject_id and name = 'आत्मत्राण') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 248, 'आत्मत्राण';
  end if;
  if not exists (select 1 from public.chapters where id = 249 and subject_id = v_subject_id and name = 'बड़े भाई साहब') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 249, 'बड़े भाई साहब';
  end if;
  if not exists (select 1 from public.chapters where id = 250 and subject_id = v_subject_id and name = 'डायरी का एक पन्ना') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 250, 'डायरी का एक पन्ना';
  end if;
  if not exists (select 1 from public.chapters where id = 251 and subject_id = v_subject_id and name = 'तताँरा वामीरो कथा') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 251, 'तताँरा वामीरो कथा';
  end if;
  if not exists (select 1 from public.chapters where id = 252 and subject_id = v_subject_id and name = 'अब कहाँ दूसरे के दुख से दुखी होने वाले') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 252, 'अब कहाँ दूसरे के दुख से दुखी होने वाले';
  end if;
  if not exists (select 1 from public.chapters where id = 253 and subject_id = v_subject_id and name = 'पतझर में टूटी पत्तियाँ') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 253, 'पतझर में टूटी पत्तियाँ';
  end if;
  if not exists (select 1 from public.chapters where id = 254 and subject_id = v_subject_id and name = 'कारतूस') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 254, 'कारतूस';
  end if;
  if not exists (select 1 from public.chapters where id = 255 and subject_id = v_subject_id and name = 'हरिहर काका') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 255, 'हरिहर काका';
  end if;
  if not exists (select 1 from public.chapters where id = 256 and subject_id = v_subject_id and name = 'सपनों के से दिन') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 256, 'सपनों के से दिन';
  end if;
  if not exists (select 1 from public.chapters where id = 257 and subject_id = v_subject_id and name = 'टोपी शुक्ला') then
    raise exception 'chapter % is no longer named % - refusing to file lessons against a stale id', 257, 'टोपी शुक्ला';
  end if;

  -- The chapter CBSE prescribes and this catalogue never had.
  select id into v_new from public.chapters
   where subject_id = v_subject_id and name = 'तीसरी कसम के शिल्पकार शैलेंद्र';
  if v_new is null then
    insert into public.chapters (subject_id, name, slug, display_order)
    values (v_subject_id, 'तीसरी कसम के शिल्पकार शैलेंद्र', 'teesri-kasam-ke-shilpkar-shailendra', 11)
    returning id into v_new;
  end if;

  -- Reading order of the two books, with the new chapter slotted in at 11.
  update public.chapters set display_order = 1 where id = 242;
  update public.chapters set display_order = 2 where id = 243;
  update public.chapters set display_order = 3 where id = 244;
  update public.chapters set display_order = 4 where id = 245;
  update public.chapters set display_order = 5 where id = 246;
  update public.chapters set display_order = 6 where id = 247;
  update public.chapters set display_order = 7 where id = 248;
  update public.chapters set display_order = 8 where id = 249;
  update public.chapters set display_order = 9 where id = 250;
  update public.chapters set display_order = 10 where id = 251;
  update public.chapters set display_order = 11 where id = v_new;
  update public.chapters set display_order = 12 where id = 252;
  update public.chapters set display_order = 13 where id = 253;
  update public.chapters set display_order = 14 where id = 254;
  update public.chapters set display_order = 15 where id = 255;
  update public.chapters set display_order = 16 where id = 256;
  update public.chapters set display_order = 17 where id = 257;

  -- ---- Sparsh ----
  select id into v_sparsh from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Hindi Sparsh (स्पर्श) — Full Chapters';
  if v_sparsh is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Hindi Sparsh (स्पर्श) — Full Chapters', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hindi', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhW0LTgQC8ls6RuLRvLEvvfG')
    returning id into v_sparsh;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_sparsh, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_sparsh, id from public.class_levels where slug = 'class-10';
    -- Without this the course is invisible on every board-scoped Browse page.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_sparsh, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'aVqgUT2-NBw', 'Kabir Ki Sakhi (कबीर की साखी) — Full Chapter', 'Class 10 Hindi Chapter 1 | Kabir Ki Sakhiya - Full Chapter Explanation & Question Answers 2025-26', 242, 1976),
      (2, 'oF7vZC19wi8', 'Meera Ke Pad (मीरा के पद) — Full Chapter', 'Class 10 Hindi Chapter 2 | Meera Ke Pad - Full Chapter Explanation & Question Answers 2025-26', 243, 1056),
      (3, 'I0jvzeOAFDo', 'Manushyata (मनुष्यता) — Full Chapter', 'Class 10 Hindi Chapter 4 | Manushyata Full Chapter Explanation & Question Answers 2025-26', 244, 1929),
      (4, 'PcVXoHY8iM4', 'Parvat Pradesh Mein Pavas (पर्वत प्रदेश में पावस) — Full Chapter', 'Class 10 Hindi Chapter 5 | Parvat Pradesh Mein Pavas Full Chapter Explanation & Exercise 2025-26', 245, 1188),
      (5, 'lUB_xgIWBhU', 'Top (तोप) — Full Chapter', 'Top - Full Chapter Explanation and NCERT Solutions | Class 10 Hindi Chapter 7 | Sparsh | 2025-26', 246, 2465),
      (6, 'bo9Y_ZSSWDs', 'Kar Chale Hum Fida (कर चले हम फ़िदा) — Full Chapter', 'Class 10 Hindi Chapter 8 | Kar Chale Hum Fida - Full Chapter Explanation & Question Answers 2025-26', 247, 2976),
      (7, 'RyfyxQrOpQE', 'Aatmtran (आत्मत्राण) — Full Chapter', 'Aatmtran - Full Chapter Explanation, NCERT Solutions & MCQs | Class 10 Hindi Ch 9 | Sparsh | 2025-26', 248, 3790),
      (8, 'FlgGNbo5jcE', 'Bade Bhai Sahab (बड़े भाई साहब) — Full Chapter', 'Bade Bhai Sahab - Full Chapter Explanation & NCERT Solutions | Class 10 Hindi Ch 10 (Gadya) Sparsh', 249, 7492),
      (9, 'HuGEZ4ZU-50', 'Diary Ka Ek Panna (डायरी का एक पन्ना) — Full Chapter', 'Diary Ka Ek Panna - Full Chapter Explanation | Class 10 Hindi Chapter 11 (Gadya) | Sparsh | 2025-26', 250, 4019),
      (10, 'cW-qOZYUvYE', 'Tantara Vamiro Katha (तताँरा वामीरो कथा) — Full Chapter', 'Tantara-Vaamiro Katha : Full Chapter Explanation |Class 10 Hindi Chapter 12 (Gadya) |Sparsh |2025-26', 251, 6859),
      (11, '4C8N3v20n3E', 'Teesri Kasam Ke Shilpkar Shailendra (तीसरी कसम के शिल्पकार शैलेंद्र)', 'Teesri Kasam Ke Shilpkar Shailendra - Full Chapter | Class 10 Hindi Ch 13 (Gadya) | Sparsh | 2025-26', v_new, 3985),
      (12, 'nBigaU0K3OE', 'Ab Kahan Dusre Ke Dukh Se Dukhi Hone Wale (अब कहाँ दूसरे के दुख से दुखी होने वाले)', 'Ab Kahan Dusre Ke Dukh Se Dukhi Hone Waale - Full Chapter | Class 10 Hindi Ch 15 | Sparsh | 2025-26', 252, 6760),
      (13, 'YFaoX-uwPMc', 'Patjhar Mein Tuti Pattiyan (पतझर में टूटी पत्तियाँ) — Full Chapter', 'Patjhad Mein Tuti Pattiyan - Full Chapter Explanation | Class 10 Hindi Chapter 16 | Sparsh | 2025-26', 253, 3906),
      (14, 'aLYf4lBPap4', 'Kartoos (कारतूस) — Full Chapter', 'Kartoos - Full Chapter Explanation, NCERT Solutions | Class 10 Hindi Chapter 17 | Sparsh | 2025-26', 254, 3220)
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
    values (v_sparsh, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_sparsh
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_sparsh
    on conflict do nothing;
  end loop;

  -- ---- Sanchayan ----
  select id into v_sanchayan from public.playlists
   where channel_id = v_channel_id and title = 'Class 10 Hindi Sanchayan (संचयन) — Full Chapters';
  if v_sanchayan is null then
    insert into public.playlists
      (title, teacher, channel_id, subject_id, category_id, content_type, language,
       difficulty, class_levels, audience_focus, youtube_playlist_id)
    values
      ('Class 10 Hindi Sanchayan (संचयन) — Full Chapters', 'Magnet Brains', v_channel_id, v_subject_id, v_category_id,
       'full-course', 'hindi', 'beginner', array['10th'], '10th', 'PLVLoWQFkZbhWe8X2PrSQ5cWWj0PKjtKx9')
    returning id into v_sanchayan;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    select v_sanchayan, id from public.learning_goals where slug = 'school';
    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_sanchayan, id from public.class_levels where slug = 'class-10';
    -- Without this the course is invisible on every board-scoped Browse page.
    insert into public.playlist_boards (playlist_id, board_id)
    select v_sanchayan, id from public.boards where slug = 'cbse';
  end if;

  for r in
    select * from (values
      (1, 'hWtfjzmsewc', 'Harihar Kaka (हरिहर काका) — Full Chapter', 'Harihar Kaka - One Shot Revision | Class 10 Hindi Sanchayan Chapter 1 2022-23', 255, 3983),
      (2, 'qiqLitUL4Ns', 'Sapno Ke Se Din (सपनों के से दिन) — Full Chapter', 'Sapno Ke Se Din - Full Chapter Revision | Class 10 Hindi Sanchayan Chapter 2 (2022-23)', 256, 3965),
      (3, 'itUWXJLlFh4', 'Topi Shukla (टोपी शुक्ला) — Full Chapter', 'Topi Shukla - Full Chapter Revision | Class 10 Hindi Sanchayan Chapter 3 (2022-23)', 257, 3438)
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
    values (v_sanchayan, v_video_id, r.pos)
    on conflict (playlist_id, video_id) do update set position = excluded.position;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    select v_video_id, learning_goal_id from public.playlist_learning_goals where playlist_id = v_sanchayan
    on conflict do nothing;
    insert into public.video_class_levels (video_id, class_level_id)
    select v_video_id, class_level_id from public.playlist_class_levels where playlist_id = v_sanchayan
    on conflict do nothing;
  end loop;

end
$hindib$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_mb bigint;
  v_chapters int;
  v_lessons int;
  v_courses int;
  v_boardless int;
  v_unfiled int;
  v_badchan int;
  v_two int;
  v_held int;
  v_orders int;
begin
  select id into strict v_mb from public.institutes_channels where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA';

  select count(*) into v_chapters from public.chapters where subject_id = 12;
  if v_chapters <> 17 then raise exception 'expected 17 Hindi B chapters, found %', v_chapters; end if;

  if not exists (select 1 from public.chapters where subject_id = 12 and name = 'तीसरी कसम के शिल्पकार शैलेंद्र') then
    raise exception 'the prescribed chapter was not created';
  end if;

  select count(*) into v_lessons from public.videos where subject_id = 12 and channel_id = v_mb;
  if v_lessons <> 17 then raise exception 'expected 17 Magnet Brains Hindi B lessons, found %', v_lessons; end if;

  select count(*) into v_courses from public.playlists where subject_id = 12 and channel_id = v_mb;
  if v_courses <> 2 then raise exception 'expected 2 courses, found %', v_courses; end if;

  select count(*) into v_boardless
    from public.playlists p
   where p.subject_id = 12 and p.channel_id = v_mb
     and not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id);
  if v_boardless <> 0 then raise exception '% course(s) have no board row and would be invisible', v_boardless; end if;

  select count(*) into v_unfiled
    from public.videos v
   where v.channel_id = v_mb and v.subject_id = 12
     and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
       or not exists (select 1 from public.video_class_levels l where l.video_id = v.id));
  if v_unfiled <> 0 then raise exception '% lesson(s) are unfiled and invisible to search', v_unfiled; end if;

  select count(*) into v_badchan
    from public.playlist_videos pv
    join public.videos v    on v.id = pv.video_id
    join public.playlists p on p.id = pv.playlist_id
   where v.channel_id is distinct from p.channel_id;
  if v_badchan <> 0 then raise exception '% lesson(s) sit in a course from another institute', v_badchan; end if;

  -- None of the three off-syllabus videos may have been imported.
  select count(*) into v_held from public.videos
   where youtube_video_id in ('Tw1AF2Inosc', 'LmOwi3jTnvw', 'ssIHAYolEcw');
  if v_held <> 0 then
    raise exception '% off-syllabus lesson(s) were imported - CBSE excludes those chapters', v_held;
  end if;

  -- display_order must be a clean 1..17.
  select count(*) into v_orders from (
    select display_order from public.chapters where subject_id = 12
     group by display_order having count(*) > 1) d;
  if v_orders <> 0 then raise exception 'Hindi B chapters share a display_order'; end if;
  select count(*) into v_orders from public.chapters
   where subject_id = 12 and display_order between 1 and 17;
  if v_orders <> 17 then raise exception 'Hindi B display_order is not a clean 1..17 run'; end if;

  -- No chapter may be left empty, including the one just created.
  if exists (select 1 from public.chapters c where c.subject_id = 12
             and not exists (select 1 from public.videos v where v.chapter_id = c.id)) then
    raise exception 'a Hindi B chapter has no lessons';
  end if;

  select count(*) into v_two from (
    select c.id from public.chapters c
      join public.videos v on v.chapter_id = c.id
     where c.subject_id = 12
     group by c.id having count(distinct v.channel_id) >= 2
  ) s;
  if v_two < 16 then raise exception 'expected at least 16 Hindi B chapters with two institutes, found %', v_two; end if;

  raise notice 'SELF-TEST PASSED: Hindi B now % chapters and % Magnet Brains lessons across 2 boarded courses; % of 17 chapters offer two institutes; 0 off-syllabus videos imported.',
    v_chapters, v_lessons, v_two;
end
$verify$;

commit;
