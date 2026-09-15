-- ============================================================================
-- Restore the grants 20260908120000 widened when it recreated two functions.
--
-- WHAT HAPPENED. 20260908120000 changes the return type of get_proposal_groups
-- and get_faculty_review_groups, so it has to DROP and recreate them. It then
-- ran `revoke all ... from public` and granted what production had. But this
-- database carries Supabase's default privileges (baseline lines 13305-13308):
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
--
-- so both recreated functions were ALSO granted directly to anon and
-- authenticated. A revoke from PUBLIC does not touch a direct role grant.
-- Measured on production immediately after that push, 2026-09-15:
--
--   anon -> get_proposal_groups         200, 7 rows    before the push: 401 42501
--   anon -> get_faculty_review_groups   401 42501 from its own is_admin() check
--                                                      before the push: permission denied
--
-- get_proposal_groups is SECURITY DEFINER with no check of its own, so anyone
-- holding the public anon key -- and any signed-in student -- could read the
-- faculty review queue: teacher names as they appear in course metadata, with
-- proposal ids, occurrence counts and a kind label. The candidate list was
-- empty at the time.
--
-- THE FIX restores exactly the grants the baseline records (lines 11848-11850
-- and 11921-11922), nothing wider and nothing narrower:
--
--   get_proposal_groups         service_role only
--   get_faculty_review_groups   authenticated + service_role
--
-- WHY THE REHEARSAL DID NOT CATCH IT. PGlite has no Supabase default
-- privileges, so a recreated function there gets exactly the grants the SQL
-- names and nothing more. The check that matters therefore runs HERE, on the
-- real database, with has_function_privilege -- which counts direct grants,
-- inherited ones and PUBLIC together.
--
-- It is the only migration since the baseline that DROPs a function, so no
-- other function was widened this way.
-- ============================================================================

do $preflight$
begin
  if to_regprocedure('public.get_proposal_groups(text)') is null then
    raise exception 'REFUSING: get_proposal_groups(text) is missing; there is nothing to restore grants on';
  end if;
  if to_regprocedure('public.get_faculty_review_groups(text)') is null then
    raise exception 'REFUSING: get_faculty_review_groups(text) is missing; there is nothing to restore grants on';
  end if;
end
$preflight$;

revoke all on function public.get_proposal_groups(text) from anon, authenticated;
revoke all on function public.get_faculty_review_groups(text) from anon;

-- Restated so the end state does not depend on what the previous file granted.
grant execute on function public.get_proposal_groups(text) to service_role;
grant execute on function public.get_faculty_review_groups(text) to authenticated, service_role;

do $verify$
declare
  v_fail text[] := array[]::text[];
begin
  -- get_proposal_groups: service_role only.
  if has_function_privilege('anon', 'public.get_proposal_groups(text)', 'execute') then
    v_fail := v_fail || 'anon can still execute get_proposal_groups'::text;
  end if;
  if has_function_privilege('authenticated', 'public.get_proposal_groups(text)', 'execute') then
    v_fail := v_fail || 'authenticated can still execute get_proposal_groups'::text;
  end if;
  if not has_function_privilege('service_role', 'public.get_proposal_groups(text)', 'execute') then
    v_fail := v_fail || 'service_role lost get_proposal_groups, which get_faculty_review_groups needs'::text;
  end if;

  -- get_faculty_review_groups: authenticated + service_role; its own is_admin()
  -- check decides which signed-in users actually get rows.
  if has_function_privilege('anon', 'public.get_faculty_review_groups(text)', 'execute') then
    v_fail := v_fail || 'anon can still execute get_faculty_review_groups'::text;
  end if;
  if not has_function_privilege('authenticated', 'public.get_faculty_review_groups(text)', 'execute') then
    v_fail := v_fail || 'authenticated lost get_faculty_review_groups, which the admin panel calls'::text;
  end if;
  if not has_function_privilege('service_role', 'public.get_faculty_review_groups(text)', 'execute') then
    v_fail := v_fail || 'service_role lost get_faculty_review_groups'::text;
  end if;

  if array_length(v_fail, 1) > 0 then
    raise exception 'REVIEW QUEUE GRANTS SELF-TEST FAILED (rolled back): %', array_to_string(v_fail, ' | ');
  end if;
  raise notice 'REVIEW QUEUE GRANTS RESTORED: get_proposal_groups is service_role only; get_faculty_review_groups is authenticated + service_role.';
end
$verify$;
