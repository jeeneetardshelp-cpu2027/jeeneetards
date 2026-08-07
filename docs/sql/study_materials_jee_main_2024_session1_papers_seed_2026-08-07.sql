-- Verified official JEE (Main) 2024 Session 1 Paper 1 question paper for
-- 29 January Shift 1 in English and Hindi. Only this shift is included because
-- it is the only Session 1 paper currently recovered as a direct NTA-hosted PDF
-- that passed identity, date, shift, bilingual, 90-question, six-section, page
-- count, SHA-256 and complete visual-rendering checks. No third-party mirror is
-- used for the remaining nine shifts. The official export exposes NTA's
-- "Possible Answers" field for numerical-response questions but contains no
-- worked solutions. The schema currently exposes one language facet, so this
-- bilingual paper uses the English facet while its title and description
-- disclose Hindi availability. JEENEETARD stores links and metadata only; the
-- PDF remains on nta.ac.in. This whole-exam paper receives one JEE scope and no
-- false class, subject, chapter or lecture attachment. Safe to rerun; exact
-- postflight guards reject metadata or scope drift.

begin;

do $$
declare
  target_material_id bigint;
  jee_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
  metadata_mismatch_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  if jee_id is null then
    raise exception 'JEE MAIN 2024 SESSION 1 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  insert into public.study_materials (
    title, description, material_type, source_name, source_url,
    file_format, language, exam_year, page_count, is_downloadable,
    rights_status, rights_note, review_status, published_at
  ) values (
    'JEE Main 2024 Session 1 - 29 January Shift 1 (English & Hindi)',
    'Official NTA JEE Main 2024 Session 1 Paper 1 question paper conducted on 29 January 2024 in Shift 1, with English and Hindi versions, covering Mathematics, Physics and Chemistry. The NTA export includes possible-answer fields for numerical-response questions; no worked solutions are included.',
    'previous_year_paper', 'National Testing Agency (JEE Main)',
    'https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf',
    'pdf', 'English', 2024, 104, true, 'official_source',
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

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url = 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf';
  if batch_material_count <> 1 then
    raise exception 'JEE MAIN 2024 SESSION 1 PAPERS POSTFLIGHT: expected 1 material, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url = 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf'
     and (title is distinct from 'JEE Main 2024 Session 1 - 29 January Shift 1 (English & Hindi)'
       or material_type is distinct from 'previous_year_paper'
       or source_name is distinct from 'National Testing Agency (JEE Main)'
       or file_format is distinct from 'pdf'
       or language is distinct from 'English'
       or exam_year is distinct from 2024
       or page_count is distinct from 104
       or is_downloadable is distinct from true
       or rights_status is distinct from 'official_source'
       or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2024 SESSION 1 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url = 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf';
  if batch_scope_count <> 1 then
    raise exception 'JEE MAIN 2024 SESSION 1 PAPERS POSTFLIGHT: expected exactly 1 total scope, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url = 'https://www.nta.ac.in/Download/ExamPaper/Paper_20250910115932.pdf'
     and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 1 then
    raise exception 'JEE MAIN 2024 SESSION 1 PAPERS POSTFLIGHT: expected 1 JEE-only scope, found %', batch_scope_count;
  end if;
end $$;

commit;
