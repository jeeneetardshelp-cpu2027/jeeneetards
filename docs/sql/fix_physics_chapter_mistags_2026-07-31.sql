-- fix_physics_chapter_mistags_2026-07-31.sql
--
-- Three real NEET Class-11 Physics chapters are completely absent from browse,
-- even though the catalogue holds full-chapter videos for all three. Six videos
-- that are explicitly single-chapter one-shots were filed under a NEIGHBOURING
-- chapter, and browse derives its chapter list from videos.chapter_id -- so a
-- NEET student sees no "Units and Measurements", no "Friction" and no "Kinetic
-- Theory of Gases" at all, and concludes the site has nothing on them.
-- Audit finding, 31 July 2026 (docs/audit_2026-07-31.md).
--
-- INDEPENDENTLY VERIFIED against live production before writing this, because
-- the finding came from the audit's un-verified bucket and this project has
-- been burned before by false positives in chapter-coverage analysis:
--   * chapters 28 (Units and Measurements, order 2), 7 (Friction, order 6) and
--     275 (Kinetic Theory of Gases, order 15) all exist in subject Physics at
--     their correct syllabus positions, and all three are genuine Class-11
--     NEET topics;
--   * the live NEET/class-11/Physics view reaches 23 chapters and none of them
--     is 28, 7 or 275;
--   * each video's own source_title states single-chapter scope, e.g.
--     "FRICTION in 56 Minutes | FULL Chapter For NEET",
--     "UNITS AND MEASUREMENT - Complete Chapter in One Video",
--     "KINETIC THEORY OF GASES in 51 Minutes | FULL Chapter For NEET";
--   * decisively, in each of these courses EVERY OTHER lesson already maps to
--     its own dedicated chapter (Vectors -> Basic Mathematics, Projectile ->
--     Kinematics, Gravitation -> Gravitation, ...). The only exceptions are the
--     six below, which is the signature of an import mapping miss rather than a
--     deliberate curation choice.
--
-- DELIBERATELY NOT CHANGED (checked, and correct as they stand):
--   * v2122 "Live Practice Session: Laws of Motion, Work-Energy-Power &
--     Circular Motion" has chapter_id NULL. A separate audit note called that a
--     defect. It is not: the video genuinely spans three chapters, and NULL is
--     this project's own established convention for exactly that case (see the
--     catalogue_depth_2026-07-30 note about a video shared across three courses
--     ending up NULL as "the honest answer for a video with no single correct
--     chapter"). Inventing one chapter for it would be the actual violation.
--   * v1504 / v1505 / v1560 each name TWO chapters in their own titles
--     ("Electromagnetic Waves and Alternating Current in One Shot", etc.).
--     There is no single right answer, so they keep the chapter curation gave
--     them.
--   * v1500 "Dual Nature of Radiation and Matter in One Shot" sits under
--     Modern Physics -- but so does its sibling "Atoms and Nuclei in One Shot"
--     in the same course, so that course consistently uses Modern Physics as
--     the umbrella. Splitting one out would make it inconsistent, and both
--     chapters 18 and 19 are already well populated, so nothing vanishes.
--   * v2138 "Friction" sits inside course 184 whose other ten lessons are all
--     one continuous Newton's-Laws lecture series. Retagging a single lecture
--     out of a coherent series is a curation judgement, not a clear defect.
--
-- Each update below applies ONLY if the row is still in the exact known-wrong
-- state, and raises rather than guessing if someone has changed it since.
-- Idempotent; safe to re-run.

begin;

do $retag$
declare
  r record;
  v_current bigint;
  v_fixed int := 0;
begin
  for r in
    select * from (values
      -- video, wrong chapter (as found), correct chapter, why
      (1539, 80, 28, 'Units and Measurement — One Shot (Concepts + PYQs)'),
      (1556, 80, 28, 'Units and Measurements — Question Practice & Concepts'),
      (1590, 80, 28, 'Units and Measurement in 81 Minutes — Full Chapter'),
      (1546, 82,  7, 'Friction — One Shot (Concepts + PYQs)'),
      (1595, 82,  7, 'Friction in 56 Minutes — Full Chapter'),
      (1603, 23, 275, 'Kinetic Theory of Gases in 51 Minutes — Full Chapter')
    ) as t(video_id, wrong_chapter, right_chapter, label)
  loop
    select chapter_id into v_current from public.videos where id = r.video_id;

    if v_current is null then
      raise exception 'video % (%) not found', r.video_id, r.label;
    elsif v_current = r.right_chapter then
      null;  -- already fixed, safe re-run
    elsif v_current <> r.wrong_chapter then
      raise exception
        'video % (%) is on chapter %, expected the known-wrong % or the already-fixed % — someone retagged it, refusing to overwrite',
        r.video_id, r.label, v_current, r.wrong_chapter, r.right_chapter;
    else
      update public.videos set chapter_id = r.right_chapter, updated_at = now()
       where id = r.video_id;
      v_fixed := v_fixed + 1;
    end if;
  end loop;

  raise notice 'retagged % video(s)', v_fixed;
end
$retag$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_bad int;
  v_missing text;
begin
  select count(*) into v_bad from public.videos
   where (id in (1539, 1556, 1590) and chapter_id is distinct from 28)
      or (id in (1546, 1595)       and chapter_id is distinct from 7)
      or (id = 1603                and chapter_id is distinct from 275);
  if v_bad <> 0 then
    raise exception '% video(s) did not end up on the intended chapter', v_bad;
  end if;

  -- The point of the exercise: all three chapters must now be reachable for a
  -- NEET class-11 Physics student, i.e. at least one video in a NEET +
  -- class-11 + Physics course points at each.
  select string_agg(c.name, '; ') into v_missing
    from public.chapters c
   where c.id in (28, 7, 275)
     and not exists (
       select 1
         from public.playlist_videos pv
         join public.videos v   on v.id = pv.video_id
         join public.playlists p on p.id = pv.playlist_id
         join public.playlist_learning_goals plg on plg.playlist_id = p.id
         join public.learning_goals lg on lg.id = plg.learning_goal_id
         join public.playlist_class_levels pcl on pcl.playlist_id = p.id
         join public.class_levels cl on cl.id = pcl.class_level_id
        where v.chapter_id = c.id
          and p.subject_id = 1
          and lg.slug = 'neet'
          and cl.slug = 'class-11'
     );
  if v_missing is not null then
    raise exception 'still unreachable in NEET class-11 Physics browse: %', v_missing;
  end if;

  raise notice 'SELF-TEST PASSED: 6 videos retagged; Units and Measurements, Friction and Kinetic Theory of Gases are all reachable in NEET class-11 Physics browse.';
end
$verify$;

commit;
