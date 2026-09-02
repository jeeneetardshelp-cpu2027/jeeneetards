-- ---------------------------------------------------------------------
-- PAUSE the zero-result search log until the disclosure is actually
-- DEPLOYED, not merely merged.
--
-- WHAT WENT WRONG. 20260902210000_search_gap_log.sql was applied on the
-- evening of 2 Sep 2026, and applying it IS switching the feature on: there is
-- no flag in src/searchGapLog.js, the caller was already deployed, and the only
-- thing holding collection back was the missing RPC. The disclosure was on the
-- `release` branch at the time, so the pairing looked satisfied.
--
-- It was not. This site serves production from a Vercel build of `release`,
-- and that build never ran -- Vercel returned "Deployment rate limited, retry
-- in 24 hours", which is also why the tip of `release` is a commit called
-- "Retrigger the production deploy". Checked directly rather than assumed:
-- https://jeeneetard.com/privacy is still the 31 August 2026 version, whose
-- section 6 is "Providers, video playback, and logs". It contains no search
-- section at all -- not a stale one, none.
--
-- So free-text queries typed by an audience largely under 18 were being stored
-- while the only privacy policy those students can read did not mention the
-- practice. That is the wrong side of a disclosure rule, and no amount of
-- merging fixes it while the build is rate limited.
--
-- THE HONEST FIX IS TO STOP COLLECTING, not to write more words. This revokes
-- EXECUTE from the two roles a browser can ever hold. The table, its RLS, its
-- indexes and the function body are all left exactly as they are, so nothing
-- is lost and re-enabling is one GRANT.
--
-- NOTHING BREAKS FOR A STUDENT. src/searchGapLog.js:86-87 wraps the call in a
-- bare `catch {}` for precisely this reason -- the header explains that turning
-- a bookkeeping call into console noise would make a bad moment worse. A
-- permission-denied answer is swallowed exactly as the missing-function answer
-- was before the push. Search itself never touches this path.
--
-- ROWS ALREADY COLLECTED are deliberately NOT deleted here. They were written
-- under a policy that did not describe them, so whether to keep or discard them
-- is the owner's call and not a side effect of stopping the bleed. `anon` can
-- write to that table but not read it, so nothing is exposed meanwhile.
--
-- HOW TO TURN IT BACK ON, in this order and not another:
--   1. get the disclosure DEPLOYED -- load https://jeeneetard.com/privacy in a
--      browser and read section 6 with your own eyes; a merged PR is not a
--      deployed page, which is the whole lesson of this file;
--   2. then a new migration re-granting execute to anon and authenticated;
--   3. then move src/PrivacyPolicy.jsx to the present tense in that same
--      change, and flip the SEARCH_GAP_COLLECTION marker in supabase/README.md.
-- src/searchGapPrivacyContract.test.js keys the policy's tense to that marker,
-- so steps 2 and 3 cannot drift apart.
-- ---------------------------------------------------------------------

begin;

-- PREFLIGHT. Refuse if the object is not what this file expects, rather than
-- succeeding vacuously against a schema that has moved.
do $preflight$
begin
  if to_regprocedure('public.log_search_gap(text, integer)') is null then
    raise exception
      'log_search_gap(text, integer) does not exist -- nothing to pause. Has 20260902210000 been applied?';
  end if;
end;
$preflight$;

revoke execute on function public.log_search_gap(text, integer) from anon;
revoke execute on function public.log_search_gap(text, integer) from authenticated;

-- service_role keeps EXECUTE on purpose: it is the key an administrator uses,
-- it never reaches a browser, and leaving it lets the feature be exercised
-- deliberately without re-opening it to the public.

comment on function public.log_search_gap(text, integer) is
  'Records a zero-result search. COLLECTION PAUSED 2 Sep 2026: execute revoked from anon and authenticated until the privacy disclosure is deployed to production, not merely merged. See 20260902250000_pause_search_gap_collection.sql.';

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Inside the transaction: a failure here rolls the whole
-- migration back, so this file can never report success while a browser role
-- can still write a row.
-- ---------------------------------------------------------------------
do $verify$
declare
  fn   oid := to_regprocedure('public.log_search_gap(text, integer)');
  role text;
begin
  foreach role in array array['anon', 'authenticated'] loop
    if has_function_privilege(role, fn, 'EXECUTE') then
      raise exception 'FAILED: % can still execute log_search_gap -- collection is not paused', role;
    end if;
  end loop;

  -- The pause must not have cost anything that would make re-enabling lossy.
  if to_regclass('public.search_gap_log') is null then
    raise exception 'FAILED: search_gap_log table is gone -- this migration must only revoke';
  end if;
  if not has_function_privilege('service_role', fn, 'EXECUTE') then
    raise exception 'FAILED: service_role lost EXECUTE -- an administrator can no longer exercise the feature';
  end if;

  raise notice 'search gap collection paused: anon and authenticated can no longer execute log_search_gap';
end;
$verify$;

commit;
