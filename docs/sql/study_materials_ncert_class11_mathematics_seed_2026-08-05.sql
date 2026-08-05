-- Complete current rationalised NCERT Class 11 Mathematics chapter set (English, 2026-27).
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
  class_11_id bigint;
  mathematics_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_11_id from public.class_levels where slug = 'class-11';
  select id into mathematics_id from public.subjects where slug = 'mathematics';

  if jee_id is null or school_id is null or cbse_id is null
     or class_11_id is null or mathematics_id is null then
    raise exception 'NCERT CLASS 11 MATHEMATICS PREFLIGHT: required curriculum row is missing';
  end if;

  -- These NCERT chapters did not yet have exact site nodes. Adding them makes
  -- the material directory accurate now and prepares matching future lectures.
  insert into public.chapters (subject_id, name, slug, display_order)
  select mathematics_id, 'Sets', 'sets', coalesce(max(display_order), 0) + 1
    from public.chapters
   where subject_id = mathematics_id
  on conflict do nothing;

  insert into public.chapters (subject_id, name, slug, display_order)
  select mathematics_id, 'Linear Inequalities', 'linear-inequalities',
         coalesce(max(display_order), 0) + 1
    from public.chapters
   where subject_id = mathematics_id
  on conflict do nothing;

  for resource in
    select * from (values
      ('Sets - NCERT Mathematics',
       'Official NCERT chapter covering set notation, types of sets, subsets, Venn diagrams and set operations.',
       'kemh101', 23, array['sets']::text[]),
      ('Relations and Functions - NCERT Mathematics Class 11',
       'Official NCERT chapter covering Cartesian products, relations, functions and their graphical representation.',
       'kemh102', 19, array['relations-and-functions']::text[]),
      ('Trigonometric Functions - NCERT Mathematics',
       'Official NCERT chapter covering angles, trigonometric functions, identities and sum-and-difference formulae.',
       'kemh103', 33, array['trigonometry']::text[]),
      ('Complex Numbers and Quadratic Equations - NCERT Mathematics',
       'Official NCERT chapter covering complex numbers, the Argand plane and quadratic equations with complex roots.',
       'kemh104', 13, array['complex-numbers', 'quadratic-equations']::text[]),
      ('Linear Inequalities - NCERT Mathematics',
       'Official NCERT chapter covering algebraic and graphical solutions of linear inequalities.',
       'kemh105', 11, array['linear-inequalities']::text[]),
      ('Permutations and Combinations - NCERT Mathematics',
       'Official NCERT chapter covering the fundamental counting principle, permutations and combinations.',
       'kemh106', 26, array['permutations-and-combinations']::text[]),
      ('Binomial Theorem - NCERT Mathematics',
       'Official NCERT chapter covering binomial expansion for positive integral indices and general terms.',
       'kemh107', 9, array['binomial-theorem']::text[]),
      ('Sequences and Series - NCERT Mathematics',
       'Official NCERT chapter covering arithmetic and geometric progressions, means and special series.',
       'kemh108', 16, array['sequences-and-series']::text[]),
      ('Straight Lines - NCERT Mathematics',
       'Official NCERT chapter covering slope, line equations, angles between lines and distances from lines.',
       'kemh109', 25, array['straight-lines']::text[]),
      ('Conic Sections - NCERT Mathematics',
       'Official NCERT chapter covering circles, parabolas, ellipses and hyperbolas as conic sections.',
       'kemh110', 32, array['circles', 'parabola', 'ellipse', 'hyperbola']::text[]),
      ('Introduction to Three Dimensional Geometry - NCERT Mathematics',
       'Official NCERT chapter covering coordinate axes, octants, distance and section formulae in three dimensions.',
       'kemh111', 9, array['vectors-and-three-dimensional-geometry']::text[]),
      ('Limits and Derivatives - NCERT Mathematics',
       'Official NCERT chapter introducing limits, derivatives and the algebra of derivatives.',
       'kemh112', 40, array['limits-continuity-and-differentiability', 'differentiation']::text[]),
      ('Statistics - NCERT Mathematics Class 11',
       'Official NCERT chapter covering measures of dispersion, range, mean deviation, variance and standard deviation.',
       'kemh113', 32, array['statistics']::text[]),
      ('Probability - NCERT Mathematics Class 11',
       'Official NCERT chapter introducing random experiments, events and the axiomatic approach to probability.',
       'kemh114', 25, array['probability']::text[])
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
        raise exception 'NCERT CLASS 11 MATHEMATICS PREFLIGHT: missing Mathematics chapter %', chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = jee_id
           and board_id is null
           and class_level_id = class_11_id
           and subject_id = mathematics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, jee_id, class_11_id, mathematics_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_11_id
           and subject_id = mathematics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_11_id, mathematics_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kemh1(0[1-9]|1[0-4])[.]pdf$';
  if batch_material_count <> 14 then
    raise exception 'NCERT CLASS 11 MATHEMATICS POSTFLIGHT: expected 14 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/kemh1(0[1-9]|1[0-4])[.]pdf$';
  if batch_scope_count <> 38 then
    raise exception 'NCERT CLASS 11 MATHEMATICS POSTFLIGHT: expected 38 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
