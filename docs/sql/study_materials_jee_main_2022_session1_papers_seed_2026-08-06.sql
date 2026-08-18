-- Complete official JEE (Main) 2022 Session 1 Paper 1 question-paper set in
-- English for 24-29 June, both shifts. All twelve live NTA PDFs had their
-- Paper 1 identity, date, shift, language, 90-question/three-subject
-- completeness, absence of an answer key, page count, rendering and SHA-256
-- checked on 2026-08-07. JEENEETARD stores links and metadata only; every PDF
-- remains on nta.ac.in. Whole-exam papers receive one JEE scope and no false
-- class, subject, chapter or lecture attachment. Safe to rerun; exact
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
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2022 Session 1 - 24 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 24 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320112124.pdf', 26),
      ('JEE Main 2022 Session 1 - 24 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 24 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf', 18),
      ('JEE Main 2022 Session 1 - 25 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 25 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320120251.pdf', 26),
      ('JEE Main 2022 Session 1 - 25 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 25 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320124553.pdf', 21),
      ('JEE Main 2022 Session 1 - 26 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 26 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320130740.pdf', 28),
      ('JEE Main 2022 Session 1 - 26 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 26 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf', 20),
      ('JEE Main 2022 Session 1 - 27 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 27 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320133453.pdf', 27),
      ('JEE Main 2022 Session 1 - 27 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 27 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322111449.pdf', 22),
      ('JEE Main 2022 Session 1 - 28 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 28 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230321125442.pdf', 21),
      ('JEE Main 2022 Session 1 - 28 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 28 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322124511.pdf', 28),
      ('JEE Main 2022 Session 1 - 29 June Shift 1 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 29 June 2022 in Shift 1, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322130815.pdf', 26),
      ('JEE Main 2022 Session 1 - 29 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 29 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf', 20)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      'English', 2022, resource.page_count, true, 'official_source',
      'Official JEE Main question paper hosted by the National Testing Agency on nta.ac.in. Linked only; not mirrored or redistributed by JEENEETARD.',
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
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320112124.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320120251.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320124553.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320130740.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320133453.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322111449.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230321125442.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322124511.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322130815.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   );
  if batch_material_count <> 12 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: expected 12 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320112124.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320120251.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320124553.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320130740.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320133453.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322111449.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230321125442.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322124511.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322130815.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   ) and (material_type is distinct from 'previous_year_paper'
     or source_name is distinct from 'National Testing Agency (JEE Main)'
     or file_format is distinct from 'pdf' or language is distinct from 'English'
     or exam_year is distinct from 2022 or is_downloadable is distinct from true
     or rights_status is distinct from 'official_source'
     or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320112124.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320120251.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320124553.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320130740.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320133453.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322111449.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230321125442.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322124511.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322130815.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   );
  if batch_scope_count <> 12 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: expected exactly 12 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320112124.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320120251.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320124553.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320130740.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320133453.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322111449.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230321125442.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322124511.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322130815.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 12 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: expected 12 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
