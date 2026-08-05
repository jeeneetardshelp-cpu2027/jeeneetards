-- Complete current rationalised NCERT Class 10 Hindi B chapter set.
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
  hindi_b_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';
  select id into hindi_b_id from public.subjects where slug = 'hindi-b';

  if school_id is null or cbse_id is null or class_10_id is null
     or hindi_b_id is null then
    raise exception 'NCERT CLASS 10 HINDI B PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('कबीर की साखी - NCERT स्पर्श',
       'कबीर की साखियों का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp101', 7, 'kabir-ki-sakhi'),
      ('मीरा के पद - NCERT स्पर्श',
       'मीरा के पदों का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp102', 5, 'meera-ke-pad'),
      ('मनुष्यता - NCERT स्पर्श',
       'मैथिलीशरण गुप्त की कविता मनुष्यता का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp103', 7, 'manushyata'),
      ('पर्वत प्रदेश में पावस - NCERT स्पर्श',
       'सुमित्रानंदन पंत की कविता का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp104', 6, 'parvat-pradesh-mein-pavas'),
      ('तोप - NCERT स्पर्श',
       'वीरेन डंगवाल की कविता तोप का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp105', 5, 'top'),
      ('कर चले हम फ़िदा - NCERT स्पर्श',
       'कैफ़ी आज़मी की कविता का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp106', 5, 'kar-chale-hum-fida'),
      ('आत्मत्राण - NCERT स्पर्श',
       'रवींद्रनाथ ठाकुर की कविता आत्मत्राण का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp107', 5, 'aatmatran'),
      ('बड़े भाई साहब - NCERT स्पर्श',
       'प्रेमचंद की कहानी बड़े भाई साहब का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp108', 17, 'bade-bhai-sahab'),
      ('डायरी का एक पन्ना - NCERT स्पर्श',
       'सीताराम सेकसरिया के पाठ का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp109', 9, 'diary-ka-ek-panna'),
      ('तताँरा वामीरो कथा - NCERT स्पर्श',
       'लीलाधर मंडलोई के पाठ का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp110', 12, 'tatara-vamiro-katha'),
      ('तीसरी कसम के शिल्पकार शैलेंद्र - NCERT स्पर्श',
       'प्रहलाद अग्रवाल के पाठ का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp111', 10, 'teesri-kasam-ke-shilpkar-shailendra'),
      ('अब कहाँ दूसरे के दुख से दुखी होने वाले - NCERT स्पर्श',
       'निदा फ़ाज़ली के पाठ का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp112', 8, 'ab-kahan-doosron-ke-dukh-se-dukhi-hone-wale'),
      ('पतझर में टूटी पत्तियाँ - NCERT स्पर्श',
       'रवींद्र केलेकर के पाठ का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp113', 10, 'patjhar-mein-tooti-pattiyan'),
      ('कारतूस - NCERT स्पर्श',
       'हबीब तनवीर के एकांकी कारतूस का आधिकारिक NCERT स्पर्श अध्याय।',
       'jhsp114', 10, 'kartus'),
      ('हरिहर काका - NCERT संचयन',
       'मिथिलेश्वर की कहानी हरिहर काका का आधिकारिक NCERT संचयन अध्याय।',
       'jhsy101', 19, 'harihar-kaka'),
      ('सपनों के से दिन - NCERT संचयन',
       'गुरदयाल सिंह के संस्मरण का आधिकारिक NCERT संचयन अध्याय।',
       'jhsy102', 12, 'sapnon-ke-se-din'),
      ('टोपी शुक्ला - NCERT संचयन',
       'राही मासूम रज़ा के पाठ का आधिकारिक NCERT संचयन अध्याय।',
       'jhsy103', 13, 'topi-shukla')
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

    select id into target_chapter_id
      from public.chapters
     where subject_id = hindi_b_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 10 HINDI B PREFLIGHT: missing Hindi B chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_10_id
         and subject_id = hindi_b_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_10_id, hindi_b_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jhs(p1(0[1-9]|1[0-4])|y10[1-3])[.]pdf$';
  if batch_material_count <> 17 then
    raise exception 'NCERT CLASS 10 HINDI B POSTFLIGHT: expected 17 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jhs(p1(0[1-9]|1[0-4])|y10[1-3])[.]pdf$';
  if batch_scope_count <> 17 then
    raise exception 'NCERT CLASS 10 HINDI B POSTFLIGHT: expected 17 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
