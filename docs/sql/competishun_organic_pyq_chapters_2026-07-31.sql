-- Guarded CREATE-ONLY production artifact for Competishun+ Organic Chemistry PYQ pilot chapters.
-- Prepared 2026-07-31. Requires owner approval before execution.
do $$
declare
  v_chemistry_id bigint;
  v_display_order integer;
  v_created integer;
begin
  if (select count(*) from public.playlists) <> 230
     or (select count(*) from public.videos) <> 2531
     or (select count(*) from public.playlist_videos) <> 2537
     or (select count(*) from public.chapters) <> 229 then
    raise exception 'catalogue baseline changed before Competishun+ Organic PYQ chapter creation';
  end if;

  select id into v_chemistry_id from public.subjects
  where name = 'Chemistry' and slug = 'chemistry';
  if v_chemistry_id is distinct from 2 then
    raise exception 'expected Chemistry subject id 2, found %', v_chemistry_id;
  end if;

  if exists (
    select 1 from public.chapters
    where subject_id = v_chemistry_id
      and (name in ('Stereoisomerism', 'Polymers', 'Organic Reaction Mechanisms', 'Aromatic Compounds')
        or slug in ('stereoisomerism', 'polymers', 'organic-reaction-mechanisms', 'aromatic-compounds'))
  ) then
    raise exception 'one or more target Competishun+ Organic PYQ chapters already exists';
  end if;

  select coalesce(max(display_order), 0) into v_display_order
  from public.chapters where subject_id = v_chemistry_id;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_chemistry_id, 'Stereoisomerism', 'stereoisomerism', v_display_order + 1),
    (v_chemistry_id, 'Polymers', 'polymers', v_display_order + 2),
    (v_chemistry_id, 'Organic Reaction Mechanisms', 'organic-reaction-mechanisms', v_display_order + 3),
    (v_chemistry_id, 'Aromatic Compounds', 'aromatic-compounds', v_display_order + 4);

  get diagnostics v_created = row_count;
  if v_created <> 4 then
    raise exception 'expected to create 4 Competishun+ Organic PYQ chapters, created %', v_created;
  end if;
  if (select count(*) from public.chapters) <> 233 then
    raise exception 'expected 233 total chapters after creation';
  end if;
  if (select count(*) from public.playlists) <> 230
     or (select count(*) from public.videos) <> 2531
     or (select count(*) from public.playlist_videos) <> 2537 then
    raise exception 'content catalogue changed during chapter-only transaction';
  end if;
end $$;
