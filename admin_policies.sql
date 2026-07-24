-- ============================================================
--  ADMIN WRITE ACCESS  —  run AFTER schema.sql, community_schema.sql
--  and courses_data.sql. Safe to run more than once.
--
--  What this does, in plain language:
--    Right now NOBODY can write through the app — only "public read"
--    policies exist, so every insert is rejected. This file adds
--    insert permission for ONE person: you.
--
--    It does NOT open writes to the public. The anon key in the
--    frontend still cannot insert anything. Only a signed-in user
--    whose profile has is_admin = true can write.
-- ============================================================


-- 1. A flag on profiles marking who the admin is ---------------
alter table public.profiles
    add column if not exists is_admin boolean not null default false;


-- 2. A helper that answers "is the current user an admin?" -----
--    SECURITY DEFINER lets it read profiles without tripping over
--    row-level security while it is itself being used inside a policy.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (select p.is_admin from public.profiles p where p.id = auth.uid()),
        false
    );
$$;

grant execute on function public.is_admin() to authenticated;


-- 3. Insert policies — admin only ------------------------------
--    Postgres has no "create policy if not exists", so each one is
--    dropped first. That is what makes this file re-runnable.
--    NOTE: these grant INSERT only. Nothing here can update or delete,
--    which keeps the blast radius small if the account is ever misused.

drop policy if exists "admin inserts" on public.institutes_channels;
create policy "admin inserts" on public.institutes_channels
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admin inserts" on public.chapters;
create policy "admin inserts" on public.chapters
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admin inserts" on public.videos;
create policy "admin inserts" on public.videos
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admin inserts" on public.playlists;
create policy "admin inserts" on public.playlists
    for insert to authenticated with check (public.is_admin());

drop policy if exists "admin inserts" on public.playlist_videos;
create policy "admin inserts" on public.playlist_videos
    for insert to authenticated with check (public.is_admin());


-- ============================================================
--  4. MAKE YOURSELF THE ADMIN
--
--  First create your login:
--    Supabase dashboard -> Authentication -> Users -> "Add user"
--    Tick "Auto Confirm User" so you can sign in straight away.
--
--  Then put your email in the line below and run just this block.
-- ============================================================
-- update public.profiles
--    set is_admin = true
--  where id = (select id from auth.users where email = 'you@example.com');

-- Check it worked — should show your email with is_admin = true:
-- select u.email, p.is_admin
--   from public.profiles p
--   join auth.users u on u.id = p.id;
