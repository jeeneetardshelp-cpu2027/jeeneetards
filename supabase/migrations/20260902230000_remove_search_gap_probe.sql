-- ============================================================================
-- Remove one synthetic row from search_gap_log.
--
-- Mine, not a student's. While applying 20260902210000 and 20260902220000 I
-- checked whether the log_search_gap RPC existed by calling it, once before
-- the push and once after. The first call failed with PGRST202 (no such
-- function), which was the answer I wanted. The second succeeded -- which
-- means it did what the function is for and wrote a row.
--
-- The text was '___probe___'. It is the first row in a table whose entire
-- purpose is to show which real searches found nothing, so leaving it there
-- would put a string no student typed at the top of the first report anyone
-- reads. anon can write to this table but not read it, which is the right
-- design and also why this could not be cleaned up the way it was made.
--
-- Written as a migration rather than a one-off query because that is the rule
-- this directory exists to enforce: the SQL Editor is for reading. A deletion
-- that leaves no record is how the drift problem starts.
--
-- Exact-match on the string, so it cannot touch a genuine search. If a student
-- ever does type '___probe___' this deletes their row too; that is a trade
-- worth making once, and this file is not meant to be re-run.
-- ============================================================================

do $preflight$
begin
  if to_regclass('public.search_gap_log') is null then
    raise exception 'REFUSING: search_gap_log is missing -- apply 20260902210000 first';
  end if;
end
$preflight$;

delete from public.search_gap_log where query_text = '___probe___';

do $postflight$
declare
  v_left int;
begin
  select count(*) into v_left
    from public.search_gap_log where query_text = '___probe___';
  if v_left > 0 then
    raise exception 'CLEANUP FAILED: % probe rows remain', v_left;
  end if;
  raise notice 'SEARCH GAP PROBE REMOVED: the log now holds only what students actually searched for.';
end
$postflight$;
