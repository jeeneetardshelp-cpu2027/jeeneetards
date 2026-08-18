-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 278.
--
-- Chapter 278 ("Indefinite Integration") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMacK7OyqPwHe0rvG4KqxFIum
-- Lessons    : 87 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 87 pass src/titleQuality.js with
--              zero blocking issues and zero warnings, and are unique within the course.
--
-- Safe to re-run: it aborts rather than duplicating. Order-independent, so it does
-- not matter which of the six 2026-08-03 import files you run first.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_class_id bigint;
  v_dropper_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UCpyc1eTpM1cA3P0ZWym4clw';

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';
  select id into strict v_class_id from public.class_levels where slug = 'class-12';
  select id into strict v_dropper_id from public.class_levels where slug = 'dropper';

  -- Guard the target rather than a global row count, so these six files can be
  -- run in any order and a re-run fails loudly instead of duplicating lessons.
  if not exists (
    select 1 from public.chapters
    where id = 278 and subject_id = 3 and name = 'Indefinite Integration'
  ) then
    raise exception 'chapter 278 is not the expected "%" chapter', 'Indefinite Integration';
  end if;

  if exists (select 1 from public.playlists where title = 'Indefinite Integration') then
    raise exception 'course "%" already exists - this file has already been run', 'Indefinite Integration';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'pA25tmF1Q64', 'VfqsOK7ipfM', '5Verqt73UNc', '3DkozK7OGDw', 'Jybd7Y_IMdo', '9NZRV-Bzi7A',
      'Suv74Ux4_Mo', 'HTzF-gXcuPM', '8qkYaywVk2U', 'ZhRYbugeLoo', 'iQES4PcGql4', 'y_oT39_DYYo',
      's7Jb2mcBe9A', 'm2YnATHhHq4', 'sLUGc64zUH4', 'dDdDnIO4abw', 'esdur9nG_Os', 'WTzrqCw4uDY',
      'L1DUr6n42tY', 'LYK5Cu19uSk', 'N520TtT3XdM', 'sPEY9sHmL_w', 'ruq201GHBYE', 'nyoWm9dcDQE',
      'UgeDuDImIAU', 'w_tqoaItR9o', 'W5EemGT7ifc', 'TEDS0Foa52k', 'wBn_FuKqS0o', 'zKUmCpuPpEc',
      'wDcJY0kfjJ0', '8sdnlpqgPUI', 'Mkxw9tspM_s', 'l0f0Tc2KV7I', 'Ft-WMHhLnMw', 'ZSliDvE1ZL8',
      'CcTDHpvnDPI', 'T8Xdoq3ar_E', 'lTWa-1JwqmY', 'f0jjmSR-VTM', 'oJthMCPabFE', 'jlv4uaChlW4',
      '4wDb7CbzMPI', 'qIoYCIhxiLk', 'AphlfX2CEAY', 'J9TS2l7h6Yk', 'wyHqQE2Wl04', 'puwzjPbOGiM',
      '2soDYPcMwd4', 'uhX8vPUi4Ug', '9ZtllmFpVJc', '1CFp96EZuYg', 'khvDfD1gg5w', 'rD0oeJfI0Ys',
      'UTpfKn9aZlc', 'teH8H4TDYw4', 'aaAdXz0ycW4', 'gP_m8fg_m-E', 'wvr8c78e0rE', 'QsqPwayBRCc',
      'Yvts7xFoxNU', 'oOf1513_sgQ', 'Z4255wYMaeo', '1sJ_Is2VLgw', 'AzPYLB9KzPs', 'k4ukJftPlMk',
      'HiT1wJ0RbKY', 'riF6uUUJj8s', 'nPrqFXQQISs', 'eQueGeuEdBY', 'yQr36Y2sgTY', '0R0Xmp4lPpI',
      'mAF5n4fiSO0', 'zsNsCaOZR0s', 'ASgxGgTgILI', 'ayslWZYwwOg', 'CMOpJO9mTEs', 'ZtsVJPw4Lv4',
      'mDxoMFFuHSE', 'bQ2hY0q5vXQ', 'jaOEELBaluE', '5ZxbW_vuTXM', '0dpTXufM5G4', '5WDh_8CyD5Y',
      'Ccot7wbptCA', '_2ftgVurJOI', 'gYOKdkgj6Ec'
    ])
  ) then
    raise exception 'at least one of these 87 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Indefinite Integration',
    'Indefinite Integration',
    'The complete Indefinite Integration course from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '12th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, 'pA25tmF1Q64', 'Intro: Indefinite Integration & Algebra of Integral', '1 Intro: Indefinite Integration & Algebra of Integral | IIT JEE Mains/Advanced | Mohit Tyagi', 691),
      (2, 'VfqsOK7ipfM', 'Integral of basic functions', '2  Integral of basic functions | IIT JEE Mains/Advanced | Mohit Tyagi', 604),
      (3, '5Verqt73UNc', 'Algebra of integral — Rule of integral', '3 Algebra of integral | Rule of integral | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 454),
      (4, '3DkozK7OGDw', 'Integration of standard function with argument', '4 Integration of standard function with argument | IIT JEE Mains/Advanced | Mohit Tyagi', 626),
      (5, 'Jybd7Y_IMdo', 'Integration of standard function ( — ) (Part 2)', '5 Integration of standard function (Part 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 713),
      (6, '9NZRV-Bzi7A', 'Methods of evaluation of integral', '6 Methods of evaluation of integral | IIT JEE Mains/Advanced | Mohit Tyagi', 422),
      (7, 'Suv74Ux4_Mo', 'Example of evaluation of integral', '7 Example of evaluation of integral | IIT JEE Mains/Advanced | Mohit Tyagi', 435),
      (8, 'HTzF-gXcuPM', 'Example of evaluation of integral ( — ) (Part 2)', '8 Example of evaluation of integral (Part 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 352),
      (9, '8qkYaywVk2U', 'Example of evaluation of integral ( — ) (Part 3)', '9 Example of evaluation of integral (Part 3) | IIT JEE Mains/Advanced | Mohit Tyagi', 443),
      (10, 'ZhRYbugeLoo', 'Example of evaluation of integral ( — ) (Part 4)', '10 Example of evaluation of integral (Part 4) | IIT JEE Mains/Advanced | Mohit Tyagi', 425),
      (11, 'iQES4PcGql4', 'Example of evaluation of integral ( — ) (Part 5)', '11 Example of evaluation of integral (Part 5) | IIT JEE Mains/Advanced | Mohit Tyagi', 507),
      (12, 'y_oT39_DYYo', 'Example of evaluation of integral ( — ) (Part 6)', '12 Example of evaluation of integral (Part 6) | IIT JEE Mains/Advanced | Mohit Tyagi', 476),
      (13, 's7Jb2mcBe9A', 'Example of evaluation of integral ( — ) (Part 7)', '13 Example of evaluation of integral (Part 7) | IIT JEE Mains/Advanced | Mohit Tyagi', 577),
      (14, 'm2YnATHhHq4', 'Example of evaluation of integral ( — ) (Part 8)', '14 Example of evaluation of integral (Part 8) | IIT JEE Mains/Advanced | Mohit Tyagi', 537),
      (15, 'sLUGc64zUH4', 'Example of evaluation of integral ( — ) (Part 9)', '15 Example of evaluation of integral (Part 9) | IIT JEE Mains/Advanced | Mohit Tyagi', 745),
      (16, 'dDdDnIO4abw', 'Indefinite Integration — Substitution Method', '16 Indefinite Integration | Substitution Method | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 596),
      (17, 'esdur9nG_Os', 'Example of Integration by Substitution Method (Part 17)', '17 Example of Integration by Substitution Method   | IIT JEE Mains/Advanced | Mohit Tyagi', 651),
      (18, 'WTzrqCw4uDY', 'Example of Integration by Substitution Method (Part 18)', '18 Example of Integration by Substitution Method   | IIT JEE Mains/Advanced | Mohit Tyagi', 574),
      (19, 'L1DUr6n42tY', 'Example of Integration by Substitution Method (Part 19)', '19 Example of Integration by Substitution Method | IIT JEE Mains/Advanced | Mohit Tyagi', 616),
      (20, 'LYK5Cu19uSk', 'Example of Integration by Substitution Method (Part 20)', '20 Example of Integration by Substitution Method | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 680),
      (21, 'N520TtT3XdM', 'Example of Integration by Substitution (Part 21)', '21 Example of Integration by Substitution | |IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 599),
      (22, 'sPEY9sHmL_w', 'Example of Integration by Substitution (Part 22)', '22 Example of Integration by Substitution | |IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 586),
      (23, 'ruq201GHBYE', 'Example of Integration by Substitution (Part 23)', '23 Example of Integration by Substitution | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 720),
      (24, 'nyoWm9dcDQE', 'Example of Integration by Substitution (Part 24)', '24 Example of Integration by Substitution | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 772),
      (25, 'UgeDuDImIAU', 'Example of Integration by Substitution (Part 25)', '25 Example of Integration by Substitution | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 518),
      (26, 'w_tqoaItR9o', 'Integration By Parts', '26 Integration By Parts | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 565),
      (27, 'W5EemGT7ifc', 'Integration by Parts — ILATE Rule', '27 Integration by Parts | ILATE Rule | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 621),
      (28, 'TEDS0Foa52k', 'Example Integration by parts Method', '28 Example Integration by parts Method | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 609),
      (29, 'wBn_FuKqS0o', 'Example of Integration using by-parts (Part 29)', '29 Example of Integration using by-parts | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 582),
      (30, 'zKUmCpuPpEc', 'Example of Integration using by-parts (Part 30)', '30 Example of Integration using by-parts | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 659),
      (31, 'wDcJY0kfjJ0', 'Example Integration using by parts (Part 31)', '31 Example Integration using by parts | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 575),
      (32, '8sdnlpqgPUI', 'Example Integration using by parts (Part 32)', '32 Example Integration using by parts | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 623),
      (33, 'Mkxw9tspM_s', 'Integration using by parts Formula & Example (Part 33)', '33 Integration using by parts Formula & Example | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 571),
      (34, 'l0f0Tc2KV7I', 'Integration using by parts Formula & Example (Part 34)', '34 Integration using by parts Formula & Example | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 796),
      (35, 'Ft-WMHhLnMw', 'Integration by Trigonometric substitution', '35 Integration by Trigonometric substitution | IIT JEE Mains/Advanced | Mohit Tyagi', 454),
      (36, 'ZSliDvE1ZL8', 'Shortcut for using integration by-parts', '36 Shortcut for using integration by-parts | IIT JEE Mains/Advanced | Mohit Tyagi', 613),
      (37, 'CcTDHpvnDPI', 'Example of Integration Trigonometric Substitution (Part 37)', '37 Example of Integration Trigonometric Substitution  | IIT JEE Mains/Advanced | Mohit Tyagi', 768),
      (38, 'T8Xdoq3ar_E', 'Example of Integration Trigonometric Substitution (Part 38)', '38 Example of Integration Trigonometric Substitution | IIT JEE Mains/Advanced | Mohit Tyagi', 751),
      (39, 'lTWa-1JwqmY', 'Standard Algebraic Integral Formula Integration', '39 Standard Algebraic Integral Formula Integration | IIT JEE Mains/Advanced | Mohit Tyagi', 564),
      (40, 'f0jjmSR-VTM', 'Standard Algebraic Integral Formula Integration ( — ) (Part 2)', '40 Standard Algebraic Integral Formula Integration (Part 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 615),
      (41, 'oJthMCPabFE', 'Integration Standard algebraic integral formula & Example', '41 Integration Standard algebraic integral formula & Example | IIT JEE Mains/Advanced | Mohit Tyagi', 478),
      (42, 'jlv4uaChlW4', 'Example of Integration By Parts (Part 42)', '42 Example of Integration By Parts | IIT JEE Mains/Advanced Maths', 481),
      (43, '4wDb7CbzMPI', 'Example of Integration By Parts (Part 43)', '43 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 679),
      (44, 'qIoYCIhxiLk', 'Example of Integration By Parts (Part 44)', '44 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 532),
      (45, 'AphlfX2CEAY', 'Example of Integration By Parts (Part 45)', '45 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 517),
      (46, 'J9TS2l7h6Yk', 'Example of Integration By Parts (Part 46)', '46 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 773),
      (47, 'wyHqQE2Wl04', 'Example of Integration By Parts (Part 47)', '47 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 630),
      (48, 'puwzjPbOGiM', 'Example of Integration By Parts (Part 48)', '48 Example of Integration By Parts | IIT JEE Mains/Advanced Maths | Mohit Tyagi', 817),
      (49, '2soDYPcMwd4', 'Integration using partial fractions (Part 49)', '49 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 684),
      (50, 'uhX8vPUi4Ug', 'Integration using partial fractions (Part 50)', '50 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 837),
      (51, '9ZtllmFpVJc', 'Integration using partial fractions (Part 51)', '51 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 736),
      (52, '1CFp96EZuYg', 'Integration using partial fractions (Part 52)', '52 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 694),
      (53, 'khvDfD1gg5w', 'Integration using partial fractions (Part 53)', '53 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 570),
      (54, 'rD0oeJfI0Ys', 'Integration using partial fractions (Part 54)', '54 Integration using partial fractions | IIT JEE Mains/Advanced | Mohit Tyagi Mathematics', 407),
      (55, 'UTpfKn9aZlc', 'Integration: Algebraic integral', '55 Integration: Algebraic integral | IIT JEE Mains/Advanced | Mohit Tyagi', 621),
      (56, 'teH8H4TDYw4', 'Integration: Example of Algebraic integral (Part 56)', '56 Integration: Example of Algebraic integral | IIT JEE Mains/Advanced | Mohit Tyagi', 427),
      (57, 'aaAdXz0ycW4', 'Integration: Example of Algebraic integral (Type 2)', '57 Integration: Example of Algebraic integral (Type 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 527),
      (58, 'gP_m8fg_m-E', 'Integration: Example of Algebraic integral (Type 3)', '58 Integration: Example of Algebraic integral (Type 3) | IIT JEE Mains/Advanced | Mohit Tyagi', 694),
      (59, 'wvr8c78e0rE', 'Integration: Example of Algebraic integral (Type 4)', '59 Integration: Example of Algebraic integral (Type 4) | IIT JEE Mains/Advanced | Mohit Tyagi', 555),
      (60, 'QsqPwayBRCc', 'Integration: Example of Algebraic integral (Type 5)', '60 Integration: Example of Algebraic integral (Type 5) | IIT JEE Mains/Advanced | Mohit Tyagi', 338),
      (61, 'Yvts7xFoxNU', 'Integration: Example of Algebraic integral (Type 6)', '61 Integration: Example of Algebraic integral (Type 6) | IIT JEE Mains/Advanced | Mohit Tyagi', 538),
      (62, 'oOf1513_sgQ', 'Integration: Example of Algebraic integral (Type 7)', '62 Integration: Example of Algebraic integral (Type 7) | IIT JEE Mains/Advanced | Mohit Tyagi', 586),
      (63, 'Z4255wYMaeo', 'Integration: Example of Algebraic integral (Part 63)', '63 Integration: Example of Algebraic integral |  IIT JEE Mains/Advanced | Mohit Tyagi', 627),
      (64, '1sJ_Is2VLgw', 'Integration: Example of Algebraic integral (Part 64)', '64 Integration: Example of Algebraic integral | IIT JEE Mains/Advanced | Mohit Tyagi', 585),
      (65, 'AzPYLB9KzPs', 'Integration: Example of Algebraic integral (Type 8 & 9)', '65 Integration: Example of Algebraic integral (Type 8 & 9) | IIT JEE Mains/Advanced | Mohit Tyagi', 783),
      (66, 'k4ukJftPlMk', 'Integration: Example of Algebraic integral (Type 10)', '66 Integration: Example of Algebraic integral (Type 10) | IIT JEE Mains/Advanced | Mohit Tyagi', 376),
      (67, 'HiT1wJ0RbKY', 'Integration: Example of Algebraic integral (Type 11) (Part 67)', '67 Integration: Example of Algebraic integral (Type 11) | IIT JEE Mains/Advanced | Mohit Tyagi', 559),
      (68, 'riF6uUUJj8s', 'Integration: Example of Algebraic integral (Type 11) (Part 68)', '68 Integration: Example of Algebraic integral (Type 11) | IIT JEE Mains/Advanced | Mohit Tyagi', 423),
      (69, 'nPrqFXQQISs', 'Integration: Example of Trigonometric Integration (T 1)', '69 Integration: Example of Trigonometric Integration (T 1) | IIT JEE Mains/Advanced | Mohit Tyagi', 516),
      (70, 'eQueGeuEdBY', 'Integration: Example of Trigonometric Integration (T 2)', '70 Integration: Example of Trigonometric Integration (T 2) | IIT JEE Mains/Advanced | Mohit Tyagi', 551),
      (71, 'yQr36Y2sgTY', 'Integration: Example of Trigonometric Integration (T 3)', '71 Integration: Example of Trigonometric Integration (T 3) | IIT JEE Mains/Advanced | Mohit Tyagi', 904),
      (72, '0R0Xmp4lPpI', 'Integration: Example of Trigonometric Integration (T 4) (Part 72)', '72 Integration: Example of Trigonometric Integration (T 4) | IIT JEE Mains/Advanced | Mohit Tyagi', 672),
      (73, 'mAF5n4fiSO0', 'Integration: Example of Trigonometric Integration (T 4) (Part 73)', '73 Integration: Example of Trigonometric Integration (T 4) | IIT JEE Mains/Advanced | Mohit Tyagi', 582),
      (74, 'zsNsCaOZR0s', 'Integration: Example of Trigonometric Integration (T 5)', '74 Integration: Example of Trigonometric Integration (T 5) | IIT JEE Mains/Advanced | Mohit Tyagi', 565),
      (75, 'ASgxGgTgILI', 'Integration: Example of Trigonometric Integration (T 6) (Part 75)', '75 Integration: Example of Trigonometric Integration (T 6) | IIT JEE Mains/Advanced | Mohit Tyagi', 714),
      (76, 'ayslWZYwwOg', 'Integration: Example of Trigonometric Integration (T 6) (Part 76)', '76 Integration: Example of Trigonometric Integration (T 6) | IIT JEE Mains/Advanced | Mohit Tyagi', 883),
      (77, 'CMOpJO9mTEs', 'Integration: Example of Trigonometric Integration (T 7)', '77 Integration: Example of Trigonometric Integration (T 7) | IIT JEE Mains/Advanced | Mohit Tyagi', 718),
      (78, 'ZtsVJPw4Lv4', 'Integration: Example of Trigonometric Integration (T 8)', '78 Integration: Example of Trigonometric Integration (T 8) | IIT JEE Mains/Advanced | Mohit Tyagi', 603),
      (79, 'mDxoMFFuHSE', 'Integration: Example of Trigonometric Integration (T 9)', '79 Integration: Example of Trigonometric Integration (T 9) | IIT JEE Mains/Advanced | Mohit Tyagi', 505),
      (80, 'bQ2hY0q5vXQ', 'Integration: Example of Trigonometric Integration (Part 80)', '80 Integration: Example of Trigonometric Integration | IIT JEE Mains/Advanced | Mohit Tyagi', 641),
      (81, 'jaOEELBaluE', 'Integration: Example of Trigonometric Integration (Part 81)', '81 Integration: Example of Trigonometric Integration | IIT JEE Mains/Advanced | Mohit Tyagi', 458),
      (82, '5ZxbW_vuTXM', 'Integration: Example of Trigonometric Integration (Part 82)', '82 Integration: Example of Trigonometric Integration | IIT JEE Mains/Advanced | Mohit Tyagi', 738),
      (83, '0dpTXufM5G4', 'Integration Forming exact derivative (Part 83)', '83 Integration Forming exact derivative | IIT JEE Mains/Advanced | Mohit Tyagi Maths', 486),
      (84, '5WDh_8CyD5Y', 'Integration Forming exact derivative (Part 84)', '84 Integration Forming exact derivative | IIT JEE Mains/Advanced | Mohit Tyagi Maths', 411),
      (85, 'Ccot7wbptCA', 'Integration: Example Forming exact derivative (Part 85)', '85 Integration: Example Forming exact derivative | IIT JEE Mains/Advanced | Mohit Tyagi Maths', 601),
      (86, '_2ftgVurJOI', 'Integration: Example Forming exact derivative (Part 86)', '86 Integration: Example Forming exact derivative | IIT JEE Mains/Advanced | Mohit Tyagi Maths', 496),
      (87, 'gYOKdkgj6Ec', 'Integration Forcing integral using by-parts with Example', '87 Integration Forcing integral using by-parts with Example | IIT JEE Mains/Advanced | Mohit Tyagi', 557)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 278, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 87 then
    raise exception 'expected 87 lessons for "%", inserted %', 'Indefinite Integration', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 278
  ) < 2 then
    raise exception 'chapter 278 still has fewer than two teaching voices after import';
  end if;
end $$;
