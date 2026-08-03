-- Guarded CREATE-ONLY production artifact for five missing JEE Mathematics chapters.
-- Owner-approved on 2026-07-30. Baseline rechecked at 2026-07-30 17:47:51 +05:30.
do $$
declare
  v_subject_id bigint;
  v_display_order integer;
  v_created integer;
begin
  if (select count(*) from public.playlists) <> 220
     or (select count(*) from public.videos) <> 2478
     or (select count(*) from public.playlist_videos) <> 2484
     or (select count(*) from public.chapters) <> 221 then
    raise exception 'catalogue baseline changed before Competishun+ Mathematics chapter creation';
  end if;

  select id into v_subject_id from public.subjects
  where name = 'Mathematics' and slug = 'mathematics';
  if v_subject_id is distinct from 3 then
    raise exception 'expected Mathematics subject id 3, found %', v_subject_id;
  end if;

  if exists (
    select 1 from public.chapters
    where subject_id = v_subject_id
      and (name in ('Indefinite Integration', 'Matrices', 'Applications of Derivatives', 'Modulus and Graphs', 'Fundamentals of Mathematics')
        or slug in ('indefinite-integration', 'matrices', 'applications-of-derivatives', 'modulus-and-graphs', 'fundamentals-of-mathematics'))
  ) then
    raise exception 'one or more target Mathematics chapters already exists';
  end if;

  select coalesce(max(display_order), 0) into v_display_order
  from public.chapters where subject_id = v_subject_id;

  insert into public.chapters (subject_id, name, slug, display_order)
  values
    (v_subject_id, 'Indefinite Integration', 'indefinite-integration', v_display_order + 1),
    (v_subject_id, 'Matrices', 'matrices', v_display_order + 2),
    (v_subject_id, 'Applications of Derivatives', 'applications-of-derivatives', v_display_order + 3),
    (v_subject_id, 'Modulus and Graphs', 'modulus-and-graphs', v_display_order + 4),
    (v_subject_id, 'Fundamentals of Mathematics', 'fundamentals-of-mathematics', v_display_order + 5);

  get diagnostics v_created = row_count;
  if v_created <> 5 then
    raise exception 'expected to create 5 Mathematics chapters, created %', v_created;
  end if;
  if (select count(*) from public.chapters) <> 226 then
    raise exception 'expected 226 total chapters after creation';
  end if;
  if (select count(*) from public.playlists) <> 220
     or (select count(*) from public.videos) <> 2478
     or (select count(*) from public.playlist_videos) <> 2484 then
    raise exception 'content catalogue changed during chapter-only transaction';
  end if;
end $$;
