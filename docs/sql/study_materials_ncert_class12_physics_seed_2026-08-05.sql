-- Complete reviewed NCERT Class 12 Physics chapter set (English, 2026-27).
-- Every file stays on ncert.nic.in; JEENEETARD stores links and metadata only.
-- Safe to rerun: materials are upserted and scope rows are inserted once.

begin;

do $$
declare
  resource record;
  chapter_slug text;
  target_material_id bigint;
  target_chapter_id bigint;
  jee_id bigint;
  neet_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_12_id bigint;
  physics_id bigint;
  batch_material_count integer;
  batch_scope_count integer;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_12_id from public.class_levels where slug = 'class-12';
  select id into physics_id from public.subjects where slug = 'physics';

  if jee_id is null or neet_id is null or school_id is null
     or cbse_id is null or class_12_id is null or physics_id is null then
    raise exception 'NCERT CLASS 12 PHYSICS PREFLIGHT: required curriculum row is missing';
  end if;

  for resource in
    select * from (values
      ('Electric Charges and Fields - NCERT Physics',
       'Official NCERT chapter covering electric charge, Coulomb''s law, electric fields, flux and Gauss''s law.',
       'leph101', 44, array['electrostatics']::text[]),
      ('Electrostatic Potential and Capacitance - NCERT Physics',
       'Official NCERT chapter covering electric potential, potential energy, conductors, dielectrics and capacitors.',
       'leph102', 36, array['electrostatics', 'capacitance']::text[]),
      ('Current Electricity - NCERT Physics',
       'Official NCERT chapter covering electric current, resistance, cells, Kirchhoff''s rules and bridge circuits.',
       'leph103', 26, array['current-electricity']::text[]),
      ('Moving Charges and Magnetism - NCERT Physics',
       'Official NCERT chapter covering magnetic forces, motion in magnetic fields, current loops and galvanometers.',
       'leph104', 29, array['moving-charges-and-magnetism']::text[]),
      ('Magnetism and Matter - NCERT Physics',
       'Official NCERT chapter covering bar magnets, magnetic properties of materials and the Earth''s magnetism.',
       'leph105', 18, array['magnetism-and-matter']::text[]),
      ('Electromagnetic Induction - NCERT Physics',
       'Official NCERT chapter covering Faraday''s law, Lenz''s law, motional emf, inductance and generators.',
       'leph106', 23, array['electromagnetic-induction']::text[]),
      ('Alternating Current - NCERT Physics',
       'Official NCERT chapter covering AC circuits, phasors, resonance, power and transformers.',
       'leph107', 24, array['alternating-current']::text[]),
      ('Electromagnetic Waves - NCERT Physics',
       'Official NCERT chapter covering displacement current, electromagnetic waves and the electromagnetic spectrum.',
       'leph108', 14, array['electromagnetic-waves']::text[]),
      ('Ray Optics and Optical Instruments - NCERT Physics',
       'Official NCERT chapter covering reflection, refraction, lenses, prisms and optical instruments.',
       'leph201', 34, array['ray-optics-and-optical-instruments']::text[]),
      ('Wave Optics - NCERT Physics',
       'Official NCERT chapter covering wavefronts, interference, diffraction and polarisation.',
       'leph202', 19, array['wave-optics']::text[]),
      ('Dual Nature of Radiation and Matter - NCERT Physics',
       'Official NCERT chapter covering the photoelectric effect, photon theory and the wave nature of matter.',
       'leph203', 16, array['dual-nature-of-radiation-and-matter', 'modern-physics']::text[]),
      ('Atoms - NCERT Physics',
       'Official NCERT chapter covering atomic models, line spectra and the Bohr model of hydrogen.',
       'leph204', 16, array['atoms', 'modern-physics']::text[]),
      ('Nuclei - NCERT Physics',
       'Official NCERT chapter covering nuclear composition, binding energy, radioactivity, fission and fusion.',
       'leph205', 17, array['modern-physics']::text[]),
      ('Semiconductor Electronics - NCERT Physics',
       'Official NCERT chapter covering semiconductor materials, diodes, rectifiers and digital electronics.',
       'leph206', 21, array['semiconductor-electronics', 'modern-physics']::text[])
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
       where subject_id = physics_id
         and slug = chapter_slug;

      if target_chapter_id is null then
        raise exception 'NCERT CLASS 12 PHYSICS PREFLIGHT: missing Physics chapter %', chapter_slug;
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = jee_id
           and board_id is null
           and class_level_id = class_12_id
           and subject_id = physics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, jee_id, class_12_id, physics_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = neet_id
           and board_id is null
           and class_level_id = class_12_id
           and subject_id = physics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, neet_id, class_12_id, physics_id, target_chapter_id
        );
      end if;

      if not exists (
        select 1 from public.study_material_scopes
         where material_id = target_material_id
           and learning_goal_id = school_id
           and board_id = cbse_id
           and class_level_id = class_12_id
           and subject_id = physics_id
           and chapter_id = target_chapter_id
      ) then
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id,
          class_level_id, subject_id, chapter_id
        ) values (
          target_material_id, school_id, cbse_id,
          class_12_id, physics_id, target_chapter_id
        );
      end if;
    end loop;
  end loop;

  select count(*)::integer into batch_material_count
    from public.study_materials
   where source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/leph(1|2)[0-9]{2}[.]pdf$';
  if batch_material_count <> 14 then
    raise exception 'NCERT CLASS 12 PHYSICS POSTFLIGHT: expected 14 materials, found %', batch_material_count;
  end if;

  select count(*)::integer into batch_scope_count
    from public.study_material_scopes s
    join public.study_materials m on m.id = s.material_id
   where m.source_url ~ '^https://ncert[.]nic[.]in/textbook/pdf/leph(1|2)[0-9]{2}[.]pdf$';
  if batch_scope_count <> 54 then
    raise exception 'NCERT CLASS 12 PHYSICS POSTFLIGHT: expected 54 scopes, found %', batch_scope_count;
  end if;
end $$;

commit;
