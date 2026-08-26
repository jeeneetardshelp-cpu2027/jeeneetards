-- Six verified official NTA JEE Main Paper 1 (B.E./B.Tech.) final answer
-- keys: Session 1 and Session 2 for 2024, 2025 and 2026. Provisional keys,
-- challenge notices, Paper 2 keys and third-party solutions are excluded.
-- These PDFs contain final answers but no worked solutions. JEENEETARD stores
-- links and metadata only; every PDF remains on official NTA/NIC government
-- infrastructure. Whole-exam resources receive one JEE scope and no false
-- class, subject, chapter or lecture attachment. Safe to rerun; collision,
-- metadata and scope guards fail closed.

begin;

create temporary table jee_main_final_key_seed (
  title text not null,
  description text not null,
  source_url text not null,
  exam_year integer not null,
  page_count integer not null
) on commit drop;

insert into jee_main_final_key_seed (
  title, description, source_url, exam_year, page_count
) values
  ('JEE Main 2024 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key for JEE Main 2024 Session 1 Paper 1 (B.E./B.Tech), covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20240212120843.pdf', 2024, 10),
  ('JEE Main 2024 Session 2 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key for JEE Main 2024 Session 2 Paper 1 (B.E./B.Tech), covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20240424132602.pdf', 2024, 10),
  ('JEE Main 2025 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key for JEE Main 2025 Session 1 Paper 1 (B.E./B.Tech), as updated on 10 February 2025 and covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/02/2025021039.pdf', 2025, 20),
  ('JEE Main 2025 Session 2 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key for JEE Main 2025 Session 2 Paper 1 (B.E./B.Tech), dated 18 April 2025 and covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2025/04/2025041892.pdf', 2025, 18),
  ('JEE Main 2026 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key for JEE Main 2026 Session 1 Paper 1 (B.E./B.Tech), as updated on 16 February 2026 and covering listed examination dates and shifts for centres in India. This is an answer key only and does not include worked solutions.',
   'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/02/202602161216637872.pdf', 2026, 20),
  ('JEE Main 2026 Session 2 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key on which the JEE Main 2026 Session 2 Paper 1 (B.E./B.Tech) result was compiled, covering listed examination dates and shifts for centres in India. This is an answer key only and does not include worked solutions.',
   'https://cdnbbsr.s3waas.gov.in/s3f8e59f4b2fe7c5705bf878bbd494ccdf/uploads/2026/04/20260420409057044.pdf', 2026, 18);

do $$
declare
  resource record;
  target_material_id bigint;
  jee_id bigint;
  source_collision_count integer;
  title_collision_count integer;
  batch_material_count integer;
  metadata_mismatch_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  if jee_id is null then
    raise exception 'JEE MAIN FINAL KEYS PREFLIGHT: JEE learning goal is missing';
  end if;

  select count(*)::integer into source_collision_count
    from public.study_materials m
    join jee_main_final_key_seed r on r.source_url = m.source_url
   where m.title is distinct from r.title;
  if source_collision_count <> 0 then
    raise exception 'JEE MAIN FINAL KEYS PREFLIGHT: % source URL collisions', source_collision_count;
  end if;

  select count(*)::integer into title_collision_count
    from public.study_materials m
    join jee_main_final_key_seed r on r.title = m.title
   where m.source_url is distinct from r.source_url;
  if title_collision_count <> 0 then
    raise exception 'JEE MAIN FINAL KEYS PREFLIGHT: % title collisions', title_collision_count;
  end if;

  for resource in
    select * from jee_main_final_key_seed order by exam_year, title
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'National Testing Agency (JEE Main)', resource.source_url, 'pdf',
      'English', resource.exam_year, resource.page_count, true,
      'official_source',
      'Official JEE Main final answer key hosted by NTA or NIC government infrastructure. Linked only; not mirrored or redistributed by JEENEETARD.',
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

    delete from public.study_material_scopes
     where material_id = target_material_id;

    insert into public.study_material_scopes (material_id, learning_goal_id)
    values (target_material_id, jee_id);
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials m
    join jee_main_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_material_count <> 6 then
    raise exception 'JEE MAIN FINAL KEYS POSTFLIGHT: expected 6 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from jee_main_final_key_seed r
    left join public.study_materials m
      on r.title = m.title and r.source_url = m.source_url
   where m.id is null
      or m.description is distinct from r.description
      or m.material_type is distinct from 'previous_year_paper'
      or m.source_name is distinct from 'National Testing Agency (JEE Main)'
      or m.file_format is distinct from 'pdf'
      or m.language is distinct from 'English'
      or m.exam_year is distinct from r.exam_year
      or m.page_count is distinct from r.page_count
      or m.is_downloadable is distinct from true
      or m.rights_status is distinct from 'official_source'
      or m.review_status is distinct from 'approved'
      or m.published_at is null;
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN FINAL KEYS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_scope_count <> 6 then
    raise exception 'JEE MAIN FINAL KEYS POSTFLIGHT: expected exactly 6 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url
   where s.learning_goal_id = jee_id
     and s.board_id is null
     and s.class_level_id is null
     and s.subject_id is null
     and s.chapter_id is null;
  if batch_scope_count <> 6 then
    raise exception 'JEE MAIN FINAL KEYS POSTFLIGHT: expected 6 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
