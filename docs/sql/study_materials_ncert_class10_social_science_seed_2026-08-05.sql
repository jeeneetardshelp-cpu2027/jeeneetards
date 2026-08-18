-- Complete current rationalised NCERT Class 10 Social Science chapter set.
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and each CBSE Class 10 scope is inserted once.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  target_chapter_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_10_id bigint;
  social_science_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';
  select id into social_science_id from public.subjects where slug = 'social-science';

  if school_id is null or cbse_id is null or class_10_id is null
     or social_science_id is null then
    raise exception 'NCERT CLASS 10 SOCIAL SCIENCE PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('The Rise of Nationalism in Europe - NCERT History',
       'Official NCERT History chapter on nationalism, revolution and the making of nation-states in Europe.',
       'jess301', 28, 'the-rise-of-nationalism-in-europe'),
      ('Nationalism in India - NCERT History',
       'Official NCERT History chapter on the national movement, civil disobedience and collective belonging in India.',
       'jess302', 22, 'nationalism-in-india'),
      ('The Making of a Global World - NCERT History',
       'Official NCERT History chapter tracing trade, migration, colonialism and the making of the global economy.',
       'jess303', 28, 'the-making-of-a-global-world'),
      ('The Age of Industrialisation - NCERT History',
       'Official NCERT History chapter on industrialisation, factories, workers and markets in Britain and India.',
       'jess304', 24, 'the-age-of-industrialisation'),
      ('Print Culture and the Modern World - NCERT History',
       'Official NCERT History chapter on the print revolution and its effects on ideas, debate and public life.',
       'jess305', 26, 'print-culture-and-the-modern-world'),
      ('Resources and Development - NCERT Geography',
       'Official NCERT Geography chapter on resource planning, land use and soil conservation.',
       'jess101', 12, 'resources-and-development'),
      ('Forest and Wildlife Resources - NCERT Geography',
       'Official NCERT Geography chapter on biodiversity, conservation and community participation.',
       'jess102', 6, 'forest-and-wildlife-resources'),
      ('Water Resources - NCERT Geography',
       'Official NCERT Geography chapter on water scarcity, multipurpose projects and rainwater harvesting.',
       'jess103', 11, 'water-resources'),
      ('Agriculture - NCERT Geography',
       'Official NCERT Geography chapter on farming systems, cropping patterns and major crops of India.',
       'jess104', 12, 'agriculture'),
      ('Minerals and Energy Resources - NCERT Geography',
       'Official NCERT Geography chapter on mineral distribution, conventional energy and renewable resources.',
       'jess105', 16, 'minerals-and-energy-resources'),
      ('Manufacturing Industries - NCERT Geography',
       'Official NCERT Geography chapter on industrial location, major industries and environmental impacts.',
       'jess106', 13, 'manufacturing-industries'),
      ('Lifelines of National Economy - NCERT Geography',
       'Official NCERT Geography chapter on transport, communication, trade and tourism.',
       'jess107', 13, 'lifelines-of-national-economy'),
      ('Power Sharing - NCERT Democratic Politics',
       'Official NCERT Democratic Politics chapter on power sharing through the experiences of Belgium and Sri Lanka.',
       'jess401', 12, 'power-sharing'),
      ('Federalism - NCERT Democratic Politics',
       'Official NCERT Democratic Politics chapter on federal systems, decentralisation and language policy in India.',
       'jess402', 16, 'federalism'),
      ('Gender, Religion and Caste - NCERT Democratic Politics',
       'Official NCERT Democratic Politics chapter on social differences and their expression in democratic politics.',
       'jess403', 17, 'gender-religion-and-caste'),
      ('Political Parties - NCERT Democratic Politics',
       'Official NCERT Democratic Politics chapter on the functions, challenges and reform of political parties.',
       'jess404', 17, 'political-parties'),
      ('Outcomes of Democracy - NCERT Democratic Politics',
       'Official NCERT Democratic Politics chapter evaluating democratic accountability, equality and dignity.',
       'jess405', 12, 'outcomes-of-democracy'),
      ('Development - NCERT Economics',
       'Official NCERT Economics chapter on development goals, income, public facilities and sustainability.',
       'jess201', 16, 'development'),
      ('Sectors of the Indian Economy - NCERT Economics',
       'Official NCERT Economics chapter on primary, secondary, tertiary, organised and unorganised sectors.',
       'jess202', 20, 'sectors-of-the-indian-economy'),
      ('Money and Credit - NCERT Economics',
       'Official NCERT Economics chapter on money, formal and informal credit and self-help groups.',
       'jess203', 16, 'money-and-credit'),
      ('Globalisation and the Indian Economy - NCERT Economics',
       'Official NCERT Economics chapter on multinational companies, production links and globalisation in India.',
       'jess204', 20, 'globalisation-and-the-indian-economy'),
      ('Consumer Rights - NCERT Economics',
       'Official NCERT Economics chapter on consumer protection, standardisation and the consumer movement.',
       'jess205', 19, 'consumer-rights')
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
     where subject_id = social_science_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 10 SOCIAL SCIENCE PREFLIGHT: missing Social Science chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_10_id
         and subject_id = social_science_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_10_id, social_science_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jess(10[1-7]|20[1-5]|30[1-5]|40[1-5])[.]pdf$';
  if batch_material_count <> 22 then
    raise exception 'NCERT CLASS 10 SOCIAL SCIENCE POSTFLIGHT: expected 22 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jess(10[1-7]|20[1-5]|30[1-5]|40[1-5])[.]pdf$';
  if batch_scope_count <> 22 then
    raise exception 'NCERT CLASS 10 SOCIAL SCIENCE POSTFLIGHT: expected 22 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
