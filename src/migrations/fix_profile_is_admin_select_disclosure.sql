-- Prevent browser clients from reading OTHER users' profiles.is_admin value.
--
-- profiles carries "profiles are public" (select using (true)) so reviews and
-- comments can show a name/avatar next to them -- correct for username,
-- full_name, avatar_url, created_at, but is_admin riding along on that same
-- public-read policy means anyone with the anon key can already run
-- `select id, is_admin from profiles where is_admin = true` and learn exactly
-- which account is the site admin. RLS policies are row-level, not
-- column-level, so the public-read policy can't be narrowed to "every column
-- except this one" -- a column-level grant is the correct tool here.
--
-- FIRST ATTEMPT AT THIS FILE WAS WRONG (kept as a warning for future edits):
-- `revoke select (is_admin) on table public.profiles from anon, authenticated`
-- looks right but does nothing, because Supabase's default schema setup
-- already grants blanket TABLE-LEVEL select to anon/authenticated
-- (`grant all on all tables in schema public to anon, authenticated`).
-- Postgres checks table-level SELECT first; if that passes, a column-level
-- REVOKE is never even consulted -- it can only carve an exception out of
-- privileges that were themselves granted at the column level. Confirmed
-- live: after running the column-only revoke, `select id,is_admin from
-- profiles` via the anon key still returned is_admin. The only way to
-- actually restrict a column when the role holds table-level SELECT is to
-- revoke SELECT at the table level and re-grant it column-by-column.
--
-- The public.is_admin() SECURITY DEFINER function (admin_policies.sql)
-- already exists for server-side policy checks and remains usable for a
-- user's own "am I admin" UI gate after this: SECURITY DEFINER functions run
-- as their owner, so this table-level select revoke does not affect what the
-- function can read internally.
--
-- Safe to re-run: revoke/grant are idempotent, and the self-test below
-- aborts (rolling back nothing, since there's nothing to roll back -- these
-- are catalog changes, not data) with a clear error if it didn't work,
-- instead of silently reporting success like the first attempt did.

revoke select on table public.profiles from anon, authenticated;
grant select (id, username, full_name, avatar_url, created_at)
  on table public.profiles to anon, authenticated;

do $$
declare
  v_still_exposed text;
begin
  select string_agg(grantee || ':' || privilege_type, ', ') into v_still_exposed
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and column_name = 'is_admin'
     and privilege_type = 'SELECT'
     and grantee in ('anon', 'authenticated');
  if v_still_exposed is not null then
    raise exception 'is_admin is still SELECT-able by: % -- fix did not take effect', v_still_exposed;
  end if;

  -- Regression guard: the public columns reviews/comments need must still work.
  if not exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'username' and privilege_type = 'SELECT'
       and grantee = 'anon'
  ) then
    raise exception 'anon lost SELECT on username -- public profile display would break';
  end if;

  raise notice 'SELF-TEST PASSED: is_admin is no longer readable by anon/authenticated; id/username/full_name/avatar_url/created_at remain public.';
end
$$;
