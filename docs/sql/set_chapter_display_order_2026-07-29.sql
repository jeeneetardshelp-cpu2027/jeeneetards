-- set_chapter_display_order_2026-07-29.sql
--
-- Chapters of the four original subjects (Physics, Chemistry, Mathematics,
-- Biology) all sit at display_order = 0, so every chapter menu falls back to
-- ALPHABETICAL order (Friction before Kinematics). This assigns the real
-- NCERT/JEE-coaching syllabus sequence: Class 10 block first (Mathematics
-- only), then Class 11, then Class 12; coaching splits adjacent to their
-- parent chapters (friction after NLM, capacitance after electrostatics,
-- p-block variants together).
--
-- 134 rows across subjects 1-4. Generated from a 4-subject curriculum
-- pass, each order independently reviewed, and the slug sets verified against
-- production on 2026-07-29 (read-only). Idempotent: safe to run twice.
-- The frontend needs no changes: get_browse_curriculum and the filter
-- queries already ORDER BY display_order.

begin;

-- ---- Physics (subject_id 1, 30 chapters) ----
update public.chapters c
   set display_order = v.ord
  from (values
    ('basic-mathematics-for-physics', 1),
    ('units-and-measurements', 2),
    ('kinematics', 3),
    ('laws-of-motion', 4),
    ('newtons-laws-of-motion-nlm', 5),
    ('friction', 6),
    ('work-energy-and-power', 7),
    ('system-of-particles-and-centre-of-mass', 8),
    ('rotational-motion', 9),
    ('gravitation', 10),
    ('mechanical-properties-of-solids', 11),
    ('mechanical-properties-of-fluids', 12),
    ('thermal-properties-of-matter', 13),
    ('thermodynamics', 14),
    ('oscillations-and-waves', 15),
    ('electrostatics', 16),
    ('capacitance', 17),
    ('current-electricity', 18),
    ('moving-charges-and-magnetism', 19),
    ('magnetism-and-matter', 20),
    ('electromagnetic-induction', 21),
    ('alternating-current', 22),
    ('electromagnetic-waves', 23),
    ('ray-optics-and-optical-instruments', 24),
    ('wave-optics', 25),
    ('dual-nature-of-radiation-and-matter', 26),
    ('atoms', 27),
    ('modern-physics', 28),
    ('semiconductor-electronics', 29),
    ('communication-systems', 30)
  ) as v(slug, ord)
 where c.subject_id = 1 and c.slug = v.slug;

-- ---- Chemistry (subject_id 2, 39 chapters) ----
update public.chapters c
   set display_order = v.ord
  from (values
    ('mole-concept', 1),
    ('atomic-structure', 2),
    ('periodic-table', 3),
    ('chemical-bonding-and-molecular-structure', 4),
    ('gaseous-state', 5),
    ('thermodynamics', 6),
    ('thermochemistry', 7),
    ('chemical-equilibrium', 8),
    ('ionic-equilibrium', 9),
    ('redox-reactions', 10),
    ('hydrogen', 11),
    ('the-s-block-elements', 12),
    ('p-block-elements-groups-13-and-14', 13),
    ('basic-inorganic-nomenclature', 14),
    ('purification-and-characterisation-of-organic-compounds', 15),
    ('some-basic-principles-of-organic-chemistry', 16),
    ('structural-isomerism', 17),
    ('hydrocarbons', 18),
    ('solid-state', 19),
    ('solutions', 20),
    ('electrochemistry', 21),
    ('chemical-kinetics', 22),
    ('surface-chemistry', 23),
    ('nuclear-chemistry', 24),
    ('p-block-elements', 25),
    ('p-block-elements-groups-15-and-16', 26),
    ('p-block-elements-groups-17-and-18', 27),
    ('the-d-and-f-block-elements', 28),
    ('coordination-compounds', 29),
    ('metallurgy', 30),
    ('qualitative-analysis', 31),
    ('qualitative-analysis-cations', 32),
    ('organic-compounds-containing-halogens', 33),
    ('organic-compounds-containing-oxygen', 34),
    ('carboxylic-acids-and-derivatives', 35),
    ('organic-compounds-containing-nitrogen', 36),
    ('amines', 37),
    ('biomolecules', 38),
    ('chemistry-in-everyday-life', 39)
  ) as v(slug, ord)
 where c.subject_id = 2 and c.slug = v.slug;

-- ---- Mathematics (subject_id 3, 33 chapters) ----
update public.chapters c
   set display_order = v.ord
  from (values
    ('real-numbers', 1),
    ('polynomials', 2),
    ('pair-of-linear-equations-in-two-variables', 3),
    ('arithmetic-progressions', 4),
    ('triangles', 5),
    ('introduction-to-trigonometry', 6),
    ('some-applications-of-trigonometry', 7),
    ('areas-related-to-circles', 8),
    ('surface-areas-and-volumes', 9),
    ('logarithms', 10),
    ('trigonometry', 11),
    ('trigonometric-equations', 12),
    ('quadratic-equations', 13),
    ('complex-numbers', 14),
    ('sequences-and-series', 15),
    ('permutations-and-combinations', 16),
    ('binomial-theorem', 17),
    ('coordinate-geometry', 18),
    ('straight-lines', 19),
    ('circles', 20),
    ('parabola', 21),
    ('ellipse', 22),
    ('hyperbola', 23),
    ('statistics', 24),
    ('inverse-trigonometric-functions', 25),
    ('determinants', 26),
    ('continuity', 27),
    ('differentiation', 28),
    ('definite-integration', 29),
    ('application-of-integrals', 30),
    ('differential-equations', 31),
    ('vectors-and-three-dimensional-geometry', 32),
    ('probability', 33)
  ) as v(slug, ord)
 where c.subject_id = 3 and c.slug = v.slug;

-- ---- Biology (subject_id 4, 32 chapters) ----
update public.chapters c
   set display_order = v.ord
  from (values
    ('the-living-world', 1),
    ('biological-classification', 2),
    ('plant-kingdom', 3),
    ('animal-kingdom', 4),
    ('morphology-of-flowering-plants', 5),
    ('anatomy-of-flowering-plants', 6),
    ('structural-organisation-in-animals', 7),
    ('cell-the-unit-of-life', 8),
    ('biomolecules', 9),
    ('cell-cycle-and-cell-division', 10),
    ('photosynthesis-in-higher-plants', 11),
    ('respiration-in-plants', 12),
    ('plant-growth-and-development', 13),
    ('breathing-and-exchange-of-gases', 14),
    ('body-fluids-and-circulation', 15),
    ('excretory-products-and-their-elimination', 16),
    ('locomotion-and-movement', 17),
    ('neural-control-and-coordination', 18),
    ('chemical-coordination-and-integration', 19),
    ('sexual-reproduction-in-flowering-plants', 20),
    ('human-reproduction', 21),
    ('reproductive-health', 22),
    ('principles-of-inheritance-and-variation', 23),
    ('molecular-basis-of-inheritance', 24),
    ('evolution', 25),
    ('human-health-and-disease', 26),
    ('microbes-in-human-welfare', 27),
    ('biotechnology-principles-and-processes', 28),
    ('biotechnology-and-its-applications', 29),
    ('organisms-and-populations', 30),
    ('ecosystem', 31),
    ('biodiversity-and-conservation', 32)
  ) as v(slug, ord)
 where c.subject_id = 4 and c.slug = v.slug;

-- New chapters used to default to display_order 0, which sorts BEFORE 1 —
-- a future import would jump to the top of every menu. NULL sorts last in
-- every ordering path this app uses (Postgres ASC default), which is the
-- right place for a not-yet-ordered chapter.
alter table public.chapters alter column display_order set default null;

-- Abort unless every subject now has a complete, gap-free 1..n sequence.
do $$
declare
  bad record;
begin
  for bad in
    select subject_id,
           count(*)                                   as total,
           count(*) filter (where display_order = 0)  as zeros,
           count(distinct display_order)              as distincts,
           min(display_order)                         as lo,
           max(display_order)                         as hi
      from public.chapters
     where subject_id in (1, 2, 3, 4)
     group by subject_id
  loop
    if bad.zeros <> 0 or bad.distincts <> bad.total
       or bad.lo <> 1 or bad.hi <> bad.total then
      raise exception
        'subject % order incomplete: total=%, zeros=%, distinct=%, min=%, max=%',
        bad.subject_id, bad.total, bad.zeros, bad.distincts, bad.lo, bad.hi;
    end if;
  end loop;
end $$;

commit;
