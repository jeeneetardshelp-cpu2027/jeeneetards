-- Complete reviewed NCERT Class 11 Chemistry chapter set (English, 2026-27).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and scope rows are inserted once.

begin;

do $$
declare
  resource record;
  chapter_slug text;
  target_material_id bigint;
  target_chapter_id bigint;
  jee_id bigint;
  neet_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_11_id bigint;
  chemistry_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_11_id from public.class_levels where slug = 'class-11';
  select id into chemistry_id from public.subjects where slug = 'chemistry';

  if jee_id is null or neet_id is null or school_id is null
     or cbse_id is null or class_11_id is null or chemistry_id is null then
    raise exception 'NCERT CLASS 11 CHEMISTRY PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('Some Basic Concepts of Chemistry - NCERT Chemistry',
       'Official NCERT chapter covering the scope of chemistry, laws of chemical combination, the mole concept and stoichiometry.',
       'kech101', 28, array['introduction-to-chemistry', 'mole-concept']::text[]),
      ('Structure of Atom - NCERT Chemistry',
       'Official NCERT chapter covering subatomic particles, atomic models, quantum numbers, orbitals and electronic configuration.',
       'kech102', 45, array['atomic-structure']::text[]),
      ('Classification of Elements and Periodicity in Properties - NCERT Chemistry',
       'Official NCERT chapter covering the periodic law, periodic table and trends in atomic and chemical properties.',
       'kech103', 26, array['periodic-table']::text[]),
      ('Chemical Bonding and Molecular Structure - NCERT Chemistry',
       'Official NCERT chapter covering ionic and covalent bonding, molecular geometry, hybridisation and molecular orbital theory.',
       'kech104', 36, array['chemical-bonding-and-molecular-structure']::text[]),
      ('Thermodynamics - NCERT Chemistry',
       'Official NCERT chapter covering thermodynamic systems, internal energy, enthalpy, calorimetry, entropy and Gibbs energy.',
       'kech105', 32, array['thermodynamics', 'thermochemistry']::text[]),
      ('Equilibrium - NCERT Chemistry',
       'Official NCERT chapter covering chemical equilibrium, acids and bases, buffers, solubility equilibria and ionic equilibrium.',
       'kech106', 53, array['chemical-equilibrium', 'ionic-equilibrium']::text[]),
      ('Redox Reactions - NCERT Chemistry',
       'Official NCERT chapter covering oxidation and reduction, oxidation numbers and balancing redox reactions.',
       'kech201', 21, array['redox-reactions']::text[]),
      ('Organic Chemistry - Some Basic Principles and Techniques - NCERT Chemistry',
       'Official NCERT chapter covering purification, analysis, nomenclature, isomerism and electronic effects in organic reactions.',
       'kech202', 39, array['purification-and-characterisation-of-organic-compounds', 'some-basic-principles-of-organic-chemistry', 'structural-isomerism', 'stereoisomerism', 'organic-reaction-mechanisms']::text[]),
      ('Hydrocarbons - NCERT Chemistry',
       'Official NCERT chapter covering alkanes, alkenes, alkynes, aromatic hydrocarbons and their principal reactions.',
       'kech203', 33, array['hydrocarbons']::text[])
    ) as seeded(title, description, source_code, page_count, chapter_slugs)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title,
      resource.description,
      'full_notes',
      'NCERT',
      format('https://ncert.nic.in/textbook/pdf/%s.pdf', resource.source_code),
      'pdf',
      'English',
      resource.page_count,
      true,
      'official_source',
      'Official NCERT chapter hosted on ncert.nic.in. Linked only; not mirrored or redistributed by JEENEETARD.',
      'approved',
      now()
    )
    on conflict (title, source_url) do update set
      description = excluded.description,
      material_type = excluded.material_type,
      source_name = excluded.source_name,
      file_format = excluded.file_format,
      language = excluded.language,
      page_count = excluded.page_count,
      is_downloadable = excluded.is_downloadable,
      rights_status = excluded.rights_status,
      rights_note = excluded.rights_note,
      review_status = excluded.review_status,
      published_at = coalesce(public.study_materials.published_at, excluded.published_at)
    returning id into target_material_id;

    foreach chapter_slug in array resource.chapter_slugs
    loop
      select id into target_chapter_id
        from public.chapters
       where subject_id = chemistry_id
         and slug = chapter_slug;

      if target_chapter_id is null then
        raise exception 'NCERT CLASS 11 CHEMISTRY PREFLIGHT: missing Chemistry chapter %', chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = jee_id
           and board_id is null
           and class_level_id = class_11_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, jee_id, class_11_id, chemistry_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = neet_id
           and board_id is null
           and class_level_id = class_11_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, neet_id, class_11_id, chemistry_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_11_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_11_id, chemistry_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kech(1|2)[0-9]{2}[.]pdf$';
  if batch_material_count <> 9 then
    raise exception 'NCERT CLASS 11 CHEMISTRY POSTFLIGHT: expected 9 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kech(1|2)[0-9]{2}[.]pdf$';
  if batch_scope_count <> 48 then
    raise exception 'NCERT CLASS 11 CHEMISTRY POSTFLIGHT: expected 48 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
