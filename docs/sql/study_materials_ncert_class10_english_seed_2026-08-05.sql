-- Complete current rationalised NCERT Class 10 English chapter set.
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
  english_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';
  select id into english_id from public.subjects where slug = 'english';

  if school_id is null or cbse_id is null or class_10_id is null
     or english_id is null then
    raise exception 'NCERT CLASS 10 ENGLISH PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('A Letter to God - NCERT First Flight',
       'Official NCERT First Flight unit containing A Letter to God and its language-learning activities.',
       'jeff101', 15, 'a-letter-to-god'),
      ('Nelson Mandela: Long Walk to Freedom - NCERT First Flight',
       'Official NCERT First Flight unit containing Nelson Mandela: Long Walk to Freedom and its language-learning activities.',
       'jeff102', 16, 'nelson-mandela-long-walk-to-freedom'),
      ('Two Stories about Flying - NCERT First Flight',
       'Official NCERT First Flight unit containing His First Flight, The Black Aeroplane and their language-learning activities.',
       'jeff103', 16, 'two-stories-about-flying'),
      ('From the Diary of Anne Frank - NCERT First Flight',
       'Official NCERT First Flight unit containing From the Diary of Anne Frank and its language-learning activities.',
       'jeff104', 15, 'from-the-diary-of-anne-frank'),
      ('Glimpses of India - NCERT First Flight',
       'Official NCERT First Flight unit containing A Baker from Goa, Coorg, Tea from Assam and their language-learning activities.',
       'jeff105', 17, 'glimpses-of-india'),
      ('Mijbil the Otter - NCERT First Flight',
       'Official NCERT First Flight unit containing Mijbil the Otter and its language-learning activities.',
       'jeff106', 14, 'mijbil-the-otter'),
      ('Madam Rides the Bus - NCERT First Flight',
       'Official NCERT First Flight unit containing Madam Rides the Bus and its language-learning activities.',
       'jeff107', 17, 'madam-rides-the-bus'),
      ('The Sermon at Benares - NCERT First Flight',
       'Official NCERT First Flight unit containing The Sermon at Benares and its language-learning activities.',
       'jeff108', 9, 'the-sermon-at-benares'),
      ('The Proposal - NCERT First Flight',
       'Official NCERT First Flight unit containing The Proposal and its language-learning activities.',
       'jeff109', 21, 'the-proposal'),
      ('A Triumph of Surgery - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter A Triumph of Surgery with reading and comprehension activities.',
       'jefp101', 7, 'a-triumph-of-surgery'),
      ('The Thief''s Story - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter The Thief''s Story with reading and comprehension activities.',
       'jefp102', 6, 'the-thiefs-story'),
      ('The Midnight Visitor - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter The Midnight Visitor with reading and comprehension activities.',
       'jefp103', 6, 'the-midnight-visitor'),
      ('A Question of Trust - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter A Question of Trust with reading and comprehension activities.',
       'jefp104', 6, 'a-question-of-trust'),
      ('Footprints Without Feet - NCERT Supplementary Reader',
       'Official NCERT supplementary-reader chapter Footprints Without Feet with reading and comprehension activities.',
       'jefp105', 6, 'footprints-without-feet'),
      ('The Making of a Scientist - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter The Making of a Scientist with reading and comprehension activities.',
       'jefp106', 7, 'the-making-of-a-scientist'),
      ('The Necklace - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter The Necklace with reading and comprehension activities.',
       'jefp107', 8, 'the-necklace'),
      ('Bholi - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter Bholi with reading and comprehension activities.',
       'jefp108', 9, 'bholi'),
      ('The Book That Saved the Earth - NCERT Footprints Without Feet',
       'Official NCERT supplementary-reader chapter The Book That Saved the Earth with reading and comprehension activities.',
       'jefp109', 15, 'the-book-that-saved-the-earth')
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
     where subject_id = english_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 10 ENGLISH PREFLIGHT: missing English chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_10_id
         and subject_id = english_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_10_id, english_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/(jeff10[1-9]|jefp10[1-9])[.]pdf$';
  if batch_material_count <> 18 then
    raise exception 'NCERT CLASS 10 ENGLISH POSTFLIGHT: expected 18 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/(jeff10[1-9]|jefp10[1-9])[.]pdf$';
  if batch_scope_count <> 18 then
    raise exception 'NCERT CLASS 10 ENGLISH POSTFLIGHT: expected 18 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
