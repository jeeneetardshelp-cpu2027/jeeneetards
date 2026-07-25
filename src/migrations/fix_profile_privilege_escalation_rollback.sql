-- Restore the profile-admin write surface that existed before the matching
-- security migration.

drop trigger if exists trg_protect_profile_admin_flag
on public.profiles;

drop function if exists public.protect_profile_admin_flag();

grant update (is_admin), insert (is_admin)
on table public.profiles
to anon, authenticated;
