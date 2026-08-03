-- ============================================================
-- CHAPTER CLASS SCOPES v14 - PRODUCTION APPLY
-- PRODUCTION PROJECT kezelafqhgqrprpadmlf ONLY.
-- OWNER-APPROVED SOURCE SHA-256 6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459.
-- PITR RESTORE POINT 02 Aug 2026, 13:31:42 UTC+05:30.
-- DERIVED FROM ROLLBACK REHEARSAL SHA-256 dd46b3456c49c31d1d235e2e9ba3919cb1188a211c4eeb6821aa7a0966ce5dd0.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
  if to_regclass('public.chapter_scope_v13_clone_authorization') is not null then
    raise exception 'REFUSING: restore-clone authorization marker exists';
  end if;
end
$target_guard$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';


do $baseline_guard$
declare
  v_protected record;
begin
  if to_regclass('public.chapter_class_levels') is null then
    raise exception 'REFUSING: v13 chapter_class_levels is missing';
  end if;
  if to_regprocedure('public.get_browse_curriculum(text,text,text)') is null
     or to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is null then
    raise exception 'REFUSING: expected browse functions are missing';
  end if;
  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.subjects) <> 9
     or (select count(*) from public.class_levels) <> 4
     or (select count(*) from public.chapter_class_levels) <> 5 then
    raise exception 'REFUSING: clone differs from the reviewed v13 snapshot';
  end if;
  if (select count(*) from (
select ch.slug as chapter_slug, cl.slug as class_slug
  from public.chapter_class_levels ccl
  join public.chapters ch on ch.id = ccl.chapter_id
  join public.class_levels cl on cl.id = ccl.class_level_id) existing
       where (chapter_slug, class_slug) in (
         ('kinematics', 'class-11'),
         ('newtons-laws-of-motion-nlm', 'class-11'),
         ('work-energy-and-power', 'class-11'),
         ('ray-optics-and-optical-instruments', 'class-12'),
         ('modern-physics', 'class-12')
       )) <> 5 then
    raise exception 'REFUSING: the five v13 canonical rows differ';
  end if;
  select * into v_protected from (
select
  (select count(*)
     from public.playlists p
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_courses,
  (select count(*)
     from public.playlist_videos pv
     join public.playlists p on p.id = pv.playlist_id
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_memberships,
  md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
       where p.id < 167 and exists (
         select 1
           from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
       )
    ) y), '')
  ) as protected_fingerprint) protected;
  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'REFUSING: protected original-83 JEE baseline differs';
  end if;
end
$baseline_guard$;


do $current_browse_guard$
begin
  if (
select count(*) from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
 where level = 'chapter') <> 20
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
 where level = 'chapter') <> 31
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) <> 11
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
 where level = 'chapter') <> 20
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
 where level = 'chapter') <> 19
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
   where level = 'chapter'
) overlapping_chapters) <> 8
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'physics')
 where level = 'chapter') <> 24
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'physics')
 where level = 'chapter') <> 25
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'physics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'physics')
   where level = 'chapter'
) overlapping_chapters) <> 22
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
 where level = 'chapter') <> 24
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
 where level = 'chapter') <> 25
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) <> 24
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'biology')
 where level = 'chapter') <> 32
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'biology')
 where level = 'chapter') <> 32
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'biology')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'biology')
   where level = 'chapter'
) overlapping_chapters) <> 32
     or (
select count(*) from public.get_browse_curriculum('school', 'class-10', 'mathematics')
 where level = 'chapter') <> 14 then
    raise exception 'REFUSING: current browse output differs from reviewed evidence';
  end if;
end
$current_browse_guard$;

-- REVIEWED SOURCE: src/migrations/chapter_class_scopes_v14_draft.sql
-- SHA-256: 6334faeae27575df323a0e8b4561fb4fd471985a5e9978cf1f26bd6d0b4f1459
-- =====================================================================
-- chapter_class_scopes_v14_draft.sql
-- PREPARED FOR REVIEW. NOT APPROVED OR APPLIED ANYWHERE.
--
-- Adds only evidence-reviewed chapter -> academic class rows to the v13
-- canonical junction. It does not change catalogue rows or replace browse
-- functions. Four ambiguous/shared chapters remain deliberately excluded:
-- probability, p-block-elements, surface-chemistry, qualitative-analysis.
-- =====================================================================


-- Fail closed even if this review artifact is pasted into a SQL editor.
-- A separately approved, hash-verified rehearsal package must remove only
-- this guard after pinning the exact reviewed source hash.

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


do $post_apply_guard$
declare
  v_protected record;
begin
  if (select count(*) from public.playlists) <> 292
     or (select count(*) from public.videos) <> 3088
     or (select count(*) from public.playlist_videos) <> 3094
     or (select count(*) from public.chapters) <> 241
     or (select count(*) from public.chapter_class_levels) <> 90 then
    raise exception 'POST-APPLY: catalogue or canonical-scope count drift';
  end if;
  select * into v_protected from (
select
  (select count(*)
     from public.playlists p
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_courses,
  (select count(*)
     from public.playlist_videos pv
     join public.playlists p on p.id = pv.playlist_id
    where p.id < 167
      and exists (
        select 1
          from public.playlist_learning_goals plg
          join public.learning_goals lg on lg.id = plg.learning_goal_id
         where plg.playlist_id = p.id and lg.slug = 'jee'
      )) as protected_memberships,
  md5(
    coalesce((select string_agg(row_to_json(x)::text, '|' order by x.id) from (
      select p.id, p.title, p.teacher, p.youtube_playlist_id, p.category_id,
             p.subject_id, p.class_levels, p.audience_focus, p.content_type,
             p.language, p.difficulty
        from public.playlists p
        join public.playlist_learning_goals plg on plg.playlist_id = p.id
        join public.learning_goals lg on lg.id = plg.learning_goal_id
       where lg.slug = 'jee' and p.id < 167
    ) x), '') || '|' ||
    coalesce((select string_agg(row_to_json(y)::text, '|'
                                order by y.playlist_id, y.position, y.id) from (
      select pv.id, pv.playlist_id, pv.video_id, pv.position
        from public.playlist_videos pv
        join public.playlists p on p.id = pv.playlist_id
       where p.id < 167 and exists (
         select 1
           from public.playlist_learning_goals plg
           join public.learning_goals lg on lg.id = plg.learning_goal_id
          where plg.playlist_id = p.id and lg.slug = 'jee'
       )
    ) y), '')
  ) as protected_fingerprint) protected;
  if v_protected.protected_courses <> 83
     or v_protected.protected_memberships <> 1307
     or v_protected.protected_fingerprint <> 'c742fabf93ff8dd33d6ecd5eb4793db0' then
    raise exception 'POST-APPLY: protected original-83 JEE baseline drift';
  end if;
  if (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) <> 0
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
   where level = 'chapter'
) overlapping_chapters) <> 1
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'physics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'physics')
   where level = 'chapter'
) overlapping_chapters) <> 0
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) <> 3
     or (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'biology')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'biology')
   where level = 'chapter'
) overlapping_chapters) <> 0 then
    raise exception 'POST-APPLY: projected overlap counts differ';
  end if;
  if (
select count(*) from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
 where level = 'chapter') <> 19
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
 where level = 'chapter') <> 21
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
 where level = 'chapter') <> 17
     or (
select count(*) from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
 where level = 'chapter') <> 15
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'physics')
 where level = 'chapter') <> 15
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'physics')
 where level = 'chapter') <> 12
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
 where level = 'chapter') <> 15
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
 where level = 'chapter') <> 13
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-11', 'biology')
 where level = 'chapter') <> 19
     or (
select count(*) from public.get_browse_curriculum('neet', 'class-12', 'biology')
 where level = 'chapter') <> 13
     or (
select count(*) from public.get_browse_curriculum('school', 'class-10', 'mathematics')
 where level = 'chapter') <> 14 then
    raise exception 'POST-APPLY: projected class chapter totals differ';
  end if;
  if not exists (
    select 1 from public.get_browse_curriculum('school', 'class-10', 'mathematics')
     where level = 'chapter' and slug = 'probability'
  ) then
    raise exception 'POST-APPLY: shared School Class 10 Probability disappeared';
  end if;
end
$post_apply_guard$;

select
  (select count(*) from public.chapter_class_levels) as rehearsed_scope_rows,
  (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) as jee_chemistry_overlaps,
  (
select count(*) from (
  select slug from public.get_browse_curriculum('jee', 'class-11', 'mathematics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('jee', 'class-12', 'mathematics')
   where level = 'chapter'
) overlapping_chapters) as jee_mathematics_overlaps,
  (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'physics')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'physics')
   where level = 'chapter'
) overlapping_chapters) as neet_physics_overlaps,
  (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'chemistry')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'chemistry')
   where level = 'chapter'
) overlapping_chapters) as neet_chemistry_overlaps,
  (
select count(*) from (
  select slug from public.get_browse_curriculum('neet', 'class-11', 'biology')
   where level = 'chapter'
  intersect
  select slug from public.get_browse_curriculum('neet', 'class-12', 'biology')
   where level = 'chapter'
) overlapping_chapters) as neet_biology_overlaps;

commit;

select 'v14 persistent production apply verified' as result;
