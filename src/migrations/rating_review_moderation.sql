-- rating_review_moderation.sql — lets an admin hide an inappropriate review
-- without deleting the rating (the numeric score stays in the average).
--
-- WHY THIS EXISTS NOW, BEFORE ANY UI SHOWS REVIEW TEXT PUBLICLY: the existing
-- "ratings are public" RLS policy (for select using (true)) already means
-- anyone with the anon key can read playlist_ratings.review today -- there is
-- no frontend surface for it yet, but the data itself is not private. A
-- moderation path should exist before public display is ever added, not
-- after. Additive; safe to re-run.

alter table public.playlist_ratings add column if not exists review_hidden boolean not null default false;
alter table public.playlist_ratings add column if not exists review_hidden_at timestamptz;
alter table public.playlist_ratings add column if not exists review_hidden_by uuid references public.profiles(id) on delete set null;

-- A column-level revoke ALONE would not work here: authenticated already
-- has table-level UPDATE on this table (RLS restricts which ROWS, not which
-- COLUMNS, and a student legitimately needs to update their own row's
-- `rating`/`review`/etc via the existing "user updates own rating" policy).
-- Table-level UPDATE plus a column-level revoke is not sufficient on its own
-- in Postgres to block writes to that column when the table-level grant
-- still stands -- this session already hit that exact mistake once with
-- profiles.is_admin. The trigger below is the real enforcement; the revoke
-- is defense-in-depth, same reasoning as fix_profile_privilege_escalation.sql.
revoke update (review_hidden, review_hidden_at, review_hidden_by)
  on table public.playlist_ratings
  from anon, authenticated;

create or replace function public.protect_review_moderation_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.review_hidden is distinct from old.review_hidden
          or new.review_hidden_at is distinct from old.review_hidden_at
          or new.review_hidden_by is distinct from old.review_hidden_by)
     and not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'playlist_ratings review_hidden* columns may only be changed by an admin';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_review_moderation_columns()
  from public, anon, authenticated;
grant execute on function public.protect_review_moderation_columns()
  to authenticated, service_role;

drop trigger if exists trg_protect_review_moderation_columns on public.playlist_ratings;
create trigger trg_protect_review_moderation_columns
before update on public.playlist_ratings
for each row execute function public.protect_review_moderation_columns();

-- The admin-facing entry point. SECURITY DEFINER means its own UPDATE runs
-- as the function owner (bypasses RLS and the revoke above naturally); the
-- is_admin() gate is the actual authorization check, not the SECURITY
-- DEFINER-ness itself.
create or replace function public.admin_set_review_hidden(p_rating_id bigint, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'only an admin may moderate a review';
  end if;

  update public.playlist_ratings
     set review_hidden = p_hidden,
         review_hidden_at = case when p_hidden then now() else null end,
         review_hidden_by = case when p_hidden then auth.uid() else null end
   where id = p_rating_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'rating not found';
  end if;
end;
$$;

revoke all on function public.admin_set_review_hidden(bigint, boolean) from public, anon;
grant execute on function public.admin_set_review_hidden(bigint, boolean) to authenticated;

-- Admin-only listing: every rating that has review TEXT (a bare star rating
-- with no written review has nothing to moderate), newest first, including
-- currently-hidden ones so an admin can un-hide a mistaken call.
create or replace function public.admin_list_reviews()
returns table (
  id bigint,
  playlist_id bigint,
  playlist_title text,
  user_id uuid,
  rating int,
  review text,
  review_hidden boolean,
  review_hidden_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id, r.playlist_id, p.title, r.user_id, r.rating, r.review,
    r.review_hidden, r.review_hidden_at, r.created_at
  from public.playlist_ratings r
  join public.playlists p on p.id = r.playlist_id
  where public.is_admin()
    and r.review is not null
    and length(trim(r.review)) > 0
  order by r.created_at desc;
$$;

revoke all on function public.admin_list_reviews() from public, anon;
grant execute on function public.admin_list_reviews() to authenticated;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'playlist_ratings'
       and column_name = 'review_hidden'
  ) then
    raise exception 'review_hidden column was not created';
  end if;

  -- Not checking information_schema.column_privileges here: it reports
  -- table-level grants as equivalent per-column entries (that is its
  -- documented behavior), so it would ALWAYS show anon/authenticated as
  -- having UPDATE on these columns -- inherited from the table-level UPDATE
  -- grant students legitimately need for their own rating/review/etc columns
  -- -- regardless of whether the column-level revoke above did anything.
  -- That view cannot distinguish "no real protection" from "protected by a
  -- trigger instead of a grant", so asserting on it here would just be
  -- asserting something that's expected to look the same either way. The
  -- trigger is the actual enforcement; its existence is what's checked below.

  if to_regprocedure('public.admin_set_review_hidden(bigint, boolean)') is null then
    raise exception 'admin_set_review_hidden was not created';
  end if;
  if to_regprocedure('public.admin_list_reviews()') is null then
    raise exception 'admin_list_reviews was not created';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_protect_review_moderation_columns'
  ) then
    raise exception 'trg_protect_review_moderation_columns trigger was not created';
  end if;

  raise notice 'SELF-TEST PASSED: review moderation columns + RPCs + trigger exist; column grants revoked as defense-in-depth.';
end
$$;
