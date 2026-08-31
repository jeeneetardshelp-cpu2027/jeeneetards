-- Four verified official NTA JEE Main 2021 Paper 1 (B.E./B.Tech.) final
-- answer keys: Session 1 through Session 4. Provisional keys, challenge
-- notices, Paper 2 keys and third-party solutions are excluded. These PDFs
-- contain final answers but no worked solutions. JEENEETARD stores links and
-- metadata only; all four PDFs remain on the official NTA website. Whole-exam
-- resources receive one JEE scope and no false class, subject, chapter or
-- lecture attachment. Safe to rerun; collision, metadata and scope guards
-- fail closed.

begin;

create temporary table jee_main_2021_final_key_seed (
  title text not null,
  description text not null,
  source_url text not null,
  exam_year integer not null,
  page_count integer not null
) on commit drop;

insert into jee_main_2021_final_key_seed (
  title, description, source_url, exam_year, page_count
) values
  ('JEE Main 2021 Session 1 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key on which the JEE Main 2021 Session 1 (February) Paper 1 B.E./B.Tech result was compiled on 8 March 2021, covering all listed examination dates, shifts and languages. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20210308221806.pdf', 2021, 78),
  ('JEE Main 2021 Session 2 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key on which the JEE Main 2021 Session 2 (March) Paper 1 B.E./B.Tech result was compiled on 24 March 2021, covering all listed examination dates, shifts and languages. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20210324193450.pdf', 2021, 78),
  ('JEE Main 2021 Session 3 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key on which the JEE Main 2021 Session 3 Paper 1 B.E./B.Tech result was compiled on 6 August 2021, covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20210806221131.pdf', 2021, 11),
  ('JEE Main 2021 Session 4 Final Answer Key (Paper 1 B.E./B.Tech)',
   'Official NTA final answer key on which the JEE Main 2021 Session 4 Paper 1 B.E./B.Tech result was compiled on 15 September 2021, covering all listed examination dates and shifts. This is an answer key only and does not include worked solutions.',
   'https://www.nta.ac.in/Download/Notice/Notice_20210915141450.pdf', 2021, 7);

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
    raise exception 'JEE MAIN 2021 FINAL KEYS PREFLIGHT: JEE learning goal is missing';
  end if;

  select count(*)::integer into source_collision_count
    from public.study_materials m
    join jee_main_2021_final_key_seed r on r.source_url = m.source_url
   where m.title is distinct from r.title;
  if source_collision_count <> 0 then
    raise exception 'JEE MAIN 2021 FINAL KEYS PREFLIGHT: % source URL collisions', source_collision_count;
  end if;

  select count(*)::integer into title_collision_count
    from public.study_materials m
    join jee_main_2021_final_key_seed r on r.title = m.title
   where m.source_url is distinct from r.source_url;
  if title_collision_count <> 0 then
    raise exception 'JEE MAIN 2021 FINAL KEYS PREFLIGHT: % title collisions', title_collision_count;
  end if;

  for resource in
    select * from jee_main_2021_final_key_seed order by title
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
      'Official JEE Main 2021 final answer key hosted on the NTA website. Linked only; not mirrored or redistributed by JEENEETARD.',
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
    join jee_main_2021_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_material_count <> 4 then
    raise exception 'JEE MAIN 2021 FINAL KEYS POSTFLIGHT: expected 4 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from jee_main_2021_final_key_seed r
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
    raise exception 'JEE MAIN 2021 FINAL KEYS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_2021_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_scope_count <> 4 then
    raise exception 'JEE MAIN 2021 FINAL KEYS POSTFLIGHT: expected exactly 4 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_2021_final_key_seed r
      on r.title = m.title and r.source_url = m.source_url
   where s.learning_goal_id = jee_id
     and s.board_id is null
     and s.class_level_id is null
     and s.subject_id is null
     and s.chapter_id is null;
  if batch_scope_count <> 4 then
    raise exception 'JEE MAIN 2021 FINAL KEYS POSTFLIGHT: expected 4 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
