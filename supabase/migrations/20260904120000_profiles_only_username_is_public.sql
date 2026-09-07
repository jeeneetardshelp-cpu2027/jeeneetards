-- ============================================================================
-- PROFILES: only the claimed forum username is browser-readable.
--
-- THE LEAK. Signed out, with nothing but the public anon key, this returned
-- every student's real name and Google profile photo:
--
--   GET /rest/v1/profiles?select=id,username,full_name,avatar_url
--   -> HTTP 200, content-range 0-6/7, 3 rows carrying full_name and a
--      lh3.googleusercontent.com avatar_url
--
-- It hid behind a false negative. `select=*` returns 401 42501 "permission
-- denied for table profiles", which reads as locked. It is not: the grants are
-- COLUMN-level, so naming the columns succeeds where the wildcard fails. Any
-- audit that probed with `select=*` and stopped would have called this closed.
--
-- Two things combine. RLS is enabled on the table but its SELECT policy is
--   CREATE POLICY "profiles are public" ON public.profiles FOR SELECT USING (true)
-- which filters nothing, and the baseline grants anon SELECT on id, username,
-- full_name, avatar_url and created_at.
--
-- NOBODY CHOSE TO PUBLISH THIS. full_name and avatar_url are written by the
-- new-user trigger straight from raw_user_meta_data at Google sign-in. A
-- student signing in to save their progress is not asking for their legal name
-- and photograph to be readable by anyone with the anon key. The audience is
-- largely 14-18 (Privacy Policy s.9), and the policy has never mentioned this
-- table at all.
--
-- WHAT THIS CHANGES. Table-level SELECT is revoked from public, anon and
-- authenticated, then a single column grant is restored:
--
--   username  -- the name a student DELIBERATELY claims for the forum
--
-- Everything else -- id, full_name, avatar_url, created_at, is_admin -- stops
-- being browser-readable in either role.
--
-- WHY THIS IS SAFE, checked before writing rather than assumed:
--
--   1. No browser code reads this table. `grep -rn '"profiles"' src` outside
--      src/scripts/ and *.test.* returns nothing at all. The admin panel asks
--      the is_admin() RPC, not the table.
--   2. All 24 functions in the baseline that read public.profiles are
--      SECURITY DEFINER, so they execute as owner and are unaffected by what
--      anon and authenticated may select.
--   3. INSERT and UPDATE grants are deliberately untouched. The new-user
--      trigger inserts (id, full_name, avatar_url), and
--      forum_username_claim_v1_postflight.sql asserts that `authenticated`
--      keeps UPDATE on full_name and avatar_url. Revoking those would break
--      the username claim; this file only narrows SELECT.
--
-- Body follows src/migrations/fix_profile_is_admin_select_disclosure.sql,
-- which already stated this contract -- "only the separately claimed forum
-- username is browser-readable" -- and was never applied to production. This
-- brings it into the ordered chain so `migration list` can answer for it.
--
-- Rerunnable: revoke/grant are idempotent and the checks re-derive from
-- information_schema every time.
-- ============================================================================

begin;

revoke select on table public.profiles from public, anon, authenticated;

grant select (username) on table public.profiles to anon, authenticated;

-- service_role keeps full access; it is the server-side key, never shipped.
grant select on table public.profiles to service_role;

do $$
declare
  still_exposed text;
begin
  -- 1. No table-wide SELECT for either browser role. A future `grant select on
  --    table profiles to anon` would re-open every column at once, so this is
  --    checked separately from the column list below.
  if has_table_privilege('anon', 'public.profiles', 'select')
     or has_table_privilege('authenticated', 'public.profiles', 'select') then
    raise exception
      'PROFILES POSTFLIGHT: a browser role still holds table-level SELECT on public.profiles';
  end if;

  -- 2. The forum still works: the claimed username must remain readable, or
  --    signed-out students stop seeing who wrote a post.
  if not has_column_privilege('anon', 'public.profiles', 'username', 'select')
     or not has_column_privilege('authenticated', 'public.profiles', 'username', 'select') then
    raise exception
      'PROFILES POSTFLIGHT: username is not readable by both browser roles';
  end if;

  -- 3. THE ACTUAL LEAK. Enumerate every column either browser role can still
  --    select and fail on anything that is not username. Derived from
  --    information_schema rather than a hardcoded list, so a column added
  --    later is caught too.
  select string_agg(distinct c.column_name, ', ' order by c.column_name)
    into still_exposed
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'profiles'
     and c.column_name <> 'username'
     and (has_column_privilege('anon', 'public.profiles', c.column_name, 'select')
       or has_column_privilege('authenticated', 'public.profiles', c.column_name, 'select'));

  if still_exposed is not null then
    raise exception
      'PROFILES POSTFLIGHT: still browser-readable beyond username: %', still_exposed;
  end if;

  -- 4. The write path the username claim depends on must have survived.
  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'update')
     or not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'update') then
    raise exception
      'PROFILES POSTFLIGHT: this file narrowed SELECT but broke the UPDATE grants the username claim needs';
  end if;
end $$;

commit;
