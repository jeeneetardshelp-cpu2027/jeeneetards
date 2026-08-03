-- CREATE-ONLY import: a second teaching voice for JEE Mathematics chapter 282.
--
-- Chapter 282 ("Fundamentals of Mathematics") currently carries lessons from ONE institute, so a
-- student comparing teaching styles has nothing to compare. This adds the
-- complete Mohit Tyagi course for the same chapter.
--
-- Source     : https://www.youtube.com/playlist?list=PL_A4M5IAkMafig81EHnu345hUAHXOhe46
-- Lessons    : 38 (the playlist's full declared count, enumerated in playlist order)
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "Mohit Tyagi" and a title byte-identical
--              to the source_title recorded here.
-- Titles     : "title" is the cleaned display title (leading playlist numbering,
--              channel branding and exam tags removed); "source_title" preserves
--              YouTube's original verbatim. All 38 pass src/titleQuality.js with
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
  select id into strict v_class_id from public.class_levels where slug = 'class-11';
  select id into strict v_dropper_id from public.class_levels where slug = 'dropper';

  -- Guard the target rather than a global row count, so these six files can be
  -- run in any order and a re-run fails loudly instead of duplicating lessons.
  if not exists (
    select 1 from public.chapters
    where id = 282 and subject_id = 3 and name = 'Fundamentals of Mathematics'
  ) then
    raise exception 'chapter 282 is not the expected "%" chapter', 'Fundamentals of Mathematics';
  end if;

  if exists (select 1 from public.playlists where title = 'Basic Mathematics and Inequalities') then
    raise exception 'course "%" already exists - this file has already been run', 'Basic Mathematics and Inequalities';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'dJHWsbcjAsY', '_QhuZjZ4c5c', '71TLHh8ZdfA', 'mktCRM85LF8', 'e2yLC9Bvsek', 'rU56m3Ng09Y',
      'dKye7iIfbsM', 'qA4uqRPJTag', 'ciXPCWSeh6Q', 'w8sPOpII8Qk', 'SBs3q76kS30', 'mwkf1kPxawA',
      'mfvf22yoSD8', 'rEji0cJlkrg', 'ej0B0AVlpZ0', 'hqmh-IG0w9w', 'LOEu_Oe5pQ0', '0V699FrxpnQ',
      'wSgZHpLZP1I', 'X4U_TGsqTfo', '25prc-ZZEGg', 'ynYuoEv1RxA', 'T4kQNaOTgvU', 'SqbMyDdQYlo',
      'WlFMtau445s', '0UxJBr34vnc', 'TRGF-32Tm-0', '5GeoDMNJ2LM', 'Uo4H_eZaiWE', 'xtopanshUIE',
      '8cwFfTnYxZk', 'i36h2U3GKzY', 'fLWqVkIdhKo', '6Ft4Uxnuyl4', 'w0MAx1xWlj0', 'mvvNTUewuJ4',
      'tNI4kF7Sh_4', 'SmcyU_hig0Y'
    ])
  ) then
    raise exception 'at least one of these 38 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty, audience_focus
  ) values (
    'Basic Mathematics and Inequalities',
    'Basic Mathematics-Inequalities',
    'Basic mathematics and inequalities from the official Mohit Tyagi playlist, in teaching order.',
    'Mohit Tyagi', v_channel_id, 1, 3, 'full-course', 'hinglish',
    'advanced', '11th'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);
  insert into public.playlist_class_levels (playlist_id, class_level_id)
  values (v_playlist_id, v_class_id), (v_playlist_id, v_dropper_id);

  for v_row in
    select * from (values
      (1, 'dJHWsbcjAsY', 'Basic Mathematics (Part 1)', 'Basic Mathematics   Part 1   IIT JEE', 607),
      (2, '_QhuZjZ4c5c', 'Basic Mathematics (Part 2)', 'Basic Mathematics   Part 2   IIT JEE', 624),
      (3, '71TLHh8ZdfA', 'Basic Mathematics (Part 3)', 'Basic Mathematics   Part 3   IIT JEE', 682),
      (4, 'mktCRM85LF8', 'Basic Mathematics (Part 4)', 'Basic Mathematics   Part 4   IIT JEE', 640),
      (5, 'e2yLC9Bvsek', 'Basic Mathematics (Part 5)', 'Basic Mathematics   Part 5   IIT JEE', 584),
      (6, 'rU56m3Ng09Y', 'Basic Mathematics (Part 6)', 'Basic Mathematics   Part 6   IIT JEE', 578),
      (7, 'dKye7iIfbsM', 'Basic Mathematics (Part 7)', 'Basic Mathematics   Part 7   IIT JEE', 573),
      (8, 'qA4uqRPJTag', 'Basic Mathematics (Part 8)', 'Basic Mathematics   Part 8   IIT JEE', 398),
      (9, 'ciXPCWSeh6Q', 'Basic Mathematics (Part 9)', 'Basic Mathematics   Part 9   IIT JEE', 496),
      (10, 'w8sPOpII8Qk', 'Basic Mathematics (Part 10)', 'Basic Mathematics   Part 10   IIT JEE', 670),
      (11, 'SBs3q76kS30', 'Basic Mathematics (Part 11)', 'Basic Mathematics   Part 11   IIT JEE', 402),
      (12, 'mwkf1kPxawA', 'Basic Mathematics (Part 12)', 'Basic Mathematics   Part 12  IIT JEE', 642),
      (13, 'mfvf22yoSD8', 'Basic Mathematics (Part 13)', 'Basic Mathematics   Part 13  IIT JEE', 563),
      (14, 'rEji0cJlkrg', 'Basic Mathematics (Part 14)', 'Basic Mathematics   Part 14  IIT JEE', 530),
      (15, 'ej0B0AVlpZ0', 'Basic Mathematics (Part 15)', 'Basic Mathematics   Part 15  IIT JEE', 338),
      (16, 'hqmh-IG0w9w', 'Basic Mathematics (Part 16)', 'Basic Mathematics   Part 16  IIT JEE', 639),
      (17, 'LOEu_Oe5pQ0', 'Basic Mathematics (Part 17)', 'Basic Mathematics   Part 17  IIT JEE', 722),
      (18, '0V699FrxpnQ', 'Basic Mathematics (Part 18)', 'Basic Mathematics   Part 18  IIT JEE', 546),
      (19, 'wSgZHpLZP1I', 'Basic Mathematics (Part 19)', 'Basic Mathematics   Part 19  IIT JEE', 472),
      (20, 'X4U_TGsqTfo', 'Basic Mathematics (Part 20)', 'Basic Mathematics   Part 20  IIT JEE', 608),
      (21, '25prc-ZZEGg', 'Basic Mathematics (Part 21)', 'Basic Mathematics   Part 21  IIT JEE', 620),
      (22, 'ynYuoEv1RxA', 'Basic Mathematics (Part 22)', 'Basic Mathematics   Part 22  IIT JEE', 517),
      (23, 'T4kQNaOTgvU', 'Basic Mathematics (Part 23)', 'Basic Mathematics   Part 23  IIT JEE', 451),
      (24, 'SqbMyDdQYlo', 'Basic Mathematics (Part 24)', 'Basic Mathematics   Part 24  IIT JEE', 650),
      (25, 'WlFMtau445s', 'Basic Mathematics (Part 25)', 'Basic Mathematics   Part 25  IIT JEE', 518),
      (26, '0UxJBr34vnc', 'Basic Mathematics (Part 26)', 'Basic Mathematics   Part 26  IIT JEE', 462),
      (27, 'TRGF-32Tm-0', 'Basic Mathematics (Part 27)', 'Basic Mathematics   Part 27  IIT JEE', 543),
      (28, '5GeoDMNJ2LM', 'Basic Mathematics (Part 28)', 'Basic Mathematics   Part 28  IIT JEE', 568),
      (29, 'Uo4H_eZaiWE', 'Basic Mathematics (Part 29)', 'Basic Mathematics   Part 29  IIT JEE', 764),
      (30, 'xtopanshUIE', 'Basic Mathematics (Part 30)', 'Basic Mathematics   Part 30  IIT JEE', 599),
      (31, '8cwFfTnYxZk', 'Basic Mathematics (Part 31)', 'Basic Mathematics   Part 31  IIT JEE', 653),
      (32, 'i36h2U3GKzY', 'Basic Mathematics (Part 32)', 'Basic Mathematics   Part 32   IIT JEE', 604),
      (33, 'fLWqVkIdhKo', 'Basic Mathematics (Part 33)', 'Basic Mathematics   Part 33   IIT JEE', 555),
      (34, '6Ft4Uxnuyl4', 'Basic Mathematics (Part 34)', 'Basic Mathematics   Part 34   IIT JEE', 647),
      (35, 'w0MAx1xWlj0', 'Basic Mathematics (Part 35)', 'Basic Mathematics   Part 35   IIT JEE', 609),
      (36, 'mvvNTUewuJ4', 'Basic Mathematics (Part 36)', 'Basic Mathematics   Part 36   IIT JEE', 612),
      (37, 'tNI4kF7Sh_4', 'Basic Mathematics (Part 37)', 'Basic Mathematics   Part 37   IIT JEE', 608),
      (38, 'SmcyU_hig0Y', 'Basic Mathematics (Part 38)', 'Basic Mathematics   Part 38   IIT JEE', 614)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds)
    order by position
  loop
    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      3, 282, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);
    insert into public.video_class_levels (video_id, class_level_id)
    values (v_video_id, v_class_id), (v_video_id, v_dropper_id);
    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 38 then
    raise exception 'expected 38 lessons for "%", inserted %', 'Basic Mathematics and Inequalities', v_inserted;
  end if;

  -- Prove the chapter now really does offer more than one teaching voice.
  if (
    select count(distinct v.channel_id)
    from public.videos v
    where v.chapter_id = 282
  ) < 2 then
    raise exception 'chapter 282 still has fewer than two teaching voices after import';
  end if;
end $$;
