-- One verified official CBSE JEE Main 2014 Paper 1 final-answer-key PDF.
-- Its official-host filename is "FINAL JEE14 KEY.pdf". The eight pages cover
-- the 6 April offline Sets E-H and the 9, 11, 12 and 19 April online
-- examinations. The earlier consolidated key, Paper 2 key, response/OMR
-- records, question papers and third-party solutions are excluded. This is an
-- answer key only and contains no worked solutions. JEENEETARD stores the
-- preserved official link and catalogue metadata only; the PDF is not mirrored.
-- This whole-exam resource receives one JEE scope and no false class, subject,
-- chapter or lecture attachment. Safe to rerun; collision, metadata and scope
-- guards fail closed.

begin;

create temporary table jee_main_2014_final_answer_key_seed (
  title text not null,
  description text not null,
  source_url text not null,
  exam_year integer not null,
  page_count integer not null
) on commit drop;

insert into jee_main_2014_final_answer_key_seed (
  title, description, source_url, exam_year, page_count
) values (
  'JEE Main 2014 Final Answer Key (Paper 1 B.E./B.Tech)',
  'Official CBSE final answer key for JEE Main 2014 Paper 1 B.E./B.Tech. The eight-page PDF covers the 6 April offline Sets E-H and the 9, 11, 12 and 19 April online examinations, including the official treatment of questions awarded four marks to all candidates. This is an answer key only and does not include worked solutions.',
  'https://web.archive.org/web/20140513105647id_/http://jeemain.nic.in:80/jeemainapp/PDF/FINAL%20JEE14%20KEY.pdf',
  2014,
  8
);

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
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY PREFLIGHT: JEE learning goal is missing';
  end if;

  select count(*)::integer into source_collision_count
    from public.study_materials m
    join jee_main_2014_final_answer_key_seed r on r.source_url = m.source_url
   where m.title is distinct from r.title;
  if source_collision_count <> 0 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY PREFLIGHT: % source URL collisions', source_collision_count;
  end if;

  select count(*)::integer into title_collision_count
    from public.study_materials m
    join jee_main_2014_final_answer_key_seed r on r.title = m.title
   where m.source_url is distinct from r.source_url;
  if title_collision_count <> 0 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY PREFLIGHT: % title collisions', title_collision_count;
  end if;

  for resource in
    select * from jee_main_2014_final_answer_key_seed
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at,
      paper_kind, paper_year, exam_session, exam_shift
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'Central Board of Secondary Education (JEE Main)', resource.source_url,
      'pdf', 'English', resource.exam_year, resource.page_count,
      true, 'official_source',
      'Official JEE Main 2014 final-answer-key PDF linked through a preserved capture of the original jeemain.nic.in host. Linked only; not mirrored or redistributed by JEENEETARD.',
      'approved', now(), 'answer_key', resource.exam_year, null, null
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
      published_at = coalesce(public.study_materials.published_at, excluded.published_at),
      paper_kind = excluded.paper_kind,
      paper_year = excluded.paper_year,
      exam_session = excluded.exam_session,
      exam_shift = excluded.exam_shift
    returning id into target_material_id;

    delete from public.study_material_scopes
     where material_id = target_material_id;

    insert into public.study_material_scopes (material_id, learning_goal_id)
    values (target_material_id, jee_id);
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials m
    join jee_main_2014_final_answer_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_material_count <> 1 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY POSTFLIGHT: expected 1 material, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from jee_main_2014_final_answer_key_seed r
    left join public.study_materials m
      on r.title = m.title and r.source_url = m.source_url
   where m.id is null
      or m.description is distinct from r.description
      or m.material_type is distinct from 'previous_year_paper'
      or m.source_name is distinct from 'Central Board of Secondary Education (JEE Main)'
      or m.file_format is distinct from 'pdf'
      or m.language is distinct from 'English'
      or m.exam_year is distinct from r.exam_year
      or m.page_count is distinct from r.page_count
      or m.is_downloadable is distinct from true
      or m.rights_status is distinct from 'official_source'
      or m.review_status is distinct from 'approved'
      or m.published_at is null
      or m.paper_kind is distinct from 'answer_key'
      or m.paper_year is distinct from r.exam_year
      or m.exam_session is not null
      or m.exam_shift is not null;
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_2014_final_answer_key_seed r
      on r.title = m.title and r.source_url = m.source_url;
  if batch_scope_count <> 1 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY POSTFLIGHT: expected exactly 1 total scope, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
    join jee_main_2014_final_answer_key_seed r
      on r.title = m.title and r.source_url = m.source_url
   where s.learning_goal_id = jee_id
     and s.board_id is null
     and s.class_level_id is null
     and s.subject_id is null
     and s.chapter_id is null;
  if batch_scope_count <> 1 then
    raise exception 'JEE MAIN 2014 FINAL ANSWER KEY POSTFLIGHT: expected 1 JEE-only scope, found %', batch_scope_count;
  end if;
end $$;

commit;
