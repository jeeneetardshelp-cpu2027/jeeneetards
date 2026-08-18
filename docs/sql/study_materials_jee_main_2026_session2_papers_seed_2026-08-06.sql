-- Official JEE (Main) 2026 Session 2 Paper 1 question papers in English.
-- All nine PDFs are linked by the current official JEE Main site. Their NTA
-- identity, date, shift, three-subject/75-question completeness, page count,
-- rendering and SHA-256 were checked on 2026-08-06. JEENEETARD stores links
-- and metadata only; the PDFs remain on the official NTA/NIC host. Whole-exam
-- papers receive one JEE scope and no false class, subject, chapter or lecture
-- attachment. Safe to rerun; exact postflight guards reject drift.

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
    raise exception 'JEE MAIN 2026 SESSION 2 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2026 Session 2 - 2 April Shift 1 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 2 April 2026 in Shift 1, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604092096865379.pdf', 30),
      ('JEE Main 2026 Session 2 - 2 April Shift 2 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 2 April 2026 in Shift 2, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409481957146.pdf', 31),
      ('JEE Main 2026 Session 2 - 4 April Shift 1 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 4 April 2026 in Shift 1, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604091916616339.pdf', 28),
      ('JEE Main 2026 Session 2 - 4 April Shift 2 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 4 April 2026 in Shift 2, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409432593766.pdf', 30),
      ('JEE Main 2026 Session 2 - 5 April Shift 1 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 5 April 2026 in Shift 1, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409828731207.pdf', 30),
      ('JEE Main 2026 Session 2 - 5 April Shift 2 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 5 April 2026 in Shift 2, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409829414602.pdf', 30),
      ('JEE Main 2026 Session 2 - 6 April Shift 1 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 6 April 2026 in Shift 1, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604092007095665.pdf', 28),
      ('JEE Main 2026 Session 2 - 6 April Shift 2 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 6 April 2026 in Shift 2, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409725707538.pdf', 31),
      ('JEE Main 2026 Session 2 - 8 April Shift 2 (English)',
       'Official NTA JEE Main 2026 Session 2 Paper 1 question paper conducted on 8 April 2026 in Shift 2, covering Mathematics, Physics and Chemistry. Questions only; no answer key or solutions are included.',
       'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409932754345.pdf', 31)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      'English', 2026, resource.page_count, true, 'official_source',
      'Official JEE Main question paper linked by jeemain.nta.nic.in and hosted on the Government of India S3WaaS/NIC domain. Linked only; not mirrored or redistributed by JEENEETARD.',
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
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604092096865379.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409481957146.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604091916616339.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409432593766.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409828731207.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409829414602.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/202604092007095665.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409725707538.pdf',
     'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260409932754345.pdf'
   );
  if batch_material_count <> 9 then
    raise exception 'JEE MAIN 2026 SESSION 2 PAPERS POSTFLIGHT: expected 9 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url like 'https://cdnbbsr.s3waas.gov.in/%/uploads/2026/04/%'
     and title like 'JEE Main 2026 Session 2 - %'
     and (material_type is distinct from 'previous_year_paper'
       or source_name is distinct from 'National Testing Agency (JEE Main)'
       or file_format is distinct from 'pdf' or language is distinct from 'English'
       or exam_year is distinct from 2026 or is_downloadable is distinct from true
       or rights_status is distinct from 'official_source'
       or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2026 SESSION 2 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.title like 'JEE Main 2026 Session 2 - %';
  if batch_scope_count <> 9 then
    raise exception 'JEE MAIN 2026 SESSION 2 PAPERS POSTFLIGHT: expected exactly 9 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.title like 'JEE Main 2026 Session 2 - %'
     and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 9 then
    raise exception 'JEE MAIN 2026 SESSION 2 PAPERS POSTFLIGHT: expected 9 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
