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
-- The public.is_admin() SECURITY DEFINER function (admin_policies.sql)
-- already exists for server-side policy checks and remains usable for a
-- user's own "am I admin" UI gate after this: SECURITY DEFINER functions run
-- as their owner, so this column-level revoke on anon/authenticated does not
-- affect what the function can read internally.

revoke select (is_admin) on table public.profiles from anon, authenticated;

-- Verify: zero rows means neither role can read the column directly anymore.
select grantee, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'profiles'
   and column_name = 'is_admin'
   and privilege_type = 'SELECT'
   and grantee in ('anon', 'authenticated');
