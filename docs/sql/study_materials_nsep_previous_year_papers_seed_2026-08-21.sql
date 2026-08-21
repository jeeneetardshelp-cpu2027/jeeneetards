-- Seven NSEP Physics Olympiad previous-year papers with worked solutions,
-- supplied by the JEENEETARD owner. Competishun redistribution permission was
-- previously confirmed by the owner. PDFs and first-page previews are hosted
-- by JEENEETARD with attribution. NSEP is conducted by IAPT.
--
-- These are full-exam resources spanning many chapters, so each paper receives
-- one Olympiad + Physics scope and no misleading chapter or lecture attachment.
-- Safe to rerun: this seed upserts its seven records and replaces their scopes.

begin;

create temporary table nsep_paper_seed_resources (
  title text not null,
  description text not null,
  file_name text not null,
  exam_year integer not null,
  page_count integer not null
) on commit drop;

insert into nsep_paper_seed_resources (
  title, description, file_name, exam_year, page_count
) values
  ('NSEP 2019-20 Physics Paper with Solutions',
   'National Standard Examination in Physics 2019-20 paper with worked Competishun solutions for Physics Olympiad preparation.',
   'nsep-2019-20-paper-with-solutions.pdf', 2019, 35),
  ('NSEP 2020-21 Physics Paper with Solutions',
   'IOQP Physics Part I (NSEP) 2020-21 question paper with worked solutions for Physics Olympiad preparation.',
   'nsep-2020-21-paper-with-solutions.pdf', 2020, 18),
  ('NSEP 2021-22 Physics Paper with Solutions',
   'IOQP Physics Part I (NSEP) 2021-22 question paper with worked solutions for Physics Olympiad preparation.',
   'nsep-2021-22-paper-with-solutions.pdf', 2021, 22),
  ('NSEP 2022-23 Physics Paper with Solutions',
   'National Standard Examination in Physics 2022-23 paper with worked Competishun solutions for Physics Olympiad preparation.',
   'nsep-2022-23-paper-with-solutions.pdf', 2022, 46),
  ('NSEP 2023-24 Physics Paper with Solutions',
   'National Standard Examination in Physics 2023-24 paper with worked Competishun solutions for Physics Olympiad preparation.',
   'nsep-2023-24-paper-with-solutions.pdf', 2023, 33),
  ('NSEP 2024-25 Physics Paper with Solutions',
   'National Standard Examination in Physics 2024-25 paper with worked Competishun solutions for Physics Olympiad preparation.',
   'nsep-2024-25-paper-with-solutions.pdf', 2024, 37),
  ('NSEP 2025-26 Physics Paper with Solutions',
   'National Standard Examination in Physics 2025-26 paper with answers and worked Competishun solutions for Physics Olympiad preparation.',
   'nsep-2025-26-paper-with-solutions.pdf', 2025, 47);

do $$
declare
  resource record;
  target_material_id bigint;
  olympiad_id bigint;
  physics_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
  unexpected_scope_count integer;
begin
  select id into olympiad_id
    from public.learning_goals
   where slug = 'olympiad';
  if olympiad_id is null then
    raise exception 'NSEP PAPERS PREFLIGHT: Olympiad learning goal is missing';
  end if;

  select id into physics_id
    from public.subjects
   where slug = 'physics';
  if physics_id is null then
    raise exception 'NSEP PAPERS PREFLIGHT: Physics subject is missing';
  end if;

  for resource in
    select * from nsep_paper_seed_resources order by exam_year
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      preview_image_url, file_format, language, exam_year, page_count,
      is_downloadable, rights_status, rights_note, review_status, published_at
    ) values (
      resource.title,
      resource.description,
      'previous_year_paper',
      'Competishun',
      'https://jeeneetard.com/study-materials/previous-year-papers/nsep/' || resource.file_name,
      'https://jeeneetard.com/study-materials/previews/previous-year-papers/nsep/' || replace(resource.file_name, '.pdf', '.jpg'),
      'pdf',
      'English',
      resource.exam_year,
      resource.page_count,
      true,
      'creator_permission',
      'Competishun redistribution permission previously confirmed by the JEENEETARD owner. Owner-supplied PDF hosted by JEENEETARD with Competishun attribution; NSEP is conducted by IAPT.',
      'approved',
      now()
    )
    on conflict (title, source_url) do update set
      description = excluded.description,
      material_type = excluded.material_type,
      source_name = excluded.source_name,
      preview_image_url = excluded.preview_image_url,
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

    delete from public.study_material_scopes
     where material_id = target_material_id;

    insert into public.study_material_scopes (
      material_id, learning_goal_id, subject_id
    ) values (
      target_material_id, olympiad_id, physics_id
    );
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials m
    join nsep_paper_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/previous-year-papers/nsep/' || r.file_name
   where m.title = r.title
     and m.material_type = 'previous_year_paper'
     and m.source_name = 'Competishun'
     and m.file_format = 'pdf'
     and m.language = 'English'
     and m.exam_year = r.exam_year
     and m.page_count = r.page_count
     and m.is_downloadable
     and m.rights_status = 'creator_permission'
     and m.review_status = 'approved'
     and m.published_at is not null
     and m.preview_image_url = 'https://jeeneetard.com/study-materials/previews/previous-year-papers/nsep/' || replace(r.file_name, '.pdf', '.jpg');
  if batch_material_count <> 7 then
    raise exception 'NSEP PAPERS POSTFLIGHT: expected 7 exact materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join nsep_paper_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/previous-year-papers/nsep/' || r.file_name
   where s.learning_goal_id = olympiad_id
     and s.subject_id = physics_id
     and s.board_id is null
     and s.class_level_id is null
     and s.chapter_id is null;
  if batch_scope_count <> 7 then
    raise exception 'NSEP PAPERS POSTFLIGHT: expected 7 Olympiad Physics scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into unexpected_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join nsep_paper_seed_resources r
      on m.source_url = 'https://jeeneetard.com/study-materials/previous-year-papers/nsep/' || r.file_name
   where s.learning_goal_id <> olympiad_id
      or s.subject_id <> physics_id
      or s.board_id is not null
      or s.class_level_id is not null
      or s.chapter_id is not null;
  if unexpected_scope_count <> 0 then
    raise exception 'NSEP PAPERS POSTFLIGHT: unexpected scopes found %', unexpected_scope_count;
  end if;
end $$;

commit;
