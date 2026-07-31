-- biology_class11_diversity_extend_class12_dropper_2026-07-31.sql
--
-- The 41 Biology courses added this session (Aakash NEET + ALLEN NEET,
-- biology_class11_{aakash,allen}_neet_part*_2026-07-31.sql) were tagged
-- class_level=class-11 only. This site's Biology chapter taxonomy does not
-- split chapters by class (confirmed earlier this session), and its
-- EXISTING Competition Wallah courses are already commonly tagged across
-- all three class levels at once (playlist_class_levels is a many-to-many
-- join, e.g. course 121 "Complete NEET BOTANY - Mindmap Series" already
-- carries class-11 + class-12 + dropper) -- reflecting how NEET Biology is
-- actually studied as one continuous two-year syllabus. Without this, the
-- diversity work only reached Class 11; Class 12 and Dropper Biology
-- students still saw only Competition Wallah for all 31-32 chapters.
--
-- Purely additive: no new videos, no new courses -- just extends the
-- SAME 41 already-imported courses with 2 more class-level links each.
-- Idempotent (guarded by NOT EXISTS, safe to re-run).

begin;

do $$
declare
  v_class12_id bigint;
  v_dropper_id bigint;
begin
  select id into v_class12_id from public.class_levels where slug = 'class-12';
  select id into v_dropper_id from public.class_levels where slug = 'dropper';
  if v_class12_id is null then raise exception 'class-12 class_level not found'; end if;
  if v_dropper_id is null then raise exception 'dropper class_level not found'; end if;

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select pl.id, v_class12_id
    from public.playlists pl
   where pl.id in (249, 250, 251, 252, 253, 254, 255, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292)
     and not exists (
       select 1 from public.playlist_class_levels x
        where x.playlist_id = pl.id and x.class_level_id = v_class12_id
     );

  insert into public.playlist_class_levels (playlist_id, class_level_id)
  select pl.id, v_dropper_id
    from public.playlists pl
   where pl.id in (249, 250, 251, 252, 253, 254, 255, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292)
     and not exists (
       select 1 from public.playlist_class_levels x
        where x.playlist_id = pl.id and x.class_level_id = v_dropper_id
     );
end
$$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  v_missing_12 int;
  v_missing_dropper int;
  v_course_count int;
begin
  select count(*) into v_course_count from public.playlists where id in (249, 250, 251, 252, 253, 254, 255, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292);
  if v_course_count <> 41 then
    raise exception 'expected all 41 target courses to still exist, found %', v_course_count;
  end if;

  select count(*) into v_missing_12
    from public.playlists pl
   where pl.id in (249, 250, 251, 252, 253, 254, 255, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292)
     and not exists (
       select 1 from public.playlist_class_levels x
       join public.class_levels cl on cl.id = x.class_level_id
      where x.playlist_id = pl.id and cl.slug = 'class-12'
     );
  select count(*) into v_missing_dropper
    from public.playlists pl
   where pl.id in (249, 250, 251, 252, 253, 254, 255, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292)
     and not exists (
       select 1 from public.playlist_class_levels x
       join public.class_levels cl on cl.id = x.class_level_id
      where x.playlist_id = pl.id and cl.slug = 'dropper'
     );
  if v_missing_12 <> 0 or v_missing_dropper <> 0 then
    raise exception '% course(s) missing a class-12 link, % course(s) missing a dropper link', v_missing_12, v_missing_dropper;
  end if;

  raise notice 'SELF-TEST PASSED: all 41 Biology diversity courses now also linked to class-12 and dropper.';
end
$$;

commit;
