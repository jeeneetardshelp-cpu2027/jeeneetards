-- Official NEET UG 2024 question papers in English.
-- The two PDFs are exposed by the official NTA download API. Their NTA
-- identity, 5 May date, booklet code, 200-question completeness, page count,
-- rendering and SHA-256 were checked on 2026-08-16. Pages 31-32 are
-- intentional rough-work pages. An NTA catalogue entry labelled English_2
-- was excluded because visual review proves it is a Hindi-English booklet.
-- JEENEETARD stores links and metadata only; the PDFs remain on the official
-- NTA host. Whole-exam papers receive one NEET scope and no false class,
-- subject, chapter or lecture attachment. Safe to rerun; exact postflight
-- guards reject drift.

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
    raise exception 'NEET UG 2024 PAPERS PREFLIGHT: NEET learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('NEET UG 2024 - Set T1 (English)',
       'Official NTA NEET UG 2024 question paper, English booklet code T1, conducted on 5 May 2024. Contains 200 questions across Physics, Chemistry, Botany and Zoology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124132822.pdf', 32),
      ('NEET UG 2024 - Set R1 (English)',
       'Official NTA NEET UG 2024 question paper, English booklet code R1, conducted on 5 May 2024. Contains 200 questions across Physics, Chemistry, Botany and Zoology. Questions only; no answer key or solutions are included.',
       'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124133206.pdf', 32)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (NEET UG)', resource.source_url, 'pdf',
      'English', 2024, resource.page_count, true, 'official_source',
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
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124132822.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124133206.pdf'
   );
  if batch_material_count <> 2 then
    raise exception 'NEET UG 2024 PAPERS POSTFLIGHT: expected 2 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124132822.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124133206.pdf'
   )
     and (material_type is distinct from 'previous_year_paper'
       or source_name is distinct from 'National Testing Agency (NEET UG)'
       or file_format is distinct from 'pdf' or language is distinct from 'English'
       or exam_year is distinct from 2024 or page_count is distinct from 32
       or is_downloadable is distinct from true
       or rights_status is distinct from 'official_source'
       or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'NEET UG 2024 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124132822.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124133206.pdf'
   );
  if batch_scope_count <> 2 then
    raise exception 'NEET UG 2024 PAPERS POSTFLIGHT: expected exactly 2 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124132822.pdf',
     'https://www.nta.ac.in/Download/ExamPaper/Paper_20250124133206.pdf'
   )
     and s.learning_goal_id = neet_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 2 then
    raise exception 'NEET UG 2024 PAPERS POSTFLIGHT: expected 2 NEET-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
