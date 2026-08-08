-- Complete official JEE Main 2017 Paper 1 question-paper set in English and
-- Hindi: four offline sets from 2 April and the Physics, Chemistry and
-- Mathematics files for both online dates, 8 and 9 April. The archived
-- official jeemain.nic.in question-paper page identifies every linked file.
-- All 267 pages were hashed and visually checked on 2026-08-08. JEENEETARD
-- stores links and metadata only; the files are not mirrored. The database
-- language taxonomy has no bilingual value, so Hinglish is the closest filter
-- while titles and descriptions explicitly state English and Hindi. Papers
-- receive one JEE scope and no false class, subject, chapter or lecture
-- attachment. Safe to rerun; exact postflight guards reject metadata or scope
-- drift.

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
    raise exception 'JEE MAIN 2017 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2017 - 2 April Offline Set A (English and Hindi)',
       'Official CBSE JEE Main 2017 Paper 1 question paper conducted offline on 2 April 2017, Set A, in English and Hindi, covering Mathematics, Physics and Chemistry. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174432id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetA.pdf', 44),
      ('JEE Main 2017 - 2 April Offline Set B (English and Hindi)',
       'Official CBSE JEE Main 2017 Paper 1 question paper conducted offline on 2 April 2017, Set B, in English and Hindi, covering Mathematics, Physics and Chemistry. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174442id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetB.pdf', 44),
      ('JEE Main 2017 - 2 April Offline Set C (English and Hindi)',
       'Official CBSE JEE Main 2017 Paper 1 question paper conducted offline on 2 April 2017, Set C, in English and Hindi, covering Mathematics, Physics and Chemistry. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174448id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetC.pdf', 44),
      ('JEE Main 2017 - 2 April Offline Set D (English and Hindi)',
       'Official CBSE JEE Main 2017 Paper 1 question paper conducted offline on 2 April 2017, Set D, in English and Hindi, covering Mathematics, Physics and Chemistry. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174500id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetD.pdf', 44),
      ('JEE Main 2017 - 8 April Online Physics (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Physics question paper conducted on 8 April 2017, in English and Hindi. Contains Physics questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174340id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_VI_Physics_E_H_8.pdf', 18),
      ('JEE Main 2017 - 8 April Online Chemistry (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Chemistry question paper conducted on 8 April 2017, in English and Hindi. Contains Chemistry questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174351id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_VI_Chemistry_E_H_8.pdf', 13),
      ('JEE Main 2017 - 8 April Online Mathematics (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Mathematics question paper conducted on 8 April 2017, in English and Hindi. Contains Mathematics questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174416id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_VI_Mathematics_E_H_8.pdf', 14),
      ('JEE Main 2017 - 9 April Online Physics (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Physics question paper conducted on 9 April 2017, in English and Hindi. Contains Physics questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174336id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_IX_Physics_E_H_9.pdf', 20),
      ('JEE Main 2017 - 9 April Online Chemistry (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Chemistry question paper conducted on 9 April 2017, in English and Hindi. Contains Chemistry questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174346id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_IX_Chemistry_E_H_9.pdf', 13),
      ('JEE Main 2017 - 9 April Online Mathematics (English and Hindi)',
       'Official CBSE JEE Main 2017 online Paper 1 Mathematics question paper conducted on 9 April 2017, in English and Hindi. Contains Mathematics questions 1-30; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20170516174411id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_IX_Mathematics_E_H_9.pdf', 13)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'Central Board of Secondary Education (JEE Main)', resource.source_url,
      'pdf', 'Hinglish', 2017, resource.page_count, true, 'official_source',
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
     'https://web.archive.org/web/20170516174432id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetA.pdf',
     'https://web.archive.org/web/20170516174442id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetB.pdf',
     'https://web.archive.org/web/20170516174448id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetC.pdf',
     'https://web.archive.org/web/20170516174500id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetD.pdf',
     'https://web.archive.org/web/20170516174340id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_VI_Physics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174351id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_VI_Chemistry_E_H_8.pdf',
     'https://web.archive.org/web/20170516174416id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_VI_Mathematics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174336id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_IX_Physics_E_H_9.pdf',
     'https://web.archive.org/web/20170516174346id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_IX_Chemistry_E_H_9.pdf',
     'https://web.archive.org/web/20170516174411id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_IX_Mathematics_E_H_9.pdf'
   );
  if batch_material_count <> 10 then
    raise exception 'JEE MAIN 2017 PAPERS POSTFLIGHT: expected 10 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://web.archive.org/web/20170516174432id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetA.pdf',
     'https://web.archive.org/web/20170516174442id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetB.pdf',
     'https://web.archive.org/web/20170516174448id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetC.pdf',
     'https://web.archive.org/web/20170516174500id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetD.pdf',
     'https://web.archive.org/web/20170516174340id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_VI_Physics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174351id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_VI_Chemistry_E_H_8.pdf',
     'https://web.archive.org/web/20170516174416id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_VI_Mathematics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174336id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_IX_Physics_E_H_9.pdf',
     'https://web.archive.org/web/20170516174346id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_IX_Chemistry_E_H_9.pdf',
     'https://web.archive.org/web/20170516174411id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_IX_Mathematics_E_H_9.pdf'
   ) and (material_type is distinct from 'previous_year_paper'
     or source_name is distinct from 'Central Board of Secondary Education (JEE Main)'
     or file_format is distinct from 'pdf' or language is distinct from 'Hinglish'
     or exam_year is distinct from 2017 or is_downloadable is distinct from true
     or rights_status is distinct from 'official_source'
     or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2017 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20170516174432id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetA.pdf',
     'https://web.archive.org/web/20170516174442id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetB.pdf',
     'https://web.archive.org/web/20170516174448id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetC.pdf',
     'https://web.archive.org/web/20170516174500id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetD.pdf',
     'https://web.archive.org/web/20170516174340id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_VI_Physics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174351id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_VI_Chemistry_E_H_8.pdf',
     'https://web.archive.org/web/20170516174416id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_VI_Mathematics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174336id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_IX_Physics_E_H_9.pdf',
     'https://web.archive.org/web/20170516174346id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_IX_Chemistry_E_H_9.pdf',
     'https://web.archive.org/web/20170516174411id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_IX_Mathematics_E_H_9.pdf'
   );
  if batch_scope_count <> 10 then
    raise exception 'JEE MAIN 2017 PAPERS POSTFLIGHT: expected exactly 10 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20170516174432id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetA.pdf',
     'https://web.archive.org/web/20170516174442id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetB.pdf',
     'https://web.archive.org/web/20170516174448id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetC.pdf',
     'https://web.archive.org/web/20170516174500id_/http://jeemain.nic.in:80/webinfo/PDF/Paper01_RBS_English_Hindi_SetD.pdf',
     'https://web.archive.org/web/20170516174340id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_VI_Physics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174351id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_VI_Chemistry_E_H_8.pdf',
     'https://web.archive.org/web/20170516174416id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_VI_Mathematics_E_H_8.pdf',
     'https://web.archive.org/web/20170516174336id_/http://jeemain.nic.in:80/webinfo/PDF/01_Set_IX_Physics_E_H_9.pdf',
     'https://web.archive.org/web/20170516174346id_/http://jeemain.nic.in:80/webinfo/PDF/02_Set_IX_Chemistry_E_H_9.pdf',
     'https://web.archive.org/web/20170516174411id_/http://jeemain.nic.in:80/webinfo/PDF/03_Set_IX_Mathematics_E_H_9.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 10 then
    raise exception 'JEE MAIN 2017 PAPERS POSTFLIGHT: expected 10 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
