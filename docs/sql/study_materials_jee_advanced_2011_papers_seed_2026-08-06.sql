-- Official IIT-JEE 2011 question papers with answers in English, preserved in
-- the current JEE (Advanced) archive. The archive provides one PDF for each
-- paper and no separate Hindi edition. Every PDF stays on jeeadv.ac.in;
-- JEENEETARD stores links and metadata only. Whole-exam papers receive one JEE
-- goal scope and no false class, subject, chapter or lecture attachment. Safe
-- to rerun.

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
    raise exception 'IIT-JEE 2011 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('IIT-JEE 2011 Paper 1 (English)',
       'Official IIT-JEE 2011 Paper 1 question paper with answers in English, covering Chemistry, Physics and Mathematics.',
       'https://jeeadv.ac.in/past_qps/2011_1.pdf', 'English', 30),
      ('IIT-JEE 2011 Paper 2 (English)',
       'Official IIT-JEE 2011 Paper 2 question paper with answers in English, covering Chemistry, Physics and Mathematics.',
       'https://jeeadv.ac.in/past_qps/2011_2.pdf', 'English', 26)
    ) as seeded(title, description, source_url, language, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'JEE (Advanced) archive', resource.source_url, 'pdf', resource.language,
      2011, resource.page_count, true, 'official_source',
      'Official IIT-JEE question paper hosted in the JEE (Advanced) archive on jeeadv.ac.in. Linked only; not mirrored or redistributed by JEENEETARD.',
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
   where source_url ~ '^https://jeeadv[.]ac[.]in/past_qps/2011_[12][.]pdf$'
     and exam_year = 2011;
  if batch_material_count <> 2 then
    raise exception 'IIT-JEE 2011 PAPERS POSTFLIGHT: expected 2 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://jeeadv[.]ac[.]in/past_qps/2011_[12][.]pdf$'
     and m.exam_year = 2011 and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 2 then
    raise exception 'IIT-JEE 2011 PAPERS POSTFLIGHT: expected 2 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
