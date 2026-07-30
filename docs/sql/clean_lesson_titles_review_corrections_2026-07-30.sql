-- clean_lesson_titles_review_corrections_2026-07-30.sql
--
-- The adversarial review of 8 of the 18 title batches could not run when the
-- main pass shipped (usage limit). Those reviews have now completed and
-- returned 37 corrections in total, 33 of which are not yet live.
-- Mostly batch 15: dropped "PYQ" qualifiers that the source carried, and
-- "(Part N)" families numbered non-contiguously or starting from the wrong
-- position.
--
-- Each row is guarded on the CURRENTLY LIVE title rather than source_title
-- (these lessons were already rewritten), so a row edited since the snapshot
-- is skipped instead of silently overwritten. source_title still holds every
-- original. Idempotent; aborts unless every intended change landed.

begin;

update public.videos v
   set title = n.new_title
  from (values
    (74, 'Irodov Q.3.2 — Interaction Force Between Two Copper...', 'Irodov Q.3.2 — Interaction Force'),
    (183, 'Huygens Wave Theory, Wave Front, Point Source and Line Source', 'Huygens Wave Theory, Wave Front, Huygens Principle, Point Source and Line Source'),
    (190, 'Examples of Single Slit/Circular Aperture Diffraction, Resolving Limit and Power', 'Single Slit/Circular Aperture Diffraction Examples, Resolving Limit and Resolving Power'),
    (1511, 'Kinematics One Shot', 'Kinematics in One Shot with PYQ'),
    (1512, 'Newton''s Laws of Motion + Friction One Shot', 'Newton''s Laws of Motion + Friction in One Shot with PYQ'),
    (1513, 'Circular Motion + Work, Power, Energy One Shot', 'Circular Motion + Work, Power, Energy in One Shot with PYQ'),
    (1514, 'Centre of Mass One Shot', 'Centre of Mass in One Shot with PYQ'),
    (1515, 'Rotational Motion One Shot', 'Rotational Motion in One Shot with PYQ'),
    (1516, 'Mechanical & Thermal Properties of Matter One Shot', 'Mechanical & Thermal Properties of Matter in One Shot with PYQ'),
    (1517, 'Simple Harmonic Motion & Waves One Shot', 'Simple Harmonic Motion & Waves in One Shot with PYQ'),
    (1518, 'Thermodynamics + KTG + Heat + Elasticity One Shot', 'Thermodynamics + KTG + Heat + Elasticity in One Shot with PYQ'),
    (1519, 'Mechanical Properties of Fluids One Shot', 'Mechanical Properties of Fluids in One Shot with PYQ'),
    (1520, 'Mechanics of Solids, Gravitation & Rotational Motion One Shot', 'Mechanics of Solids, Gravitation & Rotational Motion in One Shot with PYQ'),
    (1531, 'IUPAC Nomenclature', 'IUPAC Nomenclature — One Shot (Concepts + PYQs)'),
    (1532, 'Isomerism', 'Isomerism — One Shot (Concepts + PYQs)'),
    (1533, 'Optical Isomerism', 'Optical Isomerism — One Shot (Concepts + PYQs)'),
    (1534, 'GOC', 'GOC — One Shot (Concepts + PYQs)'),
    (1535, 'Aromaticity and Stability of Intermediates (GOC Part 2)', 'Aromaticity and Stability of Intermediates — GOC Part 2 (Concepts + PYQs)'),
    (1536, 'Qualitative & Quantitative Analysis & Purification', 'Qualitative & Quantitative Analysis & Purification — One Shot (Concepts + PYQs)'),
    (1537, 'Hydrocarbons: Alkanes and Alkenes', 'Hydrocarbons: Alkanes and Alkenes — One Shot (Concepts + PYQs)'),
    (1538, 'Hydrocarbons: Alkynes and Benzene', 'Hydrocarbons: Alkynes and Benzene — One Shot (Concepts + PYQs)'),
    (754, 'Complex Numbers (Part 8)', 'Complex Numbers'),
    (755, 'Complex Numbers (Part 9)', 'Complex Numbers (Part 2)'),
    (756, 'Complex Numbers (Part 10)', 'Complex Numbers (Part 3)'),
    (757, 'Complex Numbers (Part 11)', 'Complex Numbers (Part 4)'),
    (758, 'Complex Numbers (Part 12)', 'Complex Numbers (Part 5)'),
    (759, 'Complex Numbers (Part 13)', 'Complex Numbers (Part 6)'),
    (760, 'Complex Numbers (Part 14)', 'Complex Numbers (Part 7)'),
    (763, 'Complex Numbers (Part 17)', 'Complex Numbers (Part 8)'),
    (764, 'Complex Numbers (Part 18)', 'Complex Numbers (Part 9)'),
    (765, 'Complex Numbers (Part 19)', 'Complex Numbers (Part 10)'),
    (766, 'Complex Numbers (Part 20)', 'Complex Numbers (Part 11)'),
    (677, 'Examples of Communication Systems, Amplitude Modulation, Diode Detector', 'Examples of Communication Systems, Amplitude Modulation, Modulation Index, Diode Detector')
  ) as n(id, expected_title, new_title)
 where v.id = n.id
   and v.title = n.expected_title;

do $$
declare
  n_missing int;
  n_dup int;
begin
  select count(*) into n_missing from (values
    (74, 'Irodov Q.3.2 — Interaction Force'),
    (183, 'Huygens Wave Theory, Wave Front, Huygens Principle, Point Source and Line Source'),
    (190, 'Single Slit/Circular Aperture Diffraction Examples, Resolving Limit and Resolving Power'),
    (1511, 'Kinematics in One Shot with PYQ'),
    (1512, 'Newton''s Laws of Motion + Friction in One Shot with PYQ'),
    (1513, 'Circular Motion + Work, Power, Energy in One Shot with PYQ'),
    (1514, 'Centre of Mass in One Shot with PYQ'),
    (1515, 'Rotational Motion in One Shot with PYQ'),
    (1516, 'Mechanical & Thermal Properties of Matter in One Shot with PYQ'),
    (1517, 'Simple Harmonic Motion & Waves in One Shot with PYQ'),
    (1518, 'Thermodynamics + KTG + Heat + Elasticity in One Shot with PYQ'),
    (1519, 'Mechanical Properties of Fluids in One Shot with PYQ'),
    (1520, 'Mechanics of Solids, Gravitation & Rotational Motion in One Shot with PYQ'),
    (1531, 'IUPAC Nomenclature — One Shot (Concepts + PYQs)'),
    (1532, 'Isomerism — One Shot (Concepts + PYQs)'),
    (1533, 'Optical Isomerism — One Shot (Concepts + PYQs)'),
    (1534, 'GOC — One Shot (Concepts + PYQs)'),
    (1535, 'Aromaticity and Stability of Intermediates — GOC Part 2 (Concepts + PYQs)'),
    (1536, 'Qualitative & Quantitative Analysis & Purification — One Shot (Concepts + PYQs)'),
    (1537, 'Hydrocarbons: Alkanes and Alkenes — One Shot (Concepts + PYQs)'),
    (1538, 'Hydrocarbons: Alkynes and Benzene — One Shot (Concepts + PYQs)'),
    (754, 'Complex Numbers'),
    (755, 'Complex Numbers (Part 2)'),
    (756, 'Complex Numbers (Part 3)'),
    (757, 'Complex Numbers (Part 4)'),
    (758, 'Complex Numbers (Part 5)'),
    (759, 'Complex Numbers (Part 6)'),
    (760, 'Complex Numbers (Part 7)'),
    (763, 'Complex Numbers (Part 8)'),
    (764, 'Complex Numbers (Part 9)'),
    (765, 'Complex Numbers (Part 10)'),
    (766, 'Complex Numbers (Part 11)'),
    (677, 'Examples of Communication Systems, Amplitude Modulation, Modulation Index, Diode Detector')
  ) as want(id, title)
  join public.videos v on v.id = want.id
  where v.title <> want.title;
  if n_missing <> 0 then
    raise exception 'title corrections: % row(s) did not reach the intended title (edited since review?)', n_missing;
  end if;

  select count(*) into n_dup from (
    select pv.playlist_id, lower(btrim(v.title)) as t
      from public.playlist_videos pv
      join public.videos v on v.id = pv.video_id
     group by pv.playlist_id, lower(btrim(v.title))
    having count(*) > 1
  ) d;
  if n_dup <> 0 then
    raise exception 'title corrections created % duplicate lesson title(s) within a course', n_dup;
  end if;
end $$;

commit;
