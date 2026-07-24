-- STAGING-ONLY dry run of the byte-for-byte production package body.
-- Expected final result: one evidence row, then ROLLBACK.
begin;

create temporary table fq_baseline on commit drop as
select
  (select count(*) from public.playlists) as playlists,
  (select count(*) from public.videos) as videos,
  (select count(*) from public.playlist_videos) as playlist_video_links,
  (select count(*) from public.playlist_learning_goals) as goal_links,
  (select count(*) from public.playlist_class_levels) as class_links,
  (select count(*) from public.teachers) as teachers,
  (select count(*) from public.playlist_teachers) as faculty_links;

-- AUTO-GENERATED — FACULTY + CONTENT QUALITY PRODUCTION PACKAGE.
-- Requires a verified recent backup and explicit production approval.
-- Additive identity/editorial schema. It never scans legacy names and never
-- creates or merges a teacher without a later human review decision.


-- ============================================================
-- src/migrations/faculty_quality_production_preflight.sql
-- ============================================================

-- Production preflight for the reviewed faculty + content-quality package.
-- Read-only assertions. Any mismatch aborts before the first schema change.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.playlists') is null then missing := array_append(missing, 'playlists'); end if;
  if to_regclass('public.videos') is null then missing := array_append(missing, 'videos'); end if;
  if to_regclass('public.institutes_channels') is null then missing := array_append(missing, 'institutes_channels'); end if;
  if to_regclass('public.subjects') is null then missing := array_append(missing, 'subjects'); end if;
  if to_regclass('public.learning_goals') is null then missing := array_append(missing, 'learning_goals'); end if;
  if to_regclass('public.playlist_learning_goals') is null then missing := array_append(missing, 'playlist_learning_goals'); end if;
  if to_regclass('public.playlist_class_levels') is null then missing := array_append(missing, 'playlist_class_levels'); end if;
  if to_regprocedure('public.is_admin()') is null then missing := array_append(missing, 'is_admin()'); end if;
  if to_regprocedure('public.import_playlist(jsonb,text)') is null then missing := array_append(missing, 'import_playlist(jsonb,text)'); end if;
  if to_regprocedure('public.create_course(jsonb)') is null then missing := array_append(missing, 'create_course(jsonb)'); end if;
  if to_regprocedure('public.import_playlist(jsonb)') is not null then
    raise exception 'legacy import_playlist(jsonb) overload still exists';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'pg_trgm extension is missing';
  end if;
  if cardinality(missing) > 0 then raise exception 'missing production prerequisites: %', missing; end if;

  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='playlists' and column_name='teacher') then
    raise exception 'playlists.teacher legacy source column is missing';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='playlists' and column_name='content_type') then
    raise exception 'playlist decision metadata is missing';
  end if;
end $$;



-- ============================================================
-- src/migrations/teachers_v7.sql
-- ============================================================

-- ============================================================
--  v7 (CORRECTED) — FACULTY IDENTITY, WITHOUT ASSUMING IDENTITY
--
--  Delta on top of v6.2. NOT applied anywhere. NOT part of the verified
--  production migration. Staging only, and only after review.
--
--  ── THE CORRECTION ──────────────────────────────────────────
--  The first draft of this file made normalised equality PROVE identity:
--  teacher_aliases.normalized_alias was globally unique, teachers.canonical_name
--  was globally unique, and find_teacher() returned a single id. Together those
--  made two real people who share a name unrepresentable, and silently merged
--  them. Two teachers can both be "Amit Kumar". Two teachers can both be known
--  as "AB". A database that cannot say so is wrong.
--
--  The rule now, everywhere in this file:
--
--      Normalised equality SUGGESTS a candidate. It never proves identity,
--      never merges people, and never auto-selects.
--
--  Consequences, all deliberate:
--    * unique(teacher_id, normalized_alias) — an alias is unique WITHIN a
--      teacher, not across teachers.
--    * no unique index on canonical_name.
--    * search returns EVERY candidate and flags ambiguity; callers must ask.
--    * the free-text migration proposes. It writes no teachers, no aliases and
--      no playlist links until a human approves a specific resolution.
-- ============================================================

create extension if not exists pg_trgm;

-- pg_trgm is relocatable. Supabase projects may install it in `public` or in
-- `extensions`. Discover that once and compile a schema-qualified wrapper;
-- search ranking must not depend on the caller's search_path.
do $install_catalog_similarity$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if v_schema is null then raise exception 'pg_trgm extension is not installed'; end if;
  execute format(
    'create or replace function public.catalog_similarity(text, text)
       returns real language sql immutable strict set search_path = ''''
       as $fn$ select %I.similarity($1, $2) $fn$', v_schema);
end
$install_catalog_similarity$;

-- ------------------------------------------------------------
-- 1. NAME NORMALISATION
--    A comparison key, not an identity. One signature only.
-- ------------------------------------------------------------
create or replace function public.normalize_person_name(p_name text)
returns text language sql immutable as $$
  -- UNICODE-SAFE. Do not remove "non-alphanumeric" characters here:
  -- PostgreSQL recognises Devanagari base letters as [:alnum:] but not their
  -- combining vowel marks. Replacing punctuation and whitespace preserves
  -- complete Indic-script words instead of breaking them into consonants.
  -- Original-script names and their
  -- transliterations are kept as SEPARATE reviewed aliases (alias_type
  -- 'transliteration'), never folded into one another.
  select nullif(
    trim(
      regexp_replace(                                     -- 4. collapse whitespace
        regexp_replace(                                   -- 3. strip honorifics (Latin only)
          regexp_replace(                                 -- 2. punctuation/whitespace -> space
            regexp_replace(                               -- 1. drop apostrophes
              lower(coalesce(p_name, '')), '[''’`´]', '', 'g'),
            '[[:punct:][:space:]]+', ' ', 'g'),
          '\y(sir|maam|mam|madam|mister|mr|mrs|ms|miss|dr|doctor|prof|professor|ji|bhaiya|bhaiyya|guruji)\y',
          ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;

-- Does this free-text string name MORE THAN ONE person?
-- Separators do NOT require surrounding spaces: "ABJ&NS", "ABJ/NS", "ABJ+NS"
-- are as common as "Amit & Priya". False positives ("Kumar, Amit") are fine —
-- they only route the value to manual review, which is where an ambiguous
-- human name belongs anyway.
create or replace function public.looks_like_multiple_people(p_name text)
returns boolean language sql immutable as $$
  select coalesce(p_name, '') ~* '[&+/]|(\y(and|aur|evam|with)\y)|,';
$$;

-- Not a person at all: "Faculty Team", "Physics Department", "Various Teachers".
-- These must never become a teacher record, so they are classified separately
-- rather than lumped in with genuine multi-person strings.
create or replace function public.looks_like_organization(p_name text)
returns boolean language sql immutable as $$
  select coalesce(p_name, '') ~* '\y(team|department|dept|faculty|faculties|teachers|staff|various|multiple|panel|group|institute|academy|classes)\y';
$$;

-- ------------------------------------------------------------
-- 2. TABLES
-- ------------------------------------------------------------
create table if not exists public.teachers (
    id             bigint generated always as identity primary key,
    display_name   text not null,
    canonical_name text not null,          -- comparison key, maintained by trigger
    slug           text not null unique,   -- URL identity; disambiguated on collision
    bio            text,
    photo_url      text,
    verified       boolean not null default false,
    created_at     timestamptz not null default now()
);
-- Deliberately NOT unique: two different people may share a canonical name.
-- Indexed for lookup only.
create index if not exists idx_teachers_canonical on public.teachers (canonical_name);

create table if not exists public.teacher_aliases (
    id               bigint generated always as identity primary key,
    teacher_id       bigint not null references public.teachers(id) on delete cascade,
    alias            text not null,
    normalized_alias text not null,        -- maintained by trigger
    -- what KIND of alias this is, so ranking can treat them differently
    alias_type       text not null default 'nickname'
                     check (alias_type in ('full-name','short','initials','nickname',
                                           'maiden','transliteration','misspelling')),
    -- provenance and review state. An alias nobody has checked must not rank
    -- like one a human verified.
    status           text not null default 'proposed'
                     check (status in ('proposed','verified','rejected')),
    source           text not null default 'manual'
                     check (source in ('manual','migrated','import','student-report')),
    created_by       uuid references auth.users(id) on delete set null,
    verified_by      uuid references auth.users(id) on delete set null,
    verified_at      timestamptz,
    created_at       timestamptz not null default now(),
    -- An alias is unique WITHIN a teacher. Across teachers it may repeat:
    -- that is what makes an ambiguous alias representable instead of merged.
    unique (teacher_id, normalized_alias)
);
create index if not exists idx_alias_teacher on public.teacher_aliases (teacher_id);
create index if not exists idx_alias_norm    on public.teacher_aliases (normalized_alias);

-- ---- context junctions: what distinguishes two same-named teachers ----
create table if not exists public.teacher_institutes (
    teacher_id   bigint not null references public.teachers(id) on delete cascade,
    institute_id bigint not null references public.institutes_channels(id) on delete cascade,
    is_primary   boolean not null default false,
    primary key (teacher_id, institute_id)
);
create table if not exists public.teacher_subjects (
    teacher_id bigint not null references public.teachers(id)  on delete cascade,
    subject_id bigint not null references public.subjects(id)  on delete cascade,
    primary key (teacher_id, subject_id)
);
create table if not exists public.teacher_learning_goals (
    teacher_id       bigint not null references public.teachers(id)       on delete cascade,
    learning_goal_id bigint not null references public.learning_goals(id) on delete cascade,
    primary key (teacher_id, learning_goal_id)
);
create index if not exists idx_ti_inst on public.teacher_institutes (institute_id);
create index if not exists idx_ts_sub  on public.teacher_subjects (subject_id);
create index if not exists idx_tlg_goal on public.teacher_learning_goals (learning_goal_id);

create table if not exists public.playlist_teachers (
    playlist_id bigint not null references public.playlists(id) on delete cascade,
    teacher_id  bigint not null references public.teachers(id)  on delete restrict,
    role        text   not null default 'instructor'
                check (role in ('instructor','co-instructor','guest')),
    position    int    not null default 1,
    primary key (playlist_id, teacher_id)
);
create index if not exists idx_pt_teacher on public.playlist_teachers (teacher_id);

create table if not exists public.video_teachers (
    video_id   bigint not null references public.videos(id)   on delete cascade,
    teacher_id bigint not null references public.teachers(id) on delete restrict,
    primary key (video_id, teacher_id)
);
create index if not exists idx_vt_teacher on public.video_teachers (teacher_id);

-- ------------------------------------------------------------
-- 3. THE PROPOSAL LEDGER
--    The free-text migration writes ONLY here. A pending row has changed
--    nothing in the content tables.
-- ------------------------------------------------------------
create table if not exists public.teacher_name_proposals (
    id            bigint generated always as identity primary key,
    raw_teacher   text not null unique,      -- the exact free-text string seen
    normalized    text,                      -- null when it normalises to nothing
    occurrences   int  not null default 0,   -- how many playlists carry it
    kind          text not null
                  check (kind in ('single','multi-person','organization-or-team','blank')),
    status        text not null default 'pending'
                  check (status in ('pending','approved-existing','approved-new',
                                    'split','rejected','deferred')),
    resolved_teacher_ids bigint[],           -- filled in on approval
    note          text,
    reviewed_by   uuid references auth.users(id) on delete set null,
    reviewed_at   timestamptz,
    created_at    timestamptz not null default now()
);
create index if not exists idx_proposal_status on public.teacher_name_proposals (status);

-- ------------------------------------------------------------
-- 4. DERIVED COLUMNS
-- ------------------------------------------------------------
create or replace function public.set_teacher_canonical()
returns trigger language plpgsql as $$
declare v_base text; v_slug text; v_n int := 1;
begin
  new.canonical_name := public.normalize_person_name(new.display_name);
  if new.canonical_name is null then
    raise exception 'teacher display_name % normalises to nothing', new.display_name;
  end if;
  if new.slug is null or new.slug = '' then
    -- Two concurrent "Amit Kumar" inserts would otherwise both scan, both pick
    -- amit-kumar-2, and one would die on the unique index. Serialise slug
    -- allocation per canonical name for the duration of the transaction.
    perform pg_advisory_xact_lock(hashtext('teacher_slug:' || new.canonical_name));
    -- Slugs must be unique for URLs even though NAMES need not be, so a second
    -- "Amit Kumar" becomes amit-kumar-2 rather than colliding or merging.
    v_base := regexp_replace(new.canonical_name, '\s+', '-', 'g');
    v_slug := v_base;
    while exists (select 1 from public.teachers t
                   where t.slug = v_slug and t.id is distinct from new.id) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    new.slug := v_slug;
  end if;
  return new;
end; $$;
drop trigger if exists trg_teacher_canonical on public.teachers;
create trigger trg_teacher_canonical before insert or update on public.teachers
  for each row execute function public.set_teacher_canonical();

create or replace function public.set_alias_normalized()
returns trigger language plpgsql as $$
begin
  new.normalized_alias := public.normalize_person_name(new.alias);
  if new.normalized_alias is null then
    raise exception 'alias % normalises to nothing', new.alias;
  end if;
  return new;
end; $$;
drop trigger if exists trg_alias_normalized on public.teacher_aliases;
create trigger trg_alias_normalized before insert or update on public.teacher_aliases
  for each row execute function public.set_alias_normalized();

-- ------------------------------------------------------------
-- 5. SEARCH INDEXES
-- ------------------------------------------------------------
create index if not exists idx_teachers_canonical_pattern
  on public.teachers (canonical_name text_pattern_ops);
create index if not exists idx_alias_norm_pattern
  on public.teacher_aliases (normalized_alias text_pattern_ops);
create index if not exists idx_teachers_canonical_trgm
  on public.teachers using gin (canonical_name gin_trgm_ops);
create index if not exists idx_alias_norm_trgm
  on public.teacher_aliases using gin (normalized_alias gin_trgm_ops);

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
alter table public.teachers               enable row level security;
alter table public.teacher_aliases        enable row level security;
alter table public.teacher_institutes     enable row level security;
alter table public.teacher_subjects       enable row level security;
alter table public.teacher_learning_goals enable row level security;
alter table public.playlist_teachers      enable row level security;
alter table public.video_teachers         enable row level security;
alter table public.teacher_name_proposals enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['teachers','teacher_institutes',
                             'teacher_subjects','teacher_learning_goals',
                             'playlist_teachers','video_teachers'] loop
    execute format('drop policy if exists "public read" on public.%I', tbl);
    execute format('create policy "public read" on public.%I for select using (true)', tbl);
  end loop;
end $$;

-- teacher_aliases is NOT blanket-public. A proposed alias is an unreviewed
-- identity CLAIM about a real person; filtering it out of search_teachers()
-- means nothing while PostgREST will happily serve
-- /rest/v1/teacher_aliases?select=* to anyone. The row itself must be
-- unreadable. Two permissive SELECT policies OR together: the public one is
-- restricted to verified, the admin one covers every status.
drop policy if exists "public read"          on public.teacher_aliases;
drop policy if exists "public read verified" on public.teacher_aliases;
drop policy if exists "admin read aliases"   on public.teacher_aliases;
create policy "public read verified" on public.teacher_aliases
  for select to anon, authenticated using (status = 'verified');
create policy "admin read aliases" on public.teacher_aliases
  for select to authenticated using (public.is_admin());

drop policy if exists "admin read proposals" on public.teacher_name_proposals;
create policy "admin read proposals" on public.teacher_name_proposals
  for select using (public.is_admin());
revoke all on table public.teacher_name_proposals from anon;

-- ------------------------------------------------------------
-- 7. SEARCH — returns CANDIDATES, with context, and says when it is unsure.
--
--    Ranking
--      1 exact on canonical name, or on a VERIFIED alias
--      2 exact on an unverified (proposed/migrated) alias  <- demoted on purpose
--      3 prefix
--      4 partial / contains
--      5 typo-tolerant (short queries excluded — see below)
--
--    SHORT-QUERY PROTECTION: trigram similarity on 1-3 character queries
--    matches almost everything, which would bury the real answer under noise
--    and make an ambiguous alias look decisive. Fuzzy is disabled below 4
--    characters, and prefix below 2.
--
--    `is_ambiguous` is true when more than one teacher ties at the best rank.
--    Callers MUST NOT auto-select in that case — that is the whole point.
-- ------------------------------------------------------------
-- The engine. p_include_unverified is NEVER exposed to students: an alias
-- nobody has reviewed is an unverified identity CLAIM about a real person, and
-- publishing it is a different kind of wrong from ranking it low. Public search
-- passes false; the admin review console passes true.
create or replace function public.search_teachers_internal(
    p_query text, p_limit int, p_include_unverified boolean)
returns table (
    teacher_id bigint, display_name text, slug text, verified boolean,
    match_type text, match_rank int, matched_on text, alias_status text,
    institutes text, subjects text, goals text,
    course_count bigint, is_ambiguous boolean
) language sql stable as $$
  with nq as (
    select public.normalize_person_name(p_query) as q,
           length(public.normalize_person_name(p_query)) as qlen
  ),
  cand as (
      -- A teacher's own display name is always searchable, even when the
      -- teacher record is unverified; the UI shows that status.
      select t.id as tid, 1 as rk, 'exact-name'::text as mt, t.display_name as mo, null::text as st
        from public.teachers t, nq where nq.q is not null and t.canonical_name = nq.q
      union all
      select a.teacher_id, 1, 'exact-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and a.normalized_alias = nq.q and a.status = 'verified'
      union all
      select a.teacher_id, 2, 'exact-alias-unverified', a.alias, a.status
        from public.teacher_aliases a, nq
       where p_include_unverified and nq.q is not null
         and a.normalized_alias = nq.q and a.status = 'proposed'
      union all
      select t.id, 3, 'prefix', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 2 and t.canonical_name like nq.q || '%'
      union all
      select a.teacher_id, 3, 'prefix-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 2
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and a.normalized_alias like nq.q || '%'
      union all
      select t.id, 4, 'partial', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 3 and t.canonical_name like '%' || nq.q || '%'
      union all
      select a.teacher_id, 4, 'partial-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 3
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and a.normalized_alias like '%' || nq.q || '%'
      union all
      -- fuzzy needs 4+ characters: on "AB" trigram matches nearly everyone and
      -- would bury the real answer while making an ambiguous alias look decisive
      select t.id, 5, 'fuzzy', t.display_name, null
        from public.teachers t, nq
       where nq.q is not null and nq.qlen >= 4 and public.catalog_similarity(t.canonical_name, nq.q) >= 0.4
      union all
      select a.teacher_id, 5, 'fuzzy-alias', a.alias, a.status
        from public.teacher_aliases a, nq
       where nq.q is not null and nq.qlen >= 4
         and (a.status = 'verified' or (p_include_unverified and a.status = 'proposed'))
         and public.catalog_similarity(a.normalized_alias, nq.q) >= 0.4
  ),
  best as (select distinct on (tid) tid, rk, mt, mo, st from cand order by tid, rk, mt),
  toprank as (select min(rk) as r, count(*) as n from best where rk = (select min(rk) from best))
  select b.tid, t.display_name, t.slug, t.verified, b.mt, b.rk, b.mo, b.st,
         (select string_agg(ic.name, ', ' order by ic.name) from public.teacher_institutes ti
            join public.institutes_channels ic on ic.id = ti.institute_id where ti.teacher_id = b.tid),
         (select string_agg(sj.name, ', ' order by sj.name) from public.teacher_subjects ts
            join public.subjects sj on sj.id = ts.subject_id where ts.teacher_id = b.tid),
         (select string_agg(lg.name, ', ' order by lg.name) from public.teacher_learning_goals tg
            join public.learning_goals lg on lg.id = tg.learning_goal_id where tg.teacher_id = b.tid),
         (select count(*) from public.playlist_teachers pt where pt.teacher_id = b.tid),
         (b.rk = (select r from toprank) and (select n from toprank) > 1)
    from best b join public.teachers t on t.id = b.tid
   order by b.rk, t.verified desc,
            (select count(*) from public.playlist_teachers pt where pt.teacher_id = b.tid) desc,
            t.display_name
   limit greatest(coalesce(p_limit, 10), 1);
$$;

-- PUBLIC. Verified aliases only; rejected aliases are searchable nowhere.
--
-- SECURITY DEFINER on purpose: EXECUTE on search_teachers_internal is revoked
-- from anon, so an invoker-rights wrapper would fail with "permission denied
-- for function search_teachers_internal" the moment a logged-out student
-- searched. Running as the owner is what lets the public wrapper use the
-- private engine. include_unverified is hardcoded false — it is not a
-- parameter, so no caller can widen it.
create or replace function public.search_teachers(p_query text, p_limit int default 10)
returns table (
    teacher_id bigint, display_name text, slug text, verified boolean,
    match_type text, match_rank int, matched_on text, alias_status text,
    institutes text, subjects text, goals text,
    course_count bigint, is_ambiguous boolean
) language sql stable security definer set search_path = '' as $$
  select * from public.search_teachers_internal(p_query, p_limit, false);
$$;

-- ADMIN ONLY. Includes proposed aliases, for the review console.
create or replace function public.search_teacher_candidates(p_query text, p_limit int default 10)
returns table (
    teacher_id bigint, display_name text, slug text, verified boolean,
    match_type text, match_rank int, matched_on text, alias_status text,
    institutes text, subjects text, goals text,
    course_count bigint, is_ambiguous boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  -- Granting this to `authenticated` without a body check made "admin search"
  -- available to every signed-in student. The grant is not the boundary; this is.
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.search_teachers_internal(p_query, p_limit, true);
end; $$;

-- Preview near-duplicates BEFORE creating anything (see create_teacher).
create or replace function public.similar_teachers(p_name text, p_limit int default 5)
returns table (
    teacher_id bigint, display_name text, slug text, verified boolean,
    match_type text, match_rank int, matched_on text, alias_status text,
    institutes text, subjects text, goals text,
    course_count bigint, is_ambiguous boolean
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.search_teachers_internal(p_name, p_limit, true);
end; $$;

-- Resolve to exactly ONE teacher, or say precisely why not. Three different
-- "no" answers, because they call for three different responses:
--   ambiguous        -> several exact candidates; a human must choose
--   unverified-match -> exact candidates exist but only via unreviewed aliases
--   no-match         -> genuinely nothing
-- There is deliberately no function that breaks a tie.
create or replace function public.resolve_teacher_exact(p_name text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  -- Admin/importer only. It reports candidates reached through PROPOSED
  -- aliases (that is the point of the 'unverified-match' outcome), so exposing
  -- it to ordinary authenticated users would leak exactly what the alias RLS
  -- above is protecting.
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  with hits as (
    select * from public.search_teachers_internal(p_name, 25, true) where match_rank <= 2
  ),
  verified_hits as (select * from hits where match_rank = 1)
  select case
    when (select count(*) from hits) = 0 then
      jsonb_build_object('resolved', false, 'reason', 'no-match', 'candidates', '[]'::jsonb)
    when (select count(*) from verified_hits) = 1 then
      jsonb_build_object('resolved', true, 'teacher_id', (select teacher_id from verified_hits))
    when (select count(*) from verified_hits) > 1 then
      jsonb_build_object('resolved', false, 'reason', 'ambiguous',
        'candidates', (select jsonb_agg(jsonb_build_object('teacher_id', teacher_id,
            'display_name', display_name, 'institutes', institutes, 'subjects', subjects,
            'course_count', course_count)) from verified_hits))
    else
      -- only unreviewed aliases matched: candidates exist, but nothing is proven
      jsonb_build_object('resolved', false, 'reason', 'unverified-match',
        'candidates', (select jsonb_agg(jsonb_build_object('teacher_id', teacher_id,
            'display_name', display_name, 'matched_on', matched_on, 'alias_status', alias_status,
            'institutes', institutes, 'course_count', course_count)) from hits))
  end
  into v_result;
  return v_result;
end; $$;

-- ------------------------------------------------------------
-- 8. FACETS / PROFILE (unchanged in spirit)
-- ------------------------------------------------------------
create or replace function public.get_faculty_facets(
    p_chapter_id bigint default null, p_subject_id bigint default null,
    p_goal_id bigint default null)
returns table (teacher_id bigint, display_name text, slug text, verified boolean,
               institutes text, course_count bigint)
language sql stable as $$
  select t.id, t.display_name, t.slug, t.verified,
         (select string_agg(ic.name, ', ' order by ic.name)
            from public.teacher_institutes ti
            join public.institutes_channels ic on ic.id = ti.institute_id
           where ti.teacher_id = t.id),
         count(distinct pl.id)
    from public.teachers t
    join public.playlist_teachers pt on pt.teacher_id = t.id
    join public.playlists pl         on pl.id = pt.playlist_id
   where (p_goal_id is null or exists (select 1 from public.playlist_learning_goals g
            where g.playlist_id = pl.id and g.learning_goal_id = p_goal_id))
     and (p_subject_id is null or pl.subject_id = p_subject_id)
     and (p_chapter_id is null or exists (select 1 from public.playlist_videos pv
            join public.videos v on v.id = pv.video_id
           where pv.playlist_id = pl.id and v.chapter_id = p_chapter_id))
   group by t.id, t.display_name, t.slug, t.verified
  having count(distinct pl.id) > 0
   order by count(distinct pl.id) desc, t.verified desc, t.display_name;
$$;

create or replace function public.get_faculty_profile(p_slug text)
returns jsonb language sql stable as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id, 'display_name', t.display_name, 'slug', t.slug,
    'verified', t.verified, 'bio', t.bio, 'photo_url', t.photo_url,
    'aliases', coalesce((select jsonb_agg(jsonb_build_object(
                            'alias', a.alias, 'type', a.alias_type, 'status', a.status)
                          order by a.status desc, a.alias)
                           from public.teacher_aliases a
                          where a.teacher_id = t.id and a.status <> 'rejected'), '[]'::jsonb),
    'institutes', coalesce((select jsonb_agg(ic.name order by ic.name)
                              from public.teacher_institutes ti
                              join public.institutes_channels ic on ic.id = ti.institute_id
                             where ti.teacher_id = t.id), '[]'::jsonb),
    'course_count', (select count(*) from public.playlist_teachers pt where pt.teacher_id = t.id),
    'courses', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'playlist_id', pl.id, 'title', pl.title, 'subject', s.name, 'role', pt.role,
                 'average_rating', pl.average_rating, 'ratings_count', pl.ratings_count)
               order by pl.title)
          from public.playlist_teachers pt
          join public.playlists pl on pl.id = pt.playlist_id
          left join public.subjects s on s.id = pl.subject_id
         where pt.teacher_id = t.id), '[]'::jsonb)
  ) end
  from public.teachers t where t.slug = p_slug;
$$;

-- ------------------------------------------------------------
-- 9. WRITE PATH
--
--    create_teacher ALWAYS creates. It cannot refuse on the grounds that a
--    similar name exists, because a similar name is not evidence of the same
--    person. It RETURNS the candidates so the caller can show a warning and
--    let a human decide — which is a different thing from deciding for them.
-- ------------------------------------------------------------
create or replace function public.create_teacher(
    p_display_name text,
    p_aliases      jsonb default '[]',   -- [{alias, type}] or ["str", ...]
    p_verified     boolean default false,
    p_duplicate_acknowledged boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_cands jsonb; v_el jsonb; v_alias text; v_type text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if public.normalize_person_name(p_display_name) is null then
    raise exception 'display_name is required'; end if;
  if public.looks_like_multiple_people(p_display_name) then
    raise exception 'display_name "%" looks like more than one person', p_display_name; end if;

  if public.looks_like_organization(p_display_name) then
    raise exception 'display_name "%" looks like a team or department, not a person', p_display_name; end if;

  -- Duplicate detection happens BEFORE the insert. A strong candidate (an exact
  -- name or verified-alias match) does not PROVE this is the same person — so
  -- creation is not forbidden — but it must not happen by accident. The admin
  -- previews with similar_teachers(), then re-submits with the acknowledgement.
  select jsonb_agg(jsonb_build_object('teacher_id', teacher_id, 'display_name', display_name,
                                      'match_type', match_type, 'institutes', institutes,
                                      'course_count', course_count))
    into v_cands from public.search_teachers_internal(p_display_name, 5, true) where match_rank = 1;
  if v_cands is not null and not p_duplicate_acknowledged then
    raise exception 'existing faculty already match "%": % — review them, then resubmit with p_duplicate_acknowledged := true if this is genuinely a different person',
      p_display_name, v_cands
      using errcode = 'check_violation';
  end if;

  insert into public.teachers (display_name, verified)
  values (trim(p_display_name), p_verified) returning id into v_id;

  insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by)
  values (v_id, trim(p_display_name), 'full-name',
          case when p_verified then 'verified' else 'proposed' end, 'manual', auth.uid());

  for v_el in select * from jsonb_array_elements(coalesce(p_aliases, '[]'::jsonb)) loop
    if jsonb_typeof(v_el) = 'string' then
      v_alias := v_el #>> '{}'; v_type := 'nickname';
    else
      v_alias := v_el->>'alias'; v_type := coalesce(v_el->>'type', 'nickname');
    end if;
    if public.normalize_person_name(v_alias) is not null then
      insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by)
      values (v_id, trim(v_alias), v_type, 'proposed', 'manual', auth.uid())
      on conflict (teacher_id, normalized_alias) do nothing;
    end if;
  end loop;

  return jsonb_build_object('teacher_id', v_id, 'created', true,
                            'duplicate_acknowledged', p_duplicate_acknowledged,
                            'matched_before_create', coalesce(v_cands, '[]'::jsonb));
end; $$;

-- An alias may be shared across teachers; it is unique only within one.
create or replace function public.add_teacher_alias(
    p_teacher_id bigint, p_alias text,
    p_type text default 'nickname', p_verified boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_shared jsonb;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;
  if public.normalize_person_name(p_alias) is null then
    raise exception 'alias % normalises to nothing', p_alias; end if;

  insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source,
                                      created_by, verified_by, verified_at)
  values (p_teacher_id, trim(p_alias), p_type,
          case when p_verified then 'verified' else 'proposed' end, 'manual',
          auth.uid(), case when p_verified then auth.uid() end,
          case when p_verified then now() end)
  on conflict (teacher_id, normalized_alias) do update
    set alias_type = excluded.alias_type,
        -- Verification only ever moves forward. (Not greatest(): relying on
        -- 'verified' > 'proposed' alphabetically would silently invert the
        -- moment someone adds a status like 'withdrawn'.)
        status = case when public.teacher_aliases.status = 'verified'
                        or excluded.status = 'verified' then 'verified'
                      else excluded.status end,
        verified_by = coalesce(excluded.verified_by, public.teacher_aliases.verified_by),
        verified_at = coalesce(excluded.verified_at, public.teacher_aliases.verified_at);

  -- Informational: who else answers to this alias. Not an error.
  select jsonb_agg(jsonb_build_object('teacher_id', t.id, 'display_name', t.display_name))
    into v_shared
    from public.teacher_aliases a join public.teachers t on t.id = a.teacher_id
   where a.normalized_alias = public.normalize_person_name(p_alias)
     and a.teacher_id <> p_teacher_id;

  return jsonb_build_object('teacher_id', p_teacher_id, 'alias', trim(p_alias),
                            'also_used_by', coalesce(v_shared, '[]'::jsonb));
end; $$;

-- ------------------------------------------------------------
-- 10. FREE-TEXT MIGRATION — PROPOSAL ONLY.
--
--     scan_free_text_teachers() is a READ of playlists.teacher that writes
--     ONLY to teacher_name_proposals. It creates no teacher, no alias and no
--     playlist link. A pending proposal has changed nothing.
-- ------------------------------------------------------------
create or replace function public.scan_free_text_teachers()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_new int := 0; v_multi int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;

  for r in
    select p.teacher as raw, count(*) as n
      from public.playlists p
     where nullif(trim(coalesce(p.teacher,'')), '') is not null
     group by p.teacher
  loop
    insert into public.teacher_name_proposals (raw_teacher, normalized, occurrences, kind)
    values (r.raw, public.normalize_person_name(r.raw), r.n,
            -- organisation is checked FIRST: "Physics Department" also trips the
            -- multi-person separators, but it is not two people — it is nobody,
            -- and it must never become a teacher record.
            case when public.normalize_person_name(r.raw) is null then 'blank'
                 when public.looks_like_organization(r.raw) then 'organization-or-team'
                 when public.looks_like_multiple_people(r.raw) then 'multi-person'
                 else 'single' end)
    on conflict (raw_teacher) do update set occurrences = excluded.occurrences;
    v_new := v_new + 1;
    if public.looks_like_multiple_people(r.raw) then v_multi := v_multi + 1; end if;
  end loop;

  return jsonb_build_object(
    'proposals_total',   (select count(*) from public.teacher_name_proposals),
    'pending',           (select count(*) from public.teacher_name_proposals where status = 'pending'),
    'multi_person',      v_multi,
    'teachers_created',  0,
    'aliases_created',   0,
    'playlist_links_created', 0,
    'note', 'proposal only — nothing was written to teachers, aliases or playlist_teachers');
end; $$;

-- ---- approval operations: each one does its writes transactionally ----

create or replace function public.approve_proposal_as_existing(
    p_proposal_id bigint, p_teacher_id bigint, p_add_alias boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p record; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status <> 'pending' and p.status <> 'deferred' then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if p.kind = 'multi-person' then
    raise exception 'proposal % names more than one person — use split_proposal()', p_proposal_id; end if;
  if p.kind = 'organization-or-team' then
    raise exception 'proposal % is a team/department, not a person — reject it or split it into the real faculty', p_proposal_id; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;

  if p_add_alias then
    insert into public.teacher_aliases (teacher_id, alias, alias_type, status, source, created_by, verified_by, verified_at)
    values (p_teacher_id, trim(p.raw_teacher), 'nickname', 'verified', 'migrated', auth.uid(), auth.uid(), now())
    on conflict (teacher_id, normalized_alias) do update
      set status = 'verified', verified_by = auth.uid(), verified_at = now();
  end if;

  insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
  select pl.id, p_teacher_id, 'instructor', 1
    from public.playlists pl where pl.teacher = p.raw_teacher
  on conflict (playlist_id, teacher_id) do nothing;
  get diagnostics v_links = row_count;

  update public.teacher_name_proposals
     set status = 'approved-existing', resolved_teacher_ids = array[p_teacher_id],
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'approved-existing',
                                       array[p_teacher_id], null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teacher_id', p_teacher_id,
                            'playlists_linked', v_links);
end; $$;

create or replace function public.approve_proposal_as_new(
    p_proposal_id bigint, p_display_name text default null, p_verified boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p record; v_new jsonb; v_tid bigint; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status not in ('pending','deferred') then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if p.kind = 'multi-person' then
    raise exception 'proposal % names more than one person — use split_proposal()', p_proposal_id; end if;
  if p.kind = 'organization-or-team' then
    raise exception 'proposal % is a team/department, not a person — reject it or split it into the real faculty', p_proposal_id; end if;

  v_new := public.create_teacher(coalesce(p_display_name, trim(p.raw_teacher)), '[]'::jsonb, p_verified, true);
  v_tid := (v_new->>'teacher_id')::bigint;

  if coalesce(p_display_name, '') <> '' and p_display_name <> p.raw_teacher then
    perform public.add_teacher_alias(v_tid, trim(p.raw_teacher), 'nickname', true);
  end if;

  insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
  select pl.id, v_tid, 'instructor', 1
    from public.playlists pl where pl.teacher = p.raw_teacher
  on conflict (playlist_id, teacher_id) do nothing;
  get diagnostics v_links = row_count;

  update public.teacher_name_proposals
     set status = 'approved-new', resolved_teacher_ids = array[v_tid],
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'approved-new',
                                       array[v_tid], null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teacher_id', v_tid,
                            'playlists_linked', v_links,
                            'similar_existing', v_new->'similar_existing');
end; $$;

-- "Amit & Priya" -> two real teachers, both linked to every affected playlist.
create or replace function public.split_proposal(
    p_proposal_id bigint, p_teacher_ids bigint[], p_override_kind boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p record; v_id bigint; v_pos int := 0; v_links int := 0; v_total int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  -- FOR UPDATE: two admins opening the review queue must not both approve
  -- the same proposal and double-link its playlists.
  select * into p from public.teacher_name_proposals where id = p_proposal_id for update;
  if not found then raise exception 'invalid proposal_id %', p_proposal_id; end if;
  if p.status not in ('pending','deferred') then
    raise exception 'proposal % is already %', p_proposal_id, p.status; end if;
  if coalesce(array_length(p_teacher_ids,1),0) < 2 then
    raise exception 'split needs at least two teacher_ids'; end if;
  -- Splitting a value that does not look like several people is usually a
  -- mistake, so it needs an explicit override rather than silent acceptance.
  if p.kind not in ('multi-person','organization-or-team') and not p_override_kind then
    raise exception 'proposal % is kind "%" — pass p_override_kind := true to split it anyway',
      p_proposal_id, p.kind; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x) <> array_length(p_teacher_ids,1) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  if exists (select 1 from unnest(p_teacher_ids) x
             where not exists (select 1 from public.teachers t where t.id = x)) then
    raise exception 'unknown teacher_id in %', p_teacher_ids; end if;

  foreach v_id in array p_teacher_ids loop
    v_pos := v_pos + 1;
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    select pl.id, v_id, case when v_pos = 1 then 'instructor' else 'co-instructor' end, v_pos
      from public.playlists pl where pl.teacher = p.raw_teacher
    on conflict (playlist_id, teacher_id) do nothing;
    get diagnostics v_links = row_count;
    v_total := v_total + v_links;
  end loop;

  update public.teacher_name_proposals
     set status = 'split', resolved_teacher_ids = p_teacher_ids,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id;
  perform public.log_proposal_decision(p_proposal_id, p.raw_teacher, 'split', p_teacher_ids, null);

  return jsonb_build_object('proposal_id', p_proposal_id, 'teachers', p_teacher_ids,
                            'links_created', v_total);
end; $$;

create or replace function public.reject_proposal(p_proposal_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_raw text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  update public.teacher_name_proposals
     set status = 'rejected', note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id and status in ('pending','deferred')
   returning raw_teacher into v_raw;
  if v_raw is null then raise exception 'proposal % not pending', p_proposal_id; end if;
  -- Same transaction: a history with holes in it is not a history.
  perform public.log_proposal_decision(p_proposal_id, v_raw, 'rejected', null, p_note);
  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'rejected');
end; $$;

create or replace function public.defer_proposal(p_proposal_id bigint, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_raw text;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  update public.teacher_name_proposals
     set status = 'deferred', note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_proposal_id and status = 'pending'
   returning raw_teacher into v_raw;
  if v_raw is null then raise exception 'proposal % not pending', p_proposal_id; end if;
  perform public.log_proposal_decision(p_proposal_id, v_raw, 'deferred', null, p_note);
  return jsonb_build_object('proposal_id', p_proposal_id, 'status', 'deferred');
end; $$;

-- ------------------------------------------------------------
-- 11. ATTACHING FACULTY — by ID only.
--
--     teacher_ids semantics, all three distinct and all three tested:
--       key absent   -> PRESERVE whatever is already attached
--       []           -> CLEAR, deliberately
--       [a, b]       -> REPLACE with exactly that set, in order
-- ------------------------------------------------------------
create or replace function public.set_playlist_teachers(
    p_playlist_id bigint, p_teacher_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_pos int := 0; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if p_teacher_ids is null then
    raise exception 'set_playlist_teachers requires an array; omit the key upstream to preserve'; end if;
  if not exists (select 1 from public.playlists where id = p_playlist_id) then
    raise exception 'invalid playlist_id %', p_playlist_id; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x)
     <> coalesce(array_length(p_teacher_ids,1),0) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  select array_agg(x) into v_bad from unnest(p_teacher_ids) x
   where not exists (select 1 from public.teachers t where t.id = x);
  if v_bad is not null then
    raise exception 'unknown teacher_id(s) % — create the faculty record first', v_bad; end if;

  delete from public.playlist_teachers where playlist_id = p_playlist_id;
  foreach v_id in array p_teacher_ids loop
    v_pos := v_pos + 1;
    insert into public.playlist_teachers (playlist_id, teacher_id, role, position)
    values (p_playlist_id, v_id, case when v_pos = 1 then 'instructor' else 'co-instructor' end, v_pos);
  end loop;
  return jsonb_build_object('playlist_id', p_playlist_id, 'teachers', v_pos);
end; $$;

create or replace function public.set_video_teachers(p_video_id bigint, p_teacher_ids bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_n int := 0; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if p_teacher_ids is null then raise exception 'requires an array'; end if;
  if not exists (select 1 from public.videos where id = p_video_id) then
    raise exception 'invalid video_id %', p_video_id; end if;
  if (select count(distinct x) from unnest(p_teacher_ids) x)
     <> coalesce(array_length(p_teacher_ids,1),0) then
    raise exception 'duplicate teacher_id in %', p_teacher_ids; end if;
  select array_agg(x) into v_bad from unnest(p_teacher_ids) x
   where not exists (select 1 from public.teachers t where t.id = x);
  if v_bad is not null then raise exception 'unknown teacher_id(s) %', v_bad; end if;

  delete from public.video_teachers where video_id = p_video_id;
  foreach v_id in array p_teacher_ids loop
    insert into public.video_teachers (video_id, teacher_id) values (p_video_id, v_id);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('video_id', p_video_id, 'teachers', v_n);
end; $$;

-- ------------------------------------------------------------
-- 12. GRANTS
-- ------------------------------------------------------------
do $$
declare fn text;
begin
  foreach fn in array array[
    'public.add_teacher_alias(bigint, text, text, boolean)',
    'public.scan_free_text_teachers()',
    'public.approve_proposal_as_existing(bigint, bigint, boolean)',
    'public.approve_proposal_as_new(bigint, text, boolean)',
    'public.reject_proposal(bigint, text)',
    'public.defer_proposal(bigint, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;

revoke all on function public.set_playlist_teachers(bigint, bigint[]) from public, anon;
revoke all on function public.set_video_teachers(bigint, bigint[])    from public, anon;
grant execute on function public.set_playlist_teachers(bigint, bigint[]) to authenticated, service_role;
grant execute on function public.set_video_teachers(bigint, bigint[])    to authenticated, service_role;
grant execute on function public.search_teachers(text, int)                 to anon, authenticated, service_role;
grant execute on function public.resolve_teacher_exact(text)                to authenticated, service_role;
grant execute on function public.get_faculty_facets(bigint, bigint, bigint) to anon, authenticated, service_role;
grant execute on function public.get_faculty_profile(text)                  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 13. IMMUTABLE DECISION LOG  (review item 8)
--
--     teacher_name_proposals.status is current state and gets overwritten.
--     Who decided what, when, and why must survive that. Append-only: no
--     update or delete policy exists, and none should be added.
-- ------------------------------------------------------------
create table if not exists public.teacher_proposal_decisions (
    id           bigint generated always as identity primary key,
    proposal_id  bigint not null references public.teacher_name_proposals(id) on delete restrict,
    raw_teacher  text   not null,
    decision     text   not null
                 check (decision in ('approved-existing','approved-new','split','rejected','deferred')),
    teacher_ids  bigint[],
    note         text,
    decided_by   uuid references auth.users(id) on delete set null,
    decided_at   timestamptz not null default now()
);
create index if not exists idx_decisions_proposal on public.teacher_proposal_decisions (proposal_id);
alter table public.teacher_proposal_decisions enable row level security;
drop policy if exists "admin read decisions" on public.teacher_proposal_decisions;
create policy "admin read decisions" on public.teacher_proposal_decisions
  for select using (public.is_admin());
-- Append-only is enforced by PRIVILEGE, not just by the absence of an RLS
-- policy: service_role bypasses RLS but NOT table grants, so without these
-- revokes it could still UPDATE or DELETE the audit trail directly.
-- log_proposal_decision() is SECURITY DEFINER and inserts as the owner, which
-- is the only writable path.
revoke all on table public.teacher_proposal_decisions from anon, authenticated, service_role;
revoke insert, update, delete on table public.teacher_proposal_decisions
  from anon, authenticated, service_role;
grant select on table public.teacher_proposal_decisions to authenticated;  -- gated by admin RLS

create or replace function public.log_proposal_decision(
    p_proposal_id bigint, p_raw text, p_decision text, p_teacher_ids bigint[], p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into public.teacher_proposal_decisions
         (proposal_id, raw_teacher, decision, teacher_ids, note, decided_by)
  values (p_proposal_id, p_raw, p_decision, p_teacher_ids, p_note, auth.uid());
$$;

-- ------------------------------------------------------------
-- 14. PROPOSAL GROUPING  (review item 7)
--
--     "ABJ Sir", "abj sir" and "ABJ  SIR" are three raw rows but ONE decision
--     for a human. Every raw variant is preserved with its own occurrence
--     count; this groups them so the reviewer resolves them together.
-- ------------------------------------------------------------
create or replace function public.get_proposal_groups(p_status text default 'pending')
returns table (
    normalized        text,
    kind              text,
    variants          jsonb,     -- [{proposal_id, raw_teacher, occurrences}]
    variant_count     int,
    total_occurrences bigint,
    candidates        jsonb      -- existing faculty this group might be
) language sql stable security definer set search_path = '' as $$
  select p.normalized,
         min(p.kind) as kind,
         jsonb_agg(jsonb_build_object('proposal_id', p.id, 'raw_teacher', p.raw_teacher,
                                      'occurrences', p.occurrences) order by p.raw_teacher),
         count(*)::int,
         sum(p.occurrences),
         coalesce((select jsonb_agg(jsonb_build_object('teacher_id', c.teacher_id,
                     'display_name', c.display_name, 'match_type', c.match_type,
                     'institutes', c.institutes, 'course_count', c.course_count))
                     from public.search_teachers_internal(min(p.raw_teacher), 5, true) c
                    where c.match_rank <= 2), '[]'::jsonb)
    from public.teacher_name_proposals p
   where p.status = coalesce(p_status, 'pending')
     and p.normalized is not null
   group by p.normalized
   order by sum(p.occurrences) desc;
$$;

-- Apply one decision to every raw variant sharing a normalized value.
create or replace function public.approve_group_as_existing(
    p_normalized text, p_teacher_id bigint, p_add_alias boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_done int := 0; v_res jsonb; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    v_res := public.approve_proposal_as_existing(r.id, p_teacher_id, p_add_alias);
    v_links := v_links + coalesce((v_res->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
                            'teacher_id', p_teacher_id, 'playlists_linked', v_links);
end; $$;

-- ------------------------------------------------------------
-- 15. CONTEXT JUNCTION WRITE APIs  (review item 9)
--     Same authorization and validation discipline as playlist linking:
--     admin-only, ids validated, duplicates rejected, replace-exactly.
-- ------------------------------------------------------------
create or replace function public.set_teacher_context(
    p_teacher_id bigint,
    p_institute_ids bigint[] default null,   -- null = leave alone, {} = clear
    p_subject_ids   bigint[] default null,
    p_goal_ids      bigint[] default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint; v_bad bigint[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501'; end if;
  if not exists (select 1 from public.teachers where id = p_teacher_id) then
    raise exception 'invalid teacher_id %', p_teacher_id; end if;

  if p_institute_ids is not null then
    if (select count(distinct x) from unnest(p_institute_ids) x) <> coalesce(array_length(p_institute_ids,1),0) then
      raise exception 'duplicate institute_id'; end if;
    select array_agg(x) into v_bad from unnest(p_institute_ids) x
     where not exists (select 1 from public.institutes_channels c where c.id = x);
    if v_bad is not null then raise exception 'unknown institute_id(s) %', v_bad; end if;
    delete from public.teacher_institutes where teacher_id = p_teacher_id;
    foreach v_id in array p_institute_ids loop
      insert into public.teacher_institutes (teacher_id, institute_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  if p_subject_ids is not null then
    if (select count(distinct x) from unnest(p_subject_ids) x) <> coalesce(array_length(p_subject_ids,1),0) then
      raise exception 'duplicate subject_id'; end if;
    select array_agg(x) into v_bad from unnest(p_subject_ids) x
     where not exists (select 1 from public.subjects sj where sj.id = x);
    if v_bad is not null then raise exception 'unknown subject_id(s) %', v_bad; end if;
    delete from public.teacher_subjects where teacher_id = p_teacher_id;
    foreach v_id in array p_subject_ids loop
      insert into public.teacher_subjects (teacher_id, subject_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  if p_goal_ids is not null then
    if (select count(distinct x) from unnest(p_goal_ids) x) <> coalesce(array_length(p_goal_ids,1),0) then
      raise exception 'duplicate learning_goal_id'; end if;
    select array_agg(x) into v_bad from unnest(p_goal_ids) x
     where not exists (select 1 from public.learning_goals g where g.id = x);
    if v_bad is not null then raise exception 'unknown learning_goal_id(s) %', v_bad; end if;
    delete from public.teacher_learning_goals where teacher_id = p_teacher_id;
    foreach v_id in array p_goal_ids loop
      insert into public.teacher_learning_goals (teacher_id, learning_goal_id) values (p_teacher_id, v_id);
    end loop;
  end if;

  return jsonb_build_object('teacher_id', p_teacher_id,
    'institutes', (select count(*) from public.teacher_institutes where teacher_id = p_teacher_id),
    'subjects',   (select count(*) from public.teacher_subjects   where teacher_id = p_teacher_id),
    'goals',      (select count(*) from public.teacher_learning_goals where teacher_id = p_teacher_id));
end; $$;

-- ------------------------------------------------------------
-- 16. GRANTS FOR THE NEW/CHANGED SURFACE
-- ------------------------------------------------------------
revoke all on function public.search_teachers_internal(text, int, boolean) from public, anon, authenticated;
revoke all on function public.search_teacher_candidates(text, int)         from public, anon;
revoke all on function public.similar_teachers(text, int)                  from public, anon;
revoke all on function public.create_teacher(text, jsonb, boolean, boolean) from public, anon, authenticated;
revoke all on function public.split_proposal(bigint, bigint[], boolean)     from public, anon, authenticated;
revoke all on function public.approve_group_as_existing(text, bigint, boolean) from public, anon, authenticated;
revoke all on function public.get_proposal_groups(text)                     from public, anon, authenticated;
revoke all on function public.set_teacher_context(bigint, bigint[], bigint[], bigint[]) from public, anon;
revoke all on function public.log_proposal_decision(bigint, text, text, bigint[], text) from public, anon, authenticated;

grant execute on function public.search_teacher_candidates(text, int)       to authenticated, service_role;
grant execute on function public.similar_teachers(text, int)                to authenticated, service_role;
grant execute on function public.create_teacher(text, jsonb, boolean, boolean) to service_role;
grant execute on function public.split_proposal(bigint, bigint[], boolean)  to service_role;
grant execute on function public.approve_group_as_existing(text, bigint, boolean) to service_role;
grant execute on function public.get_proposal_groups(text)                  to service_role;
grant execute on function public.set_teacher_context(bigint, bigint[], bigint[], bigint[]) to authenticated, service_role;

-- ------------------------------------------------------------
-- 17. AUTHORIZATION BOUNDARY — final grants
--     The internal engine is reachable ONLY through the wrappers above.
-- ------------------------------------------------------------
revoke all on function public.search_teachers_internal(text, int, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.search_teachers(text, int)          from public;
revoke all on function public.resolve_teacher_exact(text)         from public, anon;
revoke all on function public.log_proposal_decision(bigint, text, text, bigint[], text)
  from public, anon, authenticated, service_role;

grant execute on function public.search_teachers(text, int)  to anon, authenticated, service_role;
-- guarded internally by is_admin(); the grant only lets an admin REACH the check
grant execute on function public.search_teacher_candidates(text, int) to authenticated, service_role;
grant execute on function public.similar_teachers(text, int)          to authenticated, service_role;
grant execute on function public.resolve_teacher_exact(text)          to authenticated, service_role;


-- ============================================================
-- src/migrations/teachers_v7_import.sql
-- ============================================================

-- ============================================================
-- teachers_v7_import.sql — atomic faculty-aware import wrappers
--
-- Apply ONLY after:
--   import_playlist_v6.sql
--   teachers_v7.sql
--
-- This file is intentionally absent from both production and staging builders
-- until the corrected faculty model has passed a fresh disposable-staging run.
-- It changes no existing function signature, so an older client remains safe.
-- ============================================================

-- Admin UI capability check. Search and import support are separate on purpose:
-- a database may have teachers_v7 but not these wrappers. In that state the UI
-- must not send teacher_ids to import_playlist(), which would ignore the key.
create or replace function public.faculty_import_capability()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'teacher_ids_supported', true,
    'omitted', 'preserve',
    'empty_array', 'clear',
    'non_empty_array', 'replace');
end; $$;

-- Private validator shared by both wrappers. It runs before the underlying
-- importer performs its first write.
create or replace function public.validate_teacher_ids_payload(payload jsonb)
returns bigint[] language plpgsql stable security definer set search_path = '' as $$
declare v_ids bigint[];
begin
  if not (payload ? 'teacher_ids') then
    raise exception 'teacher_ids key is required by the faculty import wrapper';
  end if;
  if jsonb_typeof(payload->'teacher_ids') <> 'array' then
    raise exception 'teacher_ids must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'teacher_ids') e
     where jsonb_typeof(e) <> 'number'
        or (e#>>'{}') !~ '^[1-9][0-9]{0,17}$') then
    raise exception 'teacher_ids must contain positive whole numbers within range';
  end if;

  select coalesce(array_agg(x::bigint order by ord), '{}'::bigint[])
    into v_ids
    from jsonb_array_elements_text(payload->'teacher_ids') with ordinality a(x, ord);

  if (select count(distinct x) from unnest(v_ids) x)
     <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'duplicate teacher_id in %', v_ids;
  end if;
  if exists (
    select 1 from unnest(v_ids) x
     where not exists (select 1 from public.teachers t where t.id = x)) then
    raise exception 'unknown teacher_id in %', v_ids;
  end if;
  return v_ids;
end; $$;

create or replace function public.import_playlist_with_teachers(
    payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;

  -- Validation precedes import_playlist(): invalid faculty cannot leave a
  -- playlist, videos or taxonomy behind.
  v_ids := public.validate_teacher_ids_payload(payload);
  v_result := public.import_playlist(payload - 'teacher_ids', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);

  return v_result || jsonb_build_object(
    'teachers', coalesce(array_length(v_ids, 1), 0),
    'teacher_links_replaced', true);
end; $$;

create or replace function public.create_course_with_teachers(payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_ids := public.validate_teacher_ids_payload(payload);
  v_result := public.create_course(payload - 'teacher_ids');
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);

  return v_result || jsonb_build_object(
    'teachers', coalesce(array_length(v_ids, 1), 0),
    'teacher_links_replaced', true);
end; $$;

revoke all on function public.validate_teacher_ids_payload(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.faculty_import_capability()
  from public, anon;
revoke all on function public.import_playlist_with_teachers(jsonb, text)
  from public, anon;
revoke all on function public.create_course_with_teachers(jsonb)
  from public, anon;

grant execute on function public.faculty_import_capability()
  to authenticated, service_role;
grant execute on function public.import_playlist_with_teachers(jsonb, text)
  to authenticated, service_role;
grant execute on function public.create_course_with_teachers(jsonb)
  to authenticated, service_role;


-- ============================================================
-- src/migrations/teachers_v7_admin_ui.sql
-- ============================================================

-- ============================================================
-- teachers_v7_admin_ui.sql — browser-admin proposal review wrappers
-- Apply after teachers_v7.sql and teachers_v7_import.sql.
-- Isolated from all builders until disposable-staging verification.
-- ============================================================

-- get_proposal_groups() is service-role only. This wrapper lets an authenticated
-- admin reach it while keeping the authorization decision inside the function.
create or replace function public.get_faculty_review_groups(p_status text default 'pending')
returns table (
    normalized text, kind text, variants jsonb, variant_count int,
    total_occurrences bigint, candidates jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query select * from public.get_proposal_groups(p_status);
end; $$;

-- Approve every spelling/case variant as one new person, atomically. The first
-- proposal creates the teacher; the rest link to that exact id.
create or replace function public.approve_faculty_review_group_as_new(
    p_normalized text, p_display_name text, p_verified boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_result jsonb; v_teacher_id bigint; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    if v_teacher_id is null then
      v_result := public.approve_proposal_as_new(r.id, p_display_name, p_verified);
      v_teacher_id := (v_result->>'teacher_id')::bigint;
    else
      v_result := public.approve_proposal_as_existing(r.id, v_teacher_id, true);
    end if;
    v_links := v_links + coalesce((v_result->>'playlists_linked')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;

  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teacher_id', v_teacher_id, 'playlists_linked', v_links);
end; $$;

create or replace function public.reject_faculty_review_group(
    p_normalized text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    perform public.reject_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_rejected', v_done);
end; $$;

create or replace function public.defer_faculty_review_group(
    p_normalized text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_done int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status = 'pending'
            order by id for update
  loop
    perform public.defer_proposal(r.id, p_note); v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_deferred', v_done);
end; $$;

create or replace function public.split_faculty_review_group(
    p_normalized text, p_teacher_ids bigint[], p_override_kind boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; v_result jsonb; v_done int := 0; v_links int := 0;
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  for r in select id from public.teacher_name_proposals
            where normalized = p_normalized and status in ('pending','deferred')
            order by id for update
  loop
    v_result := public.split_proposal(r.id, p_teacher_ids, p_override_kind);
    v_links := v_links + coalesce((v_result->>'links_created')::int, 0);
    v_done := v_done + 1;
  end loop;
  if v_done = 0 then raise exception 'no pending proposals for normalized "%"', p_normalized; end if;
  return jsonb_build_object('normalized', p_normalized, 'variants_resolved', v_done,
    'teachers', p_teacher_ids, 'links_created', v_links);
end; $$;

-- Existing functions below already contain the same is_admin()/service-role
-- body guard. Granting authenticated only lets a real admin reach that guard.
grant execute on function public.scan_free_text_teachers() to authenticated, service_role;
grant execute on function public.approve_group_as_existing(text, bigint, boolean) to authenticated, service_role;

revoke all on function public.get_faculty_review_groups(text) from public, anon;
revoke all on function public.approve_faculty_review_group_as_new(text, text, boolean) from public, anon;
revoke all on function public.reject_faculty_review_group(text, text) from public, anon;
revoke all on function public.defer_faculty_review_group(text, text) from public, anon;
revoke all on function public.split_faculty_review_group(text, bigint[], boolean) from public, anon;

grant execute on function public.get_faculty_review_groups(text) to authenticated, service_role;
grant execute on function public.approve_faculty_review_group_as_new(text, text, boolean) to authenticated, service_role;
grant execute on function public.reject_faculty_review_group(text, text) to authenticated, service_role;
grant execute on function public.defer_faculty_review_group(text, text) to authenticated, service_role;
grant execute on function public.split_faculty_review_group(text, bigint[], boolean) to authenticated, service_role;


-- ============================================================
-- src/migrations/universal_search.sql
-- ============================================================

-- =====================================================================
--  universal_search.sql — one search box across the whole library
--
--  Groups: faculty · chapters · playlists · lectures · institutes
--
--  DESIGN NOTES YOU SHOULD READ BEFORE CHANGING ANYTHING HERE
--
--  1. ALL RANKING AND PAGING HAPPEN HERE, IN THE DATABASE.
--     The browser never receives the catalogue. It sends a query string and
--     receives at most p_limit rows per group plus a total count. That is
--     requirement 4, and it is also the only version that stays fast when the
--     library is 50k lectures instead of 40.
--
--  2. FACULTY IS CAPABILITY-GATED, NOT FAKED.
--     Real faculty identity — aliases, verified status, ambiguity — lives in
--     teachers_v7.sql, which is NOT applied to production. So the faculty
--     branch below is reached through dynamic SQL guarded by to_regclass():
--       * where the teacher tables exist  -> a real Faculty group
--       * where they do not               -> the group is ABSENT
--     It is never synthesised from playlists.teacher, which is free text that
--     has never been reviewed and cannot distinguish two people with the same
--     name. An absent group is honest; a fabricated identity is not.
--     This is what lets universal search ship while v7 stays isolated.
--
--  3. SECURITY INVOKER on purpose.
--     Catalogue rows stay subject to RLS, so this function can never become a
--     way to read something the caller could not already read. The faculty
--     branch delegates to search_teachers(), which is SECURITY DEFINER and
--     hardcodes include_unverified => false. Students therefore see VERIFIED
--     aliases only (requirement 10); the admin candidate search is a different
--     function with different grants and is not reachable from here.
--
--  4. SHORT-QUERY PROTECTION (requirement 6).
--     Under 2 characters nothing is returned at all. Prefix needs 2, partial
--     needs 3, fuzzy needs 4. On "ab", trigram similarity matches almost every
--     name in the table: it buries the right answer and, worse, makes an
--     ambiguous match look decisive.
--
--  5. RANK ORDER (requirement 5) is a single integer so it sorts trivially:
--       1 exact        2 verified alias      3 prefix
--       4 partial      5 guarded fuzzy
--     Tier 2 only ever occurs for faculty — nothing else has aliases.
--
--  Apply order: after schema.sql. Independent of teachers_v7.sql.
-- =====================================================================

create extension if not exists pg_trgm;

-- pg_trgm's schema is not uniform across Supabase projects. Compile one
-- schema-qualified wrapper instead of relying on the runtime search_path.
do $install_catalog_similarity$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  if v_schema is null then raise exception 'pg_trgm extension is not installed'; end if;
  execute format(
    'create or replace function public.catalog_similarity(text, text)
       returns real language sql immutable strict set search_path = ''''
       as $fn$ select %I.similarity($1, $2) $fn$', v_schema);
end
$install_catalog_similarity$;

-- ------------------------------------------------------------
-- Normalisation for NON-PERSON text.
--
-- Deliberately NOT normalize_person_name(): that function strips honorifics
-- (sir/dr/ji/...), which is right for a human name and wrong for everything
-- else — it would quietly turn the chapter "Semiconductor" into something it
-- is not the moment a token happened to collide. Replace punctuation and
-- whitespace rather than "non-alphanumeric" characters: Indic vowel marks
-- are combining characters and are not classified as [:alnum:].
-- ------------------------------------------------------------
create or replace function public.normalize_search_text(p_text text)
returns text language sql immutable as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(coalesce(p_text, '')), '[''’`´]', '', 'g'),
          '[[:punct:][:space:]]+', ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;

comment on function public.normalize_search_text(text) is
  'Case/punctuation-insensitive comparison key for non-person text. Unicode-safe.';

-- ------------------------------------------------------------
-- Indexes. Expression indexes must match the expression used in the query
-- EXACTLY or Postgres will not use them and every search becomes a seq scan.
-- ------------------------------------------------------------
create index if not exists idx_chapters_name_trgm
  on public.chapters using gin (public.normalize_search_text(name) gin_trgm_ops);
create index if not exists idx_playlists_title_trgm
  on public.playlists using gin (public.normalize_search_text(title) gin_trgm_ops);
create index if not exists idx_videos_title_trgm
  on public.videos using gin (public.normalize_search_text(title) gin_trgm_ops);
create index if not exists idx_institutes_name_trgm
  on public.institutes_channels using gin (public.normalize_search_text(name) gin_trgm_ops);

-- text_pattern_ops powers the prefix (LIKE 'q%') tier.
create index if not exists idx_chapters_name_pattern
  on public.chapters (public.normalize_search_text(name) text_pattern_ops);
create index if not exists idx_playlists_title_pattern
  on public.playlists (public.normalize_search_text(title) text_pattern_ops);
create index if not exists idx_videos_title_pattern
  on public.videos (public.normalize_search_text(title) text_pattern_ops);

-- ------------------------------------------------------------
-- The tier calculation, in one place so the five groups cannot drift apart.
--   returns NULL when the candidate does not match at all
-- ------------------------------------------------------------
create or replace function public.search_rank(p_haystack text, p_needle text)
returns int language sql immutable as $$
  select case
    when p_needle is null or p_haystack is null then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'        then 3
    when length(p_needle) >= 3 and p_haystack like '%' || p_needle || '%' then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded.
    when length(p_needle) >= 4 and public.catalog_similarity(p_haystack, p_needle) >= 0.4 then 5
    else null
  end;
$$;

-- ------------------------------------------------------------
--  universal_search
--
--  One round trip. One row per result. group_total lets the UI say
--  "showing 5 of 43" and drive paging without a second count query.
-- ------------------------------------------------------------
create or replace function public.universal_search(
    p_query  text,
    p_types  text[] default null,   -- null/empty = every group
    p_limit  int     default 5,
    p_offset int     default 0)
returns table (
    group_key    text,      -- faculty | chapter | playlist | lecture | institute
    entity_id    bigint,
    title        text,
    subtitle     text,      -- "Competishun · Physics · JEE"
    aka          text,      -- "ABJ Sir, ABJ"  (faculty only, verified aliases)
    slug         text,
    match_type   text,
    match_rank   int,
    matched_on   text,
    is_ambiguous boolean,
    group_total  bigint,
    extra        jsonb      -- chapter_id etc. for deep links
) language plpgsql stable security invoker set search_path = public, pg_temp as $$
declare
  q       text := public.normalize_search_text(p_query);
  qlen    int  := coalesce(length(q), 0);
  lim     int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off     int  := greatest(coalesce(p_offset, 0), 0);
  want    text[] := case when p_types is null or cardinality(p_types) = 0
                         then array['faculty','chapter','playlist','lecture','institute']
                         else p_types end;
begin
  -- Requirement 6. One character is not a query; returning the top of the
  -- alphabet for "a" trains students to ignore the suggestions entirely.
  if qlen < 2 then
    return;
  end if;

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7.
  if 'faculty' = any(want) and to_regclass('public.teachers') is not null then
    return query execute $dyn$
      with hits as (
        select s.teacher_id, s.display_name, s.slug, s.match_type, s.match_rank,
               s.matched_on, s.is_ambiguous, s.institutes, s.subjects, s.goals,
               s.verified
          from public.search_teachers($1, 50) s
      ), counted as (
        select h.*, count(*) over () as total from hits h
      )
      select 'faculty'::text,
             c.teacher_id,
             c.display_name,
             -- "Competishun · Physics · JEE" — the context that makes two
             -- people with the same name distinguishable (requirement 2).
             nullif(concat_ws(' · ', nullif(c.institutes,''), nullif(c.subjects,''),
                                     nullif(c.goals,'')), ''),
             -- VERIFIED aliases only. RLS on teacher_aliases enforces this
             -- independently; the predicate here is belt and braces.
             (select string_agg(a.alias, ', ' order by a.alias)
                from public.teacher_aliases a
               where a.teacher_id = c.teacher_id
                 and a.status = 'verified'
                 and public.normalize_person_name(a.alias)
                     is distinct from public.normalize_person_name(c.display_name)),
             c.slug, c.match_type, c.match_rank, c.matched_on, c.is_ambiguous,
             c.total,
             jsonb_build_object('verified', c.verified)
        from counted c
       order by c.match_rank, c.display_name
       limit $2 offset $3
    $dyn$ using p_query, lim, off;
  end if;

  ---------------------------------------------------------------- chapters
  if 'chapter' = any(want) then
    return query
    with m as (
      select ch.id, ch.name,
             public.search_rank(public.normalize_search_text(ch.name), q) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'chapter'::text, c.id, c.name, c.subject, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('chapter_id', c.id)
      from counted c
     -- Within a tier, the shortest name is the closest match: for "motion",
     -- "Motion" should outrank "Motion in a Straight Line".
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- playlists
  if 'playlist' = any(want) then
    return query
    with m as (
      select pl.id, pl.title,
             public.search_rank(public.normalize_search_text(pl.title), q) as rk,
             nullif(concat_ws(' · ', nullif(pl.teacher,''), ic.name, s.name), '') as ctx,
             -- first chapter this playlist teaches, so the result deep-links
             -- to a watchable page rather than a dead end
             (select v.chapter_id
                from public.playlist_videos pv
                join public.videos v on v.id = pv.video_id
               where pv.playlist_id = pl.id and v.chapter_id is not null
               order by pv.position limit 1) as chapter_id
        from public.playlists pl
        left join public.institutes_channels ic on ic.id = pl.channel_id
        left join public.subjects s on s.id = pl.subject_id
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'playlist'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object('chapter_id', c.chapter_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- lectures
  if 'lecture' = any(want) then
    return query
    with m as (
      select v.id, v.title,
             public.search_rank(public.normalize_search_text(v.title), q) as rk,
             nullif(concat_ws(' · ', ch.name, s.name), '') as ctx,
             v.chapter_id, v.subject_id
        from public.videos v
        left join public.chapters ch on ch.id = v.chapter_id
        left join public.subjects s  on s.id = v.subject_id
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'lecture'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object('chapter_id', c.chapter_id, 'subject_id', c.subject_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- institutes
  if 'institute' = any(want) then
    return query
    with m as (
      select ic.id, ic.name,
             public.search_rank(public.normalize_search_text(ic.name), q) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'institute'::text, c.id, c.name,
           case when c.n = 0 then null
                else c.n || ' course' || case when c.n = 1 then '' else 's' end end,
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.name, false, c.total,
           jsonb_build_object('institute_id', c.id)
      from counted c
     order by c.rk, length(c.name), c.name
     limit lim offset off;
  end if;
end; $$;

comment on function public.universal_search(text, text[], int, int) is
  'Grouped, server-ranked, paginated search. Faculty group appears only where teachers_v7 is installed.';

-- ------------------------------------------------------------
-- GRANTS
--
-- Supabase grants EXECUTE on every new public function to anon, authenticated
-- AND service_role by default, so a bare `grant ... to anon` would be a no-op
-- that hides whatever the default already allowed. Revoke first, then grant
-- exactly what is intended.
-- ------------------------------------------------------------
revoke all on function public.universal_search(text, text[], int, int)
  from public, anon, authenticated, service_role;
revoke all on function public.normalize_search_text(text)
  from public, anon, authenticated, service_role;
revoke all on function public.search_rank(text, text)
  from public, anon, authenticated, service_role;

-- Public browsing must work without login, so anon executes the search itself.
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;

-- The helpers MUST be granted to anon as well, and this is not optional:
-- universal_search is SECURITY INVOKER, so when a logged-out student calls it
-- the body runs as anon and calls these two by name. Revoking them from anon
-- "to keep the API surface small" would make every public search fail with
-- "permission denied for function normalize_search_text" — the same shape of
-- bug the v5 review found in the public teacher-search wrapper.
--
-- The exposure is nil: both are IMMUTABLE pure text functions that touch no
-- table and can only tell the caller something about a string they already
-- have.
grant execute on function public.normalize_search_text(text)
  to anon, authenticated, service_role;
grant execute on function public.search_rank(text, text)
  to anon, authenticated, service_role;


-- ============================================================
-- src/migrations/content_quality_v10.sql
-- ============================================================

-- ============================================================
-- content_quality_v10.sql — reviewed titles + faculty completeness
--
-- Apply after teachers_v7.sql and teachers_v7_import.sql.
-- Additive and non-destructive: raw/source titles and legacy teacher text are
-- preserved. Nothing infers identity from equal-looking names.
-- ============================================================

alter table public.playlists add column if not exists source_title text;
alter table public.playlists add column if not exists source_title_changed boolean not null default false;
alter table public.playlists add column if not exists title_review_status text not null default 'pending';
alter table public.playlists add column if not exists faculty_credit_status text not null default 'pending';

update public.playlists
   set source_title = title
 where source_title is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'playlists_title_review_status_check') then
    alter table public.playlists add constraint playlists_title_review_status_check
      check (title_review_status in ('pending','approved'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'playlists_faculty_credit_status_check') then
    alter table public.playlists add constraint playlists_faculty_credit_status_check
      check (faculty_credit_status in ('pending','identified','team','unknown'));
  end if;
end $$;

create table if not exists public.playlist_quality_reviews (
  id bigint generated always as identity primary key,
  playlist_id bigint not null references public.playlists(id) on delete cascade,
  before_state jsonb not null,
  after_state jsonb not null,
  note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz not null default now()
);
create index if not exists idx_pqr_playlist_time
  on public.playlist_quality_reviews (playlist_id, reviewed_at desc);

alter table public.playlist_quality_reviews enable row level security;
drop policy if exists "admin reads quality reviews" on public.playlist_quality_reviews;
create policy "admin reads quality reviews" on public.playlist_quality_reviews
  for select to authenticated using (public.is_admin());

-- Direct writes would bypass the review transaction and its validations.
revoke all on public.playlist_quality_reviews from public, anon, authenticated, service_role;
grant select on public.playlist_quality_reviews to authenticated, service_role;

create or replace function public.playlist_quality_missing(p_playlist_id bigint)
returns text[] language sql stable security definer set search_path = '' as $$
  select array_remove(array[
    case when p.title_review_status <> 'approved' then 'title-review' end,
    case when p.source_title is null or btrim(p.source_title) = '' then 'source-title' end,
    case when p.source_title_changed then 'source-title-changed' end,
    case when p.faculty_credit_status not in ('identified','team') then 'faculty-credit' end,
    case when p.faculty_credit_status = 'identified' and not exists (
      select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
    ) then 'faculty-link' end,
    case when p.faculty_credit_status = 'team' and exists (
      select 1 from public.playlist_teachers pt where pt.playlist_id = p.id
    ) then 'faculty-team-conflict' end,
    case when p.content_type is null then 'course-type' end,
    case when p.language is null then 'language' end,
    case when p.difficulty is null then 'difficulty' end,
    case when p.subject_id is null then 'subject' end,
    case when not exists (
      select 1 from public.playlist_learning_goals plg where plg.playlist_id = p.id
    ) then 'learning-goal' end,
    case when not exists (
      select 1 from public.playlist_class_levels pcl where pcl.playlist_id = p.id
    ) then 'class-level' end,
    case when not exists (
      select 1 from public.playlist_videos pv where pv.playlist_id = p.id
    ) then 'lessons' end,
    case when exists (
      select 1
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
       where pv.playlist_id = p.id and v.chapter_id is null
    ) then 'lesson-chapter' end
  ]::text[], null::text)
  from public.playlists p where p.id = p_playlist_id;
$$;

create or replace function public.content_quality_capability()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'quality_review_supported', true,
    'source_title_supported', true,
    'faculty_identity_required_for_identified', true,
    'automatic_identity_resolution', false);
end; $$;

create or replace function public.get_content_quality_queue(
  p_ready boolean default false, p_limit int default 100, p_offset int default 0)
returns table (
  playlist_id bigint, display_title text, source_title text, legacy_teacher text,
  institute text, subject text, content_type text, language text, difficulty text,
  title_review_status text, faculty_credit_status text, source_title_changed boolean,
  faculty jsonb, missing_fields text[], quality_ready boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 or p_offset < 0 then
    raise exception 'invalid queue bounds';
  end if;

  return query
  select p.id, p.title, p.source_title, p.teacher, ic.name, s.name,
         p.content_type, p.language, p.difficulty,
         p.title_review_status, p.faculty_credit_status, p.source_title_changed,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'teacher_id', t.id, 'display_name', t.display_name,
             'verified', t.verified, 'position', pt.position
           ) order by pt.position)
           from public.playlist_teachers pt
           join public.teachers t on t.id = pt.teacher_id
           where pt.playlist_id = p.id
         ), '[]'::jsonb),
         q.missing,
         cardinality(q.missing) = 0
    from public.playlists p
    join public.institutes_channels ic on ic.id = p.channel_id
    left join public.subjects s on s.id = p.subject_id
    cross join lateral (select public.playlist_quality_missing(p.id) as missing) q
   where (cardinality(q.missing) = 0) = p_ready
   order by cardinality(q.missing) desc, p.id
   limit p_limit offset p_offset;
end; $$;

create or replace function public.review_playlist_quality(
  p_playlist_id bigint,
  p_display_title text,
  p_teacher_ids bigint[],
  p_faculty_status text,
  p_content_type text,
  p_language text,
  p_difficulty text,
  p_note text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.playlists%rowtype;
  v_title text;
  v_before jsonb;
  v_after jsonb;
  v_missing text[];
begin
  if not (public.is_admin() or auth.role() = 'service_role'
          or session_user in ('postgres','supabase_admin')) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into p from public.playlists where id = p_playlist_id for update;
  if not found then raise exception 'unknown playlist_id %', p_playlist_id; end if;

  v_title := regexp_replace(btrim(coalesce(p_display_title, '')), '\s+', ' ', 'g');
  if char_length(v_title) < 3 or char_length(v_title) > 90 then
    raise exception 'display title must contain 3 to 90 characters';
  end if;
  if p_teacher_ids is null then raise exception 'teacher_ids must be explicit'; end if;
  if p_faculty_status not in ('identified','team','unknown') then
    raise exception 'invalid faculty status %', p_faculty_status;
  end if;
  if p_faculty_status = 'identified' and cardinality(p_teacher_ids) = 0 then
    raise exception 'identified faculty requires at least one teacher id';
  end if;
  if p_faculty_status = 'team' and cardinality(p_teacher_ids) <> 0 then
    raise exception 'team credit cannot carry individual teacher ids';
  end if;
  if p_faculty_status = 'team' and char_length(btrim(coalesce(p_note,''))) < 3 then
    raise exception 'team credit requires an editorial note';
  end if;
  if p_content_type not in ('full-course','one-shot','revision','pyq','practice') then
    raise exception 'invalid content_type %', p_content_type;
  end if;
  if p_language not in ('hindi','english','hinglish') then
    raise exception 'invalid language %', p_language;
  end if;
  if p_difficulty not in ('beginner','intermediate','advanced') then
    raise exception 'invalid difficulty %', p_difficulty;
  end if;

  v_before := jsonb_build_object(
    'title', p.title, 'title_review_status', p.title_review_status,
    'faculty_credit_status', p.faculty_credit_status,
    'content_type', p.content_type, 'language', p.language, 'difficulty', p.difficulty,
    'teacher_ids', coalesce((select jsonb_agg(pt.teacher_id order by pt.position)
      from public.playlist_teachers pt where pt.playlist_id = p.id), '[]'::jsonb));

  -- Identity replacement stays delegated to the v7 write contract. It
  -- validates duplicate/unknown ids before deleting existing links.
  perform public.set_playlist_teachers(p.id, p_teacher_ids);

  update public.playlists
     set title = v_title,
         title_review_status = 'approved',
         faculty_credit_status = p_faculty_status,
         content_type = p_content_type,
         language = p_language,
         difficulty = p_difficulty,
         source_title_changed = false
   where id = p.id;

  v_after := jsonb_build_object(
    'title', v_title, 'title_review_status', 'approved',
    'faculty_credit_status', p_faculty_status,
    'content_type', p_content_type, 'language', p_language, 'difficulty', p_difficulty,
    'teacher_ids', to_jsonb(p_teacher_ids));
  insert into public.playlist_quality_reviews
    (playlist_id, before_state, after_state, note, reviewed_by)
  values (p.id, v_before, v_after, nullif(btrim(p_note), ''), auth.uid());

  v_missing := public.playlist_quality_missing(p.id);
  return jsonb_build_object('playlist_id', p.id, 'missing_fields', v_missing,
    'quality_ready', cardinality(v_missing) = 0);
end; $$;

-- Captures the exact YouTube playlist title while leaving the curated display
-- title under the base importer's merge/replace contract.
create or replace function public.import_playlist_with_quality(
  payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_source text; v_result jsonb; v_playlist_id bigint; v_old_source text;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  v_source := btrim(coalesce(payload->>'source_title',''));
  if v_source = '' or char_length(v_source) > 500 then
    raise exception 'source_title is required and must be at most 500 characters';
  end if;

  v_result := public.import_playlist(payload - 'source_title', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  select source_title into v_old_source from public.playlists where id = v_playlist_id for update;
  update public.playlists
     set source_title = v_source,
         source_title_changed = v_old_source is not null and v_old_source is distinct from v_source
   where id = v_playlist_id;
  return v_result || jsonb_build_object('source_title_captured', true);
end; $$;

-- Replace the v7 wrapper so source-title capture and faculty links remain one
-- transaction. Old callers without source_title continue to work.
create or replace function public.import_playlist_with_teachers(
  payload jsonb, mode text default 'merge')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ids bigint[]; v_result jsonb; v_playlist_id bigint; v_source text; v_old_source text;
begin
  if not (public.is_admin() or auth.role() = 'service_role') then
    raise exception 'not authorized to import' using errcode = '42501';
  end if;
  v_ids := public.validate_teacher_ids_payload(payload);
  v_source := nullif(btrim(coalesce(payload->>'source_title','')), '');
  if v_source is not null and char_length(v_source) > 500 then
    raise exception 'source_title must be at most 500 characters';
  end if;

  v_result := public.import_playlist(payload - 'teacher_ids' - 'source_title', mode);
  v_playlist_id := (v_result->>'playlist_id')::bigint;
  perform public.set_playlist_teachers(v_playlist_id, v_ids);
  update public.playlists
     set faculty_credit_status = case when cardinality(v_ids) > 0 then 'identified' else 'pending' end
   where id = v_playlist_id;
  if v_source is not null then
    select source_title into v_old_source from public.playlists where id = v_playlist_id for update;
    update public.playlists
       set source_title = v_source,
           source_title_changed = v_old_source is not null and v_old_source is distinct from v_source
     where id = v_playlist_id;
  end if;
  return v_result || jsonb_build_object(
    'teachers', cardinality(v_ids), 'teacher_links_replaced', true,
    'source_title_captured', v_source is not null);
end; $$;

revoke all on function public.playlist_quality_missing(bigint) from public, anon, authenticated, service_role;
revoke all on function public.content_quality_capability() from public, anon;
revoke all on function public.get_content_quality_queue(boolean, int, int) from public, anon;
revoke all on function public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text) from public, anon;
revoke all on function public.import_playlist_with_quality(jsonb,text) from public, anon;
revoke all on function public.import_playlist_with_teachers(jsonb,text) from public, anon;

grant execute on function public.content_quality_capability() to authenticated, service_role;
grant execute on function public.get_content_quality_queue(boolean, int, int) to authenticated, service_role;
grant execute on function public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text) to authenticated, service_role;
grant execute on function public.import_playlist_with_quality(jsonb,text) to authenticated, service_role;
grant execute on function public.import_playlist_with_teachers(jsonb,text) to authenticated, service_role;



-- ============================================================
-- src/migrations/faculty_quality_production_postflight.sql
-- ============================================================

-- Structural postflight. No fixtures and no content mutation.
do $$
declare missing text[] := '{}'::text[];
begin
  if to_regclass('public.teachers') is null then missing := array_append(missing, 'teachers'); end if;
  if to_regclass('public.teacher_aliases') is null then missing := array_append(missing, 'teacher_aliases'); end if;
  if to_regclass('public.playlist_teachers') is null then missing := array_append(missing, 'playlist_teachers'); end if;
  if to_regclass('public.playlist_quality_reviews') is null then missing := array_append(missing, 'playlist_quality_reviews'); end if;
  if to_regprocedure('public.search_teachers(text,int)') is null then missing := array_append(missing, 'search_teachers'); end if;
  if to_regprocedure('public.universal_search(text,text[],int,int)') is null then missing := array_append(missing, 'universal_search'); end if;
  if to_regprocedure('public.get_content_quality_queue(boolean,int,int)') is null then missing := array_append(missing, 'quality queue'); end if;
  if to_regprocedure('public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)') is null then
    missing := array_append(missing, 'quality review');
  end if;
  if cardinality(missing) > 0 then raise exception 'faculty/quality postflight missing: %', missing; end if;

  if exists (select 1 from public.playlists where source_title is null) then
    raise exception 'source-title backfill is incomplete';
  end if;
  if has_function_privilege('anon', 'public.get_content_quality_queue(boolean,int,int)', 'EXECUTE') then
    raise exception 'anon can execute the editorial queue';
  end if;
  if has_function_privilege('anon', 'public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)', 'EXECUTE') then
    raise exception 'anon can execute editorial writes';
  end if;
end $$;



do $$
declare b record;
begin
  select * into b from fq_baseline;
  if b.playlists <> (select count(*) from public.playlists)
     or b.videos <> (select count(*) from public.videos)
     or b.playlist_video_links <> (select count(*) from public.playlist_videos)
     or b.goal_links <> (select count(*) from public.playlist_learning_goals)
     or b.class_links <> (select count(*) from public.playlist_class_levels)
     or b.teachers <> (select count(*) from public.teachers)
     or b.faculty_links <> (select count(*) from public.playlist_teachers) then
    raise exception 'production package changed content or identity row counts';
  end if;
end $$;

select
  (select name from public.app_environment where id = true limit 1) as environment,
  to_regprocedure('public.search_teachers(text,int)') is not null as faculty_search,
  to_regprocedure('public.universal_search(text,text[],int,int)') is not null as universal_search,
  to_regprocedure('public.get_content_quality_queue(boolean,int,int)') is not null as quality_queue,
  to_regprocedure('public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)') is not null as quality_review,
  not has_function_privilege('anon','public.get_content_quality_queue(boolean,int,int)','EXECUTE') as queue_private,
  not has_function_privilege('anon','public.review_playlist_quality(bigint,text,bigint[],text,text,text,text,text)','EXECUTE') as writes_private;

rollback;
