-- First verified batch of official JEE (Main) 2022 Session 1 Paper 1 question
-- papers in English. NTA's current public archive no longer exposes a complete
-- paper index, so this seed intentionally includes only the live PDFs whose
-- date, shift, language, 90-question completeness and page count were checked.
-- These are question papers only; no answer key is included. Every PDF stays
-- on nta.ac.in, and JEENEETARD stores links and metadata only. Whole-exam
-- papers receive one JEE goal scope and no false class, subject, chapter or
-- lecture attachment. Safe to rerun.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  jee_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  if jee_id is null then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2022 Session 1 - 24 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 24 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key is included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf', 'English', 18),
      ('JEE Main 2022 Session 1 - 26 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 26 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key is included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf', 'English', 20),
      ('JEE Main 2022 Session 1 - 29 June Shift 2 (English)',
       'Official NTA JEE Main 2022 Session 1 Paper 1 question paper conducted on 29 June 2022 in Shift 2, in English, covering Mathematics, Physics and Chemistry. Questions only; no answer key is included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf', 'English', 20)
    ) as seeded(title, description, source_url, language, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      resource.language, 2022, resource.page_count, true, 'official_source',
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
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   ) and exam_year = 2022;
  if batch_material_count <> 3 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: expected 3 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320113108.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230320131539.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20230322131758.pdf'
   ) and m.exam_year = 2022 and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 3 then
    raise exception 'JEE MAIN 2022 SESSION 1 PAPERS POSTFLIGHT: expected 3 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
