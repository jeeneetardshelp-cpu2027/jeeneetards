-- Complete current rationalised NCERT Class 10 Hindi A chapter set.
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Two Kshitij PDFs each cover two poems, so 15 materials create 17 exact scopes.
-- Safe to rerun: materials are upserted and every CBSE Class 10 scope is inserted once.

begin;

do $$
declare
  resource record;
  target_chapter_slug text;
  target_material_id bigint;
  target_chapter_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_10_id bigint;
  hindi_a_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';
  select id into hindi_a_id from public.subjects where slug = 'hindi-a';

  if school_id is null or cbse_id is null or class_10_id is null
     or hindi_a_id is null then
    raise exception 'NCERT CLASS 10 HINDI A PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('सूरदास के पद - NCERT क्षितिज',
       'सूरदास के पदों का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks101', 9, array['surdas-ke-pad']),
      ('राम-लक्ष्मण-परशुराम संवाद - NCERT क्षितिज',
       'तुलसीदास के राम-लक्ष्मण-परशुराम संवाद का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks102', 7, array['ram-lakshman-parshuram-samvad']),
      ('आत्मकथ्य - NCERT क्षितिज',
       'जयशंकर प्रसाद की कविता आत्मकथ्य का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks103', 5, array['aatmakathya']),
      ('उत्साह और अट नहीं रही है - NCERT क्षितिज',
       'सूर्यकांत त्रिपाठी निराला की कविताओं उत्साह और अट नहीं रही है का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks104', 6, array['utsah', 'at-nahin-rahi-hai']),
      ('यह दंतुरित मुसकान और फसल - NCERT क्षितिज',
       'नागार्जुन की कविताओं यह दंतुरित मुसकान और फसल का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks105', 7, array['yah-danturit-muskan', 'fasal']),
      ('संगतकार - NCERT क्षितिज',
       'मंगलेश डबराल की कविता संगतकार का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks106', 8, array['sangatkar']),
      ('नेताजी का चश्मा - NCERT क्षितिज',
       'स्वयं प्रकाश की कहानी नेताजी का चश्मा का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks107', 9, array['netaji-ka-chashma']),
      ('बालगोबिन भगत - NCERT क्षितिज',
       'रामवृक्ष बेनीपुरी के पाठ बालगोबिन भगत का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks108', 9, array['balgobin-bhagat']),
      ('लखनवी अंदाज़ - NCERT क्षितिज',
       'यशपाल की कहानी लखनवी अंदाज़ का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks109', 6, array['lakhnavi-andaz']),
      ('एक कहानी यह भी - NCERT क्षितिज',
       'मन्नू भंडारी के आत्मकथ्य एक कहानी यह भी का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks110', 12, array['ek-kahani-yah-bhi']),
      ('नौबतखाने में इबादत - NCERT क्षितिज',
       'यतीन्द्र मिश्र के पाठ नौबतखाने में इबादत का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks111', 12, array['naubatkhane-mein-ibadat']),
      ('संस्कृति - NCERT क्षितिज',
       'भदंत आनंद कौसल्यायन के निबंध संस्कृति का आधिकारिक NCERT क्षितिज अध्याय।',
       'jhks112', 8, array['sanskriti']),
      ('माता का आँचल - NCERT कृतिका',
       'शिवपूजन सहाय के पाठ माता का आँचल का आधिकारिक NCERT कृतिका अध्याय।',
       'jhkr101', 9, array['mata-ka-aanchal']),
      ('साना-साना हाथ जोड़ि - NCERT कृतिका',
       'मधु कांकरिया के यात्रा-वृत्तांत साना-साना हाथ जोड़ि का आधिकारिक NCERT कृतिका अध्याय।',
       'jhkr102', 14, array['sana-sana-hath-jodi']),
      ('मैं क्यों लिखता हूँ - NCERT कृतिका',
       'अज्ञेय के निबंध मैं क्यों लिखता हूँ का आधिकारिक NCERT कृतिका अध्याय।',
       'jhkr103', 5, array['main-kyon-likhta-hoon'])
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
      'Hindi',
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

    foreach target_chapter_slug in array resource.chapter_slugs
    loop
      select id into target_chapter_id
        from public.chapters
       where subject_id = hindi_a_id
         and slug = target_chapter_slug;

      if target_chapter_id is null then
        raise exception 'NCERT CLASS 10 HINDI A PREFLIGHT: missing Hindi A chapter %', target_chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_10_id
           and subject_id = hindi_a_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_10_id, hindi_a_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jh(ks1(0[1-9]|1[0-2])|kr10[1-3])[.]pdf$';
  if batch_material_count <> 15 then
    raise exception 'NCERT CLASS 10 HINDI A POSTFLIGHT: expected 15 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jh(ks1(0[1-9]|1[0-2])|kr10[1-3])[.]pdf$';
  if batch_scope_count <> 17 then
    raise exception 'NCERT CLASS 10 HINDI A POSTFLIGHT: expected 17 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
