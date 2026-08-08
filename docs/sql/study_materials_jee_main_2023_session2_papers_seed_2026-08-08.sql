-- Verified official JEE (Main) 2023 Session 2 Paper 1 question papers in
-- English and Hindi for all twelve shifts exposed by the NTA archive on
-- 6-15 April. Every included PDF passed Paper 1/date/shift/bilingual checks,
-- a 90-question/three-subject completeness check, page count, SHA-256 and
-- complete visual rendering of all 1,313 pages. The NTA exports expose
-- possible-answer fields for numerical-response questions but contain no
-- worked solutions. The schema currently exposes one language facet, so these
-- bilingual papers use the English facet while their titles and descriptions
-- explicitly disclose Hindi availability. JEENEETARD stores links and
-- metadata only; every PDF remains on nta.ac.in. Whole-exam papers receive one
-- JEE scope and no false class, subject, chapter or lecture attachment. Safe
-- to rerun; exact postflight guards reject metadata or scope drift.

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
    raise exception 'JEE MAIN 2023 SESSION 2 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2023 Session 2 - 6 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 6 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123659.pdf', 107),
      ('JEE Main 2023 Session 2 - 6 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 6 April 2023 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123934.pdf', 114),
      ('JEE Main 2023 Session 2 - 8 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 8 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123456.pdf', 115),
      ('JEE Main 2023 Session 2 - 8 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 8 April 2023 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123626.pdf', 105),
      ('JEE Main 2023 Session 2 - 10 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 10 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122347.pdf', 113),
      ('JEE Main 2023 Session 2 - 10 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 10 April 2023 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122409.pdf', 107),
      ('JEE Main 2023 Session 2 - 11 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 11 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122615.pdf', 110),
      ('JEE Main 2023 Session 2 - 11 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 11 April 2023 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122544.pdf', 106),
      ('JEE Main 2023 Session 2 - 12 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 12 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123104.pdf', 108),
      ('JEE Main 2023 Session 2 - 13 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 13 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123157.pdf', 110),
      ('JEE Main 2023 Session 2 - 13 April Shift 2 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 13 April 2023 in Shift 2, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123348.pdf', 103),
      ('JEE Main 2023 Session 2 - 15 April Shift 1 (English & Hindi)',
       'Official NTA JEE Main 2023 Session 2 Paper 1 question paper conducted on 15 April 2023 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926124011.pdf', 115)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      'English', 2023, resource.page_count, true, 'official_source',
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
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123659.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123934.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123626.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122347.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122409.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122615.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122544.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123104.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123157.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123348.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926124011.pdf'
   );
  if batch_material_count <> 12 then
    raise exception 'JEE MAIN 2023 SESSION 2 PAPERS POSTFLIGHT: expected 12 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123659.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123934.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123626.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122347.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122409.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122615.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122544.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123104.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123157.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123348.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926124011.pdf'
   ) and (material_type is distinct from 'previous_year_paper'
     or source_name is distinct from 'National Testing Agency (JEE Main)'
     or file_format is distinct from 'pdf' or language is distinct from 'English'
     or exam_year is distinct from 2023 or is_downloadable is distinct from true
     or rights_status is distinct from 'official_source'
     or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2023 SESSION 2 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123659.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123934.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123626.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122347.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122409.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122615.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122544.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123104.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123157.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123348.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926124011.pdf'
   );
  if batch_scope_count <> 12 then
    raise exception 'JEE MAIN 2023 SESSION 2 PAPERS POSTFLIGHT: expected exactly 12 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123659.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123934.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123456.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123626.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122347.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122409.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122615.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926122544.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123104.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123157.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926123348.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230926124011.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 12 then
    raise exception 'JEE MAIN 2023 SESSION 2 PAPERS POSTFLIGHT: expected 12 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
