-- Twenty Competishun formula sheets supplied by the JEENEETARD owner.
-- Redistribution permission from Competishun was explicitly confirmed by the
-- owner on 2026-08-06. PDFs and first-page previews are hosted by JEENEETARD.
-- Chapter scopes make each sheet appear in the material directory and beside
-- every lecture assigned to the matching chapter. Mathematics is JEE-only;
-- Physics and Chemistry are shared with JEE and NEET. Safe to rerun.

begin;

create temporary table formula_sheet_seed_resources (
  title text not null,
  description text not null,
  file_name text not null,
  page_count integer not null,
  subject_slug text not null,
  chapter_slugs text[] not null,
  goal_slugs text[] not null
) on commit drop;

insert into formula_sheet_seed_resources (
  title, description, file_name, page_count,
  subject_slug, chapter_slugs, goal_slugs
) values
  ('Statistics Formula Sheet',
   'Rapid revision sheet covering central tendency, dispersion, variance, standard deviation and common statistics results.',
   'statistics-formula-sheet.pdf', 2, 'mathematics',
   array['statistics'], array['jee']),
  ('Ionic Equilibrium Formula Sheet',
   'Six-page formula and concept review covering acids, bases, pH, buffers, salt hydrolysis, solubility product and titration curves.',
   'ionic-equilibrium-formula-sheet.pdf', 6, 'chemistry',
   array['ionic-equilibrium'], array['jee', 'neet']),
  ('Friction Quick Revision Formula Sheet',
   'Quick revision deck covering types of friction, limiting friction, rough inclines, rolling, connected blocks and standard applications.',
   'friction-formula-sheet.pdf', 11, 'physics',
   array['friction'], array['jee', 'neet']),
  ('GOC 2: Reactive Intermediates and Mechanism Formula Sheet',
   'Organic chemistry revision covering reactive intermediates, stability orders, acidity, basicity, leaving groups, energy profiles and reaction mechanisms.',
   'goc-2-reactive-intermediates-mechanism-formula-sheet.pdf', 14, 'chemistry',
   array['organic-reaction-mechanisms'], array['jee', 'neet']),
  ('Relations and Functions Formula Sheet',
   'Compact review of relations, functions, domains and ranges, composition, inverses, standard functions and graphical transformations.',
   'relations-and-functions-formula-sheet.pdf', 3, 'mathematics',
   array['relations-and-functions'], array['jee']),
  ('Work, Energy and Power Quick Revision Formula Sheet',
   'Quick revision deck covering work, kinetic and potential energy, conservation of energy, power, springs and common applications.',
   'work-energy-power-formula-sheet.pdf', 11, 'physics',
   array['work-energy-and-power'], array['jee', 'neet']),
  ('Chemical Equilibrium Formula Sheet',
   'Six-page revision sheet covering equilibrium constants, reaction quotient, degree of dissociation, Le Chatelier principle and temperature effects.',
   'chemical-equilibrium-formula-sheet.pdf', 6, 'chemistry',
   array['chemical-equilibrium'], array['jee', 'neet']),
  ('GOC 1: Basic Organic Chemistry Formula Sheet',
   'Organic chemistry foundation review covering structure, bonding, electronic effects, resonance, hyperconjugation and aromaticity.',
   'goc-1-basic-organic-chemistry-formula-sheet.pdf', 11, 'chemistry',
   array['some-basic-principles-of-organic-chemistry'], array['jee', 'neet']),
  ('Quadratic Equations Formula Sheet',
   'Four-page review of roots, discriminants, Vieta relations, graphs, common roots, transformations and standard quadratic results.',
   'quadratic-equations-formula-sheet.pdf', 4, 'mathematics',
   array['quadratic-equations'], array['jee']),
  ('Chemical Bonding Formula Sheet',
   'Comprehensive formula and concept review covering Lewis structures, ionic and covalent bonding, VSEPR, hybridisation, molecular orbitals and intermolecular forces.',
   'chemical-bonding-formula-sheet.pdf', 16, 'chemistry',
   array['chemical-bonding-and-molecular-structure'], array['jee', 'neet']),
  ('Newton''s Laws of Motion Quick Revision Formula Sheet',
   'Quick revision deck covering free-body diagrams, equilibrium, pulleys, constraints, apparent weight and pseudo forces.',
   'newtons-laws-of-motion-formula-sheet.pdf', 11, 'physics',
   array['newtons-laws-of-motion-nlm'], array['jee', 'neet']),
  ('Isomerism Formula Sheet',
   'Eight-page map of structural, geometrical, optical and conformational isomerism with standard identification rules.',
   'isomerism-formula-sheet.pdf', 8, 'chemistry',
   array['structural-isomerism', 'stereoisomerism'], array['jee', 'neet']),
  ('Trigonometry Formula Sheet',
   'Thirteen-page reference covering angle measurement, identities, graphs, transformations, equations, inverse functions and triangle results.',
   'trigonometry-formula-sheet.pdf', 13, 'mathematics',
   array['trigonometry'], array['jee']),
  ('Structural Identification and Practical Organic Chemistry Formula Sheet',
   'Visual review of purification, qualitative and quantitative analysis, empirical formulas and structural identification in practical organic chemistry.',
   'structural-identification-poc-formula-sheet.pdf', 9, 'chemistry',
   array['purification-and-characterisation-of-organic-compounds'], array['jee', 'neet']),
  ('Fundamentals of Mathematics Formula Sheet',
   'Six-page foundation review covering number systems, intervals, algebra, inequalities, modulus, polynomials, logarithms and common results.',
   'fundamentals-of-mathematics-formula-sheet.pdf', 6, 'mathematics',
   array['fundamentals-of-mathematics'], array['jee']),
  ('Centre of Mass, Momentum and Collisions Formula Sheet',
   'Quick revision deck covering centre of mass, linear momentum, impulse, collisions, restitution and variable-mass systems.',
   'centre-of-mass-formula-sheet.pdf', 11, 'physics',
   array['system-of-particles-and-centre-of-mass'], array['jee', 'neet']),
  ('IUPAC Nomenclature Formula Sheet',
   'Thirteen-page organic nomenclature reference covering parent-chain selection, functional-group priority, cyclic compounds and common-name conversions.',
   'iupac-nomenclature-formula-sheet.pdf', 13, 'chemistry',
   array['some-basic-principles-of-organic-chemistry'], array['jee', 'neet']),
  ('Sets Formula Sheet',
   'Five-page review of set notation, subsets, intervals, operations, algebra of sets, Venn diagrams and Cartesian products.',
   'sets-formula-sheet.pdf', 5, 'mathematics',
   array['sets'], array['jee']),
  ('Mole Concept Formula Sheet',
   'Four-page reference covering the mole, stoichiometry, concentration terms, equivalent concept, gas relations and quantitative analysis.',
   'mole-concept-formula-sheet.pdf', 4, 'chemistry',
   array['mole-concept'], array['jee', 'neet']),
  ('Mathematical Tools for Physics Formula Sheet',
   'Six-page physics reference covering trigonometry, calculus, vectors, standard graphs, approximations and algebraic tools.',
   'mathematical-tools-physics-formula-sheet.pdf', 6, 'physics',
   array['basic-mathematics-for-physics'], array['jee', 'neet']);

do $$
declare
  resource record;
  chapter_slug text;
  goal_slug text;
  target_material_id bigint;
  target_subject_id bigint;
  target_chapter_id bigint;
  target_goal_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
  batch_jee_scope_count integer;
  batch_neet_scope_count integer;
  neet_mathematics_scope_count integer;
begin
  for resource in select * from formula_sheet_seed_resources order by file_name
  loop
    select id into target_subject_id
      from public.subjects
     where slug = resource.subject_slug;
    if target_subject_id is null then
      raise exception 'COMPETISHUN FORMULA SHEETS PREFLIGHT: subject % is missing', resource.subject_slug;
    end if;

    foreach chapter_slug in array resource.chapter_slugs
    loop
      select id into target_chapter_id
        from public.chapters
       where slug = chapter_slug
         and subject_id = target_subject_id;
      if target_chapter_id is null then
        raise exception 'COMPETISHUN FORMULA SHEETS PREFLIGHT: chapter %/% is missing', resource.subject_slug, chapter_slug;
      end if;
    end loop;

    foreach goal_slug in array resource.goal_slugs
    loop
      select id into target_goal_id
        from public.learning_goals
       where slug = goal_slug;
      if target_goal_id is null then
        raise exception 'COMPETISHUN FORMULA SHEETS PREFLIGHT: goal % is missing', goal_slug;
      end if;
    end loop;

    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      preview_image_url, file_format, language, page_count,
      is_downloadable, rights_status, rights_note,
      review_status, published_at
    ) values (
      resource.title, resource.description, 'formula_sheet', 'Competishun',
      'https://jeeneetard.com/study-materials/formula-sheets/' || resource.file_name,
      'https://jeeneetard.com/study-materials/previews/formula-sheets/' || replace(resource.file_name, '.pdf', '.jpg'),
      'pdf', 'English', resource.page_count, true, 'creator_permission',
      'Competishun redistribution permission confirmed by the JEENEETARD owner on 2026-08-06. PDF hosted by JEENEETARD with source attribution.',
      'approved', now()
    )
    on conflict (title, source_url) do update set
      description = excluded.description,
      material_type = excluded.material_type,
      source_name = excluded.source_name,
      preview_image_url = excluded.preview_image_url,
      file_format = excluded.file_format,
      language = excluded.language,
      page_count = excluded.page_count,
      is_downloadable = excluded.is_downloadable,
      rights_status = excluded.rights_status,
      rights_note = excluded.rights_note,
      review_status = excluded.review_status,
      published_at = coalesce(public.study_materials.published_at, excluded.published_at)
    returning id into target_material_id;

    -- This seed owns these twenty records and therefore replaces their scopes
    -- exactly, preventing stale goal or chapter links after a safe rerun.
    delete from public.study_material_scopes
     where material_id = target_material_id;

    foreach goal_slug in array resource.goal_slugs
    loop
      select id into target_goal_id
        from public.learning_goals
       where slug = goal_slug;
      foreach chapter_slug in array resource.chapter_slugs
      loop
        select id into target_chapter_id
          from public.chapters
         where slug = chapter_slug
           and subject_id = target_subject_id;
        insert into public.study_material_scopes (
          material_id, learning_goal_id, subject_id, chapter_id
        ) values (
          target_material_id, target_goal_id,
          target_subject_id, target_chapter_id
        );
      end loop;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials m
    join formula_sheet_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/formula-sheets/' || r.file_name
   where m.material_type = 'formula_sheet'
     and m.source_name = 'Competishun'
     and m.file_format = 'pdf'
     and m.language = 'English'
     and m.is_downloadable
     and m.rights_status = 'creator_permission'
     and m.review_status = 'approved'
     and m.published_at is not null
     and m.page_count = r.page_count
     and m.preview_image_url = 'https://jeeneetard.com/study-materials/previews/formula-sheets/' || replace(r.file_name, '.pdf', '.jpg');
  if batch_material_count <> 20 then
    raise exception 'COMPETISHUN FORMULA SHEETS POSTFLIGHT: expected 20 exact materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join formula_sheet_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/formula-sheets/' || r.file_name;
  if batch_scope_count <> 36 then
    raise exception 'COMPETISHUN FORMULA SHEETS POSTFLIGHT: expected 36 chapter scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_jee_scope_count
    from public.study_material_scopes s
    join public.learning_goals lg on lg.id = s.learning_goal_id
    join public.study_materials m on m.id = s.material_id
    join formula_sheet_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/formula-sheets/' || r.file_name
   where lg.slug = 'jee';
  if batch_jee_scope_count <> 21 then
    raise exception 'COMPETISHUN FORMULA SHEETS POSTFLIGHT: expected 21 JEE chapter scopes, found %', batch_jee_scope_count;
  end if;

  select count(*)::integer into batch_neet_scope_count
    from public.study_material_scopes s
    join public.learning_goals lg on lg.id = s.learning_goal_id
    join public.study_materials m on m.id = s.material_id
    join formula_sheet_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/formula-sheets/' || r.file_name
   where lg.slug = 'neet';
  if batch_neet_scope_count <> 15 then
    raise exception 'COMPETISHUN FORMULA SHEETS POSTFLIGHT: expected 15 NEET chapter scopes, found %', batch_neet_scope_count;
  end if;

  select count(*)::integer into neet_mathematics_scope_count
    from public.study_material_scopes s
    join public.learning_goals lg on lg.id = s.learning_goal_id
    join public.subjects sub on sub.id = s.subject_id
    join public.study_materials m on m.id = s.material_id
    join formula_sheet_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/formula-sheets/' || r.file_name
   where lg.slug = 'neet'
     and sub.slug = 'mathematics';
  if neet_mathematics_scope_count <> 0 then
    raise exception 'COMPETISHUN FORMULA SHEETS POSTFLIGHT: NEET mathematics leakage found %', neet_mathematics_scope_count;
  end if;
end $$;

commit;
