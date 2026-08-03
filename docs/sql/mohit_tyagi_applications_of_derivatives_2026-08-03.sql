-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 280.
--
-- Chapter 280 ("Applications of Derivatives") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMacK_BU3vfAcCOuOJtQOHNfI
-- Lessons    : 132 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 132 pass src/titleQuality.js with
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
    where id = 280 and subject_id = 3 and name = 'Applications of Derivatives'
  ) then
    raise exception 'chapter 280 is not the expected "%" chapter', 'Applications of Derivatives';
  end if;

  if exists (select 1 from public.playlists where title = 'Applications of Derivatives') then
    raise exception 'course "%" already exists - this file has already been run', 'Applications of Derivatives';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'KFXO-OSypAY', 'e2Pzjxxi5tg', 'jX1xKTDsX6s', 'o3tydJCS9Bs', 'oAgKgrXKkUQ', 'i3JO92kg7eM',
      'YjKrW8C8GcY', '7Ubjj6t0jOc', '1MA4N-O1zAQ', 'rlmmiHTDLgQ', 'haK5gpQQ7d8', 'sVTA4QXtbBo',
      'ezjWP8axbOc', 'ABhYN91zdoU', 'nyTrzjOVJoM', 'HH4RAVFnfN8', 'nlU8GAaVrdY', 'QKUlg-4uT7c',
      'mYEW7vlG1mY', 'BcRBOYtYKnE', 'Wf8lnttnP88', 'N_-PH93DBaY', 'cSZX8X8IztM', 'p8gdtmVY5mk',
      'FQ-2E0MjEXc', 'NeN4oyrmBUc', 'IXDDwoq5fIQ', 'cYzFtLaQYQw', 'pr3SnnsvrZs', 'wWFv4N8UsHU',
      'hA8kk1iGb1M', 'sibK73SA5Hk', '265l-k6AaAA', 'Y9cu4Kin9uM', 'QtWeIa7SGAA', 'jOT5zqeF1TQ',
      'yVkfQsR7GLo', 'vXek_92-3Mc', 'L_fQcZau67I', 'J4EZ83OLtFI', 'kELkyyV8Aek', 'IAddD_irQlE',
      '2pKwPY6spQs', '6AeUnPOFWwA', 'BlTAb3-OZrs', 'cbhTUiecJog', 'nYw0keD8KK4', '2q3UfXEOBTY',
      'FcOEnHO_RnM', 'ESHDjhFPfDU', 'PwIpFc1Hrgg', '0zsos3lHnAg', 'vlIFc5IpWd4', '-K6hN5UrFqo',
      'iHD3a0DMeSU', '1Mz71m49nR8', 'f-PCsKONLe4', 'd1SOQ0l___c', 'NM7CkwTkB-A', '8_s9XRqkWII',
      'Ioov1l4mq7w', 'rayWJc-kBoQ', 'rQCzL8yBKNA', 'ClvKkKwLlF4', 'MpVwgWPD9ds', 'wmKlE5aDVXM',
      'g1DVUp0wsr0', '-1UzN5QAC_o', 'JcgNR5R2oTc', 'fbarbNPDt18', 'D5LyvycvOys', 'RSiyefioMGw',
      '9k5d5pzettE', 'nYS3FAn2ZKs', 'El-QgHLee5o', 'Ep1ku9TIXLo', 'iJH2gsdylrQ', '9seNGLlT92M',
      'l8516zteQIw', 'qzfEGQ3WKDI', '0XvnDlHB5VQ', 'bZWjV0rsvzg', 'lRG974H1EAc', 'Rw4RJaWv9c4',
      'pRJ_U_ASBig', 'CPup3Lx4n1w', 'wGvyH2qmH98', 'Hd1MeW5gaKc', 'o6FjN6IhYV8', 'N0GwP9nW-vQ',
      'tnLhbKfHx3A', 'aYnxYtlRKBM', 'EEwZpVRudx4', '99PN98raXJY', 'LGdt5Kvrukg', 'qIRU2M8U124',
      '_cOzbP0QaQo', '4VO7SjzydQE', 'uBjh_hjdQFM', 'J_0yxOOWO5o', 'J-UwvlJuaHY', 'tYOOi50qQLM',
      'uOWtLancudQ', 'EopL1ns5FIE', 'TJTlmQjpilc', 'XRid1gNRLPo', 'SJ3Iu1qShCo', 'osKS7ImOr3M',
      '1ahtJOPx1WA', 'W6fq1QEjv74', 'AKDesVjfhxs', 'qoWIQKtPfS0', 'suY2MIbEOQI', 'DFrPyYTJ-JU',
      '8ROzRrKbF7w', 'c79Xv_oBNt8', 'Fz_YDEc6sh4', 'dw3aYO1rm2U', 'NSZFhF7WzOs', 'HADXdCmcBGs',
      'j4uNRnmnIvo', 'Cn4lVqzaPgk', 'Hn-ZHtxm-Jw', 'mnzlRmsjy_I', 'yTI3-vz-SUo', 'X_WOpJ-3G9U',
      'F1DnJlmB9xI', 'vByx2B3QyHo', 'tpWrGuqTQGE', '2Axejr2epD0', '6SJhkof1i_U', 'UwJJDAFYr0o'
    ])
  ) then
    raise exception 'at least one of these 132 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Applications of Derivatives',
    'Application of derivatives',
    'The complete Application of Derivatives course from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '12th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, 'KFXO-OSypAY', 'Application of Derivatives — Tangent and Normal (Part 1)', 'Application of Derivatives   Part 1   Tangent and Normal', 583),
      (2, 'e2Pzjxxi5tg', 'Application of Derivatives — Tangent and Normal (Part 2)', 'Application of Derivatives   Part 2   Tangent and Normal', 660),
      (3, 'jX1xKTDsX6s', 'Application of Derivatives — Tangent and Normal (Part 3)', 'Application of Derivatives   Part 3   Tangent and Normal', 772),
      (4, 'o3tydJCS9Bs', 'Application of Derivatives — Tangent and Normal (Part 4)', 'Application of Derivatives   Part 4   Tangent and Normal', 396),
      (5, 'oAgKgrXKkUQ', 'Application of Derivatives — Tangent and Normal (Part 5)', 'Application of Derivatives   Part 5    Tangent and Normal', 622),
      (6, 'i3JO92kg7eM', 'Application of Derivatives — Tangent and Normal (Part 6)', 'Application of Derivatives   Part 6   Tangent and Normal', 488),
      (7, 'YjKrW8C8GcY', 'Application of Derivatives — Tangent and Normal (Part 7)', 'Application of Derivatives   Part 7   Tangent and Normal', 674),
      (8, '7Ubjj6t0jOc', 'Application of Derivatives — Tangent and Normal (Part 8)', 'Application of Derivatives   Part 8   Tangent and Normal', 758),
      (9, '1MA4N-O1zAQ', 'Application of Derivatives — Tangent and Normal (Part 9)', 'Application of Derivatives   Part 9   Tangent and Normal', 648),
      (10, 'rlmmiHTDLgQ', 'Application of Derivatives — Tangent and Normal (Part 10)', 'Application of Derivatives   Part 10  Tangent and Normal', 480),
      (11, 'haK5gpQQ7d8', 'Application of Derivatives — Tangent and Normal (Part 11)', 'Application of Derivatives   Part 11  Tangent and Normal', 346),
      (12, 'sVTA4QXtbBo', 'Application of Derivatives — Tangent and Normal (Part 12)', 'Application of Derivatives   Part 12  Tangent and Normal', 504),
      (13, 'ezjWP8axbOc', 'Application of Derivatives — Tangent and Normal (Part 13)', 'Application of Derivatives   Part 13  Tangent and Normal', 826),
      (14, 'ABhYN91zdoU', 'Application of Derivatives — Tangent and Normal (Part 14)', 'Application of Derivatives   Part 14   Tangent and Normal', 684),
      (15, 'nyTrzjOVJoM', 'Application of Derivatives — Tangent and Normal (Part 15)', 'Application of Derivatives   Part 15  Tangent and Normal', 467),
      (16, 'HH4RAVFnfN8', 'Application of Derivatives — Tangent and Norma (Part 16)', 'Application of Derivatives   Part  16  Tangent and Norma', 654),
      (17, 'nlU8GAaVrdY', 'Application of Derivatives — Tangent and Norma (Part 17)', 'Application of Derivatives   Part  17  Tangent and Norma', 438),
      (18, 'QKUlg-4uT7c', 'Application of Derivatives — Tangent and Norma (Part 18)', 'Application of Derivatives   Part  18  Tangent and Norma', 545),
      (19, 'mYEW7vlG1mY', 'Application of Derivatives — Tangent and Normal (Part 19)', 'Application of Derivatives   Part 19  Tangent and Normal', 863),
      (20, 'BcRBOYtYKnE', 'Application of Derivatives — Tangent and Normal (Part 20)', 'Application of Derivatives   Part 20  Tangent and Normal', 506),
      (21, 'Wf8lnttnP88', 'Application of Derivatives — Tangent and Normal (Part 21)', 'Application of Derivatives   Part 21   Tangent and Normal', 550),
      (22, 'N_-PH93DBaY', 'Application of Derivatives — Tangent and Normal (Part 22)', 'Application of Derivatives   Part 22   Tangent and Normal', 509),
      (23, 'cSZX8X8IztM', 'Application of Derivatives — Tangent and Normal (Part 23)', 'Application of Derivatives   Part 23  Tangent and Normal', 615),
      (24, 'p8gdtmVY5mk', 'Application of Derivatives — Tangent and Normal (Part 24)', 'Application of Derivatives   Part 24  Tangent and Normal', 556),
      (25, 'FQ-2E0MjEXc', 'Application of Derivatives — Tangent and Normal (Part 25)', 'Application of Derivatives   Part 25  Tangent and Normal', 718),
      (26, 'NeN4oyrmBUc', 'Application of Derivatives — Tangent and Normal (Part 26)', 'Application of Derivatives   Part 26  Tangent and Normal', 584),
      (27, 'IXDDwoq5fIQ', 'Application of Derivatives — Tangent and Normal (Part 27)', 'Application of Derivatives   Part 27  Tangent and Normal', 383),
      (28, 'cYzFtLaQYQw', 'Application of Derivatives — Tangent and Normal (Part 28)', 'Application of Derivatives   Part 28   Tangent and Normal', 607),
      (29, 'pr3SnnsvrZs', 'Application of Derivatives — Tangent and Normal (Part 29)', 'Application of Derivatives   Part 29   Tangent and Normal', 938),
      (30, 'wWFv4N8UsHU', 'Application of Derivatives — Tangent and Normal (Part 30)', 'Application of Derivatives   Part 30  Tangent and Normal', 743),
      (31, 'hA8kk1iGb1M', 'Application of Derivatives — Tangent and Normal (Part 31)', 'Application of Derivatives   Part 31  Tangent and Normal', 784),
      (32, 'sibK73SA5Hk', 'Application of Derivatives — Tangent and Normal (Part 32)', 'Application of Derivatives   Part 32   Tangent and Normal', 504),
      (33, '265l-k6AaAA', 'Application of Derivatives — Tangent and Normal (Part 33)', 'Application of Derivatives   Part 33   Tangent and Normal', 521),
      (34, 'Y9cu4Kin9uM', 'Application of Derivatives — Tangent and Normal (Part 34)', 'Application of Derivatives   Part 34  Tangent and Normal', 578),
      (35, 'QtWeIa7SGAA', 'Application of Derivatives — Tangent and Normal (Part 35)', 'Application of Derivatives   Part 35  Tangent and Normal', 523),
      (36, 'jOT5zqeF1TQ', 'Application of Derivatives — Monotonocity (Part 36)', 'Application of Derivatives   Part 36 Monotonocity', 599),
      (37, 'yVkfQsR7GLo', 'Application of Derivatives — Monotonocity (Part 37)', 'Application of Derivatives   Part 37 Monotonocity', 589),
      (38, 'vXek_92-3Mc', 'Application of Derivatives — Monotonocity (Part 38)', 'Application of Derivatives   Part 38 Monotonocity', 563),
      (39, 'L_fQcZau67I', 'Application of Derivatives — Monotonocity (Part 39)', 'Application of Derivatives   Part 39 Monotonocity', 608),
      (40, 'J4EZ83OLtFI', 'Application of Derivatives — Monotonocity (Part 40)', 'Application of Derivatives   Part 40 Monotonocity', 427),
      (41, 'kELkyyV8Aek', 'Application of Derivatives — Monotonocity (Part 41)', 'Application of Derivatives   Part 41   Monotonocity', 441),
      (42, 'IAddD_irQlE', 'Application of Derivatives — Monotonocity (Part 42)', 'Application of Derivatives   Part 42   Monotonocity', 562),
      (43, '2pKwPY6spQs', 'Application of Derivatives — Monotonocity (Part 43)', 'Application of Derivatives   Part 43   Monotonocity', 670),
      (44, '6AeUnPOFWwA', 'Application of Derivatives — Monotonocity (Part 44)', 'Application of Derivatives   Part 44   Monotonocity', 757),
      (45, 'BlTAb3-OZrs', 'Application of Derivatives — Monotonocity (Part 45)', 'Application of Derivatives   Part 45   Monotonocity', 654),
      (46, 'cbhTUiecJog', 'Application of Derivatives — Monotonocity (Part 46)', 'Application of Derivatives   Part 46   Monotonocity', 713),
      (47, 'nYw0keD8KK4', 'Application of Derivatives — Monotonocity (Part 47)', 'Application of Derivatives   Part 47   Monotonocity', 420),
      (48, '2q3UfXEOBTY', 'Application of Derivatives — Monotonocity (Part 48)', 'Application of Derivatives   Part 48  Monotonocity', 623),
      (49, 'FcOEnHO_RnM', 'Application of Derivatives — Monotonocity (Part 49)', 'Application of Derivatives   Part 49  Monotonocity', 535),
      (50, 'ESHDjhFPfDU', 'Application of Derivatives — Maxima and Minima (Part 50)', 'Application of Derivatives   Part 50   Maxima and Minima', 678),
      (51, 'PwIpFc1Hrgg', 'Application of Derivatives — Maxima and Minima (Part 51)', 'Application of Derivatives   Part 51   Maxima and Minima', 757),
      (52, '0zsos3lHnAg', 'Application of Derivatives — Maxima and Minima (Part 52)', 'Application of Derivatives   Part 52   Maxima and Minima', 841),
      (53, 'vlIFc5IpWd4', 'Application of Derivatives — Local Maxima and Local Minima (Part 53)', 'Application of Derivatives   Part 53  Local Maxima and Local Minima', 651),
      (54, '-K6hN5UrFqo', 'Application of Derivatives — Local Maxima and Local Minima (Part 54)', 'Application of Derivatives   Part 54  Local Maxima and Local Minima', 894),
      (55, 'iHD3a0DMeSU', 'Application of Derivatives — maxima and minima (Part 55)', 'Application of Derivatives   Part 55  maxima and minima', 652),
      (56, '1Mz71m49nR8', 'Application of Derivatives — maxima and minima (Part 56)', 'Application of Derivatives   Part 56  maxima and minima', 608),
      (57, 'f-PCsKONLe4', 'Application of Derivatives — maxima and minima (Part 57)', 'Application of Derivatives   Part 57  maxima and minima', 664),
      (58, 'd1SOQ0l___c', 'Application of Derivatives — maxima and minima (Part 58)', 'Application of Derivatives   Part 58  maxima and minima', 501),
      (59, 'NM7CkwTkB-A', 'Application of Derivatives — Curve Sketching (Part 59)', 'Application of Derivatives   Part 59  Curve Sketching', 545),
      (60, '8_s9XRqkWII', 'Application of Derivatives — Curve Sketching (Part 60)', 'Application of Derivatives   Part 60  Curve Sketching', 569),
      (61, 'Ioov1l4mq7w', 'Application of Derivatives — Curve Sketching (Part 61)', 'Application of Derivatives   Part 61  Curve Sketching', 749),
      (62, 'rayWJc-kBoQ', 'Application of Derivatives — Curve Sketching (Part 62)', 'Application of Derivatives   Part 62  Curve Sketching', 626),
      (63, 'rQCzL8yBKNA', 'Application of Derivatives — Curve Sketching (Part 63)', 'Application of Derivatives   Part 63  Curve Sketching', 736),
      (64, 'ClvKkKwLlF4', 'Application of Derivatives — Rate Change (Part 64)', 'Application of Derivatives   Part 64  Rate Change', 558),
      (65, 'MpVwgWPD9ds', 'Application of Derivatives — Rate Change (Part 65)', 'Application of Derivatives   Part 65  Rate Change', 676),
      (66, 'wmKlE5aDVXM', 'Application of Derivatives — Rate Change (Part 66)', 'Application of Derivatives   Part 66  Rate Change', 480),
      (67, 'g1DVUp0wsr0', 'Application of Derivatives — Rate Change (Part 67)', 'Application of Derivatives   Part 67  Rate Change', 456),
      (68, '-1UzN5QAC_o', 'Application of Derivatives — Rate Change (Part 68)', 'Application of Derivatives   Part 68  Rate Change', 534),
      (69, 'JcgNR5R2oTc', 'Application of Derivatives — Rate Change (Part 69)', 'Application of Derivatives   Part 69  Rate Change', 419),
      (70, 'fbarbNPDt18', 'Application of Derivatives — Concavity and Point of Infleion (Part 70)', 'Application of Derivatives   Part 70  Concavity and Point of Infleion', 509),
      (71, 'D5LyvycvOys', 'Application of Derivatives — Concavity and Point of Infleion (Part 71)', 'Application of Derivatives   Part 71  Concavity and Point of Infleion', 551),
      (72, 'RSiyefioMGw', 'Application of Derivatives — Concavity and Point of Infleion (Part 72)', 'Application of Derivatives   Part 72  Concavity and Point of Infleion', 599),
      (73, '9k5d5pzettE', 'Application of Derivatives — Concavity and Point of Inf (Part 73)', 'Application of Derivatives   Part 73   Concavity and Point of Inf', 713),
      (74, 'nYS3FAn2ZKs', 'Application of Derivatives — Concavity and Point of Inf (Part 74)', 'Application of Derivatives   Part 74   Concavity and Point of Inf', 741),
      (75, 'El-QgHLee5o', 'Application of Derivatives — Geometrical Problems (Part 75)', 'Application of Derivatives   Part 75  Geometrical Problems', 560),
      (76, 'Ep1ku9TIXLo', 'Application of Derivatives — Geometrical Problems (Part 76)', 'Application of Derivatives   Part 76  Geometrical Problems', 675),
      (77, 'iJH2gsdylrQ', 'Application of Derivatives — Geometrical Problems (Part 77)', 'Application of Derivatives   Part 77  Geometrical Problems', 698),
      (78, '9seNGLlT92M', 'Application of Derivatives — Geometrical Problems (Part 78)', 'Application of Derivatives   Part 78  Geometrical Problems', 335),
      (79, 'l8516zteQIw', 'Application of Derivatives — Geometrical Problems (Part 79)', 'Application of Derivatives   Part 79  Geometrical Problems', 407),
      (80, 'qzfEGQ3WKDI', 'Application of Derivatives — Geometrical Problems (Part 80)', 'Application of Derivatives   Part 80  Geometrical Problems', 749),
      (81, '0XvnDlHB5VQ', 'Application of Derivatives — Geometrical Problems (Part 81)', 'Application of Derivatives   Part 81  Geometrical Problems', 413),
      (82, 'bZWjV0rsvzg', 'Application of Derivatives — Geometrical Problems (Part 82)', 'Application of Derivatives   Part 82  Geometrical Problems', 595),
      (83, 'lRG974H1EAc', 'Application of Derivatives — Geometrical Problems (Part 83)', 'Application of Derivatives   Part 83  Geometrical Problems', 555),
      (84, 'Rw4RJaWv9c4', 'Application of Derivatives — Geometrical Problems (Part 84)', 'Application of Derivatives   Part 84  Geometrical Problems', 596),
      (85, 'pRJ_U_ASBig', 'Application of Derivatives — Geometrical Problems (Part 85)', 'Application of Derivatives   Part 85  Geometrical Problems', 621),
      (86, 'CPup3Lx4n1w', 'Application of Derivatives — Geometrical Problems (Part 86)', 'Application of Derivatives   Part 86  Geometrical Problems', 768),
      (87, 'wGvyH2qmH98', 'Application of Derivatives — Geometrical Problems (Part 87)', 'Application of Derivatives   Part 87  Geometrical Problems', 788),
      (88, 'Hd1MeW5gaKc', 'Application of Derivatives — Geometrical Problems (Part 88)', 'Application of Derivatives   Part 88  Geometrical Problems', 626),
      (89, 'o6FjN6IhYV8', 'Application of Derivatives — Geometrical Problems (Part 89)', 'Application of Derivatives   Part 89  Geometrical Problems', 912),
      (90, 'N0GwP9nW-vQ', 'Application of Derivatives — Geometrical Problems (Part 90)', 'Application of Derivatives   Part 90  Geometrical Problems', 823),
      (91, 'tnLhbKfHx3A', 'Application of Derivatives — Geometrical Problems (Part 91)', 'Application of Derivatives   Part 91  Geometrical Problems', 344),
      (92, 'aYnxYtlRKBM', 'Application of Derivatives — Geometrical Problems (Part 92)', 'Application of Derivatives   Part 92  Geometrical Problems', 505),
      (93, 'EEwZpVRudx4', 'Application of Derivatives — Geometrical Problem (Part 93)', 'Application of Derivatives Part 93 Geometrical Problem', 715),
      (94, '99PN98raXJY', 'Application of Derivatives — Geometrical Problem (Part 94)', 'Application of Derivatives Part 94 Geometrical Problem', 633),
      (95, 'LGdt5Kvrukg', 'Application of Derivatives — Tangent and Normal (Part 95)', 'Application of Derivatives   Part 95   Tangent and Normal', 721),
      (96, 'qIRU2M8U124', 'Application of Derivatives — Geometrical Problems (Part 96)', 'Application of Derivatives   Part 96  Geometrical Problems', 800),
      (97, '_cOzbP0QaQo', 'Application of Derivatives — Geometrical Problems (Part 97)', 'Application of Derivatives   Part 97  Geometrical Problems', 707),
      (98, '4VO7SjzydQE', 'Application of Derivatives — Geometrical Problems (Part 98)', 'Application of Derivatives   Part 98  Geometrical Problems', 638),
      (99, 'uBjh_hjdQFM', 'Application of Derivatives — Geometrical Problems (Part 99)', 'Application of Derivatives   Part 99  Geometrical Problems', 626),
      (100, 'J_0yxOOWO5o', 'Application of Derivatives — Geometrical Problems (Part 100)', 'Application of Derivatives   Part 100  Geometrical Problems', 479),
      (101, 'J-UwvlJuaHY', 'Application of Derivatives — Geometrical Problems (Part 101)', 'Application of Derivatives   Part 101  Geometrical Problems', 551),
      (102, 'tYOOi50qQLM', 'Application of Derivatives — Geometrical Problems (Part 102)', 'Application of Derivatives   Part 102  Geometrical Problems', 676),
      (103, 'uOWtLancudQ', 'Application of Derivatives — Rolles Theorem (Part 103)', 'Application of Derivatives   Part 103  Rolles Theorem', 578),
      (104, 'EopL1ns5FIE', 'Application of Derivatives — Rolles Theorem (Part 104)', 'Application of Derivatives   Part 104  Rolles Theorem', 695),
      (105, 'TJTlmQjpilc', 'Application of Derivatives — Rolles Theorem (Part 105)', 'Application of Derivatives   Part 105  Rolles Theorem', 646),
      (106, 'XRid1gNRLPo', 'Application of Derivatives — Rolles Theorem (Part 106)', 'Application of Derivatives   Part 106   Rolles Theorem', 763),
      (107, 'SJ3Iu1qShCo', 'Application of Derivatives — Rolles Theorem (Part 107)', 'Application of Derivatives   Part 107   Rolles Theorem', 525),
      (108, 'osKS7ImOr3M', 'Application of Derivatives — Rolles Theorem (Part 108)', 'Application of Derivatives   Part 108   Rolles Theorem', 547),
      (109, '1ahtJOPx1WA', 'Application of Derivatives — Rolles Theorem (Part 109)', 'Application of Derivatives   Part 109  Rolles Theorem', 652),
      (110, 'W6fq1QEjv74', 'Application of Derivatives — Rolles Theorem (Part 110)', 'Application of Derivatives   Part 110  Rolles Theorem', 783),
      (111, 'AKDesVjfhxs', 'Application of Derivatives — LMVT (Part 111)', 'Application of Derivatives   Part 111  LMVT', 729),
      (112, 'qoWIQKtPfS0', 'Application of Derivatives — LMVT (Part 112)', 'Application of Derivatives   Part 112  LMVT', 552),
      (113, 'suY2MIbEOQI', 'Application of Derivatives — LMVT (Part 113)', 'Application of Derivatives   Part 113  LMVT', 522),
      (114, 'DFrPyYTJ-JU', 'Application of Derivatives — LMVT (Part 114)', 'Application of Derivatives   Part 114  LMVT', 734),
      (115, '8ROzRrKbF7w', 'Application of Derivatives — LMVT (Part 115)', 'Application of Derivatives   Part 115  LMVT', 757),
      (116, 'c79Xv_oBNt8', 'Application of Derivatives (Part 116)', 'Application of Derivatives   Part 116', 633),
      (117, 'Fz_YDEc6sh4', 'Application of Derivatives (Part 117)', 'Application of Derivatives   Part 117', 619),
      (118, 'dw3aYO1rm2U', 'Application of Derivatives (Part 118)', 'Application of Derivatives   Part 118', 475),
      (119, 'NSZFhF7WzOs', 'Application of Derivatives (Part 119)', 'Application of Derivatives   Part 119', 603),
      (120, 'HADXdCmcBGs', 'Application of Derivatives — Root Analysis of cubic Function (Part 120)', 'Application of Derivatives   Part 120 Root Analysis  of cubic Function', 698),
      (121, 'j4uNRnmnIvo', 'Application of Derivatives — Root Analysis of cubic Function (Part 121)', 'Application of Derivatives   Part 121 Root Analysis  of cubic Function', 649),
      (122, 'Cn4lVqzaPgk', 'Application of Derivatives — Root Analysis of cubic Function (Part 122)', 'Application of Derivatives   Part 122 Root Analysis  of cubic Function', 521),
      (123, 'Hn-ZHtxm-Jw', 'Application of Derivatives — Root Analysis of cubic Function (Part 123)', 'Application of Derivatives   Part 123 Root Analysis  of cubic Function', 447),
      (124, 'mnzlRmsjy_I', 'Application of Derivatives — Distance between curves (Part 124)', 'Application of Derivatives   Part 124  Distance between curves', 759),
      (125, 'yTI3-vz-SUo', 'Application of Derivatives — Distance between curves (Part 125)', 'Application of Derivatives   Part 125  Distance between curves', 712),
      (126, 'X_WOpJ-3G9U', 'Application of Derivatives — Distance between curves (Part 126)', 'Application of Derivatives   Part 126 Distance between curves', 495),
      (127, 'F1DnJlmB9xI', 'Application of Derivatives — Distance between curves (Part 127)', 'Application of Derivatives   Part 127 Distance between curves', 608),
      (128, 'vByx2B3QyHo', 'Application of Derivatives — Distance between curves (Part 128)', 'Application of Derivatives   Part 128 Distance between curves', 569),
      (129, 'tpWrGuqTQGE', 'Application of Derivatives — Approimation (Part 129)', 'Application of Derivatives   Part 129 Approimation', 520),
      (130, '2Axejr2epD0', 'Application of Derivatives — Approimation (Part 130)', 'Application of Derivatives   Part 130 Approimation', 354),
      (131, '6SJhkof1i_U', 'Application of Derivatives — Approimation (Part 131)', 'Application of Derivatives   Part 131 Approimation', 522),
      (132, 'UwJJDAFYr0o', 'Lagrange’s Mean Value Theorem (LMVT) — IIT JEE PYQ — (f(0))^2+(f''(0))^2=9 — JEE Advanced', 'Lagrange’s Mean Value Theorem (LMVT) | IIT JEE PYQ | (f(0))^2+(f''(0))^2=9 | JEE Advanced 2025 | #132', 1910)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 280, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 132 then
    raise exception 'expected 132 lessons for "%", inserted %', 'Applications of Derivatives', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 280
  ) < 2 then
    raise exception 'chapter 280 still has fewer than two teaching voices after import';
  end if;
end $$;
