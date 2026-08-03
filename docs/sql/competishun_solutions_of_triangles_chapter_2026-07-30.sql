-- CREATE-ONLY production artifact for the missing JEE Mathematics chapter.
-- Guard baseline recorded immediately before execution on 2026-07-30.
do $$
declare
  v_display_order integer;
begin
  if (select count(*) from public.playlists) <> 199
     or (select count(*) from public.videos) <> 2365
     or (select count(*) from public.playlist_videos) <> 2371
     or (select count(*) from public.chapters) <> 220 then
    raise exception 'catalogue baseline changed before Solutions of Triangles chapter creation';
  end if;

  if exists (
    select 1
    from public.chapters
    where subject_id = 3
      and (name = 'Solutions of Triangles' or slug = 'solutions-of-triangles')
  ) then
    raise exception 'Solutions of Triangles chapter already exists';
  end if;

  select coalesce(max(display_order), 0) + 1
  into v_display_order
  from public.chapters
  where subject_id = 3;

  insert into public.chapters (name, slug, subject_id, display_order)
  values ('Solutions of Triangles', 'solutions-of-triangles', 3, v_display_order);
end $$;
