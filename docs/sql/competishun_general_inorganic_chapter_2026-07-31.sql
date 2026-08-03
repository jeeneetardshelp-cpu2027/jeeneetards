-- Guarded CREATE-ONLY production artifact for the missing Competishun+ JEE Chemistry chapter.
-- Continuation on 2026-07-31 after live channel audit found the remaining complete-chapter lecture playlist.
do $$
declare
  v_chemistry_id bigint;
  v_display_order integer;
  v_created integer;
begin
  if (select count(*) from public.playlists) <> 229
     or (select count(*) from public.videos) <> 2528
     or (select count(*) from public.playlist_videos) <> 2534
     or (select count(*) from public.chapters) <> 228 then
    raise exception 'catalogue baseline changed before Competishun+ General Inorganic Chemistry chapter creation';
  end if;

  select id into v_chemistry_id from public.subjects
  where name = 'Chemistry' and slug = 'chemistry';
  if v_chemistry_id is distinct from 2 then
    raise exception 'expected Chemistry subject id 2, found %', v_chemistry_id;
  end if;

  if exists (
    select 1 from public.chapters
    where subject_id = v_chemistry_id
      and (name = 'General Inorganic Chemistry' or slug = 'general-inorganic-chemistry')
  ) then
    raise exception 'target Competishun+ General Inorganic Chemistry chapter already exists';
  end if;

  select coalesce(max(display_order), 0) into v_display_order
  from public.chapters where subject_id = v_chemistry_id;

  insert into public.chapters (subject_id, name, slug, display_order)
  values (v_chemistry_id, 'General Inorganic Chemistry', 'general-inorganic-chemistry', v_display_order + 1);

  get diagnostics v_created = row_count;
  if v_created <> 1 then
    raise exception 'expected to create 1 Competishun+ chapter, created %', v_created;
  end if;
  if (select count(*) from public.chapters) <> 229 then
    raise exception 'expected 229 total chapters after creation';
  end if;
  if (select count(*) from public.playlists) <> 229
     or (select count(*) from public.videos) <> 2528
     or (select count(*) from public.playlist_videos) <> 2534 then
    raise exception 'content catalogue changed during chapter-only transaction';
  end if;
end $$;
