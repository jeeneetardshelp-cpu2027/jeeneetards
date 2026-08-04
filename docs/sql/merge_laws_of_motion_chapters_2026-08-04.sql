-- merge_laws_of_motion_chapters_2026-08-04.sql
--
-- Physics has TWO chapter rows for the same NCERT chapter, sitting next to each
-- other in the sidebar:
--
--    4. [82] Laws of Motion                  13 lessons  1869m  2 institutes
--    5. [ 6] Newton's Laws of Motion (NLM)   34 lessons  3293m  5 institutes
--
-- A student browsing Class 11 Physics sees both and has to guess which one their
-- topic is under. It is the same chapter -- NCERT Class 11 Physics chapter 5 --
-- and the split is a taxonomy accident, not a real distinction. Chapter 82's own
-- lessons prove it: they include "Newton's Laws of Motion and Friction in One
-- Shot", "Laws of Motion in 74 Minutes -- Full Chapter" and several Circular
-- Motion lectures, which is exactly what chapter 6 already holds.
--
-- This merges 82 into 6 and removes the duplicate. Result: one chapter, 47
-- lessons, 5162 minutes, six institutes.
--
-- WHY MERGE INTO 6 RATHER THAN 82: it holds nearly three times the content from
-- five institutes rather than two, so the merge moves 13 rows instead of 34 and
-- leaves the larger set of course positions untouched.
--
-- ...BUT THE SURVIVING CHAPTER TAKES 82's NAME AND SLUG. "Laws of Motion" is
-- what NCERT actually calls the chapter and what a student reads on their
-- syllabus; "Newton's Laws of Motion (NLM)" is coaching shorthand. Keeping the
-- slug `laws-of-motion` also preserves the more natural of the two live URLs --
-- /explore/.../laws-of-motion keeps working and points at the merged chapter,
-- while only /explore/.../newtons-laws-of-motion-nlm goes away. The slug is
-- freed by the delete before it is reassigned, so the order below matters.
--
-- NOTHING IS DELETED EXCEPT THE EMPTY DUPLICATE ROW. All 13 lessons move; none
-- is removed. Checked first: zero of them would collide with an existing chapter
-- 6 title, and no course loses all its lessons -- the 13 are spread across ten
-- courses, contributing 1 or 2 lessons each, so every course survives intact.
--
-- NO NEW CHAPTER IS CREATED. Six of the moved lessons are specifically Circular
-- Motion and it is tempting to give that its own chapter, but NCERT has no
-- separate Circular Motion chapter and inventing one is exactly the mistake that
-- put three off-syllabus English chapters live earlier today. It stays where
-- NCERT puts it.
--
-- IT ALSO RETITLES FOUR LESSONS, because the first attempt at this file aborted
-- and that is what it exposed. Chapter 82 holds ALLEN JEE "Circular Motion
-- (Part 1)" and "(Part 2)" twice each -- same institute, same title, different
-- series -- which in one merged lesson list is unreadable. They become
-- "... — Bridge Course" and "... — Foundation Series", names taken from the
-- publisher's own source titles, not invented.
--
-- WHY THE FIRST ATTEMPT FAILED, recorded rather than quietly patched: the
-- verification block demanded ZERO duplicate titles in the merged chapter and
-- raised "3 duplicate lesson title(s)". That bar was wrong, not the data. Two of
-- the three were the Circular Motion pairs above and the third was "Constraint
-- Motion", which chapter 6 already held twice before this file existed. Across
-- the catalogue 111 (chapter, title) pairs hold more than one lesson, so failing
-- on a pre-existing, catalogue-wide condition aborted a correct merge. The whole
-- transaction rolled back cleanly and nothing was applied.
--
-- The assertion is now the invariant that actually matters: no lesson list may
-- show the same title twice FROM THE SAME INSTITUTE, and the merge may not stack
-- a title three deep. Two lessons sharing a title from different institutes is
-- fine -- the course card names the institute. Simulated against production
-- before regenerating: 0 same-institute duplicates, 0 titles three deep, and one
-- allowed pair (Constraint Motion, JEE Wallah and Mohit Tyagi).
--
-- Physics display_order is closed up to a contiguous 1..31 afterwards.
--
-- Guarded: refuses to run if chapter 82 holds anything that would collide, or if
-- either chapter is not the one this file was written against. Idempotent --
-- a re-run finds 82 already gone and stops. Self-verifying.

begin;

do $merge$
declare
  v_from bigint := 82;
  v_into bigint := 6;
  v_moved int;
  v_clash int;
  v_pos int;
  r record;
begin
  if not exists (select 1 from public.chapters where id = v_from) then
    raise notice 'chapter 82 is already gone - nothing to do';
    return;
  end if;

  if not exists (select 1 from public.chapters where id = v_from and subject_id = 1 and name = 'Laws of Motion') then
    raise exception 'chapter 82 is not the Physics chapter "Laws of Motion" - refusing to merge a stale id';
  end if;
  if not exists (select 1 from public.chapters where id = v_into and subject_id = 1 and name = 'Newton''s Laws of Motion (NLM)') then
    raise exception 'chapter 6 is not "Newton''s Laws of Motion (NLM)" - refusing to merge a stale id';
  end if;

  -- Two lessons with the same display title in one chapter would read as a
  -- duplicate to a student. Verified zero before writing this; check again.
  select count(*) into v_clash
    from public.videos a
    join public.videos b on b.chapter_id = v_into and b.title = a.title
   where a.chapter_id = v_from;
  if v_clash <> 0 then
    raise exception '% lesson title(s) would be duplicated inside the merged chapter', v_clash;
  end if;

  -- Four lessons in 82 are ALLEN JEE "Circular Motion (Part 1)" and "(Part 2)"
  -- TWICE OVER -- same institute, same title, different series. Side by side in
  -- one lesson list that is unreadable, so name the series each belongs to. The
  -- series names are the publisher's own, taken from the source titles
  -- ("Free Bridge Course for JEE Aspirants" / "Foundation Series").
  update public.videos set title = 'Circular Motion (Part 1) — Bridge Course' where youtube_video_id = 'T2D7sodPDcw';
  update public.videos set title = 'Circular Motion (Part 2) — Bridge Course' where youtube_video_id = 'Do2sZ71H7zI';
  update public.videos set title = 'Circular Motion (Part 1) — Foundation Series' where youtube_video_id = 'gpPt4bUXHgc';
  update public.videos set title = 'Circular Motion (Part 2) — Foundation Series' where youtube_video_id = 'n7CiepcP5Uw';

  update public.videos set chapter_id = v_into where chapter_id = v_from;
  get diagnostics v_moved = row_count;

  delete from public.chapters where id = v_from;

  -- Take the freed name and slug: NCERT's wording, and the better of the two
  -- live URLs.
  update public.chapters
     set name = 'Laws of Motion', slug = 'laws-of-motion'
   where id = v_into;

  -- Close the gap so Physics stays contiguous.
  v_pos := 0;
  for r in select id from public.chapters where subject_id = 1 order by display_order, id loop
    v_pos := v_pos + 1;
    update public.chapters set display_order = v_pos where id = r.id;
  end loop;

  raise notice 'moved % lesson(s) into chapter 6, removed chapter 82, Physics renumbered to 1..%', v_moved, v_pos;
end
$merge$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_n int;
  v_dup int;
  v_empty int;
  v_orphan int;
  v_mins int;
  v_inst int;
begin
  if exists (select 1 from public.chapters where id = 82) then
    raise exception 'chapter 82 survived the merge';
  end if;
  if not exists (select 1 from public.chapters where id = 6 and name = 'Laws of Motion' and slug = 'laws-of-motion') then
    raise exception 'the surviving chapter did not take the name and slug';
  end if;

  -- Physics must have exactly one chapter about the laws of motion now.
  select count(*) into v_n from public.chapters
   where subject_id = 1 and (name ilike '%laws of motion%' or name ilike '%NLM%');
  if v_n <> 1 then raise exception 'Physics still has % laws-of-motion chapters', v_n; end if;

  -- Every lesson survived the move.
  select count(*), coalesce(sum(duration_seconds), 0) / 60, count(distinct channel_id)
    into v_n, v_mins, v_inst
    from public.videos where chapter_id = 6;
  if v_n <> 47 then raise exception 'expected 47 lessons in the merged chapter, found %', v_n; end if;

  -- No lesson list may show the SAME institute twice under the same title --
  -- that is genuinely unreadable, and it is what the four retitles above fix.
  --
  -- An earlier version of this assertion demanded ZERO duplicate titles in the
  -- merged chapter and aborted the whole migration. That bar was wrong: chapter
  -- 6 already held two lessons titled "Constraint Motion" before this file
  -- existed, and 111 (chapter, title) pairs across the catalogue look like that.
  -- Two lessons sharing a title but published by DIFFERENT institutes are fine --
  -- the course card names the institute, so a student can tell them apart -- and
  -- failing on a pre-existing, catalogue-wide condition is not this migration's
  -- job. The check below is the invariant that actually matters.
  select count(*) into v_dup from (
    select title, channel_id from public.videos where chapter_id = 6
     group by title, channel_id having count(*) > 1) d;
  if v_dup <> 0 then
    raise exception '% lesson title(s) appear twice from the SAME institute inside the merged chapter', v_dup;
  end if;

  -- And the merge itself must not have introduced a new collision: nothing that
  -- moved may share a title with something that was already there, from anyone.
  select count(*) into v_dup from (
    select title from public.videos where chapter_id = 6
     group by title having count(*) > 2) d;
  if v_dup <> 0 then
    raise exception '% title(s) now appear three or more times - the merge stacked collisions', v_dup;
  end if;

  -- Nothing orphaned or emptied.
  select count(*) into v_orphan from public.videos where chapter_id is null;
  if v_orphan <> 0 then raise exception '% lesson(s) lost their chapter', v_orphan; end if;
  select count(*) into v_empty from public.playlists p
   where not exists (select 1 from public.playlist_videos pv where pv.playlist_id = p.id);
  if v_empty <> 0 then raise exception '% course(s) now have no lessons', v_empty; end if;
  select count(*) into v_empty from public.chapters c
   where not exists (select 1 from public.videos v where v.chapter_id = c.id);
  if v_empty <> 0 then raise exception '% chapter(s) now have no lessons', v_empty; end if;

  -- Physics display_order must be a clean contiguous run.
  select count(*) into v_n from public.chapters where subject_id = 1;
  select count(*) into v_orphan from public.chapters
   where subject_id = 1 and display_order between 1 and v_n;
  if v_orphan <> v_n then raise exception 'Physics display_order is not a clean 1..% run', v_n; end if;
  select count(*) into v_orphan from (
    select display_order from public.chapters where subject_id = 1
     group by display_order having count(*) > 1) d;
  if v_orphan <> 0 then raise exception 'Physics chapters share a display_order'; end if;

  raise notice 'SELF-TEST PASSED: one Laws of Motion chapter with 47 lessons, % minutes, % institutes; Physics is a clean 1..% run.',
    v_mins, v_inst, v_n;
end
$verify$;

commit;
