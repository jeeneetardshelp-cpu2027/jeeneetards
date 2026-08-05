-- First reviewed study-material resource.
-- Prepared for production, but apply only after the study-materials v1 schema.
-- Links to NCERT's own HTTPS PDF; JEENEETARD does not copy or host the file.

begin;

do $$
declare
  target_material_id bigint;
  jee_id bigint;
  neet_id bigint;
  school_id bigint;
  cbse_id bigint;
  class_11_id bigint;
  physics_id bigint;
  kinematics_id bigint;
begin
  select id into jee_id from public.learning_goals where slug = 'jee';
  select id into neet_id from public.learning_goals where slug = 'neet';
  select id into school_id from public.learning_goals where slug = 'school';
  select id into cbse_id from public.boards where slug = 'cbse';
  select id into class_11_id from public.class_levels where slug = 'class-11';
  select id into physics_id from public.subjects where slug = 'physics';
  select id into kinematics_id
    from public.chapters
   where slug = 'kinematics'
     and subject_id = physics_id;

  if jee_id is null or neet_id is null or school_id is null
     or cbse_id is null or class_11_id is null or physics_id is null
     or kinematics_id is null then
    raise exception 'NCERT KINEMATICS MATERIAL PREFLIGHT: required curriculum row is missing';
  end if;

  insert into public.study_materials (
    title, description, material_type, source_name, source_url,
    file_format, language, page_count, is_downloadable,
    rights_status, rights_note, review_status, published_at
  ) values (
    'Motion in a Straight Line — NCERT Physics',
    'Official NCERT Class 11 Physics chapter covering velocity, acceleration, graphs, uniformly accelerated motion and relative velocity.',
    'full_notes',
    'NCERT',
    'https://ncert.nic.in/textbook/pdf/keph102.pdf',
    'pdf',
    'English',
    14,
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

  if not exists (
    select 1 from public.study_material_scopes
     where study_material_scopes.material_id = target_material_id
       and learning_goal_id = jee_id
       and board_id is null
       and class_level_id = class_11_id
       and subject_id = physics_id
       and chapter_id = kinematics_id
  ) then
    insert into public.study_material_scopes (
      material_id, learning_goal_id, class_level_id, subject_id, chapter_id
    ) values (target_material_id, jee_id, class_11_id, physics_id, kinematics_id);
  end if;

  if not exists (
    select 1 from public.study_material_scopes
     where study_material_scopes.material_id = target_material_id
       and learning_goal_id = neet_id
       and board_id is null
       and class_level_id = class_11_id
       and subject_id = physics_id
       and chapter_id = kinematics_id
  ) then
    insert into public.study_material_scopes (
      material_id, learning_goal_id, class_level_id, subject_id, chapter_id
    ) values (target_material_id, neet_id, class_11_id, physics_id, kinematics_id);
  end if;

  if not exists (
    select 1 from public.study_material_scopes
     where study_material_scopes.material_id = target_material_id
       and learning_goal_id = school_id
       and board_id = cbse_id
       and class_level_id = class_11_id
       and subject_id = physics_id
       and chapter_id = kinematics_id
  ) then
    insert into public.study_material_scopes (
      material_id, learning_goal_id, board_id,
      class_level_id, subject_id, chapter_id
    ) values (
      target_material_id, school_id, cbse_id,
      class_11_id, physics_id, kinematics_id
    );
  end if;
end $$;

commit;
