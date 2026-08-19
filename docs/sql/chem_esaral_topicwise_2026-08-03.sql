-- CREATE-ONLY import: eSaral Chemistry for JEE.
--
-- WHY A FOURTH INSTITUTE: measured through the exam-goal filter students browse
-- with, JEE Chemistry had 28 chapters taught by a single institute and 8 with no
-- JEE content at all. ALLEN's own JEE Chemistry playlists could not close most
-- of those -- ALLEN bundles the inorganic and organic chapters into combined
-- one-shots with no single correct chapter_id. eSaral is an independent
-- institute (1.13M subscribers) whose Chemistry revision series IS taught
-- chapter by chapter, which is what makes a clean mapping possible.
--
-- Together the two eSaral files take JEE-view Chemistry from 13 to 24 chapters
-- with two or more institutes, closing 12: Hydrocarbons, Aromatic Compounds,
-- p-Block Groups 15 and 16, The d and f Block Elements, Coordination Compounds,
-- Metallurgy, Organic Compounds Containing Halogens, Organic Compounds
-- Containing Oxygen, Carboxylic Acids and Derivatives, Amines, Biomolecules,
-- and Chemistry in Everyday Life.
--
-- Source     : eSaral — https://www.youtube.com/playlist?list=PLMjEg73ogUELQRO037ozCV2lzeYJqmHs1
-- Lessons    : 40
-- Chapters   : 15
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API hosted on the eSaral channel, and none was already in the
--              catalogue. All lessons confirmed hosted on ONE channel, so no
--              split was needed.
--
-- Excluded on purpose: lessons pairing several chapters ("s-block & Hydrogen",
-- "p-block Class 11 & Periodic Table", "Structural, Geometrical & Optical
-- Isomerism", "IUPAC Nomenclature | General Organic Chemistry") and the
-- catch-all "Complete IOC Mega Revision in One Shot". There is no single correct
-- chapter_id for a lesson that teaches three chapters.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent; whichever
-- file runs first creates the eSaral channel row.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  v_row record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCddnJhXMUxzHoH8AZkZSd8w';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('eSaral', 'UCddnJhXMUxzHoH8AZkZSd8w') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Chemistry Topicwise Revision — eSaral') then
    raise exception 'course "%" already exists - this file has already been run', 'Chemistry Topicwise Revision — eSaral';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'QTv_u5JuueM', 'Zr25eIV4aww', 'x7aeeepFAxY', 'PeTZK4K7B38', 'c4oH5TrPRNE', 'QkevVaZmeHw',
      'Ge5Jyu2PfIM', 'OIpwYp-fhpQ', '78AZtuyb5Gw', 'FHjM42dHhoQ', 'XyIp4G80Rt0', '8tdlYk7h1-M',
      'zbkiZ0aZ5bc', 'uDn_vI5KoFY', '1M6GtYb_ngs', 'CB5savdZb7I', '5t-m0xZeiGI', 'mQ8EZonREoc',
      'M0GlJdNC7GA', '3X1uKfwOK18', 'hPzlTLaAiI0', 'gyzKYIXQjzE', '-RGC-tiy_7s', '0DF3sNna-yY',
      'iYDRSHrtbHc', '110z-Ml6Mbc', '-Ej78bxrI0c', 'PDgxdwdxxbA', 'KMBhOs0Smyg', 'z4R0mxyNkCY',
      '0smIWYHyWOg', 'MeIkFbLn2Gg', 'N5MgNnqi6dM', 'YXt1jql60EM', 'VehI7W0XNCc', 'XX0AeVj9UEc',
      'IlhTTa5d_4E', '18AM7ZfrMDE', '6VoBpw9UVcc', 'eSZZyrezx8g'
    ])
  ) then
    raise exception 'at least one of these 40 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Chemistry Topicwise Revision — eSaral', 'Chemistry Topicwise Revision — eSaral', 'Chapter-by-chapter Chemistry revision from the official eSaral channel.',
    null, v_channel_id, 1, 2, 'revision', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'QTv_u5JuueM', 'General Organic Chemistry (GOC) (Part 1)', 'General Organic Chemistry (GOC) One Shot Revision Part 1 | JEE | NEET | Class 11 Chemistry | eSaral', 3493, 288),
      (2, 'Zr25eIV4aww', 'General Organic Chemistry (GOC) (Part 2)', 'General Organic Chemistry (GOC) Part 2 | Chemistry Revision for JEE, NEET, Class 11 |  eSaral', 2510, 288),
      (3, 'x7aeeepFAxY', 'Acidic Strength in Organic Chemistry', 'Acidic Strength in Organic Chemistry | Quick Revision by Prateek Sir | Class 11, JEE & NEET - eSaral', 1678, 288),
      (4, 'PeTZK4K7B38', 'Basic Strength, Acid Base Equilibrium & Bond Length', 'Basic Strength, Acid Base Equilibrium & Bond Length | Quick Revision | Class 11, JEE & NEET', 2016, 288),
      (5, 'c4oH5TrPRNE', 'Hydrocarbon Alkanes', 'Hydrocarbon Alkanes | Organic Chemistry | Quick Revision | Class 11, JEE & NEET | Prateek Sir', 4201, 89),
      (6, 'QkevVaZmeHw', 'Hydrocarbon Alkenes', 'Hydrocarbon Alkenes Quick Revision L1 | Class 11, JEE, NEET | Reaction Mechanism | Prateek Sir', 3164, 89),
      (7, 'Ge5Jyu2PfIM', 'Hydrocarbon', 'Hydrocarbon Revision | Class 11 Chemistry | Organic Chemistry | Alkenes - Part 2 | eSaral', 2126, 89),
      (8, 'OIpwYp-fhpQ', 'Alkene', 'Alkene Part-3 | Carbene, Ozonolysis, NBS, KCP vs TCP | Quick Revision | Class 11, NEET, JEE', 2114, 89),
      (9, '78AZtuyb5Gw', 'Hydrocarbons Class 11 Organic Chemistry - Alkyne', 'Hydrocarbons Class 11 Organic Chemistry - Alkyne One SHOT | Reactions & Tricks | IIT JEE | NEET', 2041, 89),
      (10, 'FHjM42dHhoQ', 'Aromatic Hydrocarbons', 'Aromatic Hydrocarbons One Shot Revision| Chemistry Class 11, NEET, JEE | eSaral | Prateek Sir', 1941, 289),
      (11, 'XyIp4G80Rt0', 'Optical Isomerism (Part 1)', 'Optical Isomerism Revision Part1- Chemistry Class 12, JEE, NEET', 3581, 286),
      (12, '8tdlYk7h1-M', 'Optical Isomerism (Part 2)', 'Optical Isomerism Revision Part 2 | Class 12 Chemistry | IIT JEE | NEET | Prateek Sir eSaral', 2774, 286),
      (13, 'zbkiZ0aZ5bc', 'Haloalkanes & Haloarenes (Part 1)', 'Haloalkanes & Haloarenes Revision Part 1 | Class 12, JEE, NEET | Prateek Sir | eSaral', 3117, 90),
      (14, 'uDn_vI5KoFY', 'Haloalkanes & Haloarenes (Part 2)', 'Haloalkanes & Haloarenes Revision Part 2 | Class 12, JEE, NEET | Prateek Sir | eSaral', 3050, 90),
      (15, '1M6GtYb_ngs', 'Haloalkanes & Haloarenes (Part 3)', 'Haloalkanes & Haloarenes Revision Part 3 | Chemistry Class12, JEE, NEET | Prateek Sir | eSaral', 1885, 90),
      (16, 'CB5savdZb7I', 'Elimination Reaction', 'Elimination Reaction Revision with Practice Problems – Chemistry Class12, JEE, NEET', 2194, 90),
      (17, '5t-m0xZeiGI', 'Substitution vs Elimination Reaction', 'Substitution vs Elimination Reaction Revision – Chemistry Class12, JEE, NEET', 1315, 90),
      (18, 'mQ8EZonREoc', 'Haloarenes', 'Haloarenes Revision – Organic Chemistry Class 12, JEE, NEET', 1413, 90),
      (19, 'M0GlJdNC7GA', 'Alcohol', 'Alcohol Revision with Practice Questions - Organic Chemistry Class 12, JEE, NEET', 3657, 92),
      (20, '3X1uKfwOK18', 'Ether & Epoxides', 'Ether & Epoxides Revision with Practice Questions - Organic Chemistry Class 12, JEE, NEET', 2204, 92),
      (21, 'hPzlTLaAiI0', 'Phenol', 'Phenol Revision with Practice Questions - Organic Chemistry Class 12, JEE, NEET', 2659, 92),
      (22, 'gyzKYIXQjzE', 'Carbonyl Compounds', 'Carbonyl Compounds Revision with Practice Questions - Organic Chemistry Class 12, JEE, NEET', 2624, 47),
      (23, '-RGC-tiy_7s', 'Aldol, Cannizzaro and Haloform Reaction', 'Aldol, Cannizzaro and Haloform Reaction - Organic Chemistry Class 12, JEE, NEET', 2409, 47),
      (24, '0DF3sNna-yY', 'Important Name Reactions', 'Important Name Reactions - Organic Chemistry Class 12, JEE, NEET', 1651, 288),
      (25, 'iYDRSHrtbHc', 'Oxidation Reaction', 'Oxidation Reaction Revision - Organic Chemistry Class 12, JEE, NEET', 2776, 288),
      (26, '110z-Ml6Mbc', 'Reduction Reaction', 'Reduction Reaction Revision - Organic Chemistry Class 12, JEE, NEET', 2936, 288),
      (27, '-Ej78bxrI0c', 'Carboxylic Acid', 'Carboxylic Acid in One Shot | Class 12 Chemistry Revision | JEE, NEET | Prateek sir | eSaral', 2616, 47),
      (28, 'PDgxdwdxxbA', 'Amines', 'Amines Class 12 Chemistry One Shot Revision | Organic Chemistry | JEE, NEET | eSaral | Prateek Sir', 2741, 48),
      (29, 'KMBhOs0Smyg', 'Biomolecules (Part 1)', 'Biomolecules Revision PART 1 - Organic Chemistry Class 12, JEE, NEET', 2852, 85),
      (30, 'z4R0mxyNkCY', 'Biomolecules (Part 2)', 'Biomolecules Revision PART 2 - Organic Chemistry Class 12, JEE, NEET', 2652, 85),
      (31, '0smIWYHyWOg', 'Polymers', 'Polymers One Shot | Class 12 Chemistry | JEE | NEET | All Concepts, Tricks & PYQs | eSaral', 2909, 287),
      (32, 'MeIkFbLn2Gg', 'Chemistry in Everyday Life', 'Chemistry in Everyday Life in One Shot JEE Main & Adv.', 4607, 40),
      (33, 'N5MgNnqi6dM', 'Periodic Table वाली Pawri', 'Periodic Table वाली Pawri | Chemistry 1 Shot Quick Revision for JEE | NEET | कहानी एक परिवार की', 5676, 41),
      (34, 'YXt1jql60EM', 'Atomic Structure (Part 1)', 'Class 11 Chapter 2 Atomic Structure Part 1 | Chemistry Revision eSaral | JEE, NEET', 4928, 37),
      (35, 'VehI7W0XNCc', 'Atomic Structure (Part 2)', 'Class 11 Chapter 2 Atomic Structure | Chemistry Revision Part 2 | JEE, NEET | eSaral | Prateek Sir', 4226, 37),
      (36, 'XX0AeVj9UEc', 'Atomic Structure- 3', 'Atomic Structure- 3 | Physical Chemistry Revision for Class 11, JEE, NEET', 5533, 37),
      (37, 'IlhTTa5d_4E', 'Atomic Structure (Part 3)', 'Atomic Structure Part -1 | Physical Chemistry Complete Revision for Class 11, JEE, NEET', 5690, 37),
      (38, '18AM7ZfrMDE', 'Atomic Structure (Part 4)', 'Atomic Structure Part -2 | Physical Chemistry Complete Revision for Class 11, JEE, NEET', 4986, 37),
      (39, '6VoBpw9UVcc', 'Mole Concept', 'Mole Concept One-Shot | Physical Chemistry Complete Revision for Class 11, JEE, NEET', 6007, 54),
      (40, 'eSZZyrezx8g', 'States of Matter', 'States of Matter One-Shot | Physical Chemistry Complete Revision for Class 11, JEE, NEET | eSaral', 9020, 43)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    if not exists (select 1 from public.chapters where id = v_row.chapter_id and subject_id = 2) then
      raise exception 'chapter % is not a Chemistry chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 1,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    for v_level in
      select id from public.class_levels where slug in ('class-11', 'class-12', 'dropper')
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 40 then
    raise exception 'expected 40 lessons for "%", inserted %', 'Chemistry Topicwise Revision — eSaral', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    join public.videos v on v.id = pv.video_id
    where pv.playlist_id = v_playlist_id and v.channel_id <> v_channel_id
  ) then
    raise exception 'a lesson in "%" is attributed to a different channel', 'Chemistry Topicwise Revision — eSaral';
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Chemistry Topicwise Revision — eSaral';
  end if;
end $$;
