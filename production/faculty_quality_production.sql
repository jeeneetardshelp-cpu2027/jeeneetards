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
-- src/migrations/search_latin_key_v11.sql
-- ============================================================

-- =====================================================================
--  search_latin_key_v11.sql — the Hinglish bridge for universal search
--
--  ONE JOB: give Devanagari content and Latin queries a SINGLE comparison
--  key, so that all four combinations work through one index:
--
--        query \ content   Devanagari            Latin
--        Devanagari        कबीर  -> kabiira       —
--        Latin             kabir -> kabiira       motion -> motion
--
--  Today 48 lesson titles and 33 chapters are stored in Devanagari
--  (कबीर की साखी, मीरा के पद, बड़े भाई साहब, पर्वत प्रदेश में पावस). A student
--  typing "kabir ki sakhi" — which is what they actually type; nobody switches
--  keyboards to search — currently gets nothing at all. This file is the
--  transliteration half of the fix. The sargable predicates, the
--  word_similarity fuzzy tier and the indexes live in the universal_search
--  replacement; this file deliberately creates NO index and NO table so the
--  two halves can be reviewed and rolled back independently.
--
--  WHAT THIS IS NOT
--  Not a scholarly romanisation. IAST/ISO-15919 spell साखी as "sākhī", which no
--  student types. Not a phonetic engine either: real Hindi also deletes the
--  inherent vowel (कबीर is said "kabir", not "kabira"), and modelling that needs
--  syllable-weight rules wrong often enough to be worse than useless in a key.
--
--  So the scheme is blunt and mechanical, with two deliberate choices:
--    * long vowels are emitted SHORT (ी -> "i", ा -> "a", ू -> "u"), because
--      students type "sakhi", never "saakhii";
--    * the inherent vowel is KEPT (कबीर -> "kabira"), because dropping it
--      correctly is the phonology problem above.
--  The result: the key only ever has MORE letters than the student's spelling,
--  never different ones, so the student's form is a substring of the key.
--
--    content              key                        student types
--    क्षितिज               kshitija                   kshitij      -> PREFIX
--    मनुष्यता              manushyata                 manushyata   -> EXACT
--    त्रिकोणमिति            trikonamiti                trikonamiti  -> EXACT
--    कबीर की साखी          kabira ki sakhi            kabir ki sakhi   -> ALL-TOKENS
--    बड़े भाई साहब         bade bhai sahaba           bade bhai sahab  -> ALL-TOKENS
--    मीरा के पद            mira ke pada               mira ke pad      -> ALL-TOKENS
--    पर्वत प्रदेश में पावस    parvata pradesha men pavasa parvat pradesh pavas -> ALL-TOKENS
--
--  CRITICALLY: shortening happens INSIDE the vowel tables, so it can only ever
--  touch Devanagari-derived letters. An earlier revision folded aa/ii/uu over
--  the WHOLE string and silently broke Latin content — "Meiosis I" and
--  "Meiosis II" collapsed to one key, and the query "IIT" shortened to a
--  2-character needle that fell below the tier floors and returned nothing.
--  Latin bytes must stay untouched; the self-test asserts that as an equation.
--
--  What is still NOT covered: Hindi deletes schwa word-INTERNALLY too (सूरदास
--  -> "suradasa" against a typed "surdas"), and function words vary ("mein"
--  vs "men"). Those reach the fuzzy word_similarity tier and may miss. The
--  honest fix is a small curated alias table a human can extend — NOT more
--  guessing about which vowels to drop, which would make the key
--  non-deterministic and break the prefix tier for everyone.
--
--  INDEX SAFETY WARNING
--  universal_search builds expression indexes on public.search_latin_key(col).
--  An expression index is only as correct as the function was on the day it was
--  built. If you EVER change the transliteration table below after those
--  indexes exist, you MUST `reindex` them in the same transaction, or searches
--  will silently miss rows. That is also why the self-test at the bottom raises
--  rather than warns: a broken transliterator must not be applyable.
--
--  Requires: universal_search.sql (for public.normalize_search_text).
--  Apply BEFORE the universal_search v11 replacement, which indexes these.
--  Database encoding must be UTF8 (Supabase always is).
-- =====================================================================


-- ------------------------------------------------------------
--  translit_devanagari — Devanagari block (U+0900..U+097F) to Latin
--
--  Written as an explicit character loop, NOT translate(). translate() is a
--  context-free 1:1 substitution and this script is neither:
--
--    * a consonant carries an INHERENT 'a'  (क -> "ka", ब -> "ba");
--    * a following matra REPLACES it        (कि -> "ki",  बे -> "be");
--    * a following virama U+094D CANCELS it (क् -> "k");
--    * so conjuncts fall out for free       (क्ष -> "ksha", त्र -> "tra").
--
--  Implementation: v_cons holds the consonant that is still waiting to learn
--  its vowel. Every branch either fills it, cancels it, or FLUSHES it with the
--  inherent 'a' before emitting something else. End of string flushes too.
--
--  Code points are written in decimal because the matras and the virama are
--  combining characters: pasted into source they attach themselves to the
--  preceding character and become invisible and un-reviewable. The U+ value and
--  the Unicode name are in the comment on every line — that is the readable
--  form here, and it cannot be corrupted by an editor or a diff viewer.
-- ------------------------------------------------------------
create or replace function public.translit_devanagari(p_text text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $translit$
declare
  -- '[' U+0900 '-' U+097F ']' built with chr() for the same reason as above.
  c_deva  constant text := '[' || chr(2304) || '-' || chr(2431) || ']';
  v_len   int;
  v_i     int := 1;
  v_cp    int;
  v_cons  text := null;   -- consonant awaiting its vowel: 'k', 'bh', 'gy', ...
  v_out   text := '';
  v_v     text;
  v_c     text;
begin
  -- Contract: STRICT-safe on null.
  if p_text is null then
    return null;
  end if;

  -- IDENTITY FAST PATH, and the reason one key can serve both scripts: text
  -- with no Devanagari in it is returned byte-for-byte unchanged. Every Latin
  -- title and every Latin query takes this branch, so the loop never runs on
  -- the overwhelmingly common case and this function costs one regex test.
  if p_text !~ c_deva then
    return p_text;
  end if;

  v_len := length(p_text);

  while v_i <= v_len loop
    v_cp := ascii(substr(p_text, v_i, 1));

    -- ---- ज्ञ, the one conjunct that does NOT fall out of the general rules.
    -- ज=j + ञ=n would give "jn", but every Hindi speaker says and types "gy"
    -- (ज्ञान -> "gyaana", विज्ञान -> "vigyaana"). Three code points, so it has
    -- to be matched by lookahead and therefore has to come first.
    -- ascii(substr()) past the end is ascii('') = 0, so this cannot over-read.
    if v_cp = 2332                                          -- U+091C  JA
       and ascii(substr(p_text, v_i + 1, 1)) = 2381          -- U+094D  VIRAMA
       and ascii(substr(p_text, v_i + 2, 1)) = 2334          -- U+091E  NYA
    then
      if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;
      v_cons := 'gy';
      v_i := v_i + 3;
      continue;
    end if;

    -- ---- OUTSIDE THE DEVANAGARI BLOCK: pass through unchanged.
    if v_cp < 2304 or v_cp > 2431 then                      -- U+0900 .. U+097F
      -- The one documented exception. ZWNJ/ZWJ are invisible cluster-shaping
      -- controls that appear INSIDE Devanagari words (क्‌ष) and mean nothing
      -- lexically. Passing them through would leave a zero-width character in
      -- the key, where normalize_search_text will not remove it either (it is
      -- Cf, neither punct nor space), so the same word stored with and without
      -- one would get two different keys and one of them would never match.
      -- Dropping them cannot affect Latin input: Latin text never contains
      -- them, so the identity guarantee above is untouched.
      if v_cp = 8204 or v_cp = 8205 then                    -- U+200C, U+200D
        v_i := v_i + 1;
        continue;
      end if;
      if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;
      v_out := v_out || substr(p_text, v_i, 1);
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- DEPENDENT VOWEL SIGNS (matras). These REPLACE the inherent 'a'.
    v_v := case v_cp
             when 2362 then 'e'     -- U+093A  vowel sign OE
             when 2363 then 'aa'    -- U+093B  vowel sign OOE
             when 2366 then 'a'     -- U+093E  vowel sign AA  (short: students type 'sakhi', not 'saakhii')
             when 2367 then 'i'     -- U+093F  vowel sign I
             when 2368 then 'i'     -- U+0940  vowel sign II  (short, see AA)
             when 2369 then 'u'     -- U+0941  vowel sign U
             when 2370 then 'u'     -- U+0942  vowel sign UU  (short, see AA)
             when 2371 then 'ri'    -- U+0943  vowel sign VOCALIC R
             when 2372 then 'ri'    -- U+0944  vowel sign VOCALIC RR
             when 2373 then 'e'     -- U+0945  vowel sign CANDRA E
             when 2374 then 'e'     -- U+0946  vowel sign SHORT E
             when 2375 then 'e'     -- U+0947  vowel sign E
             when 2376 then 'ai'    -- U+0948  vowel sign AI
             when 2377 then 'o'     -- U+0949  vowel sign CANDRA O
             when 2378 then 'o'     -- U+094A  vowel sign SHORT O
             when 2379 then 'o'     -- U+094B  vowel sign O
             when 2380 then 'au'    -- U+094C  vowel sign AU
             when 2382 then 'e'     -- U+094E  vowel sign PRISHTHAMATRA E
             when 2383 then 'au'    -- U+094F  vowel sign AW
             when 2402 then 'li'    -- U+0962  vowel sign VOCALIC L
             when 2403 then 'li'    -- U+0963  vowel sign VOCALIC LL
           end;
    if v_v is not null then
      v_out  := v_out || coalesce(v_cons, '') || v_v;
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- VIRAMA: cancel the inherent 'a'. This is what builds conjuncts.
    if v_cp = 2381 then                                     -- U+094D  VIRAMA
      v_out  := v_out || coalesce(v_cons, '');
      v_cons := null;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- MARKS THAT PRODUCE NOTHING.
    -- Dropped WITHOUT flushing v_cons: the pending consonant is simply carried
    -- past them, which is what a combining mark should do. Deferring the flush
    -- can never lose it — the next branch or the end of the loop emits it.
    -- Nukta matters most: dropping it makes ड+U+093C give exactly the same key
    -- as the precomposed ड़ U+095C, so canonically-different spellings of
    -- बड़े both key to "bade" and the expression index stays trustworthy.
    if v_cp = 2364                                          -- U+093C  NUKTA
       or v_cp = 2365                                       -- U+093D  AVAGRAHA
       or (v_cp between 2385 and 2391)                      -- U+0951..U+0957 accents
       or v_cp = 2417                                       -- U+0971  high spacing dot
       or v_cp = 2429                                       -- U+097D  glottal stop
    then
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- Everything from here FLUSHES the pending consonant first.
    -- हंस must become "hansa", not "hnsa": the anusvara follows a consonant
    -- that still owns its inherent 'a'.
    if v_cons is not null then v_out := v_out || v_cons || 'a'; v_cons := null; end if;

    -- ---- NASALISATION AND ASPIRATION MARKS.
    if v_cp = 2304 or v_cp = 2305 or v_cp = 2306 then
      v_out := v_out || 'n';        -- U+0900 inverted candrabindu, U+0901 ँ, U+0902 ं
      v_i := v_i + 1;
      continue;
    end if;
    if v_cp = 2307 then                                     -- U+0903  VISARGA
      v_out := v_out || 'h';
      v_i := v_i + 1;
      continue;
    end if;

    -- ---- INDEPENDENT VOWELS.
    v_v := case v_cp
             when 2308 then 'a'     -- U+0904  SHORT A
             when 2309 then 'a'     -- U+0905  A
             when 2310 then 'a'     -- U+0906  AA  (short, see the matra table)
             when 2311 then 'i'     -- U+0907  I
             when 2312 then 'i'     -- U+0908  II  (short)
             when 2313 then 'u'     -- U+0909  U
             when 2314 then 'u'     -- U+090A  UU  (short)
             when 2315 then 'ri'    -- U+090B  VOCALIC R
             when 2316 then 'li'    -- U+090C  VOCALIC L
             when 2317 then 'e'     -- U+090D  CANDRA E
             when 2318 then 'e'     -- U+090E  SHORT E
             when 2319 then 'e'     -- U+090F  E
             when 2320 then 'ai'    -- U+0910  AI
             when 2321 then 'o'     -- U+0911  CANDRA O
             when 2322 then 'o'     -- U+0912  SHORT O
             when 2323 then 'o'     -- U+0913  O
             when 2324 then 'au'    -- U+0914  AU
             when 2400 then 'ri'    -- U+0960  VOCALIC RR
             when 2401 then 'li'    -- U+0961  VOCALIC LL
             when 2418 then 'a'     -- U+0972  CANDRA A
             when 2419 then 'a'     -- U+0973  OE
             when 2420 then 'a'     -- U+0974  OOE
             when 2421 then 'au'    -- U+0975  AW
             when 2422 then 'u'     -- U+0976  UE
             when 2423 then 'uu'    -- U+0977  UUE
           end;
    if v_v is not null then
      v_out := v_out || v_v;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- CONSONANTS. The value is the consonant ALONE; the inherent 'a' is
    -- added later, by whichever branch flushes it. The precomposed nukta forms
    -- U+0958..U+095F map to the same letters as base+U+093C on purpose (see
    -- the nukta note above) — क़/ख़/ग़/ज़ lose the Perso-Arabic distinction
    -- (q/x/gh/z) because a student typing a chapter name does not make it.
    v_c := case v_cp
             when 2325 then 'k'     -- U+0915  KA
             when 2326 then 'kh'    -- U+0916  KHA
             when 2327 then 'g'     -- U+0917  GA
             when 2328 then 'gh'    -- U+0918  GHA
             when 2329 then 'n'     -- U+0919  NGA
             when 2330 then 'ch'    -- U+091A  CA
             when 2331 then 'chh'   -- U+091B  CHA   (छ; keeps छ distinct from च)
             when 2332 then 'j'     -- U+091C  JA
             when 2333 then 'jh'    -- U+091D  JHA
             when 2334 then 'n'     -- U+091E  NYA
             when 2335 then 't'     -- U+091F  TTA
             when 2336 then 'th'    -- U+0920  TTHA
             when 2337 then 'd'     -- U+0921  DDA
             when 2338 then 'dh'    -- U+0922  DDHA
             when 2339 then 'n'     -- U+0923  NNA
             when 2340 then 't'     -- U+0924  TA
             when 2341 then 'th'    -- U+0925  THA
             when 2342 then 'd'     -- U+0926  DA
             when 2343 then 'dh'    -- U+0927  DHA
             when 2344 then 'n'     -- U+0928  NA
             when 2345 then 'n'     -- U+0929  NNNA
             when 2346 then 'p'     -- U+092A  PA
             when 2347 then 'ph'    -- U+092B  PHA
             when 2348 then 'b'     -- U+092C  BA
             when 2349 then 'bh'    -- U+092D  BHA
             when 2350 then 'm'     -- U+092E  MA
             when 2351 then 'y'     -- U+092F  YA
             when 2352 then 'r'     -- U+0930  RA
             when 2353 then 'r'     -- U+0931  RRA
             when 2354 then 'l'     -- U+0932  LA
             when 2355 then 'l'     -- U+0933  LLA
             when 2356 then 'l'     -- U+0934  LLLA
             when 2357 then 'v'     -- U+0935  VA
             when 2358 then 'sh'    -- U+0936  SHA
             when 2359 then 'sh'    -- U+0937  SSA
             when 2360 then 's'     -- U+0938  SA
             when 2361 then 'h'     -- U+0939  HA
             when 2392 then 'k'     -- U+0958  QA    (= KA + nukta)
             when 2393 then 'kh'    -- U+0959  KHHA
             when 2394 then 'g'     -- U+095A  GHHA
             when 2395 then 'j'     -- U+095B  ZA
             when 2396 then 'd'     -- U+095C  DDDHA (ड़)
             when 2397 then 'dh'    -- U+095D  RHA   (ढ़)
             when 2398 then 'ph'    -- U+095E  FA    (फ़)
             when 2399 then 'y'     -- U+095F  YYA
             when 2424 then 'd'     -- U+0978  MARWARI DDA
             when 2425 then 'jh'    -- U+0979  ZHA
             when 2426 then 'y'     -- U+097A  HEAVY YA
             when 2427 then 'g'     -- U+097B  GGA
             when 2428 then 'j'     -- U+097C  JJA
             when 2430 then 'd'     -- U+097E  DDDA
             when 2431 then 'b'     -- U+097F  BBA
           end;
    if v_c is not null then
      v_cons := v_c;
      v_i    := v_i + 1;
      continue;
    end if;

    -- ---- DEVANAGARI DIGITS U+0966..U+096F -> 0..9.
    if v_cp between 2406 and 2415 then
      v_out := v_out || (v_cp - 2406)::text;
      v_i   := v_i + 1;
      continue;
    end if;

    -- ---- DANDA / DOUBLE DANDA / ABBREVIATION SIGN are sentence punctuation:
    -- a space, which normalize_search_text then collapses.
    if v_cp = 2404 or v_cp = 2405 or v_cp = 2416 then        -- U+0964 U+0965 U+0970
      v_out := v_out || ' ';
      v_i   := v_i + 1;
      continue;
    end if;

    if v_cp = 2384 then                                      -- U+0950  OM
      v_out := v_out || 'om';
      v_i   := v_i + 1;
      continue;
    end if;

    -- Unassigned / unhandled inside the block: drop it rather than leak a
    -- Devanagari character into something called a *Latin* key.
    v_i := v_i + 1;
  end loop;

  -- Trailing consonant still holding its inherent 'a' (पद -> "pada").
  if v_cons is not null then v_out := v_out || v_cons || 'a'; end if;

  return v_out;
end
$translit$;

comment on function public.translit_devanagari(text) is
  'Mechanical Devanagari->Latin transliteration in the spelling an Indian student types. Identity for non-Devanagari input. Only ever adds letters, never removes them.';


-- ------------------------------------------------------------
--  search_latin_key — THE shared comparison key
--
--  Transliterate, then hand the case/punctuation half to the EXISTING
--  normalize_search_text. Reused rather than reimplemented on purpose: the
--  Latin-only indexes in universal_search.sql are built on
--  normalize_search_text, and if the two normalisers ever drifted apart, a
--  Latin query would normalise one way for the old index and another way for
--  this one and the two tiers would disagree about what "matches".
--
--  Consequences of that composition, both relied upon by the caller:
--    * IDENTITY ON LATIN: search_latin_key(x) = normalize_search_text(x) for
--      every x containing no Devanagari. So the same expression can serve
--      Latin content without changing its behaviour at all.
--    * IDEMPOTENT: search_latin_key(search_latin_key(x)) = search_latin_key(x),
--      because the output is always already-normalised Latin. That is what lets
--      the QUERY and the CONTENT go through the same function.
--    * null / empty / punctuation-only input -> null (from normalize_search_text).
-- ------------------------------------------------------------
create or replace function public.search_latin_key(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $key$
  select public.normalize_search_text(public.translit_devanagari(p_text));
$key$;

comment on function public.search_latin_key(text) is
  'Script-neutral comparison key: Devanagari transliterated to Latin, then normalize_search_text. Identity transform for Latin input, so one key serves Latin and Devanagari content and queries in all four combinations.';


-- ------------------------------------------------------------
-- GRANTS
--
-- Supabase grants EXECUTE on every new public function to anon, authenticated
-- AND service_role by default, so a bare `grant ... to anon` is a no-op that
-- hides whatever the default already allowed. Revoke first, then grant exactly
-- what is intended — same reasoning as the grant block in universal_search.sql.
--
-- Both MUST be executable by anon, and this is not optional: universal_search
-- is SECURITY INVOKER, so when a logged-out student searches, its body runs as
-- anon and calls search_latin_key BY NAME. Tightening either of these to
-- authenticated-only makes every public search fail with "permission denied for
-- function search_latin_key" — the whole search box, for every visitor, not
-- just the Hindi chapters.
--
-- The exposure is nil: both are IMMUTABLE pure text functions that read no
-- table and can only tell the caller something about a string they already have.
-- ------------------------------------------------------------
revoke all on function public.translit_devanagari(text)
  from public, anon, authenticated, service_role;
revoke all on function public.search_latin_key(text)
  from public, anon, authenticated, service_role;

grant execute on function public.translit_devanagari(text)
  to anon, authenticated, service_role;
grant execute on function public.search_latin_key(text)
  to anon, authenticated, service_role;


-- =====================================================================
--  SELF-TEST — raises, so a broken transliterator cannot be applied.
--
--  These are not invented strings: every Devanagari row below is a real
--  chapter name from the CBSE Class 10 Hindi A/B catalogue as stored in
--  public.chapters today. The expected value is THIS SCHEME'S canonical
--  output AFTER the informal-romanisation fold, so "saakhii" is stored as
--  "sakhi" and the spelling a student types is a substring of the key. What
--  the fold does NOT cover ("mein" vs "men") is the fuzzy tier's job. The test asserts
--  the exact key so that any future edit to the mapping table shows up here
--  instead of as silently missing search results.
--
--  Every pair is also checked for idempotence (key(key(x)) = key(x)), because
--  the query and the content are both pushed through this same function and a
--  scheme that is not idempotent would match content only when the student
--  typed Devanagari.
-- =====================================================================
do $selftest$
declare
  r      record;
  v_got  text;
  v_bad  text := '';
  v_n    int  := 0;
begin
  for r in
    select * from (values
      -- ---- Class 10 Hindi B, verbatim from the catalogue ----------------
      ('कबीर की साखी',            'kabira ki sakhi'),
      ('मीरा के पद',              'mira ke pada'),
      ('मनुष्यता',                'manushyata'),
      ('पर्वत प्रदेश में पावस',      'parvata pradesha men pavasa'),
      ('बड़े भाई साहब',           'bade bhai sahaba'),
      ('तोप',                     'topa'),
      ('कर चले हम फ़िदा',          'kara chale hama phida'),
      ('आत्मत्राण',               'atmatrana'),
      ('डायरी का एक पन्ना',        'dayari ka eka panna'),
      ('तताँरा वामीरो कथा',        'tatanra vamiro katha'),
      ('पतझर में टूटी पत्तियाँ',     'patajhara men tuti pattiyan'),
      ('कारतूस',                  'karatusa'),
      ('हरिहर काका',              'harihara kaka'),
      ('सपनों के से दिन',          'sapanon ke se dina'),
      ('टोपी शुक्ला',              'topi shukla'),
      ('सूरदास',                  'suradasa'),
      -- ---- the three conjuncts the design note claims -------------------
      ('क्षितिज',                  'kshitija'),   -- क् + ष -> ksh, positionally
      ('क्ष',                      'ksha'),
      ('त्र',                      'tra'),
      ('ज्ञ',                      'gya'),        -- the one hard-coded digraph
      ('ज्ञान',                    'gyana'),
      ('विज्ञान',                  'vigyana'),
      ('त्रिकोणमिति',              'trikonamiti'),-- lands EXACT on what students type
      ('राम लक्ष्मण',              'rama lakshmana'),
      -- ---- marks -------------------------------------------------------
      ('हंस',                     'hansa'),      -- anusvara after inherent 'a'
      ('संख्या',                   'sankhya'),
      ('दुःख',                    'duhkha'),     -- visarga
      ('ॐ',                       'om'),
      ('अध्याय १२',               'adhyaya 12'),-- Devanagari digits
      ('राम। सीता',               'rama sita'),-- danda becomes a space
      -- ---- mixed script, the real shape of many titles -----------------
      ('Class 10 हिंदी B',        'class 10 hindi b'),
      -- ---- LATIN IDENTITY ----------------------------------------------
      ('Projectile Motion',        'projectile motion'),
      ('Class 11 Physics: Motion', 'class 11 physics motion'),
      ('Newton''s Laws of Motion', 'newtons laws of motion')
    ) as t(src, expected)
  loop
    v_n := v_n + 1;

    v_got := public.search_latin_key(r.src);
    if v_got is distinct from r.expected then
      v_bad := v_bad || format(E'\n  %s  ->  %L   expected  %L', r.src, v_got, r.expected);
    end if;

    -- Idempotence: the key of the key must be the key.
    if public.search_latin_key(v_got) is distinct from v_got then
      v_bad := v_bad || format(E'\n  NOT IDEMPOTENT: %L -> %L',
                               v_got, public.search_latin_key(v_got));
    end if;
  end loop;

  -- A test that passes because the list was emptied proves nothing.
  if v_n < 30 then
    raise exception 'search_latin_key self-test is vacuous: only % pairs checked', v_n;
  end if;

  if v_bad <> '' then
    raise exception 'search_latin_key self-test FAILED (% pairs checked):%', v_n, v_bad;
  end if;

  raise notice 'search_latin_key: % transliteration pairs OK.', v_n;
end
$selftest$;


-- Invariants that are not single pairs.
do $selftest_invariants$
declare
  r        record;
  v_bad    text := '';
  v_zwnj   text;
  v_collide text;
begin
  ------------------------------------------------------------------ null/empty
  if public.search_latin_key(null) is not null then
    v_bad := v_bad || E'\n  search_latin_key(null) must be null';
  end if;
  if public.translit_devanagari(null) is not null then
    v_bad := v_bad || E'\n  translit_devanagari(null) must be null';
  end if;
  if public.search_latin_key('') is not null then
    v_bad := v_bad || E'\n  search_latin_key('''') must be null';
  end if;
  if public.search_latin_key('   ') is not null then
    v_bad := v_bad || E'\n  whitespace-only must be null';
  end if;
  -- A lone danda is punctuation in any script: it must not become a key.
  if public.search_latin_key(chr(2404)) is not null then
    v_bad := v_bad || E'\n  lone danda U+0964 must be null, not a key';
  end if;

  ------------------------------------------------- Latin identity, stated once
  -- The contract's central claim, asserted as an EQUATION against the existing
  -- normaliser rather than against hand-written strings: for anything with no
  -- Devanagari in it, this function must do exactly what the Latin-only tiers
  -- already do, or the two index sets disagree.
  if exists (
    select 1 from (values
      ('Projectile Motion'), ('  ROTATIONAL   motion  '), ('p-Block Elements'),
      ('Newton''s 3rd Law'), ('Thermodynamics (Part 2)'), ('12th / Dropper'),
      ('Class 11 Physics: Motion'), ('Alcohols, Phenols & Ethers')
    ) as t(s)
     where public.search_latin_key(t.s) is distinct from public.normalize_search_text(t.s)
  ) then
    v_bad := v_bad || E'\n  Latin input is NOT the identity transform: '
                   || 'search_latin_key <> normalize_search_text';
  end if;
  -- ...and translit itself must not touch a Latin byte, punctuation included.
  if public.translit_devanagari('Projectile Motion 12: p-Block & Co.')
     is distinct from 'Projectile Motion 12: p-Block & Co.' then
    v_bad := v_bad || E'\n  translit_devanagari altered pure-Latin text';
  end if;

  ------------------------------------------------ Unicode spelling robustness
  -- बड़े written with the PRECOMPOSED ड़ (U+095C) and with the DECOMPOSED
  -- ड + nukta (U+0921 U+093C) are the same word and must key identically —
  -- otherwise an expression index built over rows imported from two different
  -- sources silently splits into two half-searchable halves.
  if public.search_latin_key(chr(2348) || chr(2396) || chr(2375))
     is distinct from public.search_latin_key(chr(2348) || chr(2337) || chr(2364) || chr(2375))
  then
    v_bad := v_bad || E'\n  precomposed U+095C and decomposed U+0921+U+093C disagree';
  end if;
  if public.search_latin_key(chr(2348) || chr(2396) || chr(2375)) is distinct from 'bade' then
    v_bad := v_bad || E'\n  बड़े must key to bade';
  end if;
  -- फ़ the same way: U+095E vs U+092B + nukta.
  if public.search_latin_key(chr(2398) || chr(2367))
     is distinct from public.search_latin_key(chr(2347) || chr(2364) || chr(2367))
  then
    v_bad := v_bad || E'\n  precomposed U+095E and decomposed U+092B+U+093C disagree';
  end if;
  -- A ZWNJ inside a cluster is invisible and must be invisible to the key too.
  v_zwnj := chr(2325) || chr(2381) || chr(8204) || chr(2359)
            || chr(2367) || chr(2340) || chr(2367) || chr(2332);
  if public.search_latin_key(v_zwnj) is distinct from 'kshitija' then
    v_bad := v_bad || format(E'\n  ZWNJ changed the key: got %L, want %L',
                             public.search_latin_key(v_zwnj), 'kshitija');
  end if;

  ------------------------------------------------------------ positional rules
  -- These four assert the mechanism itself, not a word: inherent 'a', matra
  -- replacement, virama cancellation. If someone "simplifies" the loop into a
  -- translate() call, these are what break first.
  if public.search_latin_key(chr(2325))                is distinct from 'ka'  then
    v_bad := v_bad || E'\n  bare क must carry the inherent a -> ka'; end if;
  if public.search_latin_key(chr(2325) || chr(2367))   is distinct from 'ki'  then
    v_bad := v_bad || E'\n  matra must REPLACE the inherent a: कि -> ki'; end if;
  if public.search_latin_key(chr(2325) || chr(2381))   is distinct from 'k'   then
    v_bad := v_bad || E'\n  virama must CANCEL the inherent a: क् -> k'; end if;
  if public.search_latin_key(chr(2348) || chr(2375))   is distinct from 'be'  then
    v_bad := v_bad || E'\n  बे -> be'; end if;


  ------------------------------------------- the fold's reason for existing
  -- Not a transform check: the SPELLING A STUDENT TYPES must be findable in
  -- the key. Token-substring containment is exactly what the all-tokens tier
  -- matches on, so this asserts the end-to-end promise, not an intermediate.
  --
  -- KNOWN GAP, deliberately not asserted here: Hindi also deletes schwa
  -- word-INTERNALLY, which this fold does not model. सूरदास keys to "suradasa"
  -- but a student types "surdas"; कारतूस keys to "karatusa" against "kartus".
  -- Those reach the fuzzy word_similarity tier instead of the exact tiers, and
  -- may miss. Modelling interior schwa correctly is context-dependent Hindi
  -- phonology, not a regex — the honest fix is a small curated alias table
  -- (typed form -> chapter) that a human can extend, which is why this test
  -- asserts only the cases the fold genuinely delivers rather than pretending.
  for r in
    select * from (values
      ('कबीर की साखी',        'kabir ki sakhi'),
      ('मीरा के पद',          'mira ke pad'),
      ('बड़े भाई साहब',       'bade bhai sahab'),
      ('टोपी शुक्ला',          'topi shukla'),
      ('डायरी का एक पन्ना',    'dayari ka ek panna'),
      ('हरिहर काका',          'harihar kaka')
    ) as t(devanagari, typed)
  loop
    -- coalesce + null guard: bool_and over an empty set is NULL and 'if not
    -- (NULL)' does not branch, so without this the assertion could pass by
    -- producing no tokens at all — the vacuity class this file guards against.
    if public.search_latin_key(r.typed) is null
       or not coalesce((
         select bool_and(public.search_latin_key(r.devanagari) like '%' || tok || '%')
           from unnest(string_to_array(public.search_latin_key(r.typed), ' ')) as tok
       ), false) then
      v_bad := v_bad || format(
        E'\n  a student typing %L cannot reach %L (key %L)',
        r.typed, r.devanagari, public.search_latin_key(r.devanagari));
    end if;
  end loop;

  ------------------------------------------- key collisions over REAL DATA
  -- THE ASSERTION THAT WOULD HAVE CAUGHT THE LAST BUG. A revision of this file
  -- folded aa/ii/uu over the whole string, which collapsed "Meiosis I" and
  -- "Meiosis II" to one key: the query "Meiosis II" then returned Meiosis I
  -- labelled 'exact', and no query could reach the second lesson ever again.
  -- Every transform-level test still passed, because they all assert the
  -- transform, not its effect on the catalogue. This one asserts the effect:
  -- two DIFFERENT titles inside one course must never share a key.
  -- Verified to hold on production data (0 collisions) before being made fatal.
  select string_agg(format('%L (course %s)', d.k, d.playlist_id), '; ')
    into v_collide
    from (
      select pv.playlist_id, public.search_latin_key(v.title) as k
        from public.playlist_videos pv
        join public.videos v on v.id = pv.video_id
       group by pv.playlist_id, public.search_latin_key(v.title)
      having count(distinct v.title) > 1
    ) d;
  if v_collide is not null then
    v_bad := v_bad || E'\n  distinct lesson titles collapse to one search key, '
                   || 'so one of them is unreachable: ' || v_collide;
  end if;

  if v_bad <> '' then
    raise exception 'search_latin_key invariant self-test FAILED:%', v_bad;
  end if;

  raise notice 'search_latin_key: invariants OK (null-safety, Latin identity, nukta/ZWNJ, positional rules).';
end
$selftest_invariants$;


-- ============================================================
-- src/migrations/universal_search_v11.sql
-- ============================================================

-- =====================================================================
--  universal_search_v11.sql — ranking + search function, rewritten.
--
--  Replaces the ranking half of universal_search.sql / search_hide_empty_chapters.sql.
--  The RPC SIGNATURE and the RETURNS TABLE column list are byte-identical to the
--  version in production, so useUniversalSearch.js / UniversalSearch.jsx need no
--  change: same four match_type strings ('exact' | 'prefix' | 'partial' | 'fuzzy'),
--  same group_total, same extra payloads, same ordering rules.
--
--  APPLY THIS FILE AS ONE TRANSACTION. Pasting the whole script into the
--  Supabase SQL editor does that. It matters: the self-test at the bottom raises
--  an exception when search is still broken, and that only rolls the DDL back if
--  the DDL and the test share a transaction. A half-applied search is worse than
--  an unapplied one.
--
--  Depends on: pg_trgm, schema.sql, and public.search_latin_key(text) (shipped
--  separately — the preflight below refuses to continue without it).
--
--  ---------------------------------------------------------------------
--  WHAT WAS WRONG, AND WHAT CHANGED
--  ---------------------------------------------------------------------
--
--  P1  NOT SARGABLE. Every group filtered on
--          where public.search_rank(public.normalize_search_text(col), q) is not null
--      A function result compared to NULL exposes nothing to the planner. All
--      seven trigram indexes were dead weight and every keystroke seq-scanned
--      the table, running three regexp_replace calls plus similarity() per row.
--      FIX: the WHERE clause now contains only operators that are members of
--      gin_trgm_ops (LIKE / %>) applied DIRECTLY to the indexed expression. The
--      tier is computed afterwards, on the handful of rows the index returned.
--
--  P2  TYPO TOLERANCE WAS DEAD. similarity() compares WHOLE strings. A 15-char
--      query against a 90-char lecture title scores ~0.13, nowhere near the 0.4
--      threshold, so "projctile motin" returned nothing at all. FIX: word_
--      similarity() / the %> operator, which score the best-matching extent at
--      word boundaries instead of the whole haystack — and, unlike similarity(),
--      %> is GIN-indexable in the form  indexed_expression %> 'needle'.
--
--  P3  MULTI-WORD QUERIES FAILED. The query was one literal string, so
--      "motion gravity" could never be a substring of anything. FIX:
--      tier 4 is now ALL TOKENS PRESENT (see design note 5).
--
--  P4  NO HINGLISH BRIDGE. 48 lesson titles and 33 chapters are Devanagari
--      (कबीर की साखी, मीरा के पद, बड़े भाई साहब, पर्वत प्रदेश में पावस) and a student
--      typing "kabir ki sakhi" got nothing. FIX: every comparison — column AND
--      query — goes through public.search_latin_key(), which transliterates
--      Devanagari to Latin and is the identity transform for Latin input. ONE
--      key therefore serves all four combinations: Latin query/Latin row, Latin
--      query/Devanagari row, Devanagari query/Latin row, Devanagari both.
--
--  ---------------------------------------------------------------------
--  DESIGN NOTES YOU SHOULD READ BEFORE CHANGING ANYTHING HERE
--  ---------------------------------------------------------------------
--
--  1. ALL RANKING AND PAGING HAPPEN HERE, IN THE DATABASE. (unchanged)
--     The browser never receives the catalogue. It sends a query string and
--     receives at most p_limit rows per group plus a total count.
--
--  2. FACULTY IS CAPABILITY-GATED, NOT FAKED. (unchanged, verbatim below)
--     Real faculty identity lives in teachers_v7.sql, which is NOT applied to
--     production, so the faculty branch is reached through dynamic SQL guarded
--     by to_regclass(): where the teacher tables exist there is a real Faculty
--     group; where they do not, the group is ABSENT. It is never synthesised
--     from playlists.teacher. An absent group is honest; a fabricated identity
--     is not. Faculty ranking belongs to search_teachers() and is deliberately
--     NOT touched by this file.
--
--  3. SECURITY INVOKER on purpose. (unchanged)
--     Catalogue rows stay subject to RLS, so this function can never become a
--     way to read something the caller could not already read. That is also why
--     every helper it calls by name must be executable by anon — see GRANTS.
--
--  4. SHORT-QUERY PROTECTION. (unchanged)
--     Under 2 characters nothing is returned at all. Prefix needs 2, the token
--     tier needs 3, fuzzy needs 4. On "ab", trigram matching hits almost every
--     row: it buries the right answer and makes an ambiguous match look
--     decisive. The floor is measured on the SHORTER of the raw normalised query
--     and its Latin key, so a single Devanagari character that transliterates to
--     two Latin letters is still one character and still returns nothing.
--
--  5. RANK ORDER is a single integer so it sorts trivially:
--       1 exact        2 verified alias (faculty only)     3 prefix
--       4 ALL TOKENS PRESENT                               5 guarded fuzzy
--     Tier 4 is the change. For a one-word query it is exactly the old 'partial'
--     tier (needle is a substring of haystack). For "motion gravity" it
--     means every token is a substring — which is why multi-word queries work
--     now. AND-ing tokens can only NARROW a result set, never broaden it, so no
--     per-token length guard is needed; the guard belongs on the whole needle.
--     Tier 4 keeps the label 'partial' and tier 5 keeps 'fuzzy' so the UI is
--     unchanged.
--
--  6. SARGABILITY IS THE WHOLE POINT — DO NOT REINTRODUCE A FUNCTION-RESULT
--     PREDICATE. Each group filters with
--         where  k like '%' || q_longest_token || '%'   -- gin_trgm_ops strategy 2
--            or  k like q || '%'                        -- strategy 2 + btree prefix
--            or  k %> q_long                            -- gin_trgm_ops strategy 7
--     where k is literally  public.search_latin_key(<column>)  and nothing else.
--     The expression is SPELLED OUT at every use instead of being aliased
--     through a CTE or subquery column: an expression index only matches an
--     expression the planner can see verbatim, and an alias is how P1 gets
--     reintroduced by accident.
--
--     WHY PREFILTERING ON THE LONGEST TOKEN IS RECALL-SAFE. Tier 4 requires
--     EVERY token to be a substring of the haystack; the longest token is one of
--     them, so any tier-4 row necessarily contains the longest token and
--     necessarily satisfies the first disjunct. Tier 1 (haystack = needle) and
--     tier 3 (haystack LIKE needle || '%') both contain the whole needle, hence
--     every token, hence the longest one. Tier 5 is caught by the third
--     disjunct, k %> q_long: tier 5 requires EVERY token to clear the
--     word-similarity threshold, and the longest token is one of them, so a
--     tier-5 row always satisfies that disjunct too (it is a superset, not an
--     equality — the disjunct admits rows where only the longest token is
--     similar, which the ranker then discards). So the disjunction is a
--     superset of the true match set for every tier — it can never drop a row
--     search_rank_tokens would have ranked. The second disjunct is redundant for
--     recall and is there for speed: on a 2-character query the substring
--     pattern yields no trigrams, and prefix is then the only reachable tier, so
--     this is the disjunct that keeps the commonest query length off a seq scan.
--
--  7. THE WORD-SIMILARITY THRESHOLD IS SET IN THE FUNCTION, NOT IN THE DATABASE.
--     %> compares against the pg_trgm.word_similarity_threshold GUC, whose
--     default is 0.6. Relying on a per-database GUC means search quality depends
--     on invisible server state: a restored backup, a different Supabase
--     project, or somebody's stray SET and the fuzzy tier silently changes
--     behaviour. So the function calls
--         perform set_config('pg_trgm.word_similarity_threshold', '0.5', true)
--     — transaction-local (the `true`), so it cannot leak into anyone else's
--     session, and PostgREST already gives each request its own transaction.
--     0.5 is the SAME number hardcoded in search_rank_tokens tier 5, so the
--     index prefilter and the tier calculation agree exactly. If you change one,
--     change both, or the prefilter starts dropping rows the ranker would keep.
--
--  8. THE OLD normalize_search_text INDEXES ARE LEFT IN PLACE ON PURPOSE.
--     idx_*_trgm and idx_*_pattern (on public.normalize_search_text(...)) are no
--     longer used by universal_search, but normalize_search_text() itself is
--     still a public, granted function and another consumer may depend on it, so
--     dropping the indexes is a separate decision from this migration. If you
--     later confirm nothing else uses them, they are pure write overhead and can
--     go; the ones this file creates end in _latin_trgm / _latin_pattern.
--
--  9. public.search_rank(text, text) IS KEPT AND UNCHANGED. Other code and the
--     staging test suite reference it. It is simply no longer called from here.
--     Its replacement is public.search_rank_tokens(text, text[], text).
--
--  Apply order: after schema.sql, after search_latin_key, after
--  universal_search.sql / search_hide_empty_chapters.sql. Independent of
--  teachers_v7.sql.
-- =====================================================================


-- ------------------------------------------------------------
-- PREFLIGHT. Fail early and legibly rather than three statements later with
-- "function search_latin_key(text) does not exist" buried in an index build.
-- ------------------------------------------------------------
do $preflight$
declare v_volatile "char";
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    raise exception 'universal_search_v11: pg_trgm extension is not installed.';
  end if;

  if to_regprocedure('public.search_latin_key(text)') is null then
    raise exception
      'universal_search_v11: missing dependency public.search_latin_key(text). Apply the search_latin_key migration first.';
  end if;

  -- An expression index REQUIRES an immutable expression. If search_latin_key
  -- were declared stable, CREATE INDEX below would fail with a much less
  -- helpful message and the real defect (wrong volatility label) would be
  -- hidden.
  select p.provolatile into v_volatile
    from pg_proc p
   where p.oid = to_regprocedure('public.search_latin_key(text)');
  if v_volatile is distinct from 'i' then
    raise exception
      'universal_search_v11: public.search_latin_key(text) must be IMMUTABLE (it is %), otherwise it cannot be indexed.',
      case v_volatile when 's' then 'STABLE' when 'v' then 'VOLATILE' else coalesce(v_volatile::text, 'missing') end;
  end if;
end
$preflight$;


-- ------------------------------------------------------------
-- word_similarity, schema-qualified.
--
-- pg_trgm's schema is not uniform across Supabase projects (extensions here,
-- public there), and universal_search runs with a pinned search_path. Compile
-- one wrapper against the schema pg_trgm actually lives in, exactly as
-- catalog_similarity() already does for similarity().
--
-- This wrapper is used ONLY by search_rank_tokens, for the tier calculation.
-- The sargable predicate in universal_search must use the %> OPERATOR, not this
-- function: a function call is not a member of gin_trgm_ops and would put us
-- straight back into P1.
-- ------------------------------------------------------------
do $install_catalog_word_similarity$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'create or replace function public.catalog_word_similarity(text, text)
       returns real language sql immutable strict set search_path = ''''
       as $fn$ select %I.word_similarity($1, $2) $fn$', v_schema);
end
$install_catalog_word_similarity$;

comment on function public.catalog_word_similarity(text, text) is
  'Schema-stable wrapper for pg_trgm word_similarity(needle, haystack): best-matching word-boundary extent, not whole-string similarity.';


-- ------------------------------------------------------------
-- INDEXES on the Latin key.
--
-- Expression indexes must match the expression used in the query EXACTLY or
-- Postgres will not use them and every search becomes a seq scan again. The
-- expression is public.search_latin_key(<column>) — no cast, no coalesce, no
-- alias — and universal_search spells it out identically.
--
-- The gin_trgm_ops operator class is schema-qualified for the same reason
-- catalog_word_similarity is: pg_trgm may not be in the session search_path
-- when this file is applied. That is the only reason these four are created
-- through dynamic SQL.
--
-- Note 8 applies: the older idx_*_trgm / idx_*_pattern indexes over
-- normalize_search_text() are intentionally NOT dropped.
--
-- These are plain (non-CONCURRENT) builds, so each takes a brief ACCESS
-- EXCLUSIVE lock on its table. That is deliberate: CONCURRENTLY cannot run
-- inside a transaction block, and this migration must be atomic so the
-- self-test at the bottom can roll it back. On this catalogue (hundreds of
-- rows, not millions) the lock is measured in milliseconds. If these tables
-- ever grow to the point where that matters, split the index builds out into
-- their own CONCURRENTLY-per-statement file and apply it BEFORE this one — the
-- eight CREATE INDEX statements here are then no-ops thanks to IF NOT EXISTS.
-- ------------------------------------------------------------
do $install_search_indexes$
declare
  v_schema name;
  r        record;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';

  for r in
    select * from (values
      ('idx_chapters_name_latin_trgm',   'public.chapters',            'name'),
      ('idx_playlists_title_latin_trgm', 'public.playlists',           'title'),
      ('idx_videos_title_latin_trgm',    'public.videos',              'title'),
      ('idx_institutes_name_latin_trgm', 'public.institutes_channels', 'name')
    ) as t(idx, tbl, col)
  loop
    execute format(
      'create index if not exists %I on %s using gin (public.search_latin_key(%I) %I.gin_trgm_ops)',
      r.idx, r.tbl, r.col, v_schema);
  end loop;
end
$install_search_indexes$;

-- btree text_pattern_ops powers the prefix tier (LIKE 'q%'). text_pattern_ops
-- rather than the default opclass because prefix scanning needs byte ordering,
-- not the database collation. Same expression as the GIN indexes above.
create index if not exists idx_chapters_name_latin_pattern
  on public.chapters (public.search_latin_key(name) text_pattern_ops);
create index if not exists idx_playlists_title_latin_pattern
  on public.playlists (public.search_latin_key(title) text_pattern_ops);
create index if not exists idx_videos_title_latin_pattern
  on public.videos (public.search_latin_key(title) text_pattern_ops);
create index if not exists idx_institutes_name_latin_pattern
  on public.institutes_channels (public.search_latin_key(name) text_pattern_ops);

-- The indexes above are , so on a RE-RUN after any edit to
-- search_latin_key they would survive holding keys computed by the OLD
-- function — searches would then silently miss rows, and the self-tests could
-- not tell, because they call the function directly rather than reading an
-- index. Rebuild unconditionally; at this catalogue size (~2k videos, ~220
-- chapters) it is milliseconds, and the transaction already holds the locks.
do $reindex$
declare r record;
begin
  for r in
    select indexname from pg_indexes
     where schemaname = 'public' and indexname like '%_latin_%'
  loop
    execute format('reindex index public.%I', r.indexname);
  end loop;
end
$reindex$;


-- ------------------------------------------------------------
--  search_rank_tokens — the tier calculation, in one place so the four
--  catalogue groups cannot drift apart. Replaces search_rank(), which stays
--  where it is (design note 9).
--
--    p_haystack  the row's Latin key
--    p_tokens    the query's tokens, in any order
--    p_needle    the whole normalised query (tokens joined by single spaces)
--
--    1  exact                      haystack = needle
--    3  prefix                     needle >= 2 chars, haystack starts with it
--    4  all tokens present         needle >= 3 chars, every token is a substring
--    5  fuzzy                      needle >= 4 chars, word_similarity >= 0.5
--    null  no match
--
--  Tiers 1/3 use LIKE and tier 4 uses position(); both are safe because
--  normalisation has already replaced every punctuation character, so neither
--  the needle nor any token can contain a LIKE wildcard (% or _). position() is
--  used for tokens because it is cheaper and needs no escaping discussion.
--
--  The 0.5 in tier 5 must stay equal to the GUC universal_search sets — see
--  design note 7.
-- ------------------------------------------------------------
create or replace function public.search_rank_tokens(
    p_haystack text,
    p_tokens   text[],
    p_needle   text)
returns int language sql immutable as $$
  select case
    when p_needle is null or p_haystack is null                            then null
    when p_haystack = p_needle                                            then 1
    when length(p_needle) >= 2 and p_haystack like p_needle || '%'         then 3
    -- Tier 4: EVERY token present. This is what makes "motion gravity"
    -- work, and for a single-token query it reduces to the old 'partial' tier.
    when length(p_needle) >= 3
         and p_tokens is not null
         and cardinality(p_tokens) > 0
         and not exists (
               select 1
                 from unnest(p_tokens) as tok
                where tok <> ''
                  and position(tok in p_haystack) = 0
             )                                                            then 4
    -- Fuzzy is the only tier that can be wrong in a surprising way, so it is
    -- both length-guarded and threshold-guarded. word_similarity(needle,
    -- haystack) — NOT similarity() — because the haystack is a 90-character
    -- lecture title and whole-string similarity drowns in it (P2).
    -- EVERY token must clear the threshold, not just the needle as a whole.
    -- word_similarity maximises over ONE contiguous extent, so 'class 12' was
    -- satisfied by matching only 'class' and dragged 253 Class-11 lectures in.
    -- group_total is a contract column the UI renders, so this has to be tight.
    when length(p_needle) >= 4
         and not exists (
           select 1 from unnest(p_tokens) as tok
            where tok <> ''
              and public.catalog_word_similarity(tok, p_haystack) < 0.5
         )                                                              then 5
    else null
  end;
$$;

comment on function public.search_rank_tokens(text, text[], text) is
  'Match tier for universal_search: 1 exact, 3 prefix, 4 all tokens present, 5 word-similarity fuzzy, null no match.';


-- ------------------------------------------------------------
--  universal_search
--
--  One round trip. One row per result. group_total lets the UI say
--  "showing 5 of 43" and drive paging without a second count query.
--
--  Signature and returns-table columns are frozen: useUniversalSearch.js reads
--  group_key, entity_id, title, subtitle, aka, slug, match_type, match_rank,
--  matched_on, is_ambiguous, group_total, extra by name.
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
  -- Two normalisations, on purpose. q is the Latin key and is what everything
  -- is matched on. q_raw exists only to measure the length of what the student
  -- actually typed, so transliteration cannot smuggle a 1-character query past
  -- the floor in design note 4.
  q_raw    text := public.normalize_search_text(p_query);
  q        text := public.search_latin_key(p_query);
  qlen     int  := least(coalesce(length(q_raw), 0), coalesce(length(q), 0));
  q_tokens text[];
  q_long   text;
  lim      int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off      int  := greatest(coalesce(p_offset, 0), 0);
  want     text[] := case when p_types is null or cardinality(p_types) = 0
                          then array['faculty','chapter','playlist','lecture','institute']
                          else p_types end;
begin
  -- Design note 4. One character is not a query; returning the top of the
  -- alphabet for "a" trains students to ignore the suggestions entirely.
  if qlen < 2 then
    return;
  end if;

  -- Design note 7: pin the %> threshold transaction-locally so behaviour does
  -- not depend on a per-database GUC. Must happen before the first %> below.
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  -- Tokens. q is already lower-cased, punctuation-stripped and single-spaced by
  -- search_latin_key, so splitting on a single space is exact; array_remove is
  -- belt and braces.
  q_tokens := array_remove(string_to_array(q, ' '), '');

  -- The longest token drives the index prefilter (design note 6). Ties are
  -- broken alphabetically so the same query always produces the same plan.
  select tok into q_long
    from unnest(q_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(q_long, q);

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7. Verbatim from the shipped version — faculty ranking is
  -- search_teachers()' business and is deliberately untouched by v11, which is
  -- also why it is passed the RAW p_query and not the Latin key.
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
             -- people with the same name distinguishable.
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
             public.search_rank_tokens(public.search_latin_key(ch.name), q_tokens, q) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
       -- CONTENT GUARD (from search_hide_empty_chapters.sql, preserved): never
       -- suggest a chapter with no lessons mapped to it, so parked/empty
       -- chapters cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
         -- SARGABLE (design note 6). Every disjunct is a gin_trgm_ops member
         -- applied to the indexed expression verbatim.
         and (   public.search_latin_key(ch.name) like '%' || q_long || '%'
              or public.search_latin_key(ch.name) like q || '%'
              or public.search_latin_key(ch.name) %> q_long )
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
             public.search_rank_tokens(public.search_latin_key(pl.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', nullif(pl.teacher,''), ic.name, s.name), '') as ctx,
             -- first chapter this playlist teaches, so the result deep-links
             -- to a watchable page rather than a dead end. Now evaluated only
             -- for rows that survived the index prefilter, not for every
             -- playlist in the table.
             (select v.chapter_id
                from public.playlist_videos pv
                join public.videos v on v.id = pv.video_id
               where pv.playlist_id = pl.id and v.chapter_id is not null
               order by pv.position limit 1) as chapter_id
        from public.playlists pl
        left join public.institutes_channels ic on ic.id = pl.channel_id
        left join public.subjects s on s.id = pl.subject_id
       where (   public.search_latin_key(pl.title) like '%' || q_long || '%'
              or public.search_latin_key(pl.title) like q || '%'
              or public.search_latin_key(pl.title) %> q_long )
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
             public.search_rank_tokens(public.search_latin_key(v.title), q_tokens, q) as rk,
             nullif(concat_ws(' · ', ch.name, s.name), '') as ctx,
             v.chapter_id, v.subject_id,
             v.youtube_video_id,
             -- The course this lesson sits in, so a lecture result can open the
             -- LESSON rather than dumping the student on a filtered catalogue
             -- to hunt for what they just found. Lowest playlist_id keeps the
             -- choice deterministic for a lesson shared by several courses;
             -- the subquery runs only on rows the index prefilter returned.
             (select pv.playlist_id
                from public.playlist_videos pv
               where pv.video_id = v.id
               order by pv.playlist_id
               limit 1) as playlist_id
        from public.videos v
        left join public.chapters ch on ch.id = v.chapter_id
        left join public.subjects s  on s.id = v.subject_id
       where (   public.search_latin_key(v.title) like '%' || q_long || '%'
              or public.search_latin_key(v.title) like q || '%'
              or public.search_latin_key(v.title) %> q_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'lecture'::text, c.id, c.title, c.ctx, null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           -- extra is jsonb, so new keys are additive: the RETURNS TABLE
           -- signature is unchanged and older clients ignore what they do not
           -- read (see Home.jsx resultHref, which falls back when absent).
           jsonb_build_object('chapter_id', c.chapter_id, 'subject_id', c.subject_id,
                              'playlist_id', c.playlist_id,
                              'youtube_video_id', c.youtube_video_id)
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ---------------------------------------------------------------- institutes
  if 'institute' = any(want) then
    return query
    with m as (
      select ic.id, ic.name,
             public.search_rank_tokens(public.search_latin_key(ic.name), q_tokens, q) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
       where (   public.search_latin_key(ic.name) like '%' || q_long || '%'
              or public.search_latin_key(ic.name) like q || '%'
              or public.search_latin_key(ic.name) %> q_long )
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

-- The %> operator lives in pg_trgm's schema, which is 'extensions' on Supabase
-- and 'public' elsewhere, and the function above pins its search_path. plpgsql
-- resolves the SQL inside a function body at first EXECUTION, not at CREATE, so
-- the create above succeeds either way — but the first search would fail with
-- "operator does not exist: text %> text" unless pg_trgm's schema is on the
-- path. Add it, looked up from pg_extension rather than guessed. This must run
-- AFTER the create-or-replace, which resets the setting.
do $pin_search_path$
declare v_schema name;
begin
  select n.nspname into v_schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'alter function public.universal_search(text, text[], int, int) set search_path = public, %I, pg_temp',
    v_schema);
end
$pin_search_path$;

comment on function public.universal_search(text, text[], int, int) is
  'Grouped, server-ranked, paginated search. Sargable trigram predicates, multi-token AND matching, word-similarity typo tolerance, Devanagari/Latin bridge. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters.';


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
revoke all on function public.search_rank_tokens(text, text[], text)
  from public, anon, authenticated, service_role;
revoke all on function public.catalog_word_similarity(text, text)
  from public, anon, authenticated, service_role;

-- Public browsing must work without login, so anon executes the search itself.
grant execute on function public.universal_search(text, text[], int, int)
  to anon, authenticated, service_role;

-- The helpers MUST be granted to anon as well, and this is not optional:
-- universal_search is SECURITY INVOKER, so when a logged-out student calls it
-- the body runs as anon and calls these by name. Revoking them from anon "to
-- keep the API surface small" would make every public search fail with
-- "permission denied for function search_rank_tokens".
--
-- The exposure is nil: both are IMMUTABLE pure text functions that touch no
-- table and can only tell the caller something about a string they already have.
grant execute on function public.search_rank_tokens(text, text[], text)
  to anon, authenticated, service_role;
grant execute on function public.catalog_word_similarity(text, text)
  to anon, authenticated, service_role;

-- Same reasoning for the shared Latin key, which universal_search calls on
-- every row. Revoking/regranting search_latin_key is its own migration's job;
-- this is a one-line re-assert so a missing grant there cannot take public
-- search down. Granting a privilege that is already held is a no-op.
grant execute on function public.search_latin_key(text)
  to anon, authenticated, service_role;

-- normalize_search_text is still called (for the length floor) and was already
-- granted by universal_search.sql; re-asserted here for the same reason.
grant execute on function public.normalize_search_text(text)
  to anon, authenticated, service_role;


-- =====================================================================
--  SELF-TEST — this migration REFUSES TO APPLY if search is still broken.
--
--  Every assertion runs the real RPC against the real catalogue. Nothing here
--  hardcodes an id: assertions are on counts and on title CONTENT, and each
--  data-dependent case is guarded by a check that the catalogue can actually
--  answer it — a test that passes because a table is empty proves nothing, so
--  those cases SKIP LOUDLY (raise notice) instead of passing quietly.
--
--  What is deliberately NOT asserted: the query plan. On a catalogue of a few
--  hundred rows a seq scan is genuinely cheaper and the planner is right to
--  choose one, so an "index must be used" assertion here would fail for the
--  wrong reason. Sargability is a property of the PREDICATE, and the predicate
--  is reviewable by reading it. Check plans with EXPLAIN on a database with
--  production-sized data, not from a migration.
-- =====================================================================
do $selftest$
declare
  v_lectures bigint;
  v_n        bigint;
  v_rows     bigint;
  v_hits     bigint;
  v_page     int;
  v_title    text;
  v_key      text;
  v_tokens   text[];
  v_word     text;
  v_typo     text;
  v_query    text;
  v_bad      text;
  v_cases    jsonb := '[]'::jsonb;
  v_case     record;
begin
  select count(*) into v_lectures from public.videos;
  raise notice 'SELF-TEST: universal_search v11 against % lecture rows', v_lectures;

  -- ---------------------------------------------------------------- (d)
  -- SHORT-QUERY PROTECTION. Runs everywhere, needs no data. If this ever
  -- returns rows, the floor in design note 4 has been lost and every search box
  -- keystroke now dumps the top of the alphabet at a student.
  select count(*) into v_n from public.universal_search('a', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the 1-character query "a" returned % rows; the <2 character guard is gone', v_n;
  end if;
  select count(*) into v_n from public.universal_search('!', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the punctuation-only query "!" returned % rows', v_n;
  end if;
  select count(*) into v_n from public.universal_search('', null::text[], 5, 0);
  if v_n <> 0 then
    raise exception 'SELF-TEST FAILED (d): the empty query returned % rows', v_n;
  end if;

  -- ---------------------------------------------------------------- contract
  -- The four match_type strings UniversalSearch.jsx knows about. A fifth value
  -- would render as an unlabelled row rather than an error, so assert it here.
  -- Faculty is excluded on purpose: its labels come from search_teachers(),
  -- which owns tier 2 ('alias') and is not this migration's contract.
  select string_agg(distinct r.match_type, ', ') into v_bad
    from public.universal_search('motion', array['chapter','playlist','lecture','institute'], 50, 0) r
   where r.match_type not in ('exact','prefix','partial','fuzzy');
  if v_bad is not null then
    raise exception 'SELF-TEST FAILED: universal_search emitted match_type(s) the UI cannot render: %', v_bad;
  end if;

  -- ---------------------------------------------------------------- (c)
  -- The tier that already worked must keep working: an exact/prefix hit on a
  -- chapter name. Guarded on the chapter existing AND having lessons, because
  -- the chapter group hides content-less chapters by design.
  if exists (select 1 from public.chapters ch
              where public.search_latin_key(ch.name) like 'kinematics%'
                and exists (select 1 from public.videos v where v.chapter_id = ch.id)) then
    select count(*) into v_n
      from public.universal_search('kinematics', array['chapter'], 20, 0) r
     where public.search_latin_key(r.title) like 'kinematics%'
       and r.match_type in ('exact','prefix');
    if v_n = 0 then
      raise exception 'SELF-TEST FAILED (c): "kinematics" no longer returns the Kinematics chapter as an exact/prefix match';
    end if;
  else
    raise notice 'SELF-TEST SKIPPED (c): no chapter named Kinematics* with lessons mapped to it';
  end if;

  -- ---------------------------------------------------------------- (b)
  -- MULTI-TOKEN (P3). Two words that appear in one title but never adjacently
  -- could not match before, because the query was one literal string.
  --
  -- No paging needed: tiers 1/3/4 all sort ahead of tier 5, and every row in
  -- tiers 1/3/4 contains the whole query, so if any exist at all they are on
  -- the first page.
  if exists (select 1 from public.videos v
              where public.search_latin_key(v.title) like '%motion%'
                and public.search_latin_key(v.title) like '%gravity%') then
    select count(*) into v_n
      from public.universal_search('motion gravity', array['lecture'], 50, 0) r
     where public.search_latin_key(r.title) like '%motion%'
       and public.search_latin_key(r.title) like '%gravity%';
    if v_n = 0 then
      raise exception 'SELF-TEST FAILED (b): "motion gravity" matched no lecture containing both words — multi-token search is broken';
    end if;
  else
    raise notice 'SELF-TEST SKIPPED (b, literal): no lecture title contains both "motion" and "gravity"';
  end if;

  -- (b2) The same property, DERIVED from a real title so it cannot rot when the
  -- catalogue changes. Take the two longest words of some lecture title, search
  -- for them as a two-word query, and require at least one row that contains
  -- both AND is labelled by a token tier rather than fuzzy.
  select t.title, t.toks into v_title, v_tokens
    from (
      select v.id, v.title,
             (select array_agg(x order by length(x) desc, x)
                from (select distinct tok
                        from unnest(string_to_array(public.search_latin_key(v.title), ' ')) as tok
                       where length(tok) >= 4) d(x)) as toks
        from public.videos v
    ) t
   where cardinality(t.toks) >= 2
   order by length(t.title), t.id
   limit 1;

  if v_title is null then
    raise notice 'SELF-TEST SKIPPED (b2): no lecture title has two distinct words of 4+ characters';
  else
    v_query := v_tokens[1] || ' ' || v_tokens[2];
    select count(*) into v_n
      from public.universal_search(v_query, array['lecture'], 50, 0) r
     where position(v_tokens[1] in public.search_latin_key(r.title)) > 0
       and position(v_tokens[2] in public.search_latin_key(r.title)) > 0
       and r.match_type in ('exact','prefix','partial');
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (b2): the two-word query %L (built from the real lecture %L) matched no lecture containing both words',
        v_query, v_title;
    end if;
  end if;

  -- ---------------------------------------------------------------- (a)
  -- TYPO TOLERANCE (P2) — the case that returns NOTHING today.
  --
  -- Two cases, both collected first and then run through the same paged loop:
  --   a1  the literal "projctile motin", guarded on a Projectile lecture existing
  --   a2  a real 10+ character word from the catalogue with one interior letter
  --       deleted, guarded so the corrupted form is NOT a literal substring of
  --       any title — otherwise the substring tier would answer it and the test
  --       would prove nothing about fuzzy matching.
  if exists (select 1 from public.videos v
              where public.search_latin_key(v.title) like '%projectile%') then
    v_cases := v_cases || jsonb_build_array(jsonb_build_object(
      'q', 'projctile motin', 'needle', 'projectile',
      'label', '(a1) the classic typo "projctile motin" must still find a Projectile lecture'));
  else
    raise notice 'SELF-TEST SKIPPED (a1): this database has no lecture title containing "projectile"';
  end if;

  select d.tok into v_word
    from (select distinct tok
            from public.videos v,
                 unnest(string_to_array(public.search_latin_key(v.title), ' ')) as tok
           where length(tok) >= 10
             and tok ~ '^[a-z]+$') d
   order by length(d.tok) desc, d.tok
   limit 1;

  if v_word is null then
    raise notice 'SELF-TEST SKIPPED (a2): no lecture title contains a 10+ letter word to corrupt';
  else
    -- drop the middle character: 'thermodynamics' -> 'thermdynamics'
    v_typo := overlay(v_word placing '' from (length(v_word) / 2) for 1);
    if exists (select 1 from public.videos v
                where public.search_latin_key(v.title) like '%' || v_typo || '%') then
      raise notice
        'SELF-TEST SKIPPED (a2): the corrupted form %L occurs literally in the catalogue, so it would not exercise the fuzzy tier', v_typo;
    else
      v_cases := v_cases || jsonb_build_array(jsonb_build_object(
        'q', v_typo, 'needle', v_word,
        'label', format('(a2) one-deletion typo %L must still find the lecture containing %L', v_typo, v_word)));
    end if;
  end if;

  for v_case in select value as c from jsonb_array_elements(v_cases) loop
    -- Every hit here is tier 5, and tier 5 sorts LAST, so the target can sit
    -- past the first page. Walk pages until found or exhausted (cap 5 x 50).
    v_hits := 0;
    v_page := 0;
    loop
      select count(*),
             count(*) filter (
               where public.search_latin_key(r.title) like '%' || (v_case.c ->> 'needle') || '%')
        into v_rows, v_n
        from public.universal_search(v_case.c ->> 'q', array['lecture'], 50, v_page * 50) r;
      v_hits := v_hits + v_n;
      exit when v_hits > 0 or v_rows < 50 or v_page >= 4;
      v_page := v_page + 1;
    end loop;
    if v_hits = 0 then
      raise exception 'SELF-TEST FAILED (a): % — typo tolerance is not working; word_similarity is not reaching the 0.5 threshold', (v_case.c ->> 'label');
    end if;
  end loop;

  -- ---------------------------------------------------------------- (e)
  -- HINGLISH BRIDGE (P4). Derived, not hardcoded: ask search_latin_key what a
  -- real Devanagari lecture title transliterates to and search for THAT. This
  -- tests the bridge without this file knowing (or caring about) the
  -- transliteration scheme, which belongs to search_latin_key.
  --
  -- The FULL key is used as the query rather than one word of it, so the target
  -- lands in a token tier (1/3/4) and sorts ahead of every fuzzy row — no
  -- paging, no flakiness.
  select v.title, public.search_latin_key(v.title)
    into v_title, v_key
    from public.videos v
   where v.title ~ '[ऀ-ॿ]'
   order by length(v.title), v.id
   limit 1;

  if v_title is null then
    raise notice 'SELF-TEST SKIPPED (e): no Devanagari lecture titles in this database';
  else
    select count(*) into v_n
      from public.universal_search(v_key, array['lecture'], 50, 0) r
     where r.title = v_title;
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (e): the Devanagari lecture %L is not reachable by its own Latin key %L — the Hinglish bridge is broken',
        v_title, v_key;
    end if;

    -- Not fatal, but worth knowing: searching for a row's own key should be an
    -- EXACT match. Anything else means search_latin_key is not idempotent, and
    -- idempotence is what lets one key serve a Latin query against a
    -- Devanagari row.
    if not exists (select 1
                     from public.universal_search(v_key, array['lecture'], 50, 0) r
                    where r.title = v_title and r.match_type = 'exact') then
      raise notice
        'SELF-TEST WARNING (e): %L matched its own Latin key %L but NOT as an exact match — search_latin_key may not be idempotent',
        v_title, v_key;
    end if;

    -- And the reverse must not have regressed: a student typing Devanagari.
    select count(*) into v_n
      from public.universal_search(v_title, array['lecture'], 5, 0) r
     where r.title = v_title;
    if v_n = 0 then
      raise exception
        'SELF-TEST FAILED (e2): the Devanagari lecture %L cannot be found by typing its own title', v_title;
    end if;
  end if;

  raise notice 'SELF-TEST PASSED: universal_search v11 is sargable, multi-token, typo-tolerant and Devanagari-aware.';
end
$selftest$;


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

