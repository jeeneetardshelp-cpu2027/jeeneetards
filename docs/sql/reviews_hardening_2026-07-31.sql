-- reviews_hardening_2026-07-31.sql
--
-- Closes the data-layer gaps in the public-reviews feature before real
-- students start using it (audit 31 July 2026, docs/audit_2026-07-31.md
-- findings A7 + the reviews items in section 3.1). Nothing here changes what
-- the app renders; it changes what the database will actually allow.
--
-- FOUR PROBLEMS, ALL EXPLOITABLE WITH THE ANON KEY THAT SHIPS IN THE BROWSER:
--
--   1. Admin "Hide" is cosmetic. The SELECT policy is `using (true)`, unaware
--      of review_hidden, so hiding a review only removes it from the app's own
--      query. Anyone could still read the full text of every hidden review:
--        /rest/v1/playlist_ratings?select=review&review_hidden=eq.true
--      For a site whose moderation exists to remove doxxing and abuse aimed at
--      minors, that makes the moderation button a lie.
--
--   2. Reviews are shown without an author, but user_id was readable by
--      anyone, letting reviews be grouped by author and correlated.
--
--   3. Review text had NO length limit, client or server -- while a content
--      report note, which only the operator ever reads, is capped at 1000
--      characters in both places. Backwards: the public, unbounded field was
--      the unguarded one.
--
--   4. created_at is client-supplied on INSERT and the public list is ordered
--      by created_at DESC, so a student could pin their own review to the top
--      of a course forever by posting a timestamp in the year 3000 -- and could
--      also write the moderation-audit columns, which only an admin should set.
--      (The existing protect_review_moderation_columns trigger fires only on
--      UPDATE, so INSERT was unguarded.)
--
-- Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------
-- 1 + 2. READ ACCESS: hidden reviews become genuinely unreadable, and
--        user_id stops being public.
--
-- TWO permissive policies, deliberately NOT one combined policy: anon has no
-- EXECUTE on public.is_admin() (admin_policies.sql), so a single policy
-- mentioning is_admin() would raise "permission denied for function is_admin"
-- for every logged-out visitor and break public browsing outright. Postgres
-- ORs permissive policies, so anon is only ever evaluated against the first.
-- ---------------------------------------------------------------------
drop policy if exists "ratings are public" on public.playlist_ratings;
drop policy if exists "visible ratings are public" on public.playlist_ratings;
drop policy if exists "owner and admin read all ratings" on public.playlist_ratings;

create policy "visible ratings are public"
  on public.playlist_ratings for select
  using (review_hidden = false);

create policy "owner and admin read all ratings"
  on public.playlist_ratings for select to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Column-level read restriction for anon. A column-level REVOKE alone is NOT
-- enough while a table-level GRANT stands -- this project has hit that exact
-- trap twice (profiles.is_admin, and nearly playlist_ratings.review_hidden).
-- So: drop the table-level grant for anon entirely, then re-grant only the
-- columns the public reviews list actually reads.
--
-- authenticated deliberately KEEPS its table-level SELECT: CourseRating.jsx
-- loads a student's own rating with select("*"), which would break under a
-- column allow-list. RLS above still limits which ROWS it can see.
revoke select on table public.playlist_ratings from anon;
grant select (
  id, playlist_id, rating, review, difficulty, best_for, created_at, review_hidden
) on table public.playlist_ratings to anon;

-- ---------------------------------------------------------------------
-- 3. LENGTH CAP on review text -- same 1000 characters the report note has
--    enforced server-side since content_reports_hardening_v10.
-- ---------------------------------------------------------------------
do $len$
declare
  v_too_long int;
begin
  select count(*) into v_too_long
    from public.playlist_ratings
   where review is not null and char_length(review) > 1000;
  if v_too_long > 0 then
    raise exception
      '% existing review(s) exceed 1000 characters -- trim them before adding the constraint', v_too_long;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'plr_review_length') then
    alter table public.playlist_ratings
      add constraint plr_review_length
      check (review is null or char_length(review) <= 1000);
  end if;
end
$len$;

-- ---------------------------------------------------------------------
-- 4. SUBMISSION GUARD: the server owns timestamps and moderation state.
-- ---------------------------------------------------------------------
create or replace function public.enforce_rating_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Administrative maintenance and tests use service_role and stay outside
  -- this. RLS remains the primary client boundary.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Client-supplied moderation state and timestamps are never trusted. Without
    -- this, created_at could be set to the far future and, because the public
    -- list orders by created_at desc, pin a review to the top of a course
    -- permanently.
    new.created_at := now();
    new.updated_at := now();
    if not public.is_admin() then
      new.review_hidden := false;
      new.review_hidden_at := null;
      new.review_hidden_by := null;
    end if;
  elsif tg_op = 'UPDATE' then
    -- An edit must not be able to rewrite history or jump the queue.
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_rating_submission() from public, anon, authenticated;
grant execute on function public.enforce_rating_submission() to service_role;

drop trigger if exists trg_enforce_rating_submission on public.playlist_ratings;
create trigger trg_enforce_rating_submission
before insert or update on public.playlist_ratings
for each row execute function public.enforce_rating_submission();

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION
-- ---------------------------------------------------------------------
do $verify$
declare
  v_policies int;
  v_anon_has_table_select boolean;
  v_anon_cols int;
begin
  select count(*) into v_policies
    from pg_policies
   where schemaname = 'public' and tablename = 'playlist_ratings' and cmd = 'SELECT';
  if v_policies <> 2 then
    raise exception 'expected exactly 2 SELECT policies on playlist_ratings, found %', v_policies;
  end if;

  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'playlist_ratings'
                and policyname = 'ratings are public') then
    raise exception 'the old blanket "ratings are public" SELECT policy is still present';
  end if;

  -- anon must NOT hold a whole-table SELECT any more...
  select exists (
    select 1 from information_schema.table_privileges
     where table_schema = 'public' and table_name = 'playlist_ratings'
       and grantee = 'anon' and privilege_type = 'SELECT'
  ) into v_anon_has_table_select;
  if v_anon_has_table_select then
    raise exception 'anon still holds table-level SELECT on playlist_ratings -- the column allow-list is not in force';
  end if;

  -- ...but must still hold exactly the display columns, or public reviews break.
  select count(*) into v_anon_cols
    from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'playlist_ratings'
     and grantee = 'anon' and privilege_type = 'SELECT';
  if v_anon_cols <> 8 then
    raise exception 'expected anon to hold SELECT on exactly 8 columns of playlist_ratings, found %', v_anon_cols;
  end if;

  if exists (
    select 1 from information_schema.column_privileges
     where table_schema = 'public' and table_name = 'playlist_ratings'
       and grantee = 'anon' and privilege_type = 'SELECT' and column_name = 'user_id'
  ) then
    raise exception 'anon can still read playlist_ratings.user_id';
  end if;

  if not exists (select 1 from pg_constraint where conname = 'plr_review_length') then
    raise exception 'plr_review_length constraint was not created';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_enforce_rating_submission') then
    raise exception 'trg_enforce_rating_submission trigger was not created';
  end if;

  raise notice 'SELF-TEST PASSED: hidden reviews are non-public, anon cannot read user_id, review text capped at 1000 chars, timestamps and moderation state are server-owned.';
end
$verify$;

commit;
