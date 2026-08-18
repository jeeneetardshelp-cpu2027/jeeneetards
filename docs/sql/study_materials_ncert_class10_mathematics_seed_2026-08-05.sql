-- Complete current rationalised NCERT Class 10 Mathematics chapter set (English).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and each CBSE Class 10 scope is inserted once.

begin;

do $$
declare
  resource record;
  target_material_id bigint;
  target_chapter_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_10_id bigint;
  mathematics_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_10_id from public.class_levels where slug = 'class-10';
  select id into mathematics_id from public.subjects where slug = 'mathematics';

  if school_id is null or cbse_id is null or class_10_id is null
     or mathematics_id is null then
    raise exception 'NCERT CLASS 10 MATHEMATICS PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('Real Numbers - NCERT Mathematics',
       'Official NCERT chapter covering the Fundamental Theorem of Arithmetic and irrational numbers.',
       'jemh101', 9, 'real-numbers'),
      ('Polynomials - NCERT Mathematics',
       'Official NCERT chapter covering polynomial zeroes, their graphical meaning and relationships with coefficients.',
       'jemh102', 14, 'polynomials'),
      ('Pair of Linear Equations in Two Variables - NCERT Mathematics',
       'Official NCERT chapter covering graphical, substitution and elimination methods for pairs of linear equations.',
       'jemh103', 14, 'pair-of-linear-equations-in-two-variables'),
      ('Quadratic Equations - NCERT Mathematics',
       'Official NCERT chapter covering quadratic equations, factorisation, roots and the nature of roots.',
       'jemh104', 11, 'quadratic-equations'),
      ('Arithmetic Progressions - NCERT Mathematics',
       'Official NCERT chapter covering arithmetic progressions, the nth term and sums of finite arithmetic series.',
       'jemh105', 24, 'arithmetic-progressions'),
      ('Triangles - NCERT Mathematics',
       'Official NCERT chapter covering similar figures, triangle similarity and criteria for similarity.',
       'jemh106', 26, 'triangles'),
      ('Coordinate Geometry - NCERT Mathematics',
       'Official NCERT chapter covering the distance formula and section formula in coordinate geometry.',
       'jemh107', 14, 'coordinate-geometry'),
      ('Introduction to Trigonometry - NCERT Mathematics',
       'Official NCERT chapter covering trigonometric ratios, standard angles and trigonometric identities.',
       'jemh108', 20, 'introduction-to-trigonometry'),
      ('Some Applications of Trigonometry - NCERT Mathematics',
       'Official NCERT chapter applying trigonometry to heights, distances and angle-of-elevation problems.',
       'jemh109', 11, 'some-applications-of-trigonometry'),
      ('Circles - NCERT Mathematics',
       'Official NCERT chapter covering tangents to circles and the number of tangents from an external point.',
       'jemh110', 10, 'circles'),
      ('Areas Related to Circles - NCERT Mathematics',
       'Official NCERT chapter covering the areas of sectors and segments of circles.',
       'jemh111', 7, 'areas-related-to-circles'),
      ('Surface Areas and Volumes - NCERT Mathematics',
       'Official NCERT chapter covering surface areas and volumes of combinations of solid shapes.',
       'jemh112', 10, 'surface-areas-and-volumes'),
      ('Statistics - NCERT Mathematics',
       'Official NCERT chapter covering the mean, mode and median of grouped data.',
       'jemh113', 31, 'statistics'),
      ('Probability - NCERT Mathematics',
       'Official NCERT chapter introducing the theoretical approach to probability.',
       'jemh114', 16, 'probability')
    ) as seeded(title, description, source_code, page_count, chapter_slug)
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

    select id into target_chapter_id
      from public.chapters
     where subject_id = mathematics_id
       and slug = resource.chapter_slug;

    if target_chapter_id is null then
      raise exception 'NCERT CLASS 10 MATHEMATICS PREFLIGHT: missing Mathematics chapter %', resource.chapter_slug;
    end if;

    if not exists (
      select 1 from public.study_material_scopes
       where material_id = target_material_id
         and learning_goal_id = school_id
         and board_id = cbse_id
         and class_level_id = class_10_id
         and subject_id = mathematics_id
         and chapter_id = target_chapter_id
    ) then
      insert into public.study_material_scopes (
        material_id, learning_goal_id, board_id,
        class_level_id, subject_id, chapter_id
      ) values (
        target_material_id, school_id, cbse_id,
        class_10_id, mathematics_id, target_chapter_id
      );
    end if;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jemh1(0[1-9]|1[0-4])[.]pdf$';
  if batch_material_count <> 14 then
    raise exception 'NCERT CLASS 10 MATHEMATICS POSTFLIGHT: expected 14 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/jemh1(0[1-9]|1[0-4])[.]pdf$';
  if batch_scope_count <> 14 then
    raise exception 'NCERT CLASS 10 MATHEMATICS POSTFLIGHT: expected 14 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
