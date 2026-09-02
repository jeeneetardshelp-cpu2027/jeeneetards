-- ---------------------------------------------------------------------
-- RESUME the zero-result search log. Lifts the pause applied a few minutes
-- earlier by 20260902250000_pause_search_gap_collection.sql.
--
-- THE PRECONDITION THAT FILE SET HAS BEEN MET, and it was checked the way that
-- file demanded -- by loading the page, not by reading a branch:
--
--   https://jeeneetard.com/privacy  now serves "Effective date: 2 September
--   2026" and carries section 6, "Searches that find nothing", which names
--   search_gap_log and describes the practice in the present tense.
--
-- That is the whole point of the pause and of this file. When collection was
-- switched on the first time, the disclosure existed on the `release` branch
-- and had been merged -- and students could not read it, because the Vercel
-- build was rate limited and production was still serving the 31 August policy
-- with no search section at all. Merged is not deployed. A privacy disclosure
-- only counts once it is on the page a student can open.
--
-- Because the deployed page already describes collection in the present tense,
-- resuming makes the live site TRUE again immediately, with no further deploy
-- required. Leaving the pause in place would have left that page over-claiming
-- -- telling students their searches are kept while nothing was kept -- which
-- is the safe direction to be wrong in, but still wrong.
--
-- Owner decision, taken explicitly, with the deployed wording in front of them.
--
-- WHAT THIS RESTORES: exactly the two grants 20260902210000 created and
-- 20260902250000 revoked. Nothing else changes -- not the table, not its RLS,
-- not the function body, not service_role, which kept EXECUTE throughout.
--
-- ROWS COLLECTED BEFORE THE PAUSE are still in place and untouched. They were
-- written during the window when the deployed policy did not describe them.
-- Whether to keep or discard them remains an open owner decision, deliberately
-- not bundled into this file: resuming a feature and disposing of earlier data
-- are different questions and should be separately reversible.
--
-- TO PAUSE AGAIN: revoke the two grants below. src/searchGapLog.js:86-87
-- swallows the refusal, so nothing breaks for a student, and /search keeps
-- rendering its ordinary empty state. Then flip SEARCH_GAP_COLLECTION in
-- supabase/README.md back to `paused` and move src/PrivacyPolicy.jsx to the
-- future tense in the same change -- src/searchGapPrivacyContract.test.js
-- fails the build if the marker and the policy disagree.
-- ---------------------------------------------------------------------

begin;

-- PREFLIGHT. Refuse unless this is genuinely the paused state this file exists
-- to lift, rather than succeeding vacuously against something else.
do $preflight$
declare
  fn oid := to_regprocedure('public.log_search_gap(text, integer)');
begin
  if fn is null then
    raise exception
      'log_search_gap(text, integer) does not exist -- nothing to resume. Has 20260902210000 been applied?';
  end if;
  if has_function_privilege('anon', fn, 'EXECUTE') then
    raise exception
      'anon can already execute log_search_gap -- collection is not paused, so this file has nothing to lift';
  end if;
  if to_regclass('public.search_gap_log') is null then
    raise exception 'search_gap_log table is missing -- resuming would collect into nothing';
  end if;
end;
$preflight$;

grant execute on function public.log_search_gap(text, integer) to anon;
grant execute on function public.log_search_gap(text, integer) to authenticated;

comment on function public.log_search_gap(text, integer) is
  'Records a zero-result search: the query text, a normalised grouping key, the result count and the time. No identity of any kind is accepted or stored. Disclosed in src/PrivacyPolicy.jsx section 6, which was confirmed live on https://jeeneetard.com/privacy before collection resumed on 2 Sep 2026.';

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. A failure rolls the whole migration back, so this file
-- cannot report success while collection is still refused -- or while the
-- table it writes into has gone missing.
-- ---------------------------------------------------------------------
do $verify$
declare
  fn   oid := to_regprocedure('public.log_search_gap(text, integer)');
  role text;
begin
  foreach role in array array['anon', 'authenticated', 'service_role'] loop
    if not has_function_privilege(role, fn, 'EXECUTE') then
      raise exception 'FAILED: % still cannot execute log_search_gap -- collection did not resume', role;
    end if;
  end loop;

  -- The function must still be the identity-free one the policy describes.
  -- A resume that quietly restored a different body would be the exact drift
  -- this chain exists to prevent.
  if (select prosecdef from pg_proc where oid = fn) is not true then
    raise exception 'FAILED: log_search_gap is no longer SECURITY DEFINER -- it cannot write past the table RLS';
  end if;

  -- The signature is already pinned: `fn` is resolved above through
  -- to_regprocedure('public.log_search_gap(text, integer)'), which returns
  -- null unless a function with exactly those argument types exists. An
  -- earlier draft ALSO compared pg_get_function_identity_arguments(fn) against
  -- the literal 'text, integer' and aborted this migration on the first push:
  -- that function includes parameter NAMES, so the real value is
  -- 'p_query text, p_result_count integer'. The assertion was wrong, not the
  -- database, and it was redundant with the resolution above. Recorded rather
  -- than quietly deleted, because a rolled-back migration with a confusing
  -- message costs the next person the same twenty minutes.
  --
  -- What is worth asserting instead is the shape the disclosure promises: two
  -- arguments and no return value, so nothing can be read back out through it.
  if (select pronargs from pg_proc where oid = fn) <> 2 then
    raise exception 'FAILED: log_search_gap no longer takes exactly two arguments';
  end if;
  if (select prorettype from pg_proc where oid = fn) <> 'void'::regtype then
    raise exception 'FAILED: log_search_gap now returns a value -- the write-only shape the policy describes is gone';
  end if;

  raise notice 'search gap collection resumed: anon and authenticated can execute log_search_gap again';
end;
$verify$;

commit;
