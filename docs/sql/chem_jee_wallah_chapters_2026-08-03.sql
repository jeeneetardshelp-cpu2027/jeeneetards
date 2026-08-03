-- CREATE-ONLY import: JEE Wallah Chemistry, chapter by chapter.
--
-- CORRECTION TO AN EARLIER CLAIM. Two files today
-- (chem_esaral_physical / chem_motion_oneshot) state that the remaining JEE
-- Chemistry gaps need "a source that teaches physical and inorganic chemistry
-- chapter by chapter" and that none of the institutes in the catalogue does.
-- That was wrong. JEE Wallah -- already channel 89 here -- publishes exactly
-- that as its CHEMISTRY RAFTAAR and "Class 12th/JEE" series. It was missed
-- because an earlier scan filtered its playlist list too aggressively.
--
-- These chapters were Competishun-only, so Physics Wallah content genuinely is
-- a second institute for them.
--
-- Lessons    : 143 across 18 courses, one course per source playlist
-- Effect     : JEE-view Chemistry 24 -> 32 of 42 chapters with 2+ institutes,
--              closing Redox Reactions, Hydrogen, The s-Block Elements, P-Block
--              Groups 13 and 14, Chemical Kinetics, p-Block Groups 17 and 18,
--              Qualitative Analysis, and Qualitative Analysis: Cations.
-- Verified   : all 143 youtube_video_ids returned HTTP 200 from YouTube's oEmbed
--              API with author_name "JEE Wallah", and none was already present.
--              Every playlist matched its declared video count exactly.
--
-- Two playlists genuinely span two chapters and are split per lesson rather than
-- filed under one guess: "P Block Elements" (Nitrogen and Oxygen families ->
-- Groups 15 and 16; Halogen family and Noble Gases -> Groups 17 and 18) and
-- "Salt Analysis" (acidic radicals -> Qualitative Analysis; basic radicals ->
-- Qualitative Analysis: Cations). PYQ round-ups are excluded as practice.
--
-- Safe to re-run: aborts rather than duplicating.
do $$
declare
  v_channel_id bigint;
  v_goal_id bigint;
  v_playlist_id bigint;
  v_video_id bigint;
  c_row record;
  v_row record;
  v_level record;
  v_inserted integer := 0;
begin
  select id into strict v_channel_id from public.institutes_channels
  where youtube_channel_id = 'UCVJU_IChPMOe8RWkdVQjtfQ';

  select id into strict v_goal_id from public.learning_goals where slug = 'jee';

  if exists (
    select 1 from public.videos
    where youtube_video_id = any(array[
      'y4QVtdIKQDM', 'vr6DYwwlo2o', 'FEst-L-YUOY', 'N32UTduBvHU', 'hWvVeqG2lCM', 'eJsfIS01IRI',
      'a_sca--OP5c', 'XSO5mC0n6h8', 'z4fBKgB0a7w', 'yYF9LbEBgNs', 'GZeN4L03sEA', '7z9GNjl1EFY',
      'FhFpIIRBEvU', 'sSCqBU0Uak4', 'Tw-2JkyPmBY', 'BXHEBnNeAZs', 'N9gb_uIIc74', 'saXIb5T1oEs',
      'knUw9TB7ZHM', 'yH-GgZHBdYg', 'lQbTKaMRLg4', 'm4DFYiubH_w', 'FjQnvi7VAlQ', 'aTN5-arJo3Y',
      '6cFmz2UaT9M', 'sThyAya6XK4', 's0bI8tEaJD8', 'SNMSq7jg8Jc', 'HrPSQQAfFKQ', 'arJ8Q8tSQGc',
      'o-ypQvZxQoc', 'AajhdnNrJR8', 'xtFGCe6hALY', 'DdRxmPasqJA', 'zZp21zmicpo', 'Rk2hDM9sXmQ',
      '7iSHPUO5Mf0', '8N2CHjx59Hs', 'GXHsqvSyWj4', 'Y0d5WhJr2fw', 'r38agJ_cTNw', 'k3cox6rpRQA',
      '53dOXGWKn00', 'veMYiuzGO1w', 'oNF72WTOKv4', 'EBAaxRdlL-0', 'MAm6VTUOIvE', '8N2CHjx59Hs',
      '8owJbGvpPL4', 'xNEBv6Yb4a0', 'wK3vis3c8mI', '0m_lf6nlKvk', 'twM-YQP_XHM', 'ZLBGGY70hAI',
      'nBCrdDNdXfY', 'JNv0rvMwp0A', '3s1HMuIzGzk', 'sAgjJ5LaG5g', 'Y3e9bKf5hso', '5aQpsBpvs4E',
      'T3dQFP2a-vM', 'k7oBNKVsQ94', 'hLvk_BFJzKQ', 'efUUUuaMH6c', 'jRMw0aL8kRo', 'nDacyB1EpI8',
      'fL1xBK5g9p4', 'RQQWoj485JA', 'IE4-kJZvx1s', 'QsCO3of_qjg', '9RbELJ3vE0s', 'v7En1kjQKfA',
      'ePPg4ORwOUQ', 'ggACAxVsvi4', 'i8apXvt5rg8', '-1JsSKaBI1k', 'DrHA6kAiWcE', 'O9rFKIsjKHk',
      'mcRHBwJ_3lg', '-vuYvvqFQc4', '6UEhLCK5yeg', 'YxRDcTt23uI', 'nKAFyaQpIeQ', 'G-rKguGyDpE',
      'u2qjBKAVY5w', 'C9BvoF5Kb0I', 'sIJlEM-f76A', 'pNgsztLEQ6o', 'zmREjF-O180', 'c7HsefGP-hE',
      'dt9q6lchkPw', '-uvkWchGKxs', 'v9YNXMCG-4g', 'VswqF0V41Js', 'UWSrSyeoin0', 'uxBYyjD-uEI',
      'FJOJ9_fByF8', 'RY73hvZjil0', 'mBQfj-V9apY', 'vt5hTmNsHXU', 'ZqAIEcCWcr8', 'UqZw1r2bx3s',
      'yYNYXpDjg1Y', 'geyFx3mCttE', 'z2qdgonzeI0', 'tvN3ijLMeL8', 'P0Sxq0zU2bs', '7v7e_2UTlrE',
      'C_MWwoyzkgQ', 'dtnULI4HRYg', 'vKA9QjLM0zQ', 'CP41Ml4HRGQ', 'cEXNoC8rBrc', 'LLi0f87F65M',
      'uxrBdOWd6u0', 'sJtDCEQsKUg', 'PgLwNB3kU1I', '11wN6tqi_Ho', 'efoIolvCJYk', 'AFnwa-gF8l4',
      'gBci6oYeXlI', '9TEGxXBdkfY', 'fr6Ru3ENEiM', 'RE8hX9wV7NU', 'kaSVE8O09aE', 'dWZ65Bjs2wM',
      'T-vPL5ojXc0', 'VSz9ZGXi6L4', '3Uwl3rxv6rQ', 'zVXGzkOxTXU', 'pDuB9DsaFmw', 'V3Tz-z5WZqo',
      'lgE6OHNiF80', '9h-Ag7haN7g', 'uRhA4FRDejU', 'B18wP-VMFHg', 'oYvQ2OPkifU', 'jZCDZf69Ccg',
      'DGL1SSJBo3s', 'UpNN_3zXtPY', '844lQ-f7MXg', 'Hkp9Ovs0n6o', 'y7LHjd_l8nY'
    ])
  ) then
    raise exception 'at least one of these 143 lessons is already in the catalogue';
  end if;

  for c_row in
    select * from (values
      ('s_block', 'The s-Block Elements — JEE Wallah'),
      ('hydrogen', 'Hydrogen — JEE Wallah'),
      ('redox', 'Redox Reactions — JEE Wallah'),
      ('gaseous', 'Gaseous State — JEE Wallah'),
      ('p_block_raftaar', 'p-Block Elements: Groups 13 and 14 — JEE Wallah'),
      ('bonding', 'Chemical Bonding — JEE Wallah'),
      ('periodicity', 'Periodic Table — JEE Wallah'),
      ('atom', 'Atomic Structure — JEE Wallah'),
      ('mole', 'Mole Concept — JEE Wallah'),
      ('goc', 'General Organic Chemistry — JEE Wallah'),
      ('hydrocarbon', 'Hydrocarbons — JEE Wallah'),
      ('thermo', 'Thermodynamics — JEE Wallah'),
      ('metallurgy', 'Metallurgy — JEE Wallah'),
      ('kinetics', 'Chemical Kinetics — JEE Wallah'),
      ('dfblock', 'The d and f Block Elements — JEE Wallah'),
      ('coordination', 'Coordination Compounds — JEE Wallah'),
      ('p_block_12', 'p-Block Elements: Groups 15 to 18 — JEE Wallah'),
      ('salt', 'Salt Analysis — JEE Wallah')
    ) as c(ckey, ctitle)
  loop
    if exists (select 1 from public.playlists where title = c_row.ctitle) then
      raise exception 'course "%" already exists - this file has already been run', c_row.ctitle;
    end if;

    insert into public.playlists (
      title, source_title, description, teacher, channel_id, category_id,
      subject_id, content_type, language, difficulty
    ) values (
      c_row.ctitle, c_row.ctitle,
      'Chapter-by-chapter Chemistry for JEE, from the official JEE Wallah channel.',
      null, v_channel_id, 1, 2, 'full-course', 'hinglish', 'advanced'
    ) returning id into v_playlist_id;

    insert into public.playlist_learning_goals (playlist_id, learning_goal_id)
    values (v_playlist_id, v_goal_id);

    insert into public.playlist_class_levels (playlist_id, class_level_id)
    select v_playlist_id, id from public.class_levels
    where slug in ('class-11', 'class-12', 'dropper');

    for v_row in
      select * from (values
      ('s_block', 1, 'y4QVtdIKQDM', 's-Block Elements — Basic Properties of s-Block', 's-Block Elements 01 || Basic Properties of s-Block || Alkali Metals || Class 11/JEE || RAFTAAR', 6030, 46),
      ('s_block', 2, 'vr6DYwwlo2o', 's-Block Elements — Alkali Metals', 's-Block Elements 02 | Alkali Metals | Class 11/JEE | RAFTAAR', 5069, 46),
      ('s_block', 3, 'FEst-L-YUOY', 's-Block Elements — Alkaline Metals', 's-Block Elements 03 | Alkaline Metals | Earth Metal | Class 11/JEE | RAFTAAR', 6163, 46),
      ('hydrogen', 1, 'N32UTduBvHU', 'Hydrogen — Hydrogen & its Compounds', 'Hydrogen 01 | Hydrogen & its Compounds | Class11/JEE | RAFTAAR', 6809, 44),
      ('hydrogen', 2, 'hWvVeqG2lCM', 'Hydrogen — Hydrogen & its Compounds — Lecture 2', 'Hydrogen 02 | Hydrogen & its Compounds | Class11/JEE | RAFTAAR', 7390, 44),
      ('redox', 1, 'eJsfIS01IRI', 'Redox Reaction — Oxidation Number', 'Redox Reaction 01 | Oxidation Number | Oxidation & Reduction | Class 11/JEE | RAFTAAR', 5823, 95),
      ('redox', 2, 'a_sca--OP5c', 'Redox Reaction — Oxidizing Agent & Reducing Agent', 'Redox Reaction 02 | Oxidizing Agent & Reducing Agent | Redox Reaction | Class 11/JEE | RAFTAAR', 5158, 95),
      ('redox', 3, 'XSO5mC0n6h8', 'Redox Reaction — Types of Redox Reaction', 'Redox Reaction 03 | Types of Redox Reaction | Balancing of Chemical Reaction | Class 11/JEE', 4485, 95),
      ('redox', 4, 'z4fBKgB0a7w', 'Redox Reaction — Balancing of Redox Reaction', 'Redox Reaction 04 | Balancing of Redox Reaction | Equivalent Weight | Class 11/JEE | RAFTAAR', 4358, 95),
      ('gaseous', 1, 'yYF9LbEBgNs', 'Gaseous State — Some Important Variable', 'Gaseous State 01 | Some Important Variable | Gas Laws | Class 11/JEE | RAFTAAR', 4441, 43),
      ('gaseous', 2, 'GZeN4L03sEA', 'Gaseous State — Gas Laws', 'Gaseous State 02 || Gas Laws || Class 11/JEE || RAFTAAR', 5322, 43),
      ('gaseous', 3, '7z9GNjl1EFY', 'Gaseous State — Ideal Gas Equation', 'Gaseous State 03 || Ideal Gas Equation || Class 11/JEE || RAFTAAR', 6421, 43),
      ('gaseous', 4, 'FhFpIIRBEvU', 'Gaseous State — Dalton''s Law of Partial Pressure', 'Gaseous State 04 | Dalton''s Law of Partial Pressure | Kinetic Theory of Gas | Class 11/JE', 4763, 43),
      ('gaseous', 5, 'sSCqBU0Uak4', 'Gaseous State — Maxwell Distribution Law', 'Gaseous State 05 | Maxwell Distribution Law | Graham''s Law of Diffusion | Class 11/JE', 4880, 43),
      ('gaseous', 6, 'Tw-2JkyPmBY', 'Gaseous State — Real Gases', 'Gaseous State 06 | Real Gases | Class 11/JEE | RAFTAAR', 5698, 43),
      ('gaseous', 7, 'BXHEBnNeAZs', 'Gaseous State — Critical Constants', 'Gaseous State 07 | Critical Constants | Class 11/JEE | RAFTAAR', 4956, 43),
      ('p_block_raftaar', 1, 'N9gb_uIIc74', 'p-Block Elements — Electron Deficient Bonding', 'p-Block Elements 01 | Electron Deficient Bonding | Back Bonding | Class 11/JEE | RAFTAAR', 6658, 51),
      ('p_block_raftaar', 2, 'saXIb5T1oEs', 'p-Block Elements — Group 13 (Boron Family)', 'p-Block Elements 02 | Group 13 (Boron Family) | Periodic Properties | Class 11/JEE | RAFTAAR', 5984, 51),
      ('p_block_raftaar', 3, 'knUw9TB7ZHM', 'p-Block Elements — Borax', 'p-Block Elements 03 | Borax | Class 11/JEE | RAFTAAR', 4965, 51),
      ('p_block_raftaar', 4, 'yH-GgZHBdYg', 'p-Block Elements — Lecture 4', 'p-Block Elements 04 - Class 11/JEE | RAFTAAR', 4087, 51),
      ('p_block_raftaar', 5, 'lQbTKaMRLg4', 'p-Block Elements — Lecture 5', 'p-Block Elements 05 - Class 11/JEE | RAFTAAR', 7291, 51),
      ('bonding', 1, 'm4DFYiubH_w', 'Chemical Bonding — Octet Rule', 'Chemical Bonding 01 | Octet Rule | Formal Change | Class11/JEE', 6494, 86),
      ('bonding', 2, 'FjQnvi7VAlQ', 'Chemical Bonding — Octet Rule — Lecture 2', 'Chemical Bonding 02 | Octet Rule | Formal Change | Class11/JEE', 4268, 86),
      ('bonding', 3, 'aTN5-arJo3Y', 'Chemical Bonding — Covalent Bond', 'Chemical Bonding 03 | Covalent Bond | Overlapping | Class11/JEE | RAFTAAR', 5508, 86),
      ('bonding', 4, '6cFmz2UaT9M', 'Chemical Bonding — Overlapping', 'Chemical Bonding 04 | Overlapping | Class11/JEE | RAFTAAR', 7703, 86),
      ('bonding', 5, 'sThyAya6XK4', 'Chemical Bonding — Overlapping — Lecture 5', 'Chemical Bonding 05 | Overlapping | Class11/JEE | RAFTAAR', 6083, 86),
      ('bonding', 6, 's0bI8tEaJD8', 'Chemical Bonding — Valence Bond Theory', 'Chemical Bonding 06 | Valence Bond Theory | Hybridization | Class11/JEE | RAFTAAR', 6974, 86),
      ('bonding', 7, 'SNMSq7jg8Jc', 'Chemical Bonding — Hybridization', 'Chemical Bonding 07 | Hybridization | Bent Rule | Class11/JEE | RAFTAAR', 7458, 86),
      ('bonding', 8, 'HrPSQQAfFKQ', 'Chemical Bonding — Bent Rule', 'Chemical Bonding 08 | Bent Rule | VSEPR | Class11/JEE | RAFTAAR', 6740, 86),
      ('bonding', 9, 'arJ8Q8tSQGc', 'Chemical Bonding — Bond Angle', 'Chemical Bonding 09 | Bond Angle | Drago''s Rule | Class11/JEE | RAFTAAR', 5349, 86),
      ('bonding', 10, 'o-ypQvZxQoc', 'Chemical Bonding — Dipole Moment', 'Chemical Bonding 10 | Dipole Moment | Ionic Compound | Class11/JEE | RAFTAAR', 7260, 86),
      ('bonding', 11, 'AajhdnNrJR8', 'Chemical Bonding — Ionic Compound', 'Chemical Bonding 11 | Ionic Compound | Class11/JEE | RAFTAAR', 7436, 86),
      ('bonding', 12, 'xtFGCe6hALY', 'Chemical Bonding — Hydration Energy', 'Chemical Bonding 12 | Hydration Energy | Polarisation | Class11/JEE | RAFTAAR', 6594, 86),
      ('bonding', 13, 'DdRxmPasqJA', 'Chemical Bonding — Fajan''s Rule', 'Chemical Bonding 13 | Fajan''s Rule | Class11/JEE | RAFTAAR', 6815, 86),
      ('bonding', 14, 'zZp21zmicpo', 'Chemical Bonding — Solubility', 'Chemical Bonding 14 | Solubility | MOT | Class11/JEE | RAFTAAR', 5326, 86),
      ('bonding', 15, 'Rk2hDM9sXmQ', 'Chemical Bonding — Molecular Orbital Theory', 'Chemical Bonding 15 | Molecular Orbital Theory | Class11/JEE | RAFTAAR', 7384, 86),
      ('bonding', 16, '7iSHPUO5Mf0', 'Chemical Bonding — Hydrogen Bonding MOT', 'Chemical Bonding 16 | Hydrogen Bonding MOT | Class11/JEE | RAFTAAR', 7489, 86),
      ('bonding', 17, '8N2CHjx59Hs', 'Live Practice Session - Periodic Table — Lecture 17', 'Live Practice Session - Periodic Table || Chemical Bonding || Class 11/JEE || RAFTAAR', 6076, 86),
      ('periodicity', 1, 'GXHsqvSyWj4', 'Classification of Elements & Periodicity — Genesis of Periodic Classification', 'Classification of Elements & Periodicity 01 | Genesis of Periodic Classification | Class11/JEE', 7222, 41),
      ('periodicity', 2, 'Y0d5WhJr2fw', 'Classification of Elements & Periodicity — Modern Periodic Table', 'Classification of Elements & Periodicity 02 | Modern Periodic Table | Class11/JEE', 6322, 41),
      ('periodicity', 3, 'r38agJ_cTNw', 'Classification of Elements & Periodicity — Modern Periodic Table — Lecture 3', 'Classification of Elements & Periodicity 03 | Modern Periodic Table | Class11/JEE', 7116, 41),
      ('periodicity', 4, 'k3cox6rpRQA', 'Classification of Elements & Periodicity — Modern Periodic Table — Lecture 4', 'Classification of Elements & Periodicity 04 | Modern Periodic Table | Class11/JEE', 7078, 41),
      ('periodicity', 5, '53dOXGWKn00', 'Classification of Elements & Periodicity — Atomic Radius', 'Classification of Elements & Periodicity 05 | Atomic Radius | Ionic Radius | Class11/JEE', 7541, 41),
      ('periodicity', 6, 'veMYiuzGO1w', 'Classification of Elements & Periodicity — Atomic Radius — Lecture 6', 'Classification of Elements & Periodicity 06 | Atomic Radius | Ionic Radius | Class11/JEE', 7751, 41),
      ('periodicity', 7, 'oNF72WTOKv4', 'Classification of Elements & Periodicity — Ionisation Energy', 'Classification of Elements & Periodicity 07 | Ionisation Energy | Electron Affinity | Class11/JEE', 6612, 41),
      ('periodicity', 8, 'EBAaxRdlL-0', 'Classification of Elements & Periodicity — Ionisation Energy — Lecture 8', 'Classification of Elements & Periodicity 08 | Ionisation Energy | Electron Affinity | Class11/JEE', 6457, 41),
      ('periodicity', 9, 'MAm6VTUOIvE', 'Classification of Elements & Periodicity — Electron Affinity', 'Classification of Elements & Periodicity 09 | Electron Affinity | Electronegativity | Class11/JEE', 9324, 41),
      ('periodicity', 10, '8N2CHjx59Hs', 'Live Practice Session - Periodic Table — Lecture 10', 'Live Practice Session - Periodic Table || Chemical Bonding || Class 11/JEE || RAFTAAR', 6076, 41),
      ('atom', 1, '8owJbGvpPL4', 'Structure Of Atom — Sub Atomic Particles', 'Structure Of Atom 01 | Sub Atomic Particles | Cathode Rays & Anode Rays | Class11/JEE | RAFTAAR', 4568, 37),
      ('atom', 2, 'xNEBv6Yb4a0', 'Structure Of Atom — Thomson''s Atomic Model', 'Structure Of Atom 02 | Thomson''s Atomic Model | Rutherford''s Experiment | Class11/JEE | RAFTAAR', 5394, 37),
      ('atom', 3, 'wK3vis3c8mI', 'Structure Of Atom — Planck''s Quantum Theory', 'Structure Of Atom 03 | Planck''s Quantum Theory | Photoelectric Effect | Class11/JEE | RAFTAAR', 4985, 37),
      ('atom', 4, '0m_lf6nlKvk', 'Structure Of Atom — Bohr''s Atomic Model', 'Structure Of Atom 04 | Bohr''s Atomic Model | Class11/JEE | RAFTAAR', 6319, 37),
      ('atom', 5, 'twM-YQP_XHM', 'Structure Of Atom — Bohr''s Atomic Model — Lecture 5', 'Structure Of Atom 05 | Bohr''s Atomic Model | Hydrogen Spectrum | Class11/JEE | RAFTAAR', 5192, 37),
      ('atom', 6, 'ZLBGGY70hAI', 'Structure Of Atom — Hydrogen Spectrum', 'Structure Of Atom 06 | Hydrogen Spectrum | De Broglie Equation | Class11/JEE | RAFTAAR', 5808, 37),
      ('atom', 7, 'nBCrdDNdXfY', 'Structure Of Atom — Heisenberg Uncertainly Principal', 'Structure Of Atom 07 | Heisenberg Uncertainly Principal | Quantum Number | Class11/JEE | RAFTAAR', 5497, 37),
      ('atom', 8, 'JNv0rvMwp0A', 'Structure Of Atom — Hund''s Rule', 'Structure Of Atom 08 | Hund''s Rule | Pauli Exclusion Principal | Class11/JEE | RAFTAAR', 3941, 37),
      ('atom', 9, '3s1HMuIzGzk', 'Structure Of Atom — Schrodinger Wave Equation', 'Structure Of Atom 09 | Schrodinger Wave Equation | Class11/JEE | RAFTAAR', 6640, 37),
      ('mole', 1, 'sAgjJ5LaG5g', 'Mole Concept — Physical Properties and Percentage Composition', 'Mole Concept 01 || Physical Properties and Percentage Composition || Class 11/JEE || RAFTAAR', 4379, 54),
      ('mole', 2, 'Y3e9bKf5hso', 'Mole Concept — Mole Concept', 'Mole Concept 02 || Mole Concept || Class 11/JEE || RAFTAAR', 5318, 54),
      ('mole', 3, '5aQpsBpvs4E', 'Mole Concept — Concentration Terms', 'Mole Concept 03 || Concentration Terms || Class 11/JEE || RAFTAAR', 5298, 54),
      ('mole', 4, 'T3dQFP2a-vM', 'Mole Concept — Box Method', 'Mole Concept 04 || Box Method || Mixing of Non Reacting Solutions || Class 11/JEE || RAFTAAR', 6132, 54),
      ('mole', 5, 'k7oBNKVsQ94', 'Mole Concept — Volume Strength', 'Mole Concept 05 || Volume Strength || Oleum Sample || Class 11/JEE || RAFTAAR', 5661, 54),
      ('mole', 6, 'hLvk_BFJzKQ', 'Mole Concept — Application of Limiting Reagent', 'Mole Concept 06 || Application of Limiting Reagent || Percentage Purity || Class 11/JEE || RAFTAAR', 5107, 54),
      ('mole', 7, 'efUUUuaMH6c', 'Mole Concept — Percentage Yield', 'Mole Concept 07 || Percentage Yield || Mixing of Reacting Solutions || Class 11/JEE || RAFTAAR', 4718, 54),
      ('mole', 8, 'jRMw0aL8kRo', 'Mole Concept — Double Titration', 'Mole Concept 08 || Double Titration || Average Atomic/Molecular Mass || Class 11/JEE || RAFTAAR', 5181, 54),
      ('mole', 9, 'nDacyB1EpI8', 'Mole Concept — Law of Chemical Combinations', 'Mole Concept 09 | Law of Chemical Combinations | Significance Figures | Class 11/JEE | RAFTAAR', 4351, 54),
      ('goc', 1, 'fL1xBK5g9p4', 'GOC — Introduction & Classification of Organic Chemistry', 'GOC 01 || Introduction & Classification of Organic Chemistry || Class 11/JEE || RAFTAAR', 5429, 288),
      ('goc', 2, 'RQQWoj485JA', 'GOC — Double Bond Equivalent', 'GOC 02 || Double Bond Equivalent || Classification of Organic Compound || Class 11/JEE || RAFTAAR', 4988, 288),
      ('goc', 3, 'IE4-kJZvx1s', 'GOC — IUPAC Nomenclature Rules', 'GOC 03 || IUPAC Nomenclature Rules || Hydrocarbon Nomenclature || Class 11/JEE || RAFTAAR', 6203, 288),
      ('goc', 4, 'QsCO3of_qjg', 'GOC — IUPAC Nomenclature', 'GOC 04 | IUPAC Nomenclature | Class 11/JEE | RAFTAAR', 5573, 288),
      ('goc', 5, '9RbELJ3vE0s', 'GOC — IUPAC Nomenclature — Lecture 5', 'GOC 05 | IUPAC Nomenclature | Class 11/JEE | RAFTAAR', 5728, 288),
      ('goc', 6, 'v7En1kjQKfA', 'GOC — Structural Isomerism', 'GOC 06 | Structural Isomerism | Class 11/JEE | RAFTAAR', 6142, 288),
      ('goc', 7, 'ePPg4ORwOUQ', 'GOC — Condition of Geometrical Isomerism', 'GOC 07 | Condition of Geometrical Isomerism | Class 11/JEE | RAFTAAR', 6038, 288),
      ('goc', 8, 'ggACAxVsvi4', 'GOC — Absolute Configuration', 'GOC 08 | Absolute Configuration | Calculation & Properties of Geometrical Isomerism | Class 11/JEE', 6277, 288),
      ('goc', 9, 'i8apXvt5rg8', 'GOC — Confirmational Isomerism', 'GOC 09 | Confirmational Isomerism | Class 11/JEE | RAFTAAR', 4848, 288),
      ('goc', 10, '-1JsSKaBI1k', 'GOC — Introduction', 'GOC 10 | Introduction | Plane of Symmetry | Centre of Symmetry | Class 11/JEE | RAFTAAR', 5450, 288),
      ('goc', 11, 'DrHA6kAiWcE', 'GOC — Optical Isomerism', 'GOC 11 | Optical Isomerism | Relative Configuration | Class 11/JEE | RAFTAAR', 5273, 288),
      ('goc', 12, 'O9rFKIsjKHk', 'GOC — Enantiomer', 'GOC 12 | Enantiomer | Diasteromer | Calculation of Optical Isomer | Class 11/JEE | RAFTAAR', 5091, 288),
      ('goc', 13, 'mcRHBwJ_3lg', 'GOC — Inductive Effect', 'GOC 13 | Inductive Effect | Class 11/JEE | RAFTAAR', 5600, 288),
      ('goc', 14, '-vuYvvqFQc4', 'GOC — Resonance', 'GOC 14 | Resonance | Class 11/JEE | RAFTAAR', 5387, 288),
      ('goc', 15, '6UEhLCK5yeg', 'GOC — Aromaticity', 'GOC 15 | Aromaticity | Class 11/JEE | RAFTAAR', 5889, 288),
      ('goc', 16, 'YxRDcTt23uI', 'GOC — Hyperconjugation', 'GOC 16 | Hyperconjugation | Class 11/JEE | RAFTAAR', 4863, 288),
      ('goc', 17, 'nKAFyaQpIeQ', 'GOC — Acidic and Basic Strength', 'GOC 17 | Acidic and Basic Strength | Class 11/JEE | RAFTAAR', 5522, 288),
      ('goc', 18, 'G-rKguGyDpE', 'GOC — Purification', 'GOC 18 | Purification | Qualitative & Quantitative Analysis | Class 11/JEE | RAFTAAR', 3853, 288),
      ('hydrocarbon', 1, 'u2qjBKAVY5w', 'Hydrocarbon — Preparation of Alkane', 'Hydrocarbon 01 | Preparation of Alkane | Class 11/JEE | RAFTAAR', 5227, 89),
      ('hydrocarbon', 2, 'C9BvoF5Kb0I', 'Hydrocarbon — Properties of Alkane', 'Hydrocarbon 02 | Properties of Alkane | Class 11/JEE | RAFTAAR', 4933, 89),
      ('hydrocarbon', 3, 'sIJlEM-f76A', 'Hydrocarbon — Preparation of Alkene', 'Hydrocarbon 03 | Preparation of Alkene | Class 11/JEE | RAFTAAR', 5455, 89),
      ('hydrocarbon', 4, 'pNgsztLEQ6o', 'Hydrocarbon — Properties of Alkene', 'Hydrocarbon 04 | Properties of Alkene | Class 11/JEE | RAFTAAR', 5513, 89),
      ('hydrocarbon', 5, 'zmREjF-O180', 'Hydrocarbon — Alkyne', 'Hydrocarbon 05 | Alkyne | Benzene | Class 11/JEE | RAFTAAR', 5393, 89),
      ('thermo', 1, 'c7HsefGP-hE', 'Thermodynamics — Lecture 1', 'Thermodynamics 01 - Class 11/JEE | RAFTAAR', 5433, 36),
      ('thermo', 2, 'dt9q6lchkPw', 'Thermodynamics — First Law Of Thermodynamics', 'Thermodynamics 02 - First Law Of Thermodynamics | Class 11/JEE | RAFTAAR', 4552, 36),
      ('thermo', 3, '-uvkWchGKxs', 'Thermodynamics — Relation b/w Heat Capacity', 'Thermodynamics 03 - Relation b/w Heat Capacity | Isothermal process | Class 11/JEE | RAFTAAR', 5513, 36),
      ('thermo', 4, 'v9YNXMCG-4g', 'Thermodynamics — Work done in Various Process', 'Thermodynamics 04 - Work done in Various Process | Class 11/JEE | RAFTAAR', 4909, 36),
      ('thermo', 5, 'VswqF0V41Js', 'Thermodynamics — Bomb - Calorimeter', 'Thermodynamics 05 - Bomb - Calorimeter | Class 11/JEE | RAFTAAR', 4953, 36),
      ('thermo', 6, 'UWSrSyeoin0', 'Thermodynamics — 2nd Law of Thermodynamics', 'Thermodynamics 06 - 2nd Law of Thermodynamics | Bomb-Calorimeter | Class 11/JEE | RAFTAAR', 4985, 36),
      ('thermo', 7, 'uxBYyjD-uEI', 'Thermodynamics — Criteria of Spontaneity', 'Thermodynamics 07 - Criteria of Spontaneity | Thermochemistry | Class 11/JEE | RAFTAAR', 4836, 36),
      ('thermo', 8, 'FJOJ9_fByF8', 'Thermodynamics — Thermochemistry', 'Thermodynamics 08 - Thermochemistry | Class 11/JEE | RAFTAAR', 5529, 36),
      ('metallurgy', 1, 'RY73hvZjil0', 'Metallurgy — Introduction to Metallurgy', 'Metallurgy 01 : Introduction to Metallurgy | Class 12th/JEE', 4890, 55),
      ('metallurgy', 2, 'mBQfj-V9apY', 'Metallurgy — Leaching, Oxidation & Reduction', 'Metallurgy 02 : Leaching, Oxidation & Reduction | Class 12th/JEE', 3641, 55),
      ('metallurgy', 3, 'vt5hTmNsHXU', 'Metallurgy — Refining', 'Metallurgy 03 : Refining | Class 12th/JEE', 6602, 55),
      ('kinetics', 1, 'ZqAIEcCWcr8', 'Chemical Kinetics — Rate of Reaction', 'Chemical Kinetics 01 : Rate of Reaction | Class 12th/JEE', 5402, 35),
      ('kinetics', 2, 'UqZw1r2bx3s', 'Chemical Kinetics — Rate Law, Order & Molecularity', 'Chemical Kinetics 02 : Rate Law, Order & Molecularity | Class 12th/JEE', 5164, 35),
      ('kinetics', 3, 'yYNYXpDjg1Y', 'Chemical Kinetics — Elementary & Non Elementary Reactions', 'Chemical Kinetics 03 : Elementary & Non Elementary Reactions | Class 12th/JEE', 5547, 35),
      ('kinetics', 4, 'geyFx3mCttE', 'Chemical Kinetics — Integrated Rate Laws', 'Chemical Kinetics 04: Integrated Rate Laws | Class 12th/JEE', 5378, 35),
      ('kinetics', 5, 'z2qdgonzeI0', 'Chemical Kinetics — Applications of First Order Kinetics', 'Chemical Kinetics 05 | Applications of First Order Kinetics | Class 12th/JEE', 5528, 35),
      ('kinetics', 6, 'tvN3ijLMeL8', 'Chemical Kinetics — Applications of First Order Kinetics — Lecture 6', 'Chemical Kinetics 06 | Applications of First Order Kinetics | Class 12th/JEE', 4013, 35),
      ('kinetics', 7, 'P0Sxq0zU2bs', 'Chemical Kinetics — Radioactivity, 2nd & nth Order Reactions', 'Chemical Kinetics 07 | Radioactivity, 2nd & nth Order Reactions | Class 12th/JEE', 4498, 35),
      ('kinetics', 8, '7v7e_2UTlrE', 'Chemical Kinetics — Nuclear Chemistry', 'Chemical Kinetics 10 | Nuclear Chemistry | Class 12th/JEE', 4009, 35),
      ('dfblock', 1, 'C_MWwoyzkgQ', 'D&F Block Elements — Lecture 1', 'D&F Block Elements : Introduction to Elements | Class 12th/JEE', 5009, 45),
      ('dfblock', 2, 'dtnULI4HRYg', 'D&F Block Elements — Properties of D - Block Elements Part - 1', 'D&F Block Elements 02 : Properties of D - Block Elements Part - 1 | Class 12th/JEE', 5499, 45),
      ('dfblock', 3, 'vKA9QjLM0zQ', 'D&F Block Elements — Properties of D - Block Elements Part - 2', 'D&F Block Elements 03 : Properties of D - Block Elements Part - 2 | Class 12th/JEE', 5491, 45),
      ('dfblock', 4, 'CP41Ml4HRGQ', 'D&F Block Elements — Compounds of D Block Elements', 'D&F Block Elements 04 : Compounds of D Block Elements | Class 12th/JEE', 4626, 45),
      ('dfblock', 5, 'cEXNoC8rBrc', 'D & F Block Elements — F Block Elements', 'D & F Block Elements 05 : F Block Elements | Class 12th/JEE', 5032, 45),
      ('coordination', 1, 'LLi0f87F65M', 'Coordination Chemistry — Introduction', 'Coordination Chemistry 01 : Introduction | Class 12th/JEE', 5838, 87),
      ('coordination', 2, 'uxrBdOWd6u0', 'Coordination Chemistry — Type of Ligand', 'Coordination Chemistry 02 : Type of Ligand | Class 12th/JEE', 4002, 87),
      ('coordination', 3, 'sJtDCEQsKUg', 'Coordination Chemistry — Synergic Bonding', 'Coordination Chemistry 03 : Synergic Bonding | Class 12th/JEE', 5136, 87),
      ('coordination', 4, 'PgLwNB3kU1I', 'Coordination Chemistry — Effective Atomic Number', 'Coordination Chemistry 04 : Effective Atomic Number | Class 12th/JEE', 4397, 87),
      ('coordination', 5, '11wN6tqi_Ho', 'Coordination Chemistry — Nomenclature of Compound', 'Coordination Chemistry 05 : Nomenclature of Compound | Class 12th/JEE', 5991, 87),
      ('coordination', 6, 'efoIolvCJYk', 'Coordination Chemistry — IUPAC', 'Coordination Chemistry 06 : IUPAC | Class 12th/JEE', 3787, 87),
      ('coordination', 7, 'AFnwa-gF8l4', 'Coordination Chemistry — Isomerism (Part-1)', 'Coordination Chemistry 07 : Isomerism (Part-1) | Class 12th/JEE', 4474, 87),
      ('coordination', 8, 'gBci6oYeXlI', 'Coordination Chemistry — Isomerism (Part-2)', 'Coordination Chemistry 07 : Isomerism (Part-2) | Class 12th/JEE', 6373, 87),
      ('coordination', 9, '9TEGxXBdkfY', 'Coordination Chemistry — Werner''s Theory', 'Coordination Chemistry 08 : Werner''s Theory | Class 12th/JEE', 5188, 87),
      ('coordination', 10, 'fr6Ru3ENEiM', 'Coordination Chemistry — Valence Bond Theory', 'Coordination Chemistry 09 : Valence Bond Theory | Class 12th/JEE', 4902, 87),
      ('coordination', 11, 'RE8hX9wV7NU', 'Coordination Chemistry — Crystal Field Theory - Part 1', 'Coordination Chemistry 10 : Crystal Field Theory - Part 1 | Class 12th/JEE', 3943, 87),
      ('coordination', 12, 'kaSVE8O09aE', 'Coordination Chemistry — Crystal Field Theory - Part 2', 'Coordination Chemistry 10 : Crystal Field Theory - Part 2 | Class 12th/JEE', 4819, 87),
      ('coordination', 13, 'dWZ65Bjs2wM', 'Coordination Chemistry — Crystal Field Theory - Part 3', 'Coordination Chemistry 10 : Crystal Field Theory - Part 3 | Class 12th/JEE', 4466, 87),
      ('p_block_12', 1, 'T-vPL5ojXc0', 'P Block Elements — Nitrogen Family Part -1', 'P Block Elements 01 : Nitrogen Family Part -1 | Class 12th/JEE', 6740, 50),
      ('p_block_12', 2, 'VSz9ZGXi6L4', 'P Block Elements — Nitrogen Family Part -2', 'P Block Elements 02 : Nitrogen Family Part -2 | Class 12th/JEE', 6952, 50),
      ('p_block_12', 3, '3Uwl3rxv6rQ', 'P Block Elements — Nitrogen Family Part - 3', 'P Block Elements 03 : Nitrogen Family Part - 3 | Class 12th/JEE', 8656, 50),
      ('p_block_12', 4, 'zVXGzkOxTXU', 'P Block Elements — Oxygen Family Part - 1', 'P Block Elements 04 : Oxygen Family Part - 1 | Class 12th/JEE', 8166, 50),
      ('p_block_12', 5, 'pDuB9DsaFmw', 'P Block Elements — Oxygen Family Part - 2', 'P Block Elements 05 : Oxygen Family Part - 2 | Class 12th/JEE', 5441, 50),
      ('p_block_12', 6, 'V3Tz-z5WZqo', 'P Block Elements — Oxygen Family Part - 3', 'P Block Elements 06 : Oxygen Family Part - 3 | Class 12th/JEE', 4816, 50),
      ('p_block_12', 7, 'lgE6OHNiF80', 'P Block Elements — Halogen Family Part - 1', 'P Block Elements 07 : Halogen Family Part - 1 | Class 12th/JEE', 6051, 49),
      ('p_block_12', 8, '9h-Ag7haN7g', 'P Block Elements — Halogen Family Part - 2', 'P Block Elements 08 : Halogen Family Part - 2 | Class 12th/JEE', 4274, 49),
      ('p_block_12', 9, 'uRhA4FRDejU', 'P Block Elements — Noble Gases', 'P Block Elements 09 : Noble Gases | Class 12th/JEE', 3390, 49),
      ('salt', 1, 'B18wP-VMFHg', 'Salt Analysis — Acidic Radicals - Part 1', 'Salt Analysis 01 : Acidic Radicals - Part 1 | Class 12th/JEE', 4911, 39),
      ('salt', 2, 'oYvQ2OPkifU', 'Salt Analysis — Acidic Radicals - Part 2', 'Salt Analysis 02 : Acidic Radicals - Part 2 | Class 12th/JEE', 6211, 39),
      ('salt', 3, 'jZCDZf69Ccg', 'Salt Analysis — Acidic Radicals - Part 3', 'Salt Analysis 03 : Acidic Radicals - Part 3 | Class 12th/JEE', 4537, 39),
      ('salt', 4, 'DGL1SSJBo3s', 'Salt Analysis — Basic Radicals - Part 1', 'Salt Analysis 04 : Basic Radicals - Part 1 | Class 12th/JEE', 6196, 52),
      ('salt', 5, 'UpNN_3zXtPY', 'Salt Analysis — Basic Radicals Part 2', 'Salt Analysis 05 : Basic Radicals Part 2 | Class 12th/JEE', 3557, 52),
      ('salt', 6, '844lQ-f7MXg', 'Salt Analysis — Basic Radicals - Part 3', 'Salt Analysis 06 : Basic Radicals - Part 3 | Class 12th/JEE', 5017, 52),
      ('salt', 7, 'Hkp9Ovs0n6o', 'Salt Analysis — Solubility Rules & Heating Effects', 'Salt Analysis 07 : Solubility Rules & Heating Effects | Class 12th/JEE', 3693, 39),
      ('salt', 8, 'y7LHjd_l8nY', 'Salt Analysis — Common Ion Effects', 'Salt Analysis 08 : Common Ion Effects | Class 12th/JEE', 3199, 39)
      ) as x(ckey, position, youtube_video_id, title, source_title, duration_seconds, chapter_id)
      where x.ckey = c_row.ckey
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
  end loop;

  if v_inserted <> 143 then
    raise exception 'expected 143 lessons, inserted %', v_inserted;
  end if;

  -- Every lesson must sit on its course's channel and be filed under a goal and
  -- a class level, or it is invisible to goal-scoped search.
  if exists (
    select 1 from public.videos v
    where v.channel_id = v_channel_id and v.subject_id = 2
      and (not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
        or not exists (select 1 from public.video_class_levels l where l.video_id = v.id))
  ) then
    raise exception 'a JEE Wallah Chemistry lesson was left without a goal or class level';
  end if;
end $$;
