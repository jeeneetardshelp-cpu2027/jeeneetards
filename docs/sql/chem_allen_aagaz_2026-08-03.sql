-- CREATE-ONLY import: ALLEN NEET Chemistry.
--
-- WHY: Chemistry had 29 of 49 chapters taught by a single INSTITUTE. The two
-- coaching families already in the catalogue are Competishun (channels 1/81/77)
-- and Physics Wallah (channels 5/89/76) -- adding one channel of a family that
-- is already present does not give a student a second opinion. ALLEN NEET
-- is an independent institute, so these lessons are a genuine second voice.
--
-- Source     : https://www.youtube.com/playlist?list=PLru9htpOg_gfntexp5UewLaoKphx6H8ix
-- Lessons    : 25 (playlist declares 25)
-- Chapters   : 33 Solutions; 35 Chemical Kinetics; 88 Electrochemistry; 87 Coordination Compounds; 45 The d and f Block Elements; 90 Organic Compounds Containing Halogens; 92 Organic Compounds Containing Oxygen; 54 Mole Concept; 41 Periodic Table; 86 Chemical Bonding and Molecular Structure; 93 P-Block Elements; 30 Chemical Equilibrium; 38 Ionic Equilibrium; 36 Thermodynamics; 95 Redox Reactions; 288 Organic Reaction Mechanisms; 89 Hydrocarbons; 39 Qualitative Analysis; 48 Amines; 29 Thermochemistry; 47 Carboxylic Acids and Derivatives; 53 Structural Isomerism; 37 Atomic Structure; 96 Some Basic Principles of Organic Chemistry
-- Verified   : every youtube_video_id below returned HTTP 200 from YouTube's
--              oEmbed API with author_name "ALLEN NEET" and none of them was
--              already present in the catalogue.
-- Titles     : cleaned for display; source_title keeps YouTube's original
--              verbatim. All pass src/titleQuality.js with zero blocking issues
--              and zero warnings, and are unique within this course.
-- Teacher    : left null on purpose -- the source titles name more than one
--              faculty member (or none), and inventing a single name would be false.
--
-- Each lesson carries its OWN chapter_id, so a series covering several chapters
-- files each lesson where it belongs instead of all landing under one guess.
--
-- Safe to re-run: aborts rather than duplicating. Order-independent.
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
  select id into strict v_channel_id
  from public.institutes_channels
  where youtube_channel_id = 'UCySvBtI4jMLXp0BT9osvASw';

  select id into strict v_goal_id from public.learning_goals where slug = 'neet';

  if exists (select 1 from public.playlists where title = 'Chemistry One Shot — Aagaz Series') then
    raise exception 'course "%" already exists - this file has already been run', 'Chemistry One Shot — Aagaz Series';
  end if;

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'xnTeE755mFU', 'Q9LDwqrE76A', 'Ldp56wuj1WE', 'DChJqp-i3yQ', 'fpoFOeDyYM0', 'Jd6COqxhDpE',
      'bzU5OIPAjmc', 'mag19VHFXlI', '6LLgsS8VlFA', 'Y82AZF4CI2A', 'EvGXYOZXR-0', 'Ds7cg5lNdbU',
      'F829oLj88ZY', 'FblFzVp6caE', 'UzUz8yrEQ54', 'gDgTzV-QKvI', 'jr1umkqzEDc', 'BYBXlh4wqfA',
      'wI_X8xRnh9E', 'xFx2ckAQCQA', 'XI4MdpCj2BE', 'gyKW-NLSZLI', 'QqMOPcdWiQk', 'Y68O1VADXm4',
      '1YktTtrmZTY'
    ])
  ) then
    raise exception 'at least one of these 25 lessons is already in the catalogue';
  end if;

  insert into public.playlists (
    title, source_title, description, teacher, channel_id, category_id,
    subject_id, content_type, language, difficulty
  ) values (
    'Chemistry One Shot — Aagaz Series',
    'Chemistry One Shot — Aagaz Series',
    'Full-chapter one-shot Chemistry lectures from the official ALLEN NEET Aagaz series.',
    null, v_channel_id, 2, 2, 'one-shot', 'hinglish',
    'intermediate'
  ) returning id into v_playlist_id;

  insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
  values (v_playlist_id, v_goal_id);

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select v_playlist_id, id from public.class_levels
  where slug = any(array['class-12', 'dropper', 'class-11']);

  for v_row in
    select * from (values
      (1, 'xnTeE755mFU', 'Solutions', 'NEET 2026: Solutions One Shot | All Concepts & PYQs | Basic to Advanced Chemistry by Pulkit Jain Sir', 20972, 33),
      (2, 'Q9LDwqrE76A', 'Chemical Kinetics', 'NEET 2026 - Chemical Kinetics | All Concepts & PYQs | Basic to Advanced Chemistry by Pulkit Jain Sir', 17698, 35),
      (3, 'Ldp56wuj1WE', 'Electrochemistry', 'Electrochemistry NEET 2026 One Shot | Basic to Advanced Chemistry by Pulkit Jain Sir |', 19971, 88),
      (4, 'DChJqp-i3yQ', 'Coordination Compounds', 'Master Coordination Compounds | NEET 2026 Chemistry One Shot Class by Rohit Saini Sir', 26061, 87),
      (5, 'fpoFOeDyYM0', 'The d and f Block Elements', 'NEET 2026 Chemistry: d & f Block Full Chapter One Shot | Rohit Saini Sir', 14906, 45),
      (6, 'Jd6COqxhDpE', 'Organic Compounds Containing Halogens', 'Master Haloalkanes & Haloarenes in One Shot | NEET Chemistry 2026 | Arpit Saxena', 13215, 90),
      (7, 'bzU5OIPAjmc', 'Organic Compounds Containing Oxygen', 'Alcohols, Phenols & Ethers Complete One Shot 🔥 NEET 2026 | Arpit Saxena Sir', 11460, 92),
      (8, 'mag19VHFXlI', 'Mole Concept', 'Mole Concept One Shot for NEET 2026 🔥 | Chemistry by Pulkit Jain Sir', 13840, 54),
      (9, '6LLgsS8VlFA', 'Periodic Table', 'Periodic Table One Shot for NEET 2026 | Full Chemistry Revision Class by Rohit Saini Sir', 19802, 41),
      (10, 'Y82AZF4CI2A', 'Chemical Bonding and Molecular Structure', 'Chemical Bonding One Shot for NEET 2026 | Rohit Saini Sir', 24560, 86),
      (11, 'EvGXYOZXR-0', 'P-Block Elements', 'P Block FULL Chapter in One Shot 🔥 NEET 2026 Chemistry by Rohit Saini Sir', 18096, 93),
      (12, 'Ds7cg5lNdbU', 'Chemical Equilibrium', 'Chemical Equilibrium FULL Chapter in 1 Shot | NEET 2026 Chemistry | Pulkit Jain Sir', 14571, 30),
      (13, 'F829oLj88ZY', 'Ionic Equilibrium', 'Ionic Equilibrium FULL Chapter in 1 Shot | NEET 2026 Chemistry | Pulkit Jain Sir', 18852, 38),
      (14, 'FblFzVp6caE', 'Thermodynamics', 'Thermodynamics NEET 2026 | One Shot Chemistry Lecture by Pulkit Jain Sir', 14654, 36),
      (15, 'UzUz8yrEQ54', 'Redox Reactions', 'Redox Reactions One Shot | NEET 2026 Chemistry Full Chapter | Pulkit Jain Sir', 11623, 95),
      (16, 'gDgTzV-QKvI', 'Organic Reaction Mechanisms', 'General Organic Chemistry | One Shot for NEET 2026 by Arpit Saxena Sir', 23613, 288),
      (17, 'jr1umkqzEDc', 'Hydrocarbons (Part 2)', 'Hydrocarbon (Part-2) | One Shot for NEET 2026 by Arpit Saxena Sir | ALLEN', 15389, 89),
      (18, 'BYBXlh4wqfA', 'Hydrocarbons (Part 1)', 'Hydrocarbon (Part-1) | One Shot for NEET 2026 by Arpit Saxena Sir | ALLEN', 23629, 89),
      (19, 'wI_X8xRnh9E', 'Qualitative Analysis', 'Salt Analysis Complete Theory + Practical | Boards & NEET 2026 | Rohit Saini Sir', 8843, 39),
      (20, 'xFx2ckAQCQA', 'Amines', 'NEET 2026 Chemistry 🚀 AMINES One Shot | Full Chapter in 1 Video | Arpit Saxena Sir', 8301, 48),
      (21, 'XI4MdpCj2BE', 'Thermochemistry', 'THERMOCHEMISTRY One Shot 🔥 NEET 2026 Chemistry | Full Chapter | Pulkit Jain Sir', 12256, 29),
      (22, 'gyKW-NLSZLI', 'Carboxylic Acids and Derivatives', 'Aldehydes, Ketones & Carboxylic Acids One Shot | NEET 2026 | Arpit Saxena Sir', 18171, 47),
      (23, 'QqMOPcdWiQk', 'Structural Isomerism', 'Isomerism One Shot by Arpit Saxena Sir | NEET 2026 Complete Concept', 18996, 53),
      (24, 'Y68O1VADXm4', 'Atomic Structure', 'Atomic Structure One Shot 🔥 | Full Chapter Revision for NEET 2026 | Pulkit Jain Sir', 17209, 37),
      (25, '1YktTtrmZTY', 'Some Basic Principles of Organic Chemistry', 'IUPAC Nomenclature One Shot | Complete Organic Chemistry for NEET 2026 | Arpit Saxena Sir', 16975, 96)
    ) as x(position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
    order by position
  loop
    -- Refuse to file a lesson under a chapter that is not Chemistry.
    if not exists (
      select 1 from public.chapters where id = v_row.chapter_id and subject_id = 2
    ) then
      raise exception 'chapter % is not a Chemistry chapter', v_row.chapter_id;
    end if;

    insert into public.videos (
      youtube_video_id, title, source_title, channel_id, category_id,
      subject_id, chapter_id, duration_seconds, embedding_status, last_verified_at
    ) values (
      v_row.youtube_video_id, v_row.title, v_row.source_title, v_channel_id, 2,
      2, v_row.chapter_id, v_row.duration_seconds, 'allowed', now()
    ) returning id into v_video_id;

    insert into public.video_learning_goals (video_id, learning_goal_id)
    values (v_video_id, v_goal_id);

    -- Class levels follow the lesson's OWN chapter: the Class 11 half of the
    -- syllabus is display_order 1-18, the Class 12 half 19+, and every lesson is
    -- also useful to a dropper.
    for v_level in
      select cl.id
      from public.class_levels cl
      join public.chapters ch on ch.id = v_row.chapter_id
      where cl.slug = 'dropper'
         or (cl.slug = 'class-11' and (ch.display_order <= 18 or ch.id in (93, 288)))
         or (cl.slug = 'class-12' and (ch.display_order >= 19 or ch.id in (93, 288)))
    loop
      insert into public.video_class_levels (video_id, class_level_id)
      values (v_video_id, v_level.id) on conflict do nothing;
    end loop;

    insert into public.playlist_videos (playlist_id, video_id, position)
    values (v_playlist_id, v_video_id, v_row.position);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> 25 then
    raise exception 'expected 25 lessons for "%", inserted %', 'Chemistry One Shot — Aagaz Series', v_inserted;
  end if;

  -- Every lesson must be filed under a goal and a class level, or it is
  -- invisible to goal-scoped search (see backfill_video_taxonomy_junctions).
  if exists (
    select 1 from public.playlist_videos pv
    where pv.playlist_id = v_playlist_id
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = pv.video_id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = pv.video_id))
  ) then
    raise exception 'a lesson in "%" was left without a goal or class level', 'Chemistry One Shot — Aagaz Series';
  end if;
end $$;
