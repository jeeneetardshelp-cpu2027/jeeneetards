-- CREATE-ONLY import: ALLEN JEE Chemistry.
--
-- WHY: measured as a student actually browses -- scoped by exam goal -- JEE
-- Chemistry had only 2 of the 49 chapters with more than one institute.
-- Competishun teaches nearly all of it alone. The Aakash NEET and ALLEN NEET
-- Chemistry imported earlier today is tagged NEET, so a JEE student never sees
-- it, and re-tagging NEET content as JEE would be a claim about its syllabus fit
-- that is not true. This brings genuinely JEE-side content from a second
-- institute instead.
--
-- Source     : ALLEN JEE — https://www.youtube.com/playlist?list=PL_aKL95N88s1YRBIU0u2XjFWjYZbL0jng
-- Lessons    : 21
-- Chapters   : Hydrocarbons; Organic Reaction Mechanisms; Some Basic Principles of Organic Chemistry; Ionic Equilibrium; Chemical Equilibrium; Thermochemistry; Thermodynamics; Gaseous State; Chemical Bonding and Molecular Structure; Periodic Table; Atomic Structure; Mole Concept
-- Verified   : every youtube_video_id returned HTTP 200 from YouTube's oEmbed
--              API with author_name "ALLEN JEE", none already in the catalogue.
--
-- Excluded on purpose: lessons pairing two chapters ("Stoichiometry & Redox
-- Reaction", "Reaction Mechanism, Hydrocarbons", "IUPAC & GOC"), and the two
-- lessons titled only "Isomerism" -- this catalogue splits that into Structural
-- Isomerism and Stereoisomerism, and the source does not say which is taught.
--
-- Safe to re-run: aborts rather than duplicating.
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
  select id into v_channel_id from public.institutes_channels where youtube_channel_id = 'UCkUI45drrKTWLxy3q3voJRw';
  if v_channel_id is null then
    insert into public.institutes_channels (name, youtube_channel_id)
    values ('ALLEN JEE', 'UCkUI45drrKTWLxy3q3voJRw') returning id into v_channel_id;
  end if;

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (select 1 from public.playlists where title = 'Chemistry Foundation Series — JEE') then
    raise exception 'course "%" already exists - this file has already been run', 'Chemistry Foundation Series — JEE';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'kbcTwSK4fXM', 'rQDh7UZcYPk', 'Pb2u7IvQNqE', 'RIicedjfXdY', 'wzxtfHTnr00', 'f3-6oSTIhfU',
      'wgv3FlOtPx0', '7VdNfn4oxKA', 'cNDQ4OfaqEk', '4w5Zvq_kNMw', '1csrk_asj68', 'qGPq9KKMbYY',
      'nO0DwBxTA9w', 'vPEafvcWrp4', 'gyW7emCQUR0', 'VcTgHp4E1eQ', 'OX2tcRHkxJQ', 'cNNdKX9Q-gk',
      'Qrmb4rHgCmM', 'nVqkpj4FG04', 'HSefVkNkcVM'
    ])
  ) then
    raise exception 'at least one of these 21 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Chemistry Foundation Series — JEE', 'Chemistry Foundation Series — JEE',
    'Fundamental concepts, chapter by chapter, from the official ALLEN JEE Chemistry Foundation Series.',
    null, v_channel_id, 1, 2, 'full-course', 'hinglish', 'advanced'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels where slug in ('class-11', 'class-12', 'dropper');

  for v_row in
    select * from (values
      (1, 'kbcTwSK4fXM', 'Hydrocarbons (Part 3)', 'Chemistry - Fundamental Concepts of Hydrocarbons (Part-3) | Foundation Series', 16825, 89),
      (2, 'rQDh7UZcYPk', 'Hydrocarbons (Part 2)', 'Chemistry - Fundamental Concepts of Hydrocarbons (Part-2) | Foundation Series', 12070, 89),
      (3, 'Pb2u7IvQNqE', 'Hydrocarbons (Part 1)', 'Chemistry - Fundamental Concepts of Hydrocarbons (Part-1) | Foundation Series', 14794, 89),
      (4, 'RIicedjfXdY', 'Electronic Displacement Effects (GOC) (Part 2)', 'Chemistry - Fundamental Concepts of Electronic Displacement Effects (GOC) Part-2 | Foundation Series', 13991, 288),
      (5, 'wzxtfHTnr00', 'Electronic Displacement Effects (GOC) (Part 1)', 'Chemistry - Fundamental Concepts of Electronic Displacement Effects (GOC) Part-1 | Foundation Series', 17186, 288),
      (6, 'f3-6oSTIhfU', 'IUPAC (Part 2)', 'Chemistry - Fundamental Concepts of IUPAC (Part-2) | Foundation Series | @ALLENJEE', 7121, 96),
      (7, 'wgv3FlOtPx0', 'IUPAC', 'Chemistry - Fundamental Concepts of IUPAC | Foundation Series | @ALLENJEE', 12379, 96),
      (8, '7VdNfn4oxKA', 'Ionic Equilibrium (Part 1)', 'Chemistry - Fundamental Concepts of Ionic Equilibrium | Foundation Series | @ALLENJEE', 7671, 38),
      (9, 'cNDQ4OfaqEk', 'Ionic Equilibrium (Part 2)', 'Chemistry - Fundamental Concepts of Ionic Equilibrium | Foundation Series | @ALLENJEE', 12196, 38),
      (10, '4w5Zvq_kNMw', 'Chemical Equilibrium', 'Chemistry - Fundamental Concepts of Chemical Equilibrium | Foundation Series | @ALLENJEE', 12771, 30),
      (11, '1csrk_asj68', 'Thermochemistry', 'Chemistry - Fundamental Concepts of Thermochemistry | Foundation Series | @ALLENJEE', 5926, 29),
      (12, 'qGPq9KKMbYY', 'Thermodynamics (Part 2)', 'Chemistry - Fundamental Concepts of Thermodynamics (Part-2) | Foundation Series | @ALLENJEE', 9031, 36),
      (13, 'nO0DwBxTA9w', 'Thermodynamics (Part 1)', 'Chemistry - Fundamental Concepts of Thermodynamics (Part-1) | Foundation Series | @ALLENJEE', 14201, 36),
      (14, 'vPEafvcWrp4', 'States of Matter (Part 2)', 'Chemistry - Fundamental Concepts of States of Matter (Part-2) | Foundation Series | @ALLENJEE', 13492, 43),
      (15, 'gyW7emCQUR0', 'States of Matter (Part 1)', 'Chemistry - Fundamental Concepts of States of Matter (Part-1) | Foundation Series | @ALLENJEE', 14550, 43),
      (16, 'VcTgHp4E1eQ', 'Chemical Bonding (Part 2)', 'Chemistry - Fundamental Concepts of Chemical Bonding (Part-2) | Foundation Series | @ALLENJEE', 13921, 86),
      (17, 'OX2tcRHkxJQ', 'Chemical Bonding (Part 1)', 'Chemistry - Fundamental Concepts of Chemical Bonding (Part-1) | Foundation Series | @ALLENJEE', 18711, 86),
      (18, 'cNNdKX9Q-gk', 'Periodic Table', 'Chemistry - Fundamental Concepts of Periodic Table | Foundation Series | @ALLENJEE', 21497, 41),
      (19, 'Qrmb4rHgCmM', 'Atomic Structure (Part 2)', 'Chemistry - Fundamental Concepts of Atomic Structure (Part-2) | Foundation Series | @ALLENJEE', 10576, 37),
      (20, 'nVqkpj4FG04', 'Atomic Structure (Part 1)', 'Chemistry - Fundamental Concepts of Atomic Structure (Part-1) | Foundation Series | @ALLENJEE', 13541, 37),
      (21, 'HSefVkNkcVM', 'Basic Mole Concept', 'Chemistry - All Fundamental Concepts of Basic Mole Concept | Foundation Series | @ALLENJEE', 12866, 54)
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

  if v_inserted <> 21 then
    raise exception 'expected 21 lessons for "%", inserted %', 'Chemistry Foundation Series — JEE', v_inserted;
  end if;

  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Chemistry Foundation Series — JEE';
  end if;
end $$;
