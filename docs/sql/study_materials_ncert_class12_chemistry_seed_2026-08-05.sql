-- Complete reviewed NCERT Class 12 Chemistry chapter set (English, 2026-27).
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
  class_12_id bigint;
  chemistry_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_12_id from public.class_levels where slug = 'class-12';
  select id into chemistry_id from public.subjects where slug = 'chemistry';

  if jee_id is null or neet_id is null or school_id is null
     or cbse_id is null or class_12_id is null or chemistry_id is null then
    raise exception 'NCERT CLASS 12 CHEMISTRY PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('Solutions - NCERT Chemistry',
       'Official NCERT chapter covering concentration, solubility, vapour pressure, ideal and non-ideal solutions and colligative properties.',
       'lech101', 30, array['solutions']::text[]),
      ('Electrochemistry - NCERT Chemistry',
       'Official NCERT chapter covering electrochemical cells, electrode potentials, conductivity, electrolysis, batteries and corrosion.',
       'lech102', 30, array['electrochemistry']::text[]),
      ('Chemical Kinetics - NCERT Chemistry',
       'Official NCERT chapter covering reaction rates, rate laws, integrated equations, temperature dependence and collision theory.',
       'lech103', 28, array['chemical-kinetics']::text[]),
      ('The d- and f-Block Elements - NCERT Chemistry',
       'Official NCERT chapter covering transition elements, inner-transition elements and their characteristic compounds and properties.',
       'lech104', 29, array['the-d-and-f-block-elements']::text[]),
      ('Coordination Compounds - NCERT Chemistry',
       'Official NCERT chapter covering coordination entities, nomenclature, bonding, isomerism and applications.',
       'lech105', 23, array['coordination-compounds']::text[]),
      ('Haloalkanes and Haloarenes - NCERT Chemistry',
       'Official NCERT chapter covering preparation, properties and reactions of alkyl and aryl halides.',
       'lech201', 34, array['organic-compounds-containing-halogens']::text[]),
      ('Alcohols, Phenols and Ethers - NCERT Chemistry',
       'Official NCERT chapter covering nomenclature, preparation, properties and reactions of alcohols, phenols and ethers.',
       'lech202', 34, array['organic-compounds-containing-oxygen']::text[]),
      ('Aldehydes, Ketones and Carboxylic Acids - NCERT Chemistry',
       'Official NCERT chapter covering preparation, properties and reactions of carbonyl compounds and carboxylic acids.',
       'lech203', 32, array['organic-compounds-containing-oxygen', 'carboxylic-acids-and-derivatives']::text[]),
      ('Amines - NCERT Chemistry',
       'Official NCERT chapter covering classification, preparation, properties and reactions of amines and diazonium salts.',
       'lech204', 22, array['organic-compounds-containing-nitrogen', 'amines']::text[]),
      ('Biomolecules - NCERT Chemistry',
       'Official NCERT chapter covering carbohydrates, proteins, enzymes, vitamins, nucleic acids and hormones.',
       'lech205', 22, array['biomolecules']::text[])
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
        raise exception 'NCERT CLASS 12 CHEMISTRY PREFLIGHT: missing Chemistry chapter %', chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = jee_id
           and board_id is null
           and class_level_id = class_12_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, jee_id, class_12_id, chemistry_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = neet_id
           and board_id is null
           and class_level_id = class_12_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, neet_id, class_12_id, chemistry_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_12_id
           and subject_id = chemistry_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_12_id, chemistry_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lech(1|2)[0-9]{2}[.]pdf$';
  if batch_material_count <> 10 then
    raise exception 'NCERT CLASS 12 CHEMISTRY POSTFLIGHT: expected 10 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lech(1|2)[0-9]{2}[.]pdf$';
  if batch_scope_count <> 36 then
    raise exception 'NCERT CLASS 12 CHEMISTRY POSTFLIGHT: expected 36 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
