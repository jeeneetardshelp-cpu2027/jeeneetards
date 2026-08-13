-- Complete official JEE Main 2014 Paper 1 question-paper set: four offline
-- English/Hindi sets from 6 April and complete English/Hindi online papers
-- from 9, 11, 12 and 19 April. The archived official jeemain.nic.in page
-- identifies every linked file. All 336 pages were hashed and visually checked
-- on 2026-08-13. JEENEETARD stores links and metadata only; the files are not
-- mirrored. The database language taxonomy has no bilingual value, so
-- Hinglish is the closest supported filter while titles and descriptions state
-- the actual languages. Papers receive one JEE scope and no false class,
-- subject, chapter or lecture attachment. Safe to rerun; exact postflight
-- guards reject metadata or scope drift.

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
    raise exception 'JEE MAIN 2014 PAPERS PREFLIGHT: JEE learning goal is missing';
  end if;

  for resource in
    select * from (values
      ('JEE Main 2014 - 6 April Offline Set E (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted offline on 6 April 2014, Set E, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014E.pdf', 40),
      ('JEE Main 2014 - 6 April Offline Set F (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted offline on 6 April 2014, Set F, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014F.pdf', 40),
      ('JEE Main 2014 - 6 April Offline Set G (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted offline on 6 April 2014, Set G, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014G.pdf', 40),
      ('JEE Main 2014 - 6 April Offline Set H (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted offline on 6 April 2014, Set H, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014H.pdf', 40),
      ('JEE Main 2014 - 9 April Online Set 01 (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted online on 9 April 2014, Set 01, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2014.pdf', 41),
      ('JEE Main 2014 - 11 April Online Set 11 (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted online on 11 April 2014, Set 11, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/11.04.2014.pdf', 48),
      ('JEE Main 2014 - 12 April Online Set 06 (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted online on 12 April 2014, Set 06, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/12.04.2014.pdf', 39),
      ('JEE Main 2014 - 19 April Online Set 10 (English and Hindi)',
       'Official CBSE JEE Main 2014 Paper 1 question paper conducted online on 19 April 2014, Set 10, in English and Hindi, covering Physics, Chemistry and Mathematics. Complete 90-question paper; no answer key or worked solutions are included.',
       'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/19.04.2014.pdf', 48)
    ) as seeded(title, description, source_url, page_count)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, exam_year, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title, resource.description, 'previous_year_paper',
      'Central Board of Secondary Education (JEE Main)', resource.source_url,
      'pdf', 'Hinglish', 2014, resource.page_count, true, 'official_source',
      'Official CBSE/JEE Main question paper originally hosted on jeemain.nic.in and linked through an Internet Archive capture of the official host. Linked only; not mirrored or redistributed by JEENEETARD.',
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
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014E.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014F.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014G.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014H.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/11.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/12.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/19.04.2014.pdf'
   );
  if batch_material_count <> 8 then
    raise exception 'JEE MAIN 2014 PAPERS POSTFLIGHT: expected 8 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into metadata_mismatch_count
    from public.study_materials
   where source_url in (
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014E.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014F.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014G.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014H.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/11.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/12.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/19.04.2014.pdf'
   ) and (material_type is distinct from 'previous_year_paper'
     or source_name is distinct from 'Central Board of Secondary Education (JEE Main)'
     or file_format is distinct from 'pdf' or language is distinct from 'Hinglish'
     or exam_year is distinct from 2014 or is_downloadable is distinct from true
     or rights_status is distinct from 'official_source'
     or review_status is distinct from 'approved');
  if metadata_mismatch_count <> 0 then
    raise exception 'JEE MAIN 2014 PAPERS POSTFLIGHT: % metadata mismatches', metadata_mismatch_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014E.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014F.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014G.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014H.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/11.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/12.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/19.04.2014.pdf'
   );
  if batch_scope_count <> 8 then
    raise exception 'JEE MAIN 2014 PAPERS POSTFLIGHT: expected exactly 8 total scopes, found %', batch_scope_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url in (
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014E.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014F.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014G.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/06.04.2014H.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/09.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/11.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/12.04.2014.pdf',
     'https://web.archive.org/web/20150420171339id_/http://jeemain.nic.in:80/webinfo/PDF/19.04.2014.pdf'
   ) and s.learning_goal_id = jee_id
     and s.board_id is null and s.class_level_id is null
     and s.subject_id is null and s.chapter_id is null;
  if batch_scope_count <> 8 then
    raise exception 'JEE MAIN 2014 PAPERS POSTFLIGHT: expected 8 JEE-only scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
