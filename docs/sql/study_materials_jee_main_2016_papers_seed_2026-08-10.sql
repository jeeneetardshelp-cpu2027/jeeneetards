-- Complete official JEE Main 2016 Paper 1 question-paper set: four offline
-- English/Hindi sets from 3 April and complete English/Hindi/Gujarati online
-- papers from 9 and 10 April. The archived official jeemain.nic.in page
-- identifies every linked file. All 256 pages were hashed and visually checked
-- on 2026-08-10. JEENEETARD stores links and metadata only; the files are not
-- mirrored. The database language taxonomy has no bilingual or trilingual
-- value, so Hinglish is the closest supported filter while titles and
-- descriptions state the actual languages. Papers receive one JEE scope and no
-- false class, subject, chapter or lecture attachment. Safe to rerun; exact
-- postflight guards reject metadata or scope drift.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  jee_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
  metadata_mismatch_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  if jee_id is null then
    raise exception 'JEE MAIN 2016 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2016 - 3 April Offline Set E (English and Hindi)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted offline on 3 April 2016, Set E, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetE.pdf', 40),
      ('JEE Main 2016 - 3 April Offline Set F (English and Hindi)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted offline on 3 April 2016, Set F, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetF.pdf', 40),
      ('JEE Main 2016 - 3 April Offline Set G (English and Hindi)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted offline on 3 April 2016, Set G, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetG.pdf', 40),
      ('JEE Main 2016 - 3 April Offline Set H (English and Hindi)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted offline on 3 April 2016, Set H, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetH.pdf', 40),
      ('JEE Main 2016 - 9 April Online Set 04 (English, Hindi and Gujarati)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted online on 9 April 2016, Set 04, in English, Hindi and Gujarati, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2016.pdf', 46),
      ('JEE Main 2016 - 10 April Online Set 03 (English, Hindi and Gujarati)',
       'Official CBSE JEE Main 2016 Paper 1 question paper conducted online on 10 April 2016, Set 03, in English, Hindi and Gujarati, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/10.04.2016.pdf', 50)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'Central Board of Secondary Education (JEE Main)', resource.source_url,
      'pdf', 'Hinglish', 2016, resource.page_count, true, 'official_source',
      'Official CBSE/JEE Main question paper originally hosted on jeemain.nic.in and linked through an Internet Archive capture of the official host. Linked only; not mirrored or redistributed by JEENEETARD.',
      'approved', now()
    )
    on conflict (title, source_url) do update set
      description = excluded.description,
      material_type = excluded.material_type,
      source_name = excluded.source_name,
      file_format = excluded.file_format,
      language = excluded.language,
      exam_year = excluded.exam_year,
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
         and learning_goal_id = jee_id
         and board_id is null and class_level_id is null
         and subject_id is null and chapter_id is null
    ) then
      insert into public.study_material_scopes (material_id, learning_goal_id)
      values (target_material_id, jee_id);
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url in (
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetE.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetF.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetG.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetH.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2016.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/10.04.2016.pdf'
   );
  if batch_material_count <> 6 then
    raise exception 'JEE MAIN 2016 PAPERS POSTFLIGHT: expected 6 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetE.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetF.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetG.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetH.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2016.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/10.04.2016.pdf'
   ) and (material_type is distinct from 'previous_year_paper'
     or source_name is distinct from 'Central Board of Secondary Education (JEE Main)'
     or file_format is distinct from 'pdf' or language is distinct from 'Hinglish'
     or exam_year is distinct from 2016 or is_downloadable is distinct from true
     or rights_status is distinct from 'official_source'
     or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2016 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetE.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetF.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetG.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetH.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2016.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/10.04.2016.pdf'
   );
  if batch_scope_count <> 6 then
    raise exception 'JEE MAIN 2016 PAPERS POSTFLIGHT: expected exactly 6 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetE.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetF.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetG.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/03-04-2016-SetH.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2016.pdf',
     'https://web.archive.org/web/20160419204149id_/http://jeemain.nic.in:80/webinfo/PDF/10.04.2016.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 6 then
    raise exception 'JEE MAIN 2016 PAPERS POSTFLIGHT: expected 6 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
