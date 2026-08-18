-- Complete current rationalised NCERT Class 12 Mathematics chapter set (English, 2026-27).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and JEE/CBSE scopes are inserted once.

begin;

do $$
declare
  resource record;
  chapter_slug text;
  target_material_id bigint;
  target_chapter_id bigint;
  jee_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_12_id bigint;
  mathematics_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_12_id from public.class_levels where slug = 'class-12';
  select id into mathematics_id from public.subjects where slug = 'mathematics';

  if jee_id is null or school_id is null or cbse_id is null
     or class_12_id is null or mathematics_id is null then
    raise exception 'NCERT CLASS 12 MATHEMATICS PREFLIGHT: required curriculum row is missing';
  end if;

  -- The lecture taxonomy did not yet contain this NCERT chapter. Adding the
  -- exact node makes it available in the study-material directory now and
  -- ready for future Linear Programming lectures.
  insert into public.chapters (subject_id, name, slug, display_order)
  select mathematics_id, 'Linear Programming', 'linear-programming',
         coalesce(max(display_order), 0) + 1
    from public.chapters
   where subject_id = mathematics_id
  on conflict do nothing;

  for resource in
    select * from (values
      ('Relations and Functions - NCERT Mathematics',
       'Official NCERT chapter covering relations, functions, composition of functions and binary operations.',
       'lemh101', 17, array['relations-and-functions']::text[]),
      ('Inverse Trigonometric Functions - NCERT Mathematics',
       'Official NCERT chapter covering inverse trigonometric functions, their domains, ranges and properties.',
       'lemh102', 16, array['inverse-trigonometric-functions']::text[]),
      ('Matrices - NCERT Mathematics',
       'Official NCERT chapter covering types of matrices, matrix operations, transpose and invertible matrices.',
       'lemh103', 42, array['matrices']::text[]),
      ('Determinants - NCERT Mathematics',
       'Official NCERT chapter covering determinants, minors, cofactors, adjoints and applications to linear equations.',
       'lemh104', 28, array['determinants']::text[]),
      ('Continuity and Differentiability - NCERT Mathematics',
       'Official NCERT chapter covering continuity, differentiability, composite functions and higher-order derivatives.',
       'lemh105', 43, array['limits-continuity-and-differentiability', 'continuity', 'differentiation']::text[]),
      ('Application of Derivatives - NCERT Mathematics',
       'Official NCERT chapter applying derivatives to rates of change, monotonicity and maxima and minima.',
       'lemh106', 40, array['applications-of-derivatives']::text[]),
      ('Integrals - NCERT Mathematics',
       'Official NCERT chapter covering indefinite integrals, methods of integration, definite integrals and their properties.',
       'lemh201', 67, array['indefinite-integration', 'definite-integration']::text[]),
      ('Application of Integrals - NCERT Mathematics',
       'Official NCERT chapter applying definite integrals to areas under curves and between curves.',
       'lemh202', 8, array['application-of-integrals']::text[]),
      ('Differential Equations - NCERT Mathematics',
       'Official NCERT chapter covering order, degree, general and particular solutions and solution methods.',
       'lemh203', 38, array['differential-equations']::text[]),
      ('Vector Algebra - NCERT Mathematics',
       'Official NCERT chapter covering vectors, direction cosines, vector operations and scalar and vector products.',
       'lemh204', 39, array['vectors-and-three-dimensional-geometry']::text[]),
      ('Three Dimensional Geometry - NCERT Mathematics',
       'Official NCERT chapter covering lines in space, direction ratios, angles and shortest distances.',
       'lemh205', 17, array['vectors-and-three-dimensional-geometry']::text[]),
      ('Linear Programming - NCERT Mathematics',
       'Official NCERT chapter covering linear constraints, feasible regions and graphical optimisation.',
       'lemh206', 12, array['linear-programming']::text[]),
      ('Probability - NCERT Mathematics',
       'Official NCERT chapter covering conditional probability, Bayes theorem and random variables.',
       'lemh207', 33, array['probability']::text[])
    ) as seeded(title, description, source_code, page_count, chapter_slugs)
  loop
    insert into public.study_materials (
      title, description, material_type, source_name, source_url,
      file_format, language, page_count, is_downloadable,
      rights_status, rights_note, review_status, published_at
    ) values (
      resource.title,
      resource.description,
      'full_notes',
      'NCERT',
      format('https://ncert.nic.in/textbook/pdf/%s.pdf', resource.source_code),
      'pdf',
      'English',
      resource.page_count,
      true,
      'official_source',
      'Official NCERT chapter hosted on ncert.nic.in. Linked only; not mirrored or redistributed by JEENEETARD.',
      'approved',
      now()
    )
    on conflict (title, source_url) do update set
      description = excluded.description,
      material_type = excluded.material_type,
      source_name = excluded.source_name,
      file_format = excluded.file_format,
      language = excluded.language,
      page_count = excluded.page_count,
      is_downloadable = excluded.is_downloadable,
      rights_status = excluded.rights_status,
      rights_note = excluded.rights_note,
      review_status = excluded.review_status,
      published_at = coalesce(public.study_materials.published_at, excluded.published_at)
    returning id into target_material_id;

    foreach chapter_slug in array resource.chapter_slugs
    loop
      select id into target_chapter_id
        from public.chapters
       where subject_id = mathematics_id
         and slug = chapter_slug;

      if target_chapter_id is null then
        raise exception 'NCERT CLASS 12 MATHEMATICS PREFLIGHT: missing Mathematics chapter %', chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = jee_id
           and board_id is null
           and class_level_id = class_12_id
           and subject_id = mathematics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, jee_id, class_12_id, mathematics_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_12_id
           and subject_id = mathematics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_12_id, mathematics_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lemh(1|2)[0-9]{2}[.]pdf$';
  if batch_material_count <> 13 then
    raise exception 'NCERT CLASS 12 MATHEMATICS POSTFLIGHT: expected 13 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/lemh(1|2)[0-9]{2}[.]pdf$';
  if batch_scope_count <> 32 then
    raise exception 'NCERT CLASS 12 MATHEMATICS POSTFLIGHT: expected 32 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
