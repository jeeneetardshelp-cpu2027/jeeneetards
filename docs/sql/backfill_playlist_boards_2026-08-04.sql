-- backfill_playlist_boards_2026-08-04.sql
--
-- URGENT: three School Boards courses are invisible on the only path the guided
-- journey emits, including both courses from today's English import.
--
-- WHAT IS BROKEN. src/usePlaylistBrowse.js scopes Browse by board in the QUERY:
--
--     (boardId ? ", playlist_boards!inner(board_id)" : "")
--     if (boardId) q = q.eq("playlist_boards.board_id", boardId);
--
-- An INNER join means a course with no playlist_boards row cannot satisfy it. It
-- is not ranked low, it does not appear at the bottom -- it does not exist. And
-- the School Boards journey always carries a board, so this is not an edge case:
-- /explore/school/cbse/class-10/english/the-hack-driver redirects to
-- /browse?goal=school&class=10&board=cbse&subject=english&chapter=the-hack-driver,
-- which is exactly the query that returns nothing.
--
-- Reproduced live, replaying the real query shape per English chapter:
--
--     chapter                        without board chip   with CBSE chip
--     A Letter to God                [159, 372]           [159]
--     The Hundred Dresses I          [372]                []        <-- dead end
--     The Hundred Dresses II         [372]                []        <-- dead end
--     The Making of a Scientist      [373]                []        <-- dead end
--     The Hack Driver                [373]                []        <-- dead end
--     The Book That Saved the Earth  [373]                []        <-- dead end
--
-- So all 29 Magnet Brains lessons are unreachable through Browse, and the five
-- new chapters dead-end completely -- while the chapter picker, which calls
-- get_browse_curriculum and is board-BLIND, cheerfully advertises "1 course" for
-- each of them. Verified: that RPC returns course_count 1 for chapters 302-306.
--
-- WHY IT HAPPENED, and it is worth stating plainly. The sanctioned importer
-- already enforces this. src/migrations/import_playlist_v4.sql:167 --
--
--     if v_goal_slug = 'school' and coalesce(array_length(v_board_ids,1),0) = 0
--       then raise exception 'school-board content requires at least one board_id';
--
-- Hand-written docs/sql migrations do not go through validate_import_payload, so
-- they bypass that rule. Exactly two migrations in docs/sql have ever created a
-- school-goal course, and NEITHER inserts into playlist_boards:
--   social_science_chapter_gaps_2026-08-02.sql  -> course 305
--   english_magnet_brains_2026-08-04.sql        -> courses 372, 373
-- Both self-verified four junction tables and neither checked this one.
-- src/schoolCourseBoardCompleteness.test.js now fails on any future migration
-- that repeats it.
--
-- WHAT THIS FILE DOES. Adds the missing CBSE rows for those three courses.
--
-- On the board choice: all three teach NCERT Class 10 material and every one of
-- the 16 existing playlist_boards rows is CBSE, so CBSE is the honest tag. Note
-- that course 305's source titles carry the publisher's own "State Boards
-- 2023-24" series label; it is still NCERT Class 10 Economics Chapter 5, which
-- is CBSE syllabus. It is deliberately NOT also tagged State Board (id 4): that
-- journey currently has zero courses, and a single lone course would be a worse
-- experience than an empty state. Revisit when state-board content actually
-- exists.
--
-- Additive only -- no course loses a board, nothing is deleted. Idempotent.
-- Self-verifying, and refuses to run if it would sweep up more than the three
-- courses it was written for.

begin;

do $boards$
declare
  v_cbse bigint;
  v_missing int;
  v_added int;
begin
  select id into strict v_cbse from public.boards where slug = 'cbse';

  -- Only ever touch School Boards courses. A JEE or NEET course must NOT gain a
  -- board row -- import_playlist_v4.sql:169 rejects that combination outright,
  -- and it would be wrong here for the same reason.
  select count(*) into v_missing
  from public.playlists p
  join public.playlist_learning_goals plg on plg.playlist_id = p.id
  join public.learning_goals lg on lg.id = plg.learning_goal_id and lg.slug = 'school'
  where not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id);

  if v_missing = 0 then
    raise notice 'nothing to do - every School Boards course already has a board';
    return;
  end if;

  -- The blast radius was measured before this file was written. If it has grown,
  -- something else is going on and a human should look rather than let a blanket
  -- CBSE tag land on courses nobody has examined.
  if v_missing > 3 then
    raise exception '% School Boards courses lack a board row, expected at most 3 - refusing to bulk-tag content this file has not seen', v_missing;
  end if;

  insert into public.playlist_boards (playlist_id, board_id)
  select p.id, v_cbse
  from public.playlists p
  join public.playlist_learning_goals plg on plg.playlist_id = p.id
  join public.learning_goals lg on lg.id = plg.learning_goal_id and lg.slug = 'school'
  where not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id)
  on conflict do nothing;
  get diagnostics v_added = row_count;

  raise notice 'added % CBSE board row(s)', v_added;
end
$boards$;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_orphan int;
  v_wrong int;
  v_eng int;
  v_dead int;
  v_cbse bigint;
begin
  select id into strict v_cbse from public.boards where slug = 'cbse';

  -- 1. No School Boards course may be left without a board.
  select count(*) into v_orphan
  from public.playlists p
  join public.playlist_learning_goals plg on plg.playlist_id = p.id
  join public.learning_goals lg on lg.id = plg.learning_goal_id and lg.slug = 'school'
  where not exists (select 1 from public.playlist_boards pb where pb.playlist_id = p.id);
  if v_orphan <> 0 then
    raise exception '% School Boards course(s) still have no board row', v_orphan;
  end if;

  -- 2. Nothing that is NOT a School Boards course may have gained one.
  select count(*) into v_wrong
  from public.playlist_boards pb
  where not exists (
    select 1 from public.playlist_learning_goals plg
    join public.learning_goals lg on lg.id = plg.learning_goal_id
    where plg.playlist_id = pb.playlist_id and lg.slug = 'school');
  if v_wrong <> 0 then
    raise exception '% course(s) carry a board without the School Boards goal', v_wrong;
  end if;

  -- 3. Both English courses are now reachable with the CBSE chip on.
  select count(*) into v_eng
  from public.playlists p
  join public.playlist_boards pb on pb.playlist_id = p.id and pb.board_id = v_cbse
  where p.subject_id = 11 and p.channel_id = (
    select id from public.institutes_channels where youtube_channel_id = 'UC3HS6gQ79jjn4xHxogw0HiA');
  if v_eng <> 2 then
    raise exception 'expected both Magnet Brains English courses to be CBSE-visible, found %', v_eng;
  end if;

  -- 4. The actual student-facing outcome: replay the Browse query's board-scoped
  --    shape and confirm no School Boards chapter dead-ends any more. This is
  --    the check whose absence let the bug ship.
  select count(*) into v_dead
  from public.chapters c
  where exists (
      select 1
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      join public.learning_goals lg on lg.id = plg.learning_goal_id and lg.slug = 'school'
      join public.playlist_videos pv on pv.playlist_id = p.id
      join public.videos v on v.id = pv.video_id and v.chapter_id = c.id)
    and not exists (
      select 1
      from public.playlists p
      join public.playlist_learning_goals plg on plg.playlist_id = p.id
      join public.learning_goals lg on lg.id = plg.learning_goal_id and lg.slug = 'school'
      join public.playlist_boards pb on pb.playlist_id = p.id and pb.board_id = v_cbse
      join public.playlist_videos pv on pv.playlist_id = p.id
      join public.videos v on v.id = pv.video_id and v.chapter_id = c.id);
  if v_dead <> 0 then
    raise exception '% chapter(s) still return zero courses once the CBSE filter is applied', v_dead;
  end if;

  raise notice 'SELF-TEST PASSED: every School Boards course carries a board, no non-school course does, both English courses are CBSE-visible, and no chapter dead-ends under the board filter.';
end
$verify$;

commit;
