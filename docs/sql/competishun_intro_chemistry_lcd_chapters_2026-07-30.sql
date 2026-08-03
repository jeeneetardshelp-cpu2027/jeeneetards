-- Guarded CREATE-ONLY production artifact for two missing Competishun+ JEE chapters.
-- Owner continuation on 2026-07-30 after reviewed-order dry-runs showed missing chapters only.
do $$
declare
  v_chemistry_id bigint;
  v_mathematics_id bigint;
  v_chemistry_order integer;
  v_mathematics_order integer;
  v_created integer;
begin
  if (select count(*) from public.playlists) <> 227
     or (select count(*) from public.videos) <> 2516
     or (select count(*) from public.playlist_videos) <> 2522
     or (select count(*) from public.chapters) <> 226 then
    raise exception 'catalogue baseline changed before Competishun+ Introduction Chemistry/LCD chapter creation';
  end if;

  select id into v_chemistry_id from public.subjects
  where name = 'Chemistry' and slug = 'chemistry';
  if v_chemistry_id is distinct from 2 then
    raise exception 'expected Chemistry subject id 2, found %', v_chemistry_id;
  end if;

  select id into v_mathematics_id from public.subjects
  where name = 'Mathematics' and slug = 'mathematics';
  if v_mathematics_id is distinct from 3 then
    raise exception 'expected Mathematics subject id 3, found %', v_mathematics_id;
  end if;

  if exists (
    select 1 from public.chapters
    where (subject_id = v_chemistry_id and (name = 'Introduction to Chemistry' or slug = 'introduction-to-chemistry'))
       or (subject_id = v_mathematics_id and (name = 'Limits, Continuity and Differentiability' or slug = 'limits-continuity-and-differentiability'))
  ) then
    raise exception 'one or more target Competishun+ chapters already exists';
  end if;

  select coalesce(max(display_order), 0) into v_chemistry_order
  from public.chapters where subject_id = v_chemistry_id;

  select coalesce(max(display_order), 0) into v_mathematics_order
  from public.chapters where subject_id = v_mathematics_id;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_chemistry_id, 'Introduction to Chemistry', 'introduction-to-chemistry', v_chemistry_order + 1),
    (v_mathematics_id, 'Limits, Continuity and Differentiability', 'limits-continuity-and-differentiability', v_mathematics_order + 1);

  get diagnostics v_created = row_count;
  if v_created <> 2 then
    raise exception 'expected to create 2 Competishun+ chapters, created %', v_created;
  end if;
  if (select count(*) from public.chapters) <> 228 then
    raise exception 'expected 228 total chapters after creation';
  end if;
  if (select count(*) from public.playlists) <> 227
     or (select count(*) from public.videos) <> 2516
     or (select count(*) from public.playlist_videos) <> 2522 then
    raise exception 'content catalogue changed during chapter-only transaction';
  end if;
end $$;
