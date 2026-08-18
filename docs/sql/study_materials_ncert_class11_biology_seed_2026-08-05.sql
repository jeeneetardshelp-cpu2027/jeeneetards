-- Complete current rationalised NCERT Class 11 Biology chapter set (English).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and scope rows are inserted once.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  target_chapter_id bigint;
  neet_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_11_id bigint;
  biology_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_11_id from public.class_levels where slug = 'class-11';
  select id into biology_id from public.subjects where slug = 'biology';

  if neet_id is null or school_id is null or cbse_id is null
     or class_11_id is null or biology_id is null then
    raise exception 'NCERT CLASS 11 BIOLOGY PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('The Living World - NCERT Biology',
       'Official NCERT chapter introducing biodiversity, taxonomy, systematics and the defining features of living organisms.',
       'kebo101', 9, 'the-living-world'),
      ('Biological Classification - NCERT Biology',
       'Official NCERT chapter covering systems of classification, biological kingdoms, viruses, viroids and lichens.',
       'kebo102', 13, 'biological-classification'),
      ('Plant Kingdom - NCERT Biology',
       'Official NCERT chapter covering algae, bryophytes, pteridophytes, gymnosperms, angiosperms and plant life cycles.',
       'kebo103', 14, 'plant-kingdom'),
      ('Animal Kingdom - NCERT Biology',
       'Official NCERT chapter covering the basis of animal classification and the major non-chordate and chordate groups.',
       'kebo104', 18, 'animal-kingdom'),
      ('Morphology of Flowering Plants - NCERT Biology',
       'Official NCERT chapter covering the external form, modifications, inflorescences, flowers, fruits, seeds and plant families.',
       'kebo105', 16, 'morphology-of-flowering-plants'),
      ('Anatomy of Flowering Plants - NCERT Biology',
       'Official NCERT chapter covering plant tissues, tissue systems and the internal anatomy of roots, stems and leaves.',
       'kebo106', 8, 'anatomy-of-flowering-plants'),
      ('Structural Organisation in Animals - NCERT Biology',
       'Official NCERT chapter covering animal tissues and the morphology and anatomy of representative animals.',
       'kebo107', 6, 'structural-organisation-in-animals'),
      ('Cell: The Unit of Life - NCERT Biology',
       'Official NCERT chapter covering cell theory, prokaryotic and eukaryotic cells, organelles and cellular organisation.',
       'kebo108', 19, 'cell-the-unit-of-life'),
      ('Biomolecules - NCERT Biology',
       'Official NCERT chapter covering carbohydrates, proteins, lipids, nucleic acids, enzymes and cellular metabolism.',
       'kebo109', 16, 'biomolecules'),
      ('Cell Cycle and Cell Division - NCERT Biology',
       'Official NCERT chapter covering the cell cycle, mitosis, meiosis and their biological significance.',
       'kebo110', 11, 'cell-cycle-and-cell-division'),
      ('Photosynthesis in Higher Plants - NCERT Biology',
       'Official NCERT chapter covering pigments, light reactions, carbon fixation, photorespiration and factors affecting photosynthesis.',
       'kebo111', 22, 'photosynthesis-in-higher-plants'),
      ('Respiration in Plants - NCERT Biology',
       'Official NCERT chapter covering glycolysis, fermentation, aerobic respiration, electron transport and respiratory balance.',
       'kebo112', 13, 'respiration-in-plants'),
      ('Plant Growth and Development - NCERT Biology',
       'Official NCERT chapter covering plant growth, differentiation, development and plant growth regulators.',
       'kebo113', 15, 'plant-growth-and-development'),
      ('Breathing and Exchange of Gases - NCERT Biology',
       'Official NCERT chapter covering the human respiratory system, gas exchange, transport and respiratory disorders.',
       'kebo114', 12, 'breathing-and-exchange-of-gases'),
      ('Body Fluids and Circulation - NCERT Biology',
       'Official NCERT chapter covering blood, lymph, the heart, circulation, cardiac regulation and circulatory disorders.',
       'kebo115', 12, 'body-fluids-and-circulation'),
      ('Excretory Products and Their Elimination - NCERT Biology',
       'Official NCERT chapter covering nitrogenous wastes, the human excretory system, urine formation and kidney regulation.',
       'kebo116', 12, 'excretory-products-and-their-elimination'),
      ('Locomotion and Movement - NCERT Biology',
       'Official NCERT chapter covering types of movement, skeletal muscles, the skeletal system, joints and movement disorders.',
       'kebo117', 13, 'locomotion-and-movement'),
      ('Neural Control and Coordination - NCERT Biology',
       'Official NCERT chapter covering neurons, the nervous system, nerve impulses, reflexes and sensory reception.',
       'kebo118', 9, 'neural-control-and-coordination'),
      ('Chemical Coordination and Integration - NCERT Biology',
       'Official NCERT chapter covering endocrine glands, hormones, feedback regulation and common endocrine disorders.',
       'kebo119', 14, 'chemical-coordination-and-integration')
    ) as seeded(title, description, source_code, page_count, chapter_slug)
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

    select id into target_chapter_id
      from public.chapters
     where subject_id = biology_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 11 BIOLOGY PREFLIGHT: missing Biology chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = neet_id
         and board_id is null
         and class_level_id = class_11_id
         and subject_id = biology_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, neet_id, class_11_id, biology_id, target_chapter_id
      );
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_11_id
         and subject_id = biology_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_11_id, biology_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kebo1(0[1-9]|1[0-9])[.]pdf$';
  if batch_material_count <> 19 then
    raise exception 'NCERT CLASS 11 BIOLOGY POSTFLIGHT: expected 19 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kebo1(0[1-9]|1[0-9])[.]pdf$';
  if batch_scope_count <> 38 then
    raise exception 'NCERT CLASS 11 BIOLOGY POSTFLIGHT: expected 38 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
