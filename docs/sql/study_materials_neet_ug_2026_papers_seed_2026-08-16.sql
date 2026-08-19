-- Official NEET UG 2026 re-examination question papers in English.
-- All four PDFs are exposed by the official NTA download API. Their NTA
-- identity, 21 June date, Sushrut set code, 180-question completeness, page
-- count, rendering and SHA-256 were checked on 2026-08-16. Pages 2-3 and
-- 31-32 are intentional rough-work pages. JEENEETARD stores links and
-- metadata only; the PDFs remain on the official NTA host. Whole-exam papers
-- receive one NEET scope and no false class, subject, chapter or lecture
-- attachment. Safe to rerun; exact postflight guards reject drift.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  neet_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
  metadata_mismatch_count integer;
begin
  select id into neet_id from public.learning_goals where slug = 'neet';
  if neet_id is null then
    raise exception 'NEET UG 2026 PAPERS PREFLIGHT: NEET learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('NEET UG 2026 Re-Examination - Set 50 (English)',
       'Official NTA NEET UG 2026 re-examination question paper, Sushrut Set 50, conducted on 21 June 2026. Contains 180 questions across Physics, Chemistry and Biology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623154909.pdf', 32),
      ('NEET UG 2026 Re-Examination - Set 60 (English)',
       'Official NTA NEET UG 2026 re-examination question paper, Sushrut Set 60, conducted on 21 June 2026. Contains 180 questions across Physics, Chemistry and Biology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155400.pdf', 32),
      ('NEET UG 2026 Re-Examination - Set 70 (English)',
       'Official NTA NEET UG 2026 re-examination question paper, Sushrut Set 70, conducted on 21 June 2026. Contains 180 questions across Physics, Chemistry and Biology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155453.pdf', 32),
      ('NEET UG 2026 Re-Examination - Set 80 (English)',
       'Official NTA NEET UG 2026 re-examination question paper, Sushrut Set 80, conducted on 21 June 2026. Contains 180 questions across Physics, Chemistry and Biology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155537.pdf', 32)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (NEET UG)', resource.source_url, 'pdf',
      'English', 2026, resource.page_count, true, 'official_source',
      'Official NEET UG question paper exposed by the National Testing Agency download API and hosted on nta.ac.in. Linked only; not mirrored or redistributed by JEENEETARD.',
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
         and learning_goal_id = neet_id
         and board_id is null and class_level_id is null
         and subject_id is null and chapter_id is null
    ) then
      insert into public.study_material_scopes (material_id, learning_goal_id)
      values (target_material_id, neet_id);
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623154909.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155400.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155453.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623155537.pdf'
   );
  if batch_material_count <> 4 then
    raise exception 'NEET UG 2026 PAPERS POSTFLIGHT: expected 4 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url like 'https://www.nta.ac.in/Download/ExamPaper/Paper_20260623%.pdf'
     and title like 'NEET UG 2026 Re-Examination - Set %'
     and (material_type is distinct from 'previous_year_paper'
       or source_name is distinct from 'National Testing Agency (NEET UG)'
       or file_format is distinct from 'pdf' or language is distinct from 'English'
       or exam_year is distinct from 2026 or page_count is distinct from 32
       or is_downloadable is distinct from true
       or rights_status is distinct from 'official_source'
       or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'NEET UG 2026 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.title like 'NEET UG 2026 Re-Examination - Set %';
  if batch_scope_count <> 4 then
    raise exception 'NEET UG 2026 PAPERS POSTFLIGHT: expected exactly 4 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.title like 'NEET UG 2026 Re-Examination - Set %'
     and s.learning_goal_id = neet_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 4 then
    raise exception 'NEET UG 2026 PAPERS POSTFLIGHT: expected 4 NEET-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
