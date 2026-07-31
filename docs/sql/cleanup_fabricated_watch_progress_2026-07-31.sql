-- cleanup_fabricated_watch_progress_2026-07-31.sql
--
-- Removes watch-progress rows that were FABRICATED by a bug, not created by a
-- student actually watching anything.
--
-- THE BUG (fixed in code by commit "Fix: stop the site inventing watch
-- history"): YouTubePlayer.reportProgress fired on unmount and on pagehide
-- even when the lesson had never played. So merely OPENING a course page and
-- navigating away wrote a progress report, and CourseVideoPage hard-coded
-- `watched: true` on it. For a signed-in student that was upserted into
-- video_progress and then pulled back down onto every device they use.
--
-- HOW A FABRICATED ROW IS IDENTIFIED: a lesson that genuinely started playing
-- always picks up a non-zero position within 5 seconds (YouTubePlayer's
-- progress timer ticks every 5s while PLAYING, and the flush reads
-- getCurrentTime()). A row claiming watched = true while sitting at position 0
-- therefore cannot have come from real playback.
--
-- Deliberately conservative -- it does NOT touch:
--   * rows with any real position (position_seconds > 0), even if watched is
--     somehow false, because that IS evidence of real playback;
--   * rows where watched is already false, which are harmless resume points.
--
-- Idempotent: re-running deletes nothing further. Safe to re-run.
--
-- NOTE ON SCALE: at the time of writing production has exactly one account and
-- the ratings/reviews tables are empty, so this is expected to affect very few
-- rows -- possibly zero. The self-verification below reports the count rather
-- than asserting a specific number, precisely because "0 rows cleaned" is a
-- perfectly good outcome and must not fail the migration.

begin;

-- Report what is about to go, so the run is auditable rather than silent.
do $$
declare
  v_fabricated int;
  v_total int;
begin
  select count(*) into v_total from public.video_progress;
  select count(*) into v_fabricated
    from public.video_progress
   where watched = true
     and coalesce(position_seconds, 0) = 0;

  raise notice 'video_progress: % row(s) total, % identified as fabricated (watched=true at position 0)',
    v_total, v_fabricated;
end
$$;

delete from public.video_progress
 where watched = true
   and coalesce(position_seconds, 0) = 0;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
declare
  v_remaining int;
  v_survivors int;
begin
  select count(*) into v_remaining
    from public.video_progress
   where watched = true
     and coalesce(position_seconds, 0) = 0;
  if v_remaining <> 0 then
    raise exception 'expected 0 fabricated rows to remain, found %', v_remaining;
  end if;

  select count(*) into v_survivors from public.video_progress;
  raise notice 'SELF-TEST PASSED: no watched-at-position-0 rows remain; % genuine progress row(s) preserved.', v_survivors;
end
$$;

commit;
