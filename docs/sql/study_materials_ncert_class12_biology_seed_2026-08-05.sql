-- Complete current rationalised NCERT Class 12 Biology chapter set (English).
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
  class_12_id bigint;
  biology_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_12_id from public.class_levels where slug = 'class-12';
  select id into biology_id from public.subjects where slug = 'biology';

  if neet_id is null or school_id is null or cbse_id is null
     or class_12_id is null or biology_id is null then
    raise exception 'NCERT CLASS 12 BIOLOGY PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('Sexual Reproduction in Flowering Plants - NCERT Biology',
       'Official NCERT chapter covering flower structure, gametophytes, pollination, fertilisation, seed formation and apomixis.',
       'lebo101', 25, 'sexual-reproduction-in-flowering-plants'),
      ('Human Reproduction - NCERT Biology',
       'Official NCERT chapter covering reproductive anatomy, gametogenesis, fertilisation, pregnancy, birth and lactation.',
       'lebo102', 15, 'human-reproduction'),
      ('Reproductive Health - NCERT Biology',
       'Official NCERT chapter covering reproductive health, contraception, medical termination, infertility and assisted reproduction.',
       'lebo103', 10, 'reproductive-health'),
      ('Principles of Inheritance and Variation - NCERT Biology',
       'Official NCERT chapter covering Mendelian inheritance, chromosomal theory, linkage, sex determination and genetic disorders.',
       'lebo104', 28, 'principles-of-inheritance-and-variation'),
      ('Molecular Basis of Inheritance - NCERT Biology',
       'Official NCERT chapter covering DNA and RNA, replication, transcription, translation, gene regulation and the human genome.',
       'lebo105', 31, 'molecular-basis-of-inheritance'),
      ('Evolution - NCERT Biology',
       'Official NCERT chapter covering origins of life, evidence for evolution, natural selection, speciation and human evolution.',
       'lebo106', 17, 'evolution'),
      ('Human Health and Disease - NCERT Biology',
       'Official NCERT chapter covering pathogens, immunity, common diseases, cancer, AIDS and substance misuse.',
       'lebo107', 22, 'human-health-and-disease'),
      ('Microbes in Human Welfare - NCERT Biology',
       'Official NCERT chapter covering microbes in food, industry, sewage treatment, energy production and agriculture.',
       'lebo108', 12, 'microbes-in-human-welfare'),
      ('Biotechnology: Principles and Processes - NCERT Biology',
       'Official NCERT chapter covering genetic engineering principles, tools, recombinant DNA methods and bioprocessing.',
       'lebo109', 16, 'biotechnology-principles-and-processes'),
      ('Biotechnology and its Applications - NCERT Biology',
       'Official NCERT chapter covering biotechnology in agriculture and medicine, transgenic organisms, ethics and patents.',
       'lebo110', 11, 'biotechnology-and-its-applications'),
      ('Organisms and Populations - NCERT Biology',
       'Official NCERT chapter covering environmental factors, adaptations, population attributes, growth and species interactions.',
       'lebo111', 17, 'organisms-and-populations'),
      ('Ecosystem - NCERT Biology',
       'Official NCERT chapter covering ecosystem structure, productivity, decomposition, energy flow and ecological pyramids.',
       'lebo112', 11, 'ecosystem'),
      ('Biodiversity and Conservation - NCERT Biology',
       'Official NCERT chapter covering biodiversity patterns, extinction, conservation priorities and in-situ and ex-situ protection.',
       'lebo113', 13, 'biodiversity-and-conservation')
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
      raise exception 'NCERT CLASS 12 BIOLOGY PREFLIGHT: missing Biology chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = neet_id
         and board_id is null
         and class_level_id = class_12_id
         and subject_id = biology_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, neet_id, class_12_id, biology_id, target_chapter_id
      );
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_12_id
         and subject_id = biology_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_12_id, biology_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lebo1(0[1-9]|1[0-3])[.]pdf$';
  if batch_material_count <> 13 then
    raise exception 'NCERT CLASS 12 BIOLOGY POSTFLIGHT: expected 13 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lebo1(0[1-9]|1[0-3])[.]pdf$';
  if batch_scope_count <> 26 then
    raise exception 'NCERT CLASS 12 BIOLOGY POSTFLIGHT: expected 26 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
