-- Backfill the per-video taxonomy junctions from course membership.
--
-- THE BUG THIS FIXES (live, user-visible, measured on production 2026-08-03):
-- 670 of 3,088 lessons (21.7%) have no row in video_learning_goals at all.
-- src/useScopedSearch.js builds its lecture query with
--     .select("... video_learning_goals!inner(learning_goal_id)")
--     .eq("video_learning_goals.learning_goal_id", goalId)
-- and `!inner` is an INNER JOIN, so a lesson with no junction row can never be
-- returned by a goal-scoped search no matter what a student types.
--
-- Reproduced against production: searching Biology for "Living" matches 12
-- lessons by title, but only 6 survive the NEET-scoped query. The 6 hidden ones
-- include "The Living World Class 11 Biology NEET Concepts (L 1)" -- a lesson
-- whose own title says NEET.
--
-- CAUSE: three import migrations populated the COURSE-level junctions
-- (playlist_learning_goals / playlist_class_levels) but never the per-video
-- ones -- catalogue_depth_2026-07-30.sql and the ten
-- biology_class11_{aakash,allen}_neet_part*_2026-07-31.sql files. The affected
-- lessons are exactly those imports: Biology 466, Physics 153, Chemistry 51.
-- Later imports (competishun_*, the six mohit_tyagi_*_2026-08-03 files) do
-- populate both, which is why the gap is not catalogue-wide.
--
-- WHY THIS IS SAFE: nothing is invented. Every value is copied from the course
-- the lesson already belongs to, and rows are added ONLY for lessons that have
-- no entry in that junction at all -- so a per-video override deliberately set
-- through set_managed_video_taxonomy (catalog_management_v11) is never touched.
-- Measured before writing this file: all 670 goal-less and all 710 class-less
-- lessons sit in a course that carries the value, so nothing is left behind and
-- nothing has to be guessed.
--
-- Expected effect on today's catalogue: +670 video_learning_goals rows
-- (2418 -> 3088) and +1728 video_class_levels rows (4296 -> 6024). Those totals
-- are NOT asserted, because this file is deliberately order-independent with
-- respect to the six mohit_tyagi_*_2026-08-03 imports; the invariant below is
-- what is asserted instead.
--
-- Safe to re-run: the second run inserts nothing and still passes.
do $$
declare
  v_goal_rows integer;
  v_class_rows integer;
  v_goal_left integer;
  v_class_left integer;
begin
  insert into public.video_learning_goals (video_id, learning_goal_id)
  select distinct pv.video_id, plg.learning_goal_id
  from public.playlist_videos pv
  join public.playlist_learning_goals plg on plg.playlist_id = pv.playlist_id
  where not exists (
    select 1 from public.video_learning_goals vlg where vlg.video_id = pv.video_id
  )
  on conflict do nothing;
  get diagnostics v_goal_rows = row_count;

  insert into public.video_class_levels (video_id, class_level_id)
  select distinct pv.video_id, pcl.class_level_id
  from public.playlist_videos pv
  join public.playlist_class_levels pcl on pcl.playlist_id = pv.playlist_id
  where not exists (
    select 1 from public.video_class_levels vcl where vcl.video_id = pv.video_id
  )
  on conflict do nothing;
  get diagnostics v_class_rows = row_count;

  -- The real assertion: no lesson may be left without a goal (or class level)
  -- while the course it belongs to has one. That is exactly the condition that
  -- made lessons invisible to goal-scoped search.
  select count(*) into v_goal_left
  from public.videos v
  where not exists (select 1 from public.video_learning_goals g where g.video_id = v.id)
    and exists (
      select 1 from public.playlist_videos pv
      join public.playlist_learning_goals plg on plg.playlist_id = pv.playlist_id
      where pv.video_id = v.id
    );

  select count(*) into v_class_left
  from public.videos v
  where not exists (select 1 from public.video_class_levels c where c.video_id = v.id)
    and exists (
      select 1 from public.playlist_videos pv
      join public.playlist_class_levels pcl on pcl.playlist_id = pv.playlist_id
      where pv.video_id = v.id
    );

  if v_goal_left <> 0 then
    raise exception 'backfill incomplete: % lesson(s) still have no learning goal despite their course having one', v_goal_left;
  end if;
  if v_class_left <> 0 then
    raise exception 'backfill incomplete: % lesson(s) still have no class level despite their course having one', v_class_left;
  end if;

  -- No lesson may have picked up a goal its own course does not carry.
  -- This checks the WHOLE table, not just the rows inserted above, so it also
  -- assumes no deliberate per-video override diverges from its course. Verified
  -- true on production before shipping this file: 0 of 2,418 existing
  -- video_learning_goals rows and 0 of 4,296 video_class_levels rows diverge.
  -- If a future curator sets a genuine per-video override that differs, this
  -- assertion is what will (correctly, loudly) tell you this file is stale.
  if exists (
    select 1
    from public.video_learning_goals vlg
    where not exists (
      select 1 from public.playlist_videos pv
      join public.playlist_learning_goals plg
        on plg.playlist_id = pv.playlist_id
       and plg.learning_goal_id = vlg.learning_goal_id
      where pv.video_id = vlg.video_id
    )
  ) then
    raise exception 'a lesson carries a learning goal none of its courses has - refusing to leave invented taxonomy behind';
  end if;

  raise notice 'backfilled % learning-goal rows and % class-level rows', v_goal_rows, v_class_rows;
end $$;
