-- Complete current rationalised NCERT Class 10 Science chapter set (English).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: missing school chapter nodes are created, materials are
-- upserted and each CBSE Class 10 scope row is inserted once.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  target_subject_id bigint;
  target_chapter_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_10_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';

  if school_id is null or cbse_id is null or class_10_id is null then
    raise exception 'NCERT CLASS 10 SCIENCE PREFLIGHT: required School, CBSE or Class 10 row is missing';
  end if;

  for resource in
    select * from (values
      ('Chemical Reactions and Equations - NCERT Science',
       'Official NCERT chapter covering chemical equations, reaction types, oxidation, reduction and common effects of oxidation.',
       'jesc101', 16, 'chemistry', 'Chemical Reactions and Equations', 'chemical-reactions-and-equations', 1001),
      ('Acids, Bases and Salts - NCERT Science',
       'Official NCERT chapter covering acid-base indicators, reactions, pH and the preparation and uses of common salts.',
       'jesc102', 20, 'chemistry', 'Acids, Bases and Salts', 'acids-bases-and-salts', 1002),
      ('Metals and Non-metals - NCERT Science',
       'Official NCERT chapter covering properties and reactions of metals and non-metals, reactivity, extraction and corrosion.',
       'jesc103', 21, 'chemistry', 'Metals and Non-metals', 'metals-and-non-metals', 1003),
      ('Carbon and its Compounds - NCERT Science',
       'Official NCERT chapter covering carbon bonding, homologous series, nomenclature, reactions and important carbon compounds.',
       'jesc104', 21, 'chemistry', 'Carbon and its Compounds', 'carbon-and-its-compounds', 1004),
      ('Life Processes - NCERT Science',
       'Official NCERT chapter covering nutrition, respiration, transport and excretion in plants and animals.',
       'jesc105', 21, 'biology', 'Life Processes', 'life-processes', 1001),
      ('Control and Coordination - NCERT Science',
       'Official NCERT chapter covering the nervous system, hormones, plant responses and coordination in living organisms.',
       'jesc106', 13, 'biology', 'Control and Coordination', 'control-and-coordination', 1002),
      ('How do Organisms Reproduce? - NCERT Science',
       'Official NCERT chapter covering asexual and sexual reproduction in plants and animals and human reproductive health.',
       'jesc107', 15, 'biology', 'How do Organisms Reproduce?', 'how-do-organisms-reproduce', 1003),
      ('Heredity - NCERT Science',
       'Official NCERT chapter covering inherited traits, Mendelian principles, sex determination and the accumulation of variation.',
       'jesc108', 6, 'biology', 'Heredity', 'heredity', 1004),
      ('Light - Reflection and Refraction - NCERT Science',
       'Official NCERT chapter covering reflection, spherical mirrors, refraction, lenses, image formation and optical formulae.',
       'jesc109', 27, 'physics', 'Light - Reflection and Refraction', 'light-reflection-and-refraction', 1001),
      ('The Human Eye and the Colourful World - NCERT Science',
       'Official NCERT chapter covering the human eye, vision defects, prisms, dispersion and atmospheric optical effects.',
       'jesc110', 10, 'physics', 'The Human Eye and the Colourful World', 'human-eye-and-colourful-world', 1002),
      ('Electricity - NCERT Science',
       'Official NCERT chapter covering electric current, potential difference, resistance, circuit combinations, power and heating.',
       'jesc111', 24, 'physics', 'Electricity', 'electricity', 1003),
      ('Magnetic Effects of Electric Current - NCERT Science',
       'Official NCERT chapter covering magnetic fields, force on a conductor, motors, induction, generators and domestic circuits.',
       'jesc112', 13, 'physics', 'Magnetic Effects of Electric Current', 'magnetic-effects-of-electric-current', 1004),
      ('Our Environment - NCERT Science',
       'Official NCERT chapter covering ecosystems, food chains, trophic levels, ozone depletion and waste management.',
       'jesc113', 10, 'biology', 'Our Environment', 'our-environment', 1005)
    ) as seeded(
      title, description, source_code, page_count,
      subject_slug, chapter_name, chapter_slug, chapter_order
    )
  loop
    select id into target_subject_id
      from public.subjects
     where slug = resource.subject_slug;

    if target_subject_id is null then
      raise exception 'NCERT CLASS 10 SCIENCE PREFLIGHT: missing subject %', resource.subject_slug;
    end if;

    insert into public.chapters (subject_id, name, slug, display_order)
    values (
      target_subject_id, resource.chapter_name,
      resource.chapter_slug, resource.chapter_order
    )
    on conflict (subject_id, slug) do nothing;

    select id into target_chapter_id
      from public.chapters
     where subject_id = target_subject_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 10 SCIENCE PREFLIGHT: could not resolve chapter %', resource.chapter_slug;
    end if;

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

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_10_id
         and subject_id = target_subject_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_10_id, target_subject_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jesc1(0[1-9]|1[0-3])[.]pdf$';
  if batch_material_count <> 13 then
    raise exception 'NCERT CLASS 10 SCIENCE POSTFLIGHT: expected 13 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jesc1(0[1-9]|1[0-3])[.]pdf$';
  if batch_scope_count <> 13 then
    raise exception 'NCERT CLASS 10 SCIENCE POSTFLIGHT: expected 13 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
