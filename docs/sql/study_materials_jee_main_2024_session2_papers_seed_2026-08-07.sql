-- Verified official JEE (Main) 2024 Session 2 Paper 1 question papers in
-- English and Hindi for all ten shifts from 4 through 9 April. Every PDF
-- passed Paper 1 identity, date, shift, bilingual, 90-question, six-section,
-- page-count, SHA-256 and complete visual-rendering checks. The NTA exports
-- expose possible-answer fields for numerical-response questions but contain
-- no worked solutions. The schema currently exposes one language facet, so
-- these bilingual papers use the English facet while their titles and
-- descriptions disclose Hindi availability. JEENEETARD stores links and
-- metadata only; every PDF remains on nta.ac.in. Whole-exam papers receive
-- one JEE scope and no false class, subject, chapter or lecture attachment.
-- Safe to rerun; exact postflight guards reject metadata or scope drift.

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
    raise exception 'JEE MAIN 2024 SESSION 2 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2024 Session 2 - 4 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 4 April 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191500.pdf', 125),
      ('JEE Main 2024 Session 2 - 4 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 4 April 2024 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191610.pdf', 106),
      ('JEE Main 2024 Session 2 - 5 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 5 April 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191403.pdf', 121),
      ('JEE Main 2024 Session 2 - 5 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 5 April 2024 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191312.pdf', 122),
      ('JEE Main 2024 Session 2 - 6 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 6 April 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190456.pdf', 107),
      ('JEE Main 2024 Session 2 - 6 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 6 April 2024 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190349.pdf', 123),
      ('JEE Main 2024 Session 2 - 8 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 8 April 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190254.pdf', 110),
      ('JEE Main 2024 Session 2 - 8 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 8 April 2024 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190223.pdf', 117),
      ('JEE Main 2024 Session 2 - 9 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 9 April 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191640.pdf', 123),
      ('JEE Main 2024 Session 2 - 9 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2024 Session 2 Paper 1 question paper conducted on 9 April 2024 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191139.pdf', 108)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      'English', 2024, resource.page_count, true, 'official_source',
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
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191500.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191610.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191403.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191312.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190349.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190254.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190223.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191640.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191139.pdf'
   );
  if batch_material_count <> 10 then
    raise exception 'JEE MAIN 2024 SESSION 2 PAPERS POSTFLIGHT: expected 10 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from (values
      ('JEE Main 2024 Session 2 - 4 April Shift 1 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191500.pdf', 125),
      ('JEE Main 2024 Session 2 - 4 April Shift 2 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191610.pdf', 106),
      ('JEE Main 2024 Session 2 - 5 April Shift 1 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191403.pdf', 121),
      ('JEE Main 2024 Session 2 - 5 April Shift 2 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191312.pdf', 122),
      ('JEE Main 2024 Session 2 - 6 April Shift 1 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190456.pdf', 107),
      ('JEE Main 2024 Session 2 - 6 April Shift 2 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190349.pdf', 123),
      ('JEE Main 2024 Session 2 - 8 April Shift 1 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190254.pdf', 110),
      ('JEE Main 2024 Session 2 - 8 April Shift 2 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190223.pdf', 117),
      ('JEE Main 2024 Session 2 - 9 April Shift 1 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191640.pdf', 123),
      ('JEE Main 2024 Session 2 - 9 April Shift 2 (English & Hindi)', 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191139.pdf', 108)
    ) as expected(title, source_url, page_count)
    left join public.study_materials m on m.source_url = expected.source_url
   where m.id is null
      or m.title is distinct from expected.title
      or m.material_type is distinct from 'previous_year_paper'
      or m.source_name is distinct from 'National Testing Agency (JEE Main)'
      or m.file_format is distinct from 'pdf'
      or m.language is distinct from 'English'
      or m.exam_year is distinct from 2024
      or m.page_count is distinct from expected.page_count
      or m.is_downloadable is distinct from true
      or m.rights_status is distinct from 'official_source'
      or m.review_status is distinct from 'approved';
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2024 SESSION 2 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191500.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191610.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191403.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191312.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190349.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190254.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190223.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191640.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191139.pdf'
   );
  if batch_scope_count <> 10 then
    raise exception 'JEE MAIN 2024 SESSION 2 PAPERS POSTFLIGHT: expected exactly 10 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191500.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191610.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191403.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191312.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190349.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190254.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306190223.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191640.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250306191139.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 10 then
    raise exception 'JEE MAIN 2024 SESSION 2 PAPERS POSTFLIGHT: expected 10 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
