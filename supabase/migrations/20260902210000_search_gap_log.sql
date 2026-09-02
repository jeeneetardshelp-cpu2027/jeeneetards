-- ============================================================================
-- SEARCH GAP LOG -- remember the searches that found nothing, and nothing else.
--
-- WHAT THIS IS. When a student searches and universal_search returns zero
-- rows, that fact currently vanishes. It is the single most useful signal the
-- library has about itself: it names both the aliases that are missing
-- ("hcv", "abj sir") and, far more valuably, the CONTENT students came for and
-- did not find. This table turns the one-off 43-query corpus into a continuous
-- one.
--
-- WHAT IS STORED. One row per settled zero-result search:
--
--   query_text    text        the query as typed, trimmed and capped at 120 chars
--   query_key     text        public.search_latin_key(query_text) -- the same
--                             script-neutral key universal_search matches on,
--                             so Devanagari and Latin spellings of one gap
--                             collapse together
--   result_count  integer     what the search returned (0 today; the column
--                             exists so a future "one weak result" signal does
--                             not need a schema change). CLIENT-ASSERTED and
--                             therefore clamped, never trusted.
--   created_at    timestamptz when it happened
--
-- WHAT IS DELIBERATELY NOT STORED. No user id. No session id. No IP address.
-- No device or browser fingerprint. No referrer, no page, no filter state.
-- Nothing that could link two rows to one person, and nothing that could link
-- a row to an account. This audience is largely under 18 (Privacy Policy s.9)
-- and a search box is where people type things they would not say aloud; a log
-- that cannot be joined to a person is the only version of this feature worth
-- building. The RPC below takes NO identity parameter, so there is no identity
-- for a future caller to start passing by accident.
--
-- THE QUERY IS UNTRUSTED FREE TEXT. It is whatever a student typed. It is
-- trimmed, capped at 120 characters and range-checked here; any surface that
-- ever displays it (an admin page, an export) must escape it. Do not render it
-- as HTML, do not interpolate it into SQL, do not put it in a URL.
--
-- ---------------------------------------------------------------------------
-- HOLD LIFTED 2 Sep 2026. This file carried a do-not-apply banner while it
-- waited outside supabase/migrations/, because `db push` applies every pending
-- migration at once and leaving it in the chain meant no unrelated migration
-- could ship without also switching on this collection.
--
-- Both conditions the banner named have now been met: the owner decided the log
-- should exist, and src/PrivacyPolicy.jsx section 6 names `search_gap_log` and
-- says what it stores, that it is kept for signed-out visitors too, and that
-- its rows cannot be deleted on request because they carry no identity.
-- src/legalTruth.test.js now fails if that disclosure is removed.
--
-- ONE THING THIS FILE CANNOT CHECK. The policy reaching students is a deploy,
-- not a merge: this site serves from the `release` branch. Applying this
-- migration while the disclosure sits in `main` but not in `release` would
-- start collecting search text before the page students can read mentions it —
-- which is the harm the banner existed to prevent, arriving by a different
-- door. Confirm the live /privacy page names the table before pushing.
-- ---------------------------------------------------------------------------
--
-- ABUSE. The insert path is anonymous by construction, so it cannot be
-- rate-limited per account the way content_reports_hardening_v10.sql limits
-- reports per reporter_id. The caps here are therefore shape-based, and they
-- live in the function rather than the client because a client-side cap is a
-- suggestion:
--
--   * one row per query_key per DEDUPE window -- a student holding a key down,
--     or reloading, or ten students searching the same missing chapter in the
--     same hour, is one row;
--   * a ceiling on rows per minute and per hour across the whole table, so a
--     script cycling random strings cannot grow it without bound;
--   * a hard 120-character cap on what is stored;
--   * pg_try_advisory_xact_lock per key so concurrent calls cannot race past
--     the dedupe check (and a caller that loses the race is, by definition, a
--     duplicate and simply returns).
--
-- Over the cap the function returns quietly rather than raising. The caller is
-- a fire-and-forget browser call that ignores the result; an exception there
-- would only produce console noise and a red network row for no benefit.
--
-- RETENTION. None is set, matching the Privacy Policy's honest position that
-- fixed retention periods have not been chosen. `created_at` is indexed so a
-- prune is a one-line delete whenever the owner picks a period.
--
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it with `npx supabase db push`, never by pasting
-- into the SQL Editor, and check `npx supabase migration list` first.
-- Everything here is additive and idempotent (create if not exists, create or
-- replace, drop policy if exists), so a re-run is a no-op.
--
-- ROLLBACK.
--   drop function if exists public.log_search_gap(text, integer);
--   drop table if exists public.search_gap_log;
-- Nothing else in the schema references either. The client returns to the
-- missing-function path, which it already tolerates silently.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- ---------------------------------------------------------------------
-- TABLE. Insert-only: no update policy, no delete policy, no client grant
-- for either. A row is a fact about a moment and is never edited.
-- ---------------------------------------------------------------------
create table if not exists public.search_gap_log (
    id           bigint generated always as identity primary key,
    -- The query as typed. Capped so the table cannot be used as a text dump
    -- and so no single row can carry a pasted document.
    query_text   text not null
                 constraint search_gap_log_query_text_len
                 check (char_length(query_text) between 2 and 120),
    -- search_latin_key(query_text): the comparison key universal_search
    -- itself uses, so gaps group the way matches do.
    query_key    text not null
                 constraint search_gap_log_query_key_len
                 check (char_length(query_key) between 1 and 120),
    -- Client-asserted, clamped by the RPC. 0 for every row the shipped
    -- client writes.
    result_count integer not null default 0
                 constraint search_gap_log_result_count_range
                 check (result_count >= 0 and result_count <= 100000),
    created_at   timestamptz not null default now()
);

comment on table public.search_gap_log is
  'Searches that returned nothing. Query text only -- no user id, no session id, no IP, no device fingerprint, and no column that could carry one. Written solely by public.log_search_gap(); readable only by admins. The text is untrusted student input: escape it everywhere it is displayed.';
comment on column public.search_gap_log.query_text is
  'The query as typed, trimmed and capped at 120 characters. Untrusted free text.';
comment on column public.search_gap_log.query_key is
  'public.search_latin_key(query_text) -- script-neutral grouping key.';
comment on column public.search_gap_log.result_count is
  'Rows the search returned, as asserted by the client and clamped to 0..100000. 0 for every row the shipped client writes.';

-- Serves the per-key dedupe check and the admin "what is missing most" read.
create index if not exists idx_search_gap_log_key_recent
  on public.search_gap_log (query_key, created_at desc);
-- Serves the global rate ceilings and any future retention prune.
create index if not exists idx_search_gap_log_created_at
  on public.search_gap_log (created_at desc);

-- ---------------------------------------------------------------------
-- RLS. Default deny. Exactly one policy: admins read. There is no insert
-- policy and no client INSERT grant, so the SECURITY DEFINER function below
-- is the only way a row can appear. anon cannot SELECT -- a public read
-- would turn this into a live feed of what strangers are typing.
-- ---------------------------------------------------------------------
alter table public.search_gap_log enable row level security;

drop policy if exists "admins read search gaps"   on public.search_gap_log;
drop policy if exists "admins insert search gaps" on public.search_gap_log;
drop policy if exists "anyone logs search gaps"   on public.search_gap_log;

create policy "admins read search gaps" on public.search_gap_log
  for select to authenticated using (public.is_admin());

-- Explicit grants: Supabase's default privileges hand anon and authenticated
-- ALL on new tables and sequences in public, so the revoke is what actually
-- makes the policy story and the privilege story agree.
revoke all on table public.search_gap_log from public, anon, authenticated;
grant select on table public.search_gap_log to authenticated;
revoke all on sequence public.search_gap_log_id_seq from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC. The only writer. SECURITY DEFINER because the table grants nobody
-- INSERT; search_path is pinned empty so every reference is schema-qualified.
--
-- Takes no identity argument, on purpose (see the header).
-- ---------------------------------------------------------------------
create or replace function public.log_search_gap(
  p_query        text,
  p_result_count integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Windows and ceilings. Deliberately generous for a real gap and tight for
  -- a flood: a genuine missing chapter is logged once per half hour, while a
  -- script cycling random strings hits the minute ceiling immediately.
  c_dedupe_window  constant interval := interval '30 minutes';
  c_max_per_minute constant integer  := 60;
  c_max_per_hour   constant integer  := 600;
  c_max_length     constant integer  := 120;

  v_query text;
  v_key   text;
begin
  -- Untrusted free text: trim, then TRUNCATE rather than reject, so a long
  -- paste is still counted instead of being silently dropped.
  v_query := left(btrim(coalesce(p_query, '')), c_max_length);

  -- Mirrors MIN_QUERY in src/useUniversalSearch.js: under two characters is
  -- not a search, it is a keystroke.
  if char_length(v_query) < 2 then
    return;
  end if;

  v_key := public.search_latin_key(v_query);
  -- normalize_search_text returns NULL for input that is all punctuation or
  -- whitespace. Nothing to group by, nothing worth a row.
  if v_key is null or char_length(v_key) = 0 then
    return;
  end if;
  v_key := left(v_key, c_max_length);

  -- Serialize callers working on the SAME key so two of them cannot both pass
  -- the dedupe check. try_ rather than plain: a caller that loses this race is
  -- by definition the duplicate, so returning is the correct outcome and no
  -- request ever waits on a lock.
  if not pg_try_advisory_xact_lock(
       pg_catalog.hashtextextended('search-gap:' || v_key, 0)
     ) then
    return;
  end if;

  if exists (
    select 1
      from public.search_gap_log g
     where g.query_key = v_key
       and g.created_at >= pg_catalog.now() - c_dedupe_window
  ) then
    return;
  end if;

  -- Global ceilings. Approximate by design -- they are a flood stop, not an
  -- accounting boundary, so they are not worth a global lock.
  if (
    select pg_catalog.count(*)
      from public.search_gap_log g
     where g.created_at >= pg_catalog.now() - interval '1 minute'
  ) >= c_max_per_minute then
    return;
  end if;

  if (
    select pg_catalog.count(*)
      from public.search_gap_log g
     where g.created_at >= pg_catalog.now() - interval '1 hour'
  ) >= c_max_per_hour then
    return;
  end if;

  insert into public.search_gap_log (query_text, query_key, result_count)
  values (
    v_query,
    v_key,
    least(greatest(coalesce(p_result_count, 0), 0), 100000)
  );
end;
$$;

alter function public.log_search_gap(text, integer) owner to postgres;

comment on function public.log_search_gap(text, integer) is
  'Records one zero-result search. Takes the query text only -- no identity argument exists, so no caller can attach one. Trims and caps the query at 120 characters, dedupes by search_latin_key for 30 minutes, and enforces per-minute and per-hour ceilings; over any limit it returns quietly because the caller is a fire-and-forget browser call.';

revoke all on function public.log_search_gap(text, integer) from public;
grant execute on function public.log_search_gap(text, integer) to anon;
grant execute on function public.log_search_gap(text, integer) to authenticated;
grant execute on function public.log_search_gap(text, integer) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Abort the whole migration if what it just wrote is not
-- what this file promised. Same discipline as study_days.
-- ---------------------------------------------------------------------
do $selftest$
declare
  policy_count int;
  is_definer   boolean;
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'search_gap_log'
  ) then
    raise exception 'search_gap_log table was not created';
  end if;

  -- No identity column may ever appear here. Named explicitly so that adding
  -- one later fails the push rather than quietly changing what is collected.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'search_gap_log'
       and column_name in ('user_id', 'session_id', 'ip', 'ip_address',
                           'device_id', 'fingerprint', 'client_id', 'anon_id')
  ) then
    raise exception 'search_gap_log must not carry any identity column';
  end if;

  if not exists (
    select 1 from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'search_gap_log'
       and c.relrowsecurity
  ) then
    raise exception 'search_gap_log does not have row level security enabled';
  end if;

  select count(*) into policy_count
    from pg_policies
   where schemaname = 'public' and tablename = 'search_gap_log';
  if policy_count <> 1 then
    raise exception 'expected exactly 1 RLS policy on search_gap_log, found %', policy_count;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'search_gap_log'
       and cmd <> 'SELECT'
  ) then
    raise exception 'search_gap_log must have no policy other than the admin SELECT';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'search_gap_log'
       and grantee = 'anon'
  ) then
    raise exception 'anon must hold no privileges on search_gap_log';
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'search_gap_log'
       and grantee = 'authenticated'
       and privilege_type <> 'SELECT'
  ) then
    raise exception 'authenticated must hold only SELECT on search_gap_log';
  end if;

  if has_table_privilege('anon', 'public.search_gap_log', 'SELECT') then
    raise exception 'anon must not be able to select search_gap_log';
  end if;
  if has_table_privilege('anon', 'public.search_gap_log', 'INSERT') then
    raise exception 'anon must not hold a direct INSERT on search_gap_log';
  end if;
  if has_table_privilege('authenticated', 'public.search_gap_log', 'INSERT') then
    raise exception 'authenticated must not hold a direct INSERT on search_gap_log';
  end if;

  select p.prosecdef into is_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'log_search_gap'
     and pg_get_function_identity_arguments(p.oid) = 'p_query text, p_result_count integer';
  if is_definer is null then
    raise exception 'log_search_gap(text, integer) is missing after replace';
  end if;
  if not is_definer then
    raise exception 'log_search_gap must be SECURITY DEFINER';
  end if;

  if not has_function_privilege('anon', 'public.log_search_gap(text, integer)', 'EXECUTE') then
    raise exception 'anon must be able to execute log_search_gap';
  end if;

  raise notice 'SELF-TEST PASSED: search_gap_log exists with no identity column, RLS on, one admin-only SELECT policy, anon holds no table privilege, and log_search_gap is SECURITY DEFINER and executable by anon.';
end
$selftest$;

commit;
