-- =====================================================================
-- chapter_class_scopes_v14_draft.sql
-- PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.
--
-- Adds only evidence-reviewed chapter -> academic class rows to the v13
-- canonical junction. It does not change catalogue rows or replace browse
-- functions. Four ambiguous/shared chapters remain deliberately excluded:
-- probability, p-block-elements, surface-chemistry, qualitative-analysis.
-- =====================================================================

begin;

-- Fail closed even if this review artifact is pasted into a SQL editor.
-- A separately approved, hash-verified rehearsal package must remove only
-- this guard after pinning the exact reviewed source hash.
do $not_approved$
begin
  raise exception 'NOT APPROVED: chapter class scopes v14 is a review-only draft';
end
$not_approved$;

do $preflight$
declare
  v_existing_count integer;
begin
  if to_regclass('public.chapter_class_levels') is null then
    raise exception 'PREFLIGHT: v13 chapter_class_levels is missing';
  end if;

  select count(*) into v_existing_count
  from public.chapter_class_levels;

  if v_existing_count <> 5 then
    raise exception 'PREFLIGHT: expected exactly five v13 rows, got %', v_existing_count;
  end if;

  if (
    select count(*)
    from public.chapter_class_levels ccl
    join public.chapters ch on ch.id = ccl.chapter_id
    join public.class_levels cl on cl.id = ccl.class_level_id
    where (ch.slug, cl.slug) in (
      ('kinematics', 'class-11'),
      ('newtons-laws-of-motion-nlm', 'class-11'),
      ('work-energy-and-power', 'class-11'),
      ('ray-optics-and-optical-instruments', 'class-12'),
      ('modern-physics', 'class-12')
    )
  ) <> 5 then
    raise exception 'PREFLIGHT: the five reviewed v13 rows differ';
  end if;
end
$preflight$;

with reviewed(subject_slug, chapter_slug, class_slug) as (
  values
    -- Physics / Class XI (13)
    ('physics', 'units-and-measurements', 'class-11'),
    ('physics', 'basic-mathematics-for-physics', 'class-11'),
    ('physics', 'laws-of-motion', 'class-11'),
    ('physics', 'friction', 'class-11'),
    ('physics', 'system-of-particles-and-centre-of-mass', 'class-11'),
    ('physics', 'rotational-motion', 'class-11'),
    ('physics', 'gravitation', 'class-11'),
    ('physics', 'mechanical-properties-of-solids', 'class-11'),
    ('physics', 'mechanical-properties-of-fluids', 'class-11'),
    ('physics', 'thermal-properties-of-matter', 'class-11'),
    ('physics', 'thermodynamics', 'class-11'),
    ('physics', 'kinetic-theory-of-gases', 'class-11'),
    ('physics', 'oscillations-and-waves', 'class-11'),

    -- Physics / Class XII (9)
    ('physics', 'electrostatics', 'class-12'),
    ('physics', 'current-electricity', 'class-12'),
    ('physics', 'moving-charges-and-magnetism', 'class-12'),
    ('physics', 'magnetism-and-matter', 'class-12'),
    ('physics', 'electromagnetic-induction', 'class-12'),
    ('physics', 'alternating-current', 'class-12'),
    ('physics', 'electromagnetic-waves', 'class-12'),
    ('physics', 'wave-optics', 'class-12'),
    ('physics', 'semiconductor-electronics', 'class-12'),

    -- Chemistry / Class XI (15)
    ('chemistry', 'mole-concept', 'class-11'),
    ('chemistry', 'atomic-structure', 'class-11'),
    ('chemistry', 'periodic-table', 'class-11'),
    ('chemistry', 'chemical-bonding-and-molecular-structure', 'class-11'),
    ('chemistry', 'thermodynamics', 'class-11'),
    ('chemistry', 'chemical-equilibrium', 'class-11'),
    ('chemistry', 'ionic-equilibrium', 'class-11'),
    ('chemistry', 'redox-reactions', 'class-11'),
    ('chemistry', 'purification-and-characterisation-of-organic-compounds', 'class-11'),
    ('chemistry', 'some-basic-principles-of-organic-chemistry', 'class-11'),
    ('chemistry', 'hydrocarbons', 'class-11'),
    ('chemistry', 'stereoisomerism', 'class-11'),
    ('chemistry', 'gaseous-state', 'class-11'),
    ('chemistry', 'basic-inorganic-nomenclature', 'class-11'),
    ('chemistry', 'organic-reaction-mechanisms', 'class-11'),

    -- Chemistry / Class XII (9)
    ('chemistry', 'solutions', 'class-12'),
    ('chemistry', 'electrochemistry', 'class-12'),
    ('chemistry', 'chemical-kinetics', 'class-12'),
    ('chemistry', 'the-d-and-f-block-elements', 'class-12'),
    ('chemistry', 'coordination-compounds', 'class-12'),
    ('chemistry', 'organic-compounds-containing-halogens', 'class-12'),
    ('chemistry', 'organic-compounds-containing-oxygen', 'class-12'),
    ('chemistry', 'organic-compounds-containing-nitrogen', 'class-12'),
    ('chemistry', 'biomolecules', 'class-12'),

    -- Mathematics / Class XI (4)
    ('mathematics', 'trigonometry', 'class-11'),
    ('mathematics', 'complex-numbers', 'class-11'),
    ('mathematics', 'sequences-and-series', 'class-11'),
    ('mathematics', 'permutations-and-combinations', 'class-11'),

    -- Mathematics / Class XII (3)
    ('mathematics', 'application-of-integrals', 'class-12'),
    ('mathematics', 'differential-equations', 'class-12'),
    ('mathematics', 'applications-of-derivatives', 'class-12'),

    -- Biology / Class XI (19)
    ('biology', 'the-living-world', 'class-11'),
    ('biology', 'biological-classification', 'class-11'),
    ('biology', 'plant-kingdom', 'class-11'),
    ('biology', 'animal-kingdom', 'class-11'),
    ('biology', 'morphology-of-flowering-plants', 'class-11'),
    ('biology', 'anatomy-of-flowering-plants', 'class-11'),
    ('biology', 'structural-organisation-in-animals', 'class-11'),
    ('biology', 'cell-the-unit-of-life', 'class-11'),
    ('biology', 'biomolecules', 'class-11'),
    ('biology', 'cell-cycle-and-cell-division', 'class-11'),
    ('biology', 'photosynthesis-in-higher-plants', 'class-11'),
    ('biology', 'respiration-in-plants', 'class-11'),
    ('biology', 'plant-growth-and-development', 'class-11'),
    ('biology', 'breathing-and-exchange-of-gases', 'class-11'),
    ('biology', 'body-fluids-and-circulation', 'class-11'),
    ('biology', 'excretory-products-and-their-elimination', 'class-11'),
    ('biology', 'locomotion-and-movement', 'class-11'),
    ('biology', 'neural-control-and-coordination', 'class-11'),
    ('biology', 'chemical-coordination-and-integration', 'class-11'),

    -- Biology / Class XII (13)
    ('biology', 'sexual-reproduction-in-flowering-plants', 'class-12'),
    ('biology', 'human-reproduction', 'class-12'),
    ('biology', 'reproductive-health', 'class-12'),
    ('biology', 'principles-of-inheritance-and-variation', 'class-12'),
    ('biology', 'molecular-basis-of-inheritance', 'class-12'),
    ('biology', 'evolution', 'class-12'),
    ('biology', 'human-health-and-disease', 'class-12'),
    ('biology', 'microbes-in-human-welfare', 'class-12'),
    ('biology', 'biotechnology-principles-and-processes', 'class-12'),
    ('biology', 'biotechnology-and-its-applications', 'class-12'),
    ('biology', 'organisms-and-populations', 'class-12'),
    ('biology', 'ecosystem', 'class-12'),
    ('biology', 'biodiversity-and-conservation', 'class-12')
),
sources(subject_slug, source_url) as (
  values
    ('physics', 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf'),
    ('chemistry', 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf'),
    ('mathematics', 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Maths_SecP2_2026-27.pdf'),
    ('biology', 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Biology_SecP2_2026-27.pdf')
)
insert into public.chapter_class_levels (
  chapter_id, class_level_id, source_url, scope_note, reviewed_on
)
select
  ch.id,
  cl.id,
  sources.source_url,
  concat('CBSE 2026-27 ', cl.name, ' ', s.name, ' placement for ', ch.name),
  date '2026-08-02'
from reviewed
join sources on sources.subject_slug = reviewed.subject_slug
join public.subjects s on s.slug = reviewed.subject_slug
join public.chapters ch
  on ch.subject_id = s.id and ch.slug = reviewed.chapter_slug
join public.class_levels cl on cl.slug = reviewed.class_slug
on conflict (chapter_id, class_level_id) do nothing;

do $postflight$
declare
  v_total_count integer;
  v_v14_count integer;
begin
  select count(*) into v_total_count
  from public.chapter_class_levels;

  select count(*) into v_v14_count
  from public.chapter_class_levels
  where reviewed_on = date '2026-08-02';

  if v_total_count <> 90 or v_v14_count <> 85 then
    raise exception
      'POSTFLIGHT: expected 90 total rows and 85 v14 rows, got % and %',
      v_total_count, v_v14_count;
  end if;

  if exists (
    select 1
    from public.chapter_class_levels ccl
    join public.class_levels cl on cl.id = ccl.class_level_id
    where cl.slug = 'dropper'
  ) then
    raise exception 'POSTFLIGHT: Dropper is not an academic chapter class';
  end if;

  if exists (
    select 1
    from public.chapter_class_levels ccl
    join public.chapters ch on ch.id = ccl.chapter_id
    where ch.slug in (
      'probability', 'p-block-elements', 'surface-chemistry', 'qualitative-analysis'
    )
  ) then
    raise exception 'POSTFLIGHT: a deliberately deferred chapter was mapped';
  end if;
end
$postflight$;

commit;
