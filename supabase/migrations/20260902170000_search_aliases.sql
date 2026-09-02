-- ============================================================================
-- LAYERING NOTE (added 2026-09-02, after src/searchAliases.js landed upstream).
-- There are now TWO alias layers, and they are complementary, not rivals:
--
--   * src/searchAliases.js (client, already live) rewrites a WHOLE query that
--     exactly matches a Hindi SUBJECT or institute word before the RPC is
--     called: rasayan -> chemistry, bhautiki -> physics, pw -> physics wallah.
--   * this table (database) expands English CHAPTER abbreviations inside the
--     query as a second ranking pass: shm, nlm, pnc, aod, moi, rot mech.
--
-- Verified on 2026-09-02: the two key sets do not intersect at all (8 client
-- keys, 32 here, zero overlap), so neither can shadow the other. The client
-- runs first, so this table sees the rewritten query - which is harmless
-- precisely because the vocabularies are disjoint.
--
-- If you are tempted to merge them, know what you would lose: the client layer
-- must rewrite the WHOLE query (a partial rewrite would be guessing at the
-- rest of the sentence), while this layer must NOT, because an abbreviation is
-- one token inside a longer query. They are different rules, not duplication.
-- SEARCH ALIASES -- teach search the shorthand students actually type.
--
-- THE GAP. universal_search matches over titles only. A student who types
-- "SHM", "PnC", "AoD", "EMI", "rot mech" or "salt analysis" clears no tier
-- against "Simple Harmonic Motion", "Permutations and Combinations",
-- "Applications of Derivatives", "Electromagnetic Induction", "Rotational
-- Motion" or "Qualitative Analysis", because none of those titles contains the
-- typed letters as a substring and three or four characters cannot clear the
-- 0.5 word-similarity floor against a 30-character title. The result is an
-- empty suggestion list for the vocabulary every coaching classroom in India
-- uses out loud. The Devanagari bridge's own header named the fix: "a small
-- curated alias table a human can extend".
--
-- Not every shorthand is broken, and this file does not pretend otherwise.
-- "org chem" and "def int" already reach "Organic Chemistry" and "Definite
-- Integration" at the partial tier, because their letters ARE substrings. For
-- those the alias is a ranking fix, not a recall fix, and the seed rows below
-- say so in their own note column.
--
-- WHAT THIS ADDS.
--   1. public.search_aliases -- a small table, one row per typed form, that an
--      admin can extend from the SQL editor or a future admin screen without a
--      code change. The comparison keys are GENERATED columns, so a human can
--      type "AoD" and "Applications of Derivatives" (or "सूरदास") in whatever
--      capitalisation and punctuation is natural and the database computes the
--      search key with the same search_latin_key() the titles are keyed with.
--   2. public.search_expand_aliases(text) -- turns a query's Latin key into an
--      expanded Latin key, longest phrase first, one pass, no re-expansion.
--   3. public.search_rank_aliased(...) -- the tier of the BEST of the typed
--      pass and the alias pass.
--   4. universal_search, search_playlist_ids and search_video_ids re-emitted so
--      both halves of the one result system (/browse) see aliases.
--
-- THE LAW THIS FILE OBEYS: AN ALIAS NEVER REPLACES A LITERAL MATCH.
-- The typed query is matched exactly as it is today; the alias is a SECOND,
-- independent pass whose result is OR'd into the gate and LEAST'd into the
-- rank. Concretely:
--
--   * The three sargable disjuncts every block already had are untouched. Two
--     more are appended, so the candidate set can only GROW.
--   * search_rank_aliased() returns least(typed_tier, alias_tier), and LEAST
--     ignores nulls, so a row that matched literally keeps matching and keeps
--     at least the tier it had. No row that matches today can stop matching.
--   * When no alias fires -- the overwhelmingly common case -- the alias
--     variables are set to the typed ones, the two extra disjuncts are literal
--     duplicates of existing ones, and search_rank_aliased short-circuits to a
--     single search_rank_tokens call. The behaviour is not merely similar to
--     today's, it is identical, and the self-test below proves it.
--
--   Worked example of why this matters. "emi" is a substring of "chemistry",
--   so today "emi" returns chemistry lectures at tier 4. A design that REWROTE
--   the query to "electromagnetic induction" would silently delete those rows.
--   This one keeps them and adds the induction rows above them, because the
--   alias pass reaches "Electromagnetic Induction" at tier 1 and tier 1 sorts
--   first. Likewise the chapter literally named "Newton's Laws of Motion (NLM)"
--   still answers "nlm" at exactly the tier it does today.
--
-- WHY NOT JUST WIDEN THE TOKEN LIST. Tiers 4 and 5 in search_rank_tokens both
-- require EVERY token to be present, so adding the expansion words to the typed
-- token array would make matching STRICTER, not looser, and "shm" would return
-- nothing at all. The expansion has to be an alternative token set, not a
-- longer one -- which is why the alias pass is a separate call.
--
-- WHY THE EXPANSION RUNS ON THE LATIN KEY, BEFORE FILLER REMOVAL. "p and c" is
-- a real thing students type, and "and" is a filler token. Looking the alias up
-- before search_filler_tokens() runs is the only place that phrase still
-- exists. The expansion is then handed to search_query_tokens(), the helper the
-- baseline created so that "browse search tokenises identically to the
-- homepage" -- so the alias pass is filler-filtered and length-floored by
-- exactly the same code as the typed pass, and cannot drift from it.
--
-- HINDI INTERIOR SCHWA, the gap search_v11's header recorded and deliberately
-- left open: सूरदास keys to "suradasa" but a student types "surdas"; कारतूस
-- keys to "karatusa" against a typed "kartus". Both are word-INTERNAL schwa
-- deletion, which is context-dependent Hindi phonology and cannot be
-- mechanically derived. The same mechanism carries them, and carries them
-- better than a hand-written key would: the seed row stores the DEVANAGARI
-- ("surdas" -> "सूरदास") and the generated column runs it through the very same
-- transliterator that keys the chapter name, so the two sides cannot disagree
-- even if the transliterator changes.
--
-- SEEDED FROM EVIDENCE, NOT INVENTION. Every expansion below is a string that
-- exists in this catalogue. The chapter vocabulary was taken from the reviewed
-- import manifests in docs/manifests/*.json (the "chapter" field), cross-checked
-- against lesson titles in docs/sql/*.sql; the two Hindi rows are chapters in
-- the CBSE Class 10 Hindi A and Hindi B references. The self-test does not take
-- that on trust: it runs universal_search on every seeded expansion and ABORTS
-- if any of them points at nothing in this database.
--
-- COST. One probe against a table of a few dozen rows decides whether any
-- alias is relevant at all; a query that touches no alias pays that lookup and
-- nothing else, because every predicate the alias pass adds is then a literal
-- duplicate of one already there. Not measured against production data: no
-- local Postgres has production's distribution, and this file makes no claim
-- about plans or timing.
--
-- SECURITY. Everything here is SECURITY INVOKER with a pinned search_path.
-- universal_search must stay invoker -- study_materials' RLS is what keeps
-- unapproved material out of a student's results -- and the alias table is
-- readable by anon precisely because the function reads it as the caller.
-- Aliases are public vocabulary, not data: only active rows are world-readable,
-- and only public.is_admin() can write any of them.
--
-- STAGED, NOT APPLIED. This file waits on the owner's migration gate
-- (supabase/README.md): apply it with `npx supabase db push`, never by pasting
-- into the SQL editor. `db push` runs EVERY pending migration in timestamp
-- order, so check `npx supabase migration list` first.
--
-- THE SELF-TEST ABORTS INSIDE THE TRANSACTION, unlike
-- docs/sql/search_filler_tokens_2026-08-10.sql, which put its corpus after
-- COMMIT so a flaky assertion could not roll back a correct deploy. This file
-- changes how every query is MATCHED, and a bad seed row is a content mistake
-- that should never reach students, so a failure here rolls the whole thing
-- back. If the abort names an alias, the fix is to correct or delete that one
-- row from the seed below and push again -- nothing was applied.
--
-- ROLLBACK. Re-run these three function bodies from the versions this file
-- replaces, then drop the new objects:
--   universal_search  -> supabase/migrations/20260901160000_universal_search_materials.sql
--   search_playlist_ids, search_video_ids
--                     -> supabase/migrations/20260831140005_production_baseline.sql
--   drop function if exists public.search_rank_aliased(text, text[], text, text[], text);
--   drop function if exists public.search_expand_aliases(text);
--   drop table if exists public.search_aliases;
-- All three are CREATE OR REPLACE at unchanged signatures, so nothing depends
-- on a drop and no client contract moves.
-- ============================================================================

begin;
set local lock_timeout = '5s';
set local statement_timeout = '300s';

-- ---------------------------------------------------------------------
-- PREFLIGHT. Abort before touching anything if the world this migration
-- assumes is not there.
-- ---------------------------------------------------------------------
do $preflight$
begin
  if to_regprocedure('public.search_latin_key(text)') is null
     or to_regprocedure('public.search_rank_tokens(text, text[], text)') is null
     or to_regprocedure('public.search_query_tokens(text)') is null
     or to_regprocedure('public.search_filler_tokens()') is null
     or to_regprocedure('public.search_singular(text)') is null then
    raise exception 'the search helper functions are missing -- apply the baseline first';
  end if;
  if to_regprocedure('public.universal_search(text, text[], integer, integer)') is null then
    raise exception 'universal_search is missing -- this migration replaces it, it does not create it';
  end if;
  if to_regprocedure('public.search_playlist_ids(text)') is null
     or to_regprocedure('public.search_video_ids(text)') is null then
    raise exception 'the browse search helpers are missing -- apply the baseline first';
  end if;
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'is_admin() is missing -- the alias table has no admin gate without it';
  end if;
  -- The generated columns below call search_latin_key at write time, which
  -- Postgres only allows for an IMMUTABLE function.
  if (select p.provolatile from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'search_latin_key') <> 'i' then
    raise exception 'search_latin_key is not IMMUTABLE -- the generated alias keys cannot be built';
  end if;
  -- universal_search re-emitted below assumes the seven-group version.
  if position('''material''::text' in
        (select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'universal_search'
            and pg_get_function_identity_arguments(p.oid)
                = 'p_query text, p_types text[], p_limit integer, p_offset integer')) = 0 then
    raise exception 'universal_search has no material group -- apply 20260901160000_universal_search_materials.sql first';
  end if;
end
$preflight$;

-- ---------------------------------------------------------------------
-- THE TABLE. Small, curated, and extendable by a human.
--
-- alias_key / expansion_key are GENERATED so an admin never has to know how
-- the search key is built. "AoD", "aod" and "A.O.D." all store the same
-- alias_key; "सूरदास" stores whatever the transliterator makes of it, which is
-- by construction the same key the chapter name gets.
-- ---------------------------------------------------------------------
create table if not exists public.search_aliases (
  id            bigint generated always as identity primary key,
  alias         text not null,
  expansion     text not null,
  note          text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  alias_key     text generated always as (public.search_latin_key(alias)) stored,
  expansion_key text generated always as (public.search_latin_key(expansion)) stored,
  -- A blank side would expand every query to nothing.
  constraint search_aliases_alias_present
    check (public.search_latin_key(alias) is not null
           and length(public.search_latin_key(alias)) >= 2),
  constraint search_aliases_expansion_present
    check (public.search_latin_key(expansion) is not null
           and length(public.search_latin_key(expansion)) >= 3),
  -- An alias that expands to itself is a no-op; one that expands to a filler
  -- word would be stripped a moment later and match everything or nothing.
  constraint search_aliases_not_identity
    check (public.search_latin_key(alias) is distinct from public.search_latin_key(expansion)),
  constraint search_aliases_alias_not_filler
    check (not (public.search_latin_key(alias) = any (public.search_filler_tokens()))),
  -- The alias fires BEFORE the two-character floor in universal_search, so a
  -- one-character alias could not be typed anyway; the length check above
  -- keeps that honest. This one keeps the phrase window in
  -- search_expand_aliases (4 words) from silently ignoring a longer alias.
  constraint search_aliases_alias_within_window
    check (array_length(string_to_array(public.search_latin_key(alias), ' '), 1) <= 4)
);

comment on table public.search_aliases is
  'Curated typed-shorthand -> catalogue-wording table for search. One row per form students actually type ("shm", "pnc", "org chem", "surdas"). Read by search_expand_aliases() as a SECOND matching pass -- an alias never replaces a literal match. Admin-extendable: insert a row, nothing else to deploy.';
comment on column public.search_aliases.alias is
  'What the student types, in any capitalisation or punctuation. The comparison key is generated.';
comment on column public.search_aliases.expansion is
  'The catalogue wording it should also reach. Must be text that EXISTS in this catalogue -- the migration self-test refuses a seed that points at nothing. Devanagari is allowed and is transliterated by the generated key.';
comment on column public.search_aliases.note is
  'Why this row exists, for whoever reads the table in a year.';
comment on column public.search_aliases.is_active is
  'Switch a row off without deleting it. Only active rows are world-readable and only active rows expand.';

create unique index if not exists search_aliases_alias_key_uniq
  on public.search_aliases (alias_key);
-- search_expand_aliases probes "does any alias start with one of these tokens"
-- before it does anything else; this is the index that answers it.
create index if not exists search_aliases_first_word_idx
  on public.search_aliases ((split_part(alias_key, ' ', 1))) where is_active;

drop trigger if exists trg_search_aliases_updated_at on public.search_aliases;
create trigger trg_search_aliases_updated_at
  before update on public.search_aliases
  for each row execute function public.set_updated_at();

alter table public.search_aliases enable row level security;

-- Aliases are public vocabulary. universal_search is SECURITY INVOKER, so a
-- logged-out student's search reads this table AS anon; without this policy
-- every public search would silently stop expanding.
drop policy if exists "public reads active search aliases" on public.search_aliases;
create policy "public reads active search aliases" on public.search_aliases
  for select to anon, authenticated using (is_active);

-- Everything else -- reading drafts, writing, deleting -- is admin only. The
-- grant is not the boundary; this is.
drop policy if exists "admins manage search aliases" on public.search_aliases;
create policy "admins manage search aliases" on public.search_aliases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Explicit grants. An identity column needs no sequence grant.
revoke all on table public.search_aliases from public;
grant select on table public.search_aliases to anon;
grant select, insert, update, delete on table public.search_aliases to authenticated;
grant all on table public.search_aliases to service_role;

-- ---------------------------------------------------------------------
-- THE SEED. Every expansion is wording that exists in this catalogue.
-- Sources: the "chapter" field of the reviewed import manifests in
-- docs/manifests/*.json, cross-checked against lesson titles in docs/sql/*.sql.
-- The self-test at the bottom re-checks all of it against the live database.
--
-- Deliberately NOT seeded: shorthand that already works. "thermo", "repro",
-- "semicon" and "chem bonding" are prefixes or substrings of the real titles,
-- so tier 4 already finds them and an alias row would be dead weight.
-- ---------------------------------------------------------------------
insert into public.search_aliases (alias, expansion, note) values
  -- Physics
  ('shm',        'Simple Harmonic Motion',
   'Universal in oscillations teaching; the single most typed physics shorthand.'),
  ('nlm',        'Newton''s Laws of Motion',
   'The chapter is literally named "Newton''s Laws of Motion (NLM)", so the literal match already works and must survive; this row reaches the lessons that spell it out.'),
  ('emi',        'Electromagnetic Induction',
   'Also a substring of "chemistry", so the literal chemistry hits must survive -- they do, one tier lower.'),
  ('ktg',        'Kinetic Theory of Gases',
   'Standard in JEE/NEET physics revision.'),
  ('ac',         'Alternating Current',
   'Two characters, so it clears the query floor by exactly one.'),
  ('com',        'Centre of Mass',
   'Chapter: "System of Particles and Centre of Mass".'),
  ('moi',        'Moment of Inertia',
   'Rotational motion topic, spelled out in lesson titles.'),
  ('rot mech',   'Rotational Motion',
   'Spoken shorthand; "mech" alone is deliberately not an alias.'),
  ('wpe',        'Work, Energy and Power',
   'Chapter wording is "Work, Energy and Power"; students say work-power-energy.'),
  ('emw',        'Electromagnetic Waves',
   'Distinct from emi -- different chapter.'),
  -- RANKING, not recall. "em" and "waves" are both substrings of
  -- "Electromagnetic Waves", so tier 4 already finds it; the alias lifts the
  -- right chapter to the exact tier so it stops sitting under partial matches.
  ('em waves',   'Electromagnetic Waves',
   'Already found at the partial tier because "em" and "waves" are both substrings; the alias makes it the exact match it should be.'),
  -- Chemistry
  ('goc',        'General Organic Chemistry',
   'The name every coaching class uses for the reaction-mechanism foundation.'),
  ('org chem',   'Organic Chemistry',
   'Ranking, not recall: "org" and "chem" are substrings of "Organic Chemistry", so tier 4 already matches. The alias lifts the chapter above the partial hits.'),
  ('inorg chem', 'Inorganic Chemistry',
   'Ranking, not recall, same as org chem.'),
  ('phy chem',   'Physical Chemistry',
   'Ranking, not recall, same as org chem.'),
  ('ionic eq',   'Ionic Equilibrium',
   'Ranking, not recall: "eq" is a substring of "Equilibrium". "eq" for equilibrium is written on every whiteboard.'),
  ('moc',        'Mole Concept',
   'Chapter: "Mole Concept".'),
  ('salt analysis', 'Qualitative Analysis',
   'What the lab work is called by students; the chapter is "Qualitative Analysis".'),
  -- Mathematics
  ('pnc',        'Permutations and Combinations',
   'Chapter: "Permutations and Combinations".'),
  ('p and c',    'Permutations and Combinations',
   'The spoken form. "and" is a filler token, which is exactly why the alias is looked up before filler removal.'),
  ('aod',        'Applications of Derivatives',
   'Chapter: "Applications of Derivatives".'),
  ('aoi',        'Application of Integrals',
   'Chapter: "Application of Integrals".'),
  ('lcd',        'Limits, Continuity and Differentiability',
   'Chapter: "Limits, Continuity and Differentiability".'),
  ('itf',        'Inverse Trigonometric Functions',
   'Chapter: "Inverse Trigonometric Functions".'),
  ('3d',         'Three-Dimensional Geometry',
   'Chapter: "Vectors and Three-Dimensional Geometry".'),
  ('sot',        'Solutions of Triangles',
   'Chapter: "Solutions of Triangles".'),
  ('def int',    'Definite Integration',
   'Ranking, not recall: "def" and "int" are both substrings of "Definite Integration".'),
  ('indef int',  'Indefinite Integration',
   'Ranking, not recall, same as def int.'),
  ('pmi',        'Principle of Mathematical Induction',
   'Chapter: "Principle of Mathematical Induction".'),
  -- Hindi interior schwa -- the gap search_v11's header recorded and left open.
  -- The expansion is stored in DEVANAGARI on purpose: the generated key runs it
  -- through the same transliterator that keys the chapter name, so the two
  -- sides cannot disagree, now or after a transliterator change.
  ('surdas',     'सूरदास',
   'Word-internal schwa deletion: सूरदास transliterates to "suradasa", a student types "surdas". CBSE Class 10 Hindi A, chapter "सूरदास के पद".'),
  ('kartus',     'कारतूस',
   'Same gap: कारतूस transliterates to "karatusa", a student types "kartus" (or "kartoos", which the Latin title already answers). CBSE Class 10 Hindi B, chapter "कारतूस".')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- THE EXPANDER. Latin key in, Latin key out.
--
-- Longest phrase first ("org chem" beats a hypothetical "org"), one pass, and
-- the words an alias produces are never themselves re-expanded -- which is what
-- makes a cycle structurally impossible rather than merely unlikely.
--
-- SECURITY INVOKER (the default) on purpose: the caller's RLS decides which
-- alias rows are visible, exactly as it decides which materials are.
-- STABLE, not IMMUTABLE, because it reads a table.
-- ---------------------------------------------------------------------
create or replace function public.search_expand_aliases(p_key text)
returns text
language plpgsql
stable
parallel safe
set search_path to 'public', 'pg_temp'
as $expand$
declare
  v_toks   text[];
  v_out    text[] := '{}';
  v_n      int;
  v_i      int := 1;
  v_w      int;
  v_window constant int := 4;   -- longest alias phrase, enforced by a CHECK
  v_phrase text;
  v_exp    text;
  v_hit    boolean;
begin
  -- Contract: identity on null, blank and anything with no alias in it. Every
  -- caller relies on "unchanged means no alias fired".
  if p_key is null or btrim(p_key) = '' then
    return p_key;
  end if;

  v_toks := array_remove(string_to_array(btrim(p_key), ' '), '');
  v_n := coalesce(cardinality(v_toks), 0);
  if v_n = 0 then
    return p_key;
  end if;

  -- ONE indexed probe for the common case. Any alias phrase that could match
  -- must begin with one of the query's own tokens, so if none does, no window
  -- below can hit and the loop is pure waste.
  if not exists (
        select 1
          from public.search_aliases a
         where a.is_active
           and split_part(a.alias_key, ' ', 1) = any (v_toks)) then
    return p_key;
  end if;

  while v_i <= v_n loop
    v_hit := false;
    v_w := least(v_window, v_n - v_i + 1);
    while v_w >= 1 loop
      v_phrase := array_to_string(v_toks[v_i : v_i + v_w - 1], ' ');
      -- Reset explicitly: SELECT INTO leaves the previous value when no row
      -- matches, which would expand the wrong window.
      v_exp := null;
      select a.expansion_key into v_exp
        from public.search_aliases a
       where a.is_active
         and a.alias_key = v_phrase
       limit 1;
      if v_exp is not null and v_exp <> '' then
        v_out := v_out || array_remove(string_to_array(v_exp, ' '), '');
        v_i := v_i + v_w;
        v_hit := true;
        exit;
      end if;
      v_w := v_w - 1;
    end loop;
    if not v_hit then
      v_out := v_out || v_toks[v_i];
      v_i := v_i + 1;
    end if;
  end loop;

  return coalesce(nullif(array_to_string(v_out, ' '), ''), p_key);
end;
$expand$;

alter function public.search_expand_aliases(text) owner to postgres;

comment on function public.search_expand_aliases(text) is
  'Expands curated shorthand inside a search Latin key, longest phrase first, one pass, no re-expansion. Returns its input unchanged when no alias fires, which is how callers know to skip the second matching pass entirely.';

revoke all on function public.search_expand_aliases(text) from public;
grant execute on function public.search_expand_aliases(text) to anon;
grant execute on function public.search_expand_aliases(text) to authenticated;
grant execute on function public.search_expand_aliases(text) to service_role;

-- ---------------------------------------------------------------------
-- THE RANKER. The better of the two passes.
--
-- LEAST ignores nulls, so:
--   typed matches, alias does not  -> the typed tier, unchanged
--   alias matches, typed does not  -> the alias tier, a row that used to be lost
--   both match                     -> the better tier
--   neither                        -> null, no match, exactly as today
-- A row that matches today can therefore never stop matching, and can never be
-- demoted. That is the whole safety argument, and the self-test asserts it
-- directly rather than trusting this comment.
--
-- The equality short-circuit is not an optimisation detail, it is the proof
-- that a query with no alias in it takes literally today's code path.
-- ---------------------------------------------------------------------
create or replace function public.search_rank_aliased(
  p_haystack     text,
  p_tokens       text[],
  p_needle       text,
  p_alias_tokens text[],
  p_alias_needle text
) returns integer
language sql
immutable
parallel safe
set search_path to 'public', 'pg_temp'
as $rank$
  select case
    when p_alias_needle is not distinct from p_needle
      then public.search_rank_tokens(p_haystack, p_tokens, p_needle)
    else least(
      public.search_rank_tokens(p_haystack, p_tokens, p_needle),
      public.search_rank_tokens(p_haystack, p_alias_tokens, p_alias_needle))
  end;
$rank$;

alter function public.search_rank_aliased(text, text[], text, text[], text) owner to postgres;

comment on function public.search_rank_aliased(text, text[], text, text[], text) is
  'Match tier for a query and its alias expansion: the better of search_rank_tokens on the typed form and on the expansion. Never worse than the typed form alone, so an alias cannot remove or demote a literal match.';

revoke all on function public.search_rank_aliased(text, text[], text, text[], text) from public;
grant execute on function public.search_rank_aliased(text, text[], text, text[], text) to anon;
grant execute on function public.search_rank_aliased(text, text[], text, text[], text) to authenticated;
grant execute on function public.search_rank_aliased(text, text[], text, text[], text) to service_role;

-- ---------------------------------------------------------------------
-- universal_search, re-emitted whole.
--
-- Copied VERBATIM from 20260901160000_universal_search_materials.sql, comments
-- included. plpgsql has no way to patch one branch of a function, so every
-- search migration in this repo has re-emitted the whole body; this one is no
-- different. Exactly three kinds of change were made, and nothing else:
--   1. four new declarations and the alias resolution block after q_long;
--   2. in each of the six title blocks, search_rank_tokens(...) became
--      search_rank_aliased(...) with two more arguments;
--   3. in each of the six gates, two disjuncts were APPENDED to the existing
--      three, which were not touched.
-- The faculty block is untouched: it delegates to search_teachers(), which
-- matches person names, not catalogue titles, and is not this file's business.
-- ---------------------------------------------------------------------
create or replace function public.universal_search(
  p_query text,
  p_types text[] default null::text[],
  p_limit integer default 5,
  p_offset integer default 0
) returns table(
  group_key text, entity_id bigint, title text, subtitle text, aka text,
  slug text, match_type text, match_rank integer, matched_on text,
  is_ambiguous boolean, group_total bigint, extra jsonb
)
    language plpgsql stable
    -- SECURITY INVOKER (the default, and what production has). Do NOT make
    -- this SECURITY DEFINER: every group below relies on the caller's RLS,
    -- the study-material blocks would start returning unapproved rows, and
    -- search_aliases would stop being filtered to active rows.
    set search_path to 'public', 'public', 'pg_temp'
    as $_$
declare
  -- Two normalisations, on purpose. q is the Latin key and is what everything
  -- is matched on. q_raw exists only to measure the length of what the student
  -- actually typed, so transliteration cannot smuggle a 1-character query past
  -- the floor in design note 4.
  q_raw    text := public.normalize_search_text(p_query);
  q        text := public.search_latin_key(p_query);
  qlen     int  := least(coalesce(length(q_raw), 0), coalesce(length(q), 0));
  q_tokens text[];
  q_content text[];
  q_long   text;
  -- The alias pass. When no alias fires these are set to the typed values and
  -- every predicate below collapses to the one it already was.
  q_alias        text;
  q_alias_needle text;
  q_alias_tokens text[];
  q_alias_long   text;
  lim      int  := least(greatest(coalesce(p_limit, 5), 1), 50);
  off      int  := greatest(coalesce(p_offset, 0), 0);
  want     text[] := case when p_types is null or cardinality(p_types) = 0
                          then array['faculty','chapter','playlist','lecture','institute',
                                     'material','paper']
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

  -- Filler removal. Tiers 4 and 5 in search_rank_tokens both require EVERY
  -- token to match, so one word that no title contains kills the whole query.
  -- Measured against production on 2026-08-10: 19 of 43 realistic student
  -- queries returned nothing, including "how to solve pulley problems" while
  -- "Pulley Problem - Newton's Laws of Motion" sat in the catalogue, and
  -- "friction problems" while 5 Friction lectures did.
  --
  -- Tokens are FILTERED, never rewritten. The first deploy also singularised
  -- the surviving tokens here ("problems" -> "problem"), and that broke the
  -- typo tier: "kinamatics" became "kinamatic", whose trigrams lost the shared
  -- 'ics' tail with "kinematics" and fell below the 0.5 fuzzy threshold --
  -- 14 rows -> 0, a measured regression. Plural-widening now lives inside
  -- search_rank_tokens, where each tier accepts a token's typed OR singular
  -- form; the tokens themselves stay exactly as the student typed them, so the
  -- fuzzy tier sees the same strings it always did.
  --
  -- A token is filler if EITHER its typed or its singular form is in the list;
  -- both directions are needed. Typed-only lets "problems" through (the list
  -- holds "problem"); singular-only lets "class" through, because "class"
  -- singularises to "clas", which no list holds.
  --
  -- If filtering would leave nothing, keep the original tokens. Without that
  -- guard a query of pure filler ("how to") empties q_tokens, and tier 5's
  -- "not exists (unnest(empty))" is vacuously true, which would match every
  -- row in the catalogue.
  q_content := array(
    select tok
      from unnest(q_tokens) as tok
     where tok <> ''
       and not (tok = any (public.search_filler_tokens()))
       and not (public.search_singular(tok) = any (public.search_filler_tokens()))
       and tok !~ '^[0-9]{1,2}$'
  );
  if cardinality(q_content) > 0 then
    q_tokens := q_content;
  end if;

  -- The longest token drives the index prefilter (design note 6). Ties are
  -- broken alphabetically so the same query always produces the same plan.
  select tok into q_long
    from unnest(q_tokens) as tok
   order by length(tok) desc, tok
   limit 1;
  q_long := coalesce(q_long, q);

  -- ALIAS PASS. Looked up on the Latin key BEFORE filler removal, because
  -- "p and c" only exists as a phrase at this point. The expansion is then
  -- tokenised by search_query_tokens(), the helper whose whole reason to exist
  -- is that "browse search tokenises identically to the homepage" -- so the
  -- alias pass gets the same filler filtering and the same longest-token rule
  -- as the typed pass, from the same code, and cannot drift from it.
  --
  -- When nothing expands, all four alias variables become the typed ones. That
  -- is what makes every added predicate below a duplicate and every added
  -- LEAST a no-op for the overwhelming majority of searches.
  q_alias := public.search_expand_aliases(q);
  if q_alias is not null and q_alias is distinct from q then
    select t.q, t.q_tokens, t.q_long
      into q_alias_needle, q_alias_tokens, q_alias_long
      from public.search_query_tokens(q_alias) t;
  end if;
  if q_alias_needle is null then
    q_alias_needle := q;
    q_alias_tokens := q_tokens;
    q_alias_long   := q_long;
  end if;
  q_alias_long := coalesce(q_alias_long, q_long);

  ---------------------------------------------------------------- faculty
  -- Dynamic SQL: these tables may not exist (see design note 2). A static
  -- reference would make the whole function fail to CREATE on a database
  -- without teachers_v7. Verbatim from the shipped version — faculty ranking is
  -- search_teachers()' business and is deliberately untouched by v11, which is
  -- also why it is passed the RAW p_query and not the Latin key. Aliases are
  -- catalogue vocabulary, not names, so this block is untouched here too.
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
             public.search_rank_aliased(public.search_latin_key(ch.name), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             s.name as subject
        from public.chapters ch
        left join public.subjects s on s.id = ch.subject_id
       -- CONTENT GUARD (from search_hide_empty_chapters.sql, preserved): never
       -- suggest a chapter with no lessons mapped to it, so parked/empty
       -- chapters cannot dead-end the searcher.
       where exists (select 1 from public.videos v where v.chapter_id = ch.id)
         -- SARGABLE (design note 6). Every disjunct is a gin_trgm_ops member
         -- applied to the indexed expression verbatim. The first three are the
         -- shipped gate, untouched; the last two are the alias pass, and are
         -- literal duplicates of the first and third when no alias fired.
         and (   public.search_latin_key(ch.name) like '%' || q_long || '%'
              or public.search_latin_key(ch.name) like q || '%'
              or public.search_latin_key(ch.name) %> q_long
              or public.search_latin_key(ch.name) like '%' || q_alias_long || '%'
              or public.search_latin_key(ch.name) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(pl.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
              or public.search_latin_key(pl.title) %> q_long
              or public.search_latin_key(pl.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(pl.title) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(v.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
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
              or public.search_latin_key(v.title) %> q_long
              or public.search_latin_key(v.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(v.title) %> q_alias_long )
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
             public.search_rank_aliased(public.search_latin_key(ic.name), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             (select count(*) from public.playlists pl where pl.channel_id = ic.id) as n
        from public.institutes_channels ic
       where (   public.search_latin_key(ic.name) like '%' || q_long || '%'
              or public.search_latin_key(ic.name) like q || '%'
              or public.search_latin_key(ic.name) %> q_long
              or public.search_latin_key(ic.name) like '%' || q_alias_long || '%'
              or public.search_latin_key(ic.name) %> q_alias_long )
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

  ---------------------------------------------------------- notes & sheets
  -- Short notes, formula sheets and full lecture notes. Previous-year papers
  -- are deliberately excluded here and answered by the 'paper' block below.
  if 'material' = any(want) then
    return query
    with m as (
      select sm.id, sm.title, sm.material_type,
             public.search_rank_aliased(public.search_latin_key(sm.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             -- ONE scope row, the most specific this material has. It has to be
             -- a single row rather than a mix of columns from several, because
             -- the client turns these slugs into a /materials filter set and
             -- get_study_materials() satisfies them from a SINGLE scope row:
             -- slugs taken from different rows could name a combination that
             -- renders nothing. Evaluated only for rows that survived the
             -- index prefilter, like the playlist/lecture subqueries above.
             -- board_id is deliberately NOT emitted: /materials only applies a
             -- board filter when the goal is 'school', and leaving it out only
             -- ever widens the page the student lands on.
             (select jsonb_build_object(
                       'goal_slug', lg.slug,
                       'class_slug', cl.slug,
                       'subject_slug', sub.slug,
                       'chapter_slug', ch.slug,
                       'subject_name', sub.name,
                       'chapter_name', ch.name)
                from public.study_material_scopes s
                left join public.learning_goals lg on lg.id = s.learning_goal_id
                left join public.class_levels   cl on cl.id = s.class_level_id
                left join public.subjects      sub on sub.id = s.subject_id
                left join public.chapters       ch on ch.id  = s.chapter_id
               where s.material_id = sm.id
               order by (s.chapter_id is not null) desc,
                        (s.subject_id is not null) desc,
                        (s.class_level_id is not null) desc,
                        (s.learning_goal_id is not null) desc,
                        s.id
               limit 1) as scope
        from public.study_materials sm
       -- The public RLS policy on study_materials is exactly this predicate.
       -- Written out anyway: this function is SECURITY INVOKER today, and if
       -- that ever changed the gate would still hold.
       where sm.review_status = 'approved'
         and sm.published_at <= now()
         and sm.material_type <> 'previous_year_paper'
         -- CONTENT GUARD, same idea as the chapter block. /materials lists a
         -- material only if it has at least one scope row (the `exists` clause
         -- in get_study_materials), so a scope-less material has no page to
         -- send the student to and must not be suggested.
         and exists (select 1 from public.study_material_scopes s2
                      where s2.material_id = sm.id)
         -- SARGABLE (design note 6), identical in shape to every block above.
         and (   public.search_latin_key(sm.title) like '%' || q_long || '%'
              or public.search_latin_key(sm.title) like q || '%'
              or public.search_latin_key(sm.title) %> q_long
              or public.search_latin_key(sm.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(sm.title) %> q_alias_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'material'::text, c.id, c.title,
           -- "Formula sheet · Physics · Kinematics". The labels mirror
           -- STUDY_MATERIAL_TYPES in src/useStudyMaterials.js, singularised
           -- because this describes one row rather than a filter.
           nullif(concat_ws(' · ',
                    case c.material_type
                      when 'short_notes'   then 'Short notes'
                      when 'formula_sheet' then 'Formula sheet'
                      when 'full_notes'    then 'Full lecture notes'
                      when 'previous_year_paper' then 'Previous-year paper'
                    end,
                    c.scope->>'subject_name',
                    c.scope->>'chapter_name'), ''),
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object(
             'material_type', c.material_type,
             'goal_slug',     c.scope->>'goal_slug',
             'class_slug',    c.scope->>'class_slug',
             'subject_slug',  c.scope->>'subject_slug',
             'chapter_slug',  c.scope->>'chapter_slug')
      from counted c
     order by c.rk, length(c.title), c.title
     limit lim offset off;
  end if;

  ------------------------------------------------------- previous-year papers
  if 'paper' = any(want) then
    return query
    with m as (
      select sm.id, sm.title, sm.material_type, sm.source_name, sm.exam_year,
             public.search_rank_aliased(public.search_latin_key(sm.title), q_tokens, q,
                                        q_alias_tokens, q_alias_needle) as rk,
             -- Does the curated JEE Main papers landing list this paper? That
             -- page (src/useJeeMainPapers.js) selects previous_year_paper rows
             -- whose title matches JEE_MAIN_PAPERS_TITLE_PATTERN, so this is
             -- the same test, and has to be kept in step with that constant.
             -- ilike is not sargable, but it only ever runs on rows the
             -- trigram prefilter already returned.
             (sm.title ilike 'JEE Main%') as jee_main_landing,
             -- board_id is deliberately NOT emitted: /materials only applies a
             -- board filter when the goal is 'school', and leaving it out only
             -- ever widens the page the student lands on.
             (select jsonb_build_object(
                       'goal_slug', lg.slug,
                       'class_slug', cl.slug,
                       'subject_slug', sub.slug,
                       'chapter_slug', ch.slug,
                       'subject_name', sub.name,
                       'chapter_name', ch.name)
                from public.study_material_scopes s
                left join public.learning_goals lg on lg.id = s.learning_goal_id
                left join public.class_levels   cl on cl.id = s.class_level_id
                left join public.subjects      sub on sub.id = s.subject_id
                left join public.chapters       ch on ch.id  = s.chapter_id
               where s.material_id = sm.id
               order by (s.chapter_id is not null) desc,
                        (s.subject_id is not null) desc,
                        (s.class_level_id is not null) desc,
                        (s.learning_goal_id is not null) desc,
                        s.id
               limit 1) as scope
        from public.study_materials sm
       where sm.review_status = 'approved'
         and sm.published_at <= now()
         and sm.material_type = 'previous_year_paper'
         -- CONTENT GUARD. A paper is offered when SOME page on this site
         -- lists it: the JEE Main landing (which reads study_materials
         -- directly and needs no scope) or the /materials directory (which
         -- needs one).
         and (   sm.title ilike 'JEE Main%'
              or exists (select 1 from public.study_material_scopes s2
                          where s2.material_id = sm.id))
         and (   public.search_latin_key(sm.title) like '%' || q_long || '%'
              or public.search_latin_key(sm.title) like q || '%'
              or public.search_latin_key(sm.title) %> q_long
              or public.search_latin_key(sm.title) like '%' || q_alias_long || '%'
              or public.search_latin_key(sm.title) %> q_alias_long )
    ), hit as (select * from m where rk is not null),
       counted as (select h.*, count(*) over () as total from hit h)
    select 'paper'::text, c.id, c.title,
           -- "2024 · National Testing Agency". The year is the fact a student
           -- picks a paper by, so it leads.
           nullif(concat_ws(' · ', c.exam_year::text, c.source_name), ''),
           null::text, null::text,
           case c.rk when 1 then 'exact' when 3 then 'prefix'
                     when 4 then 'partial' else 'fuzzy' end,
           c.rk, c.title, false, c.total,
           jsonb_build_object(
             'material_type',    c.material_type,
             'jee_main_landing', c.jee_main_landing,
             'goal_slug',        c.scope->>'goal_slug',
             'class_slug',       c.scope->>'class_slug',
             'subject_slug',     c.scope->>'subject_slug',
             'chapter_slug',     c.scope->>'chapter_slug')
      from counted c
     -- The one deliberate departure from the other blocks' ordering. Papers
     -- from every year share one title shape ("JEE Main 2024 Session 1 ..."),
     -- so "shortest title first" would order them arbitrarily. Newest first is
     -- what a student wants, and is what get_study_materials() already does.
     order by c.rk, c.exam_year desc nulls last, length(c.title), c.title
     limit lim offset off;
  end if;
end; $_$;

alter function public.universal_search(text, text[], integer, integer) owner to postgres;

comment on function public.universal_search(text, text[], integer, integer) is
  'Grouped, server-ranked, paginated search. Sargable trigram predicates, multi-token AND matching, word-similarity typo tolerance, Devanagari/Latin bridge, and a curated shorthand pass (search_aliases) that only ever adds matches. Faculty group appears only where teachers_v7 is installed. Chapter group hides content-less chapters. Material and paper groups return only approved, published study material that some page on this site actually lists.';

-- Grants are re-stated because a from-scratch replay must not depend on
-- CREATE OR REPLACE inheriting the existing ACL. Same set as the baseline.
revoke all on function public.universal_search(text, text[], integer, integer) from public;
grant all on function public.universal_search(text, text[], integer, integer) to anon;
grant all on function public.universal_search(text, text[], integer, integer) to authenticated;
grant all on function public.universal_search(text, text[], integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- BROWSE. /browse is the one result system, and its course list and lecture
-- list do not go through universal_search -- they call these two. Leaving them
-- alone would mean "shm" worked in the header box and returned nothing on the
-- results page it sends you to.
--
-- Both are the baseline bodies with the same three changes, and both get the
-- alias tokens from search_query_tokens() twice: once for the typed query and
-- once for its expansion. That is the whole reason that helper exists.
-- ---------------------------------------------------------------------
create or replace function public.search_playlist_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $$
declare
  t     record;
  ta    record;   -- the same tokenisation, of the alias expansion
  a_q   text;
  a_hit boolean := false;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  a_q := public.search_expand_aliases(t.q);
  if a_q is not null and a_q is distinct from t.q then
    select * into ta from public.search_query_tokens(a_q);
    a_hit := (ta.q is not null);
  end if;
  -- No alias: the second pass becomes a copy of the first, every added
  -- disjunct becomes a duplicate, and search_rank_aliased short-circuits.
  if not a_hit then
    ta := t;
  end if;

  return query
    select pl.id
      from public.playlists pl
     where (   public.search_latin_key(pl.title) like '%' || t.q_long || '%'
            or public.search_latin_key(pl.title) like t.q || '%'
            or public.search_latin_key(pl.title) %> t.q_long
            or public.search_latin_key(pl.title) like '%' || ta.q_long || '%'
            or public.search_latin_key(pl.title) %> ta.q_long )
       and public.search_rank_aliased(public.search_latin_key(pl.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null;
end; $$;

alter function public.search_playlist_ids(text) owner to postgres;

comment on function public.search_playlist_ids(text) is
  'Course ids whose title matches p_query with universal_search''s playlist logic (multi-token AND, trigram typo, Hinglish, curated shorthand). For the /browse course list to search as well as the homepage.';

revoke all on function public.search_playlist_ids(text) from public;
grant all on function public.search_playlist_ids(text) to anon;
grant all on function public.search_playlist_ids(text) to authenticated;
grant all on function public.search_playlist_ids(text) to service_role;

create or replace function public.search_video_ids(p_query text)
returns table(id bigint)
    language plpgsql stable
    set search_path to 'public', 'public', 'pg_temp'
    as $$
declare
  t     record;
  ta    record;
  a_q   text;
  a_hit boolean := false;
begin
  select * into t from public.search_query_tokens(p_query);
  if t.qlen is null or t.qlen < 2 then
    return;
  end if;
  perform set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  a_q := public.search_expand_aliases(t.q);
  if a_q is not null and a_q is distinct from t.q then
    select * into ta from public.search_query_tokens(a_q);
    a_hit := (ta.q is not null);
  end if;
  if not a_hit then
    ta := t;
  end if;

  return query
    select v.id
      from public.videos v
     where (   public.search_latin_key(v.title) like '%' || t.q_long || '%'
            or public.search_latin_key(v.title) like t.q || '%'
            or public.search_latin_key(v.title) %> t.q_long
            or public.search_latin_key(v.title) like '%' || ta.q_long || '%'
            or public.search_latin_key(v.title) %> ta.q_long )
       and public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                      ta.q_tokens, ta.q) is not null
     order by public.search_rank_aliased(public.search_latin_key(v.title), t.q_tokens, t.q,
                                         ta.q_tokens, ta.q),
              length(v.title), v.id
     limit 500;
end; $$;

alter function public.search_video_ids(text) owner to postgres;

comment on function public.search_video_ids(text) is
  'Lecture ids whose title matches p_query with universal_search''s lecture logic, curated shorthand included. Relevance-ordered, capped at 500 so a broad query cannot overflow a URL id-filter.';

revoke all on function public.search_video_ids(text) from public;
grant all on function public.search_video_ids(text) to anon;
grant all on function public.search_video_ids(text) to authenticated;
grant all on function public.search_video_ids(text) to service_role;

-- ---------------------------------------------------------------------
-- SELF-VERIFICATION. Inside the transaction: a failure here rolls the whole
-- migration back, so a bad seed row can never reach a student.
--
-- Four things are proved, in order of how much they matter:
--   A. the shape of what was just written;
--   B. THE LAW -- the alias pass can never remove or demote a literal match;
--   C. every seeded alias points at something that exists here, and now
--      reaches it;
--   D. a corpus of queries that worked yesterday still works, including the
--      exact tier, the typo tier, the filler guard and the length floor.
-- ---------------------------------------------------------------------
do $verify$
declare
  src        text;
  gone       text;
  is_definer boolean;
  cfg        text;
  v_n        int;
  v_row      record;
  v_fail     text[] := '{}';
  v_alias    text[];
  v_target   text[];
begin
  ------------------------------------------------------------------ A. shape
  if to_regclass('public.search_aliases') is null then
    raise exception 'search_aliases was not created';
  end if;
  select count(*) into v_n from public.search_aliases where is_active;
  if v_n < 20 then
    raise exception 'only % active aliases -- the seed did not land', v_n;
  end if;
  if to_regclass('public.search_aliases_alias_key_uniq') is null then
    raise exception 'the alias uniqueness index is missing -- two rows could claim one typed form';
  end if;

  select p.prosrc, p.prosecdef, array_to_string(p.proconfig, ',')
    into src, is_definer, cfg
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'universal_search'
     and pg_get_function_identity_arguments(p.oid)
         = 'p_query text, p_types text[], p_limit integer, p_offset integer';

  if src is null then
    raise exception 'universal_search(text, text[], integer, integer) is missing after replace';
  end if;
  -- Never elevate. RLS on study_materials is what keeps unapproved material
  -- out of a student's search results, and RLS on search_aliases is what keeps
  -- an inactive alias from firing.
  if is_definer then
    raise exception 'universal_search must stay SECURITY INVOKER';
  end if;
  if cfg is null or position('search_path=' in cfg) = 0 then
    raise exception 'universal_search lost its pinned search_path';
  end if;

  -- All seven groups survived the re-emission.
  select g into gone
    from unnest(array['faculty','chapter','playlist','lecture','institute','material','paper']) as g
   where position('''' || g || '''::text' in src) = 0
   limit 1;
  if gone is not null then
    raise exception 'universal_search lost a group block: %', gone;
  end if;

  -- The alias plumbing landed in all six title blocks...
  v_n := (length(src) - length(replace(src, 'search_rank_aliased(', '')))
         / length('search_rank_aliased(');
  if v_n <> 6 then
    raise exception 'expected search_rank_aliased in all 6 title blocks, found %', v_n;
  end if;
  -- ...and the three shipped disjuncts are still there, untouched, in each of
  -- them. This is the structural half of "an alias never removes a match": the
  -- candidate set can only have grown.
  v_n := (length(src) - length(replace(src, 'like ''%'' || q_long || ''%''', '')))
         / length('like ''%'' || q_long || ''%''');
  if v_n <> 6 then
    raise exception 'the shipped substring disjunct is missing from a block (found %)', v_n;
  end if;
  v_n := (length(src) - length(replace(src, 'like q || ''%''', '')))
         / length('like q || ''%''');
  if v_n <> 6 then
    raise exception 'the shipped prefix disjunct is missing from a block (found %)', v_n;
  end if;
  v_n := (length(src) - length(replace(src, '%> q_long', '')))
         / length('%> q_long');
  if v_n <> 6 then
    raise exception 'the shipped word-similarity disjunct is missing from a block (found %)', v_n;
  end if;
  -- The approved+published gate, still written out once per study-material block.
  if (length(src) - length(replace(src, 'review_status = ''approved''', '')))
     / length('review_status = ''approved''') <> 2 then
    raise exception 'expected the approved gate in exactly both study-material blocks';
  end if;

  -- Both browse helpers see aliases too, or /browse contradicts the box.
  for v_row in select unnest(array['search_playlist_ids','search_video_ids']) as fn loop
    select p.prosrc into src
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = v_row.fn;
    if src is null or position('search_rank_aliased' in src) = 0 then
      raise exception '% does not use the alias pass -- /browse would disagree with the search box', v_row.fn;
    end if;
  end loop;

  -- The two new functions are invoker with a pinned path, like everything else.
  for v_row in
    select p.proname, p.prosecdef, array_to_string(p.proconfig, ',') as cfg
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('search_expand_aliases', 'search_rank_aliased')
  loop
    if v_row.prosecdef then
      raise exception '% must stay SECURITY INVOKER', v_row.proname;
    end if;
    if v_row.cfg is null or position('search_path=' in v_row.cfg) = 0 then
      raise exception '% has no pinned search_path', v_row.proname;
    end if;
  end loop;

  -------------------------------------------------------------------- B. law
  -- The alias pass can never remove a match and never demote one. Pure
  -- function, synthetic corpus, no dependence on what is in the catalogue --
  -- so this assertion means the same thing on every database.
  if exists (
    select 1
      from (values
        -- haystack,                        typed tokens,        typed needle, alias tokens,                             alias needle
        ('simple harmonic motion class 11', array['shm'],        'shm',        array['simple','harmonic','motion'],      'simple harmonic motion'),
        ('shm marathon jee 2026',           array['shm'],        'shm',        array['simple','harmonic','motion'],      'simple harmonic motion'),
        ('oscillations and shm revision',   array['shm'],        'shm',        array['simple','harmonic','motion'],      'simple harmonic motion'),
        ('chemistry full course',           array['emi'],        'emi',        array['electromagnetic','induction'],     'electromagnetic induction'),
        ('electromagnetic induction',       array['emi'],        'emi',        array['electromagnetic','induction'],     'electromagnetic induction'),
        ('newtons laws of motion nlm',      array['nlm'],        'nlm',        array['newtons','laws','motion'],         'newtons laws of motion'),
        ('kinematics relative motion',      array['kinematics'], 'kinematics', array['kinematics'],                      'kinematics'),
        ('nothing relevant here at all',    array['shm'],        'shm',        array['simple','harmonic','motion'],      'simple harmonic motion')
      ) as v(h, t, n, at, an)
     where public.search_rank_tokens(v.h, v.t, v.n) is not null
       and (   public.search_rank_aliased(v.h, v.t, v.n, v.at, v.an) is null
            or public.search_rank_aliased(v.h, v.t, v.n, v.at, v.an)
               > public.search_rank_tokens(v.h, v.t, v.n))
  ) then
    raise exception 'THE LAW IS BROKEN: the alias pass removed or demoted a literal match';
  end if;

  -- And it is genuinely additive, not a no-op: a row the typed form cannot
  -- reach must now be reachable through the expansion.
  if public.search_rank_tokens('simple harmonic motion class 11', array['shm'], 'shm') is not null then
    raise exception 'the premise of this migration is wrong -- "shm" already matched that title';
  end if;
  if public.search_rank_aliased('simple harmonic motion class 11', array['shm'], 'shm',
                                array['simple','harmonic','motion'], 'simple harmonic motion') is null then
    raise exception 'the alias pass does not match what it exists to match';
  end if;

  -- Identity when nothing fires. This is what makes "no alias in the query"
  -- provably today's code path rather than merely a similar one.
  if public.search_expand_aliases(null) is not null then
    raise exception 'search_expand_aliases is not null-safe';
  end if;
  if public.search_expand_aliases('') <> '' then
    raise exception 'search_expand_aliases does not pass a blank key through';
  end if;
  for v_row in
    select unnest(array['kinematics', 'rotational motion', 'thermodynamics',
                        'zzqqxx', 'jee main 2024 paper']) as q
  loop
    if public.search_expand_aliases(v_row.q) is distinct from v_row.q then
      raise exception 'a query with no alias in it was rewritten: % -> %',
        v_row.q, public.search_expand_aliases(v_row.q);
    end if;
  end loop;

  ------------------------------------------------------ C. the seed is real
  for v_row in
    select a.alias, a.alias_key, a.expansion, a.expansion_key
      from public.search_aliases a
     where a.is_active
     order by a.id
  loop
    -- The expander agrees with the table.
    if public.search_expand_aliases(v_row.alias_key) is distinct from v_row.expansion_key then
      raise exception 'alias %L does not expand to its own expansion (got %L)',
        v_row.alias, public.search_expand_aliases(v_row.alias_key);
    end if;

    -- The target EXISTS in this catalogue. A seed row that points at nothing
    -- is a content mistake, and it stops the deploy here rather than shipping
    -- an alias that quietly does nothing.
    select array_agg(r.group_key || ':' || r.entity_id) into v_target
      from public.universal_search(v_row.expansion_key, null, 25, 0) r;
    if v_target is null then
      raise exception 'alias %L expands to %L, which matches NOTHING in this catalogue -- fix or remove that seed row',
        v_row.alias, v_row.expansion;
    end if;

    -- And typing the alias now reaches it.
    select array_agg(r.group_key || ':' || r.entity_id) into v_alias
      from public.universal_search(v_row.alias_key, null, 25, 0) r;
    if v_alias is null or not (v_alias && v_target) then
      raise exception 'alias %L still does not reach %L', v_row.alias, v_row.expansion;
    end if;
  end loop;

  ------------------------------------------------- D. nothing that worked broke
  -- Exactly the corpus docs/sql/search_filler_tokens_2026-08-10.sql shipped,
  -- because those are the queries the last change to this code path was
  -- measured against.
  for v_row in
    select unnest(array[
      'how to solve pulley problems',
      'friction problems',
      'how to find maxima',
      'class 11 physics ncert',
      'gravitation class 11',
      'projectile motion numericals'
    ]) as q
  loop
    select count(*) into v_n from public.universal_search(v_row.q, null, 10, 0);
    if v_n = 0 then v_fail := v_fail || v_row.q; end if;
  end loop;
  if array_length(v_fail, 1) > 0 then
    raise exception 'REGRESSION - these returned results before: %', array_to_string(v_fail, ' | ');
  end if;

  -- An exact chapter name must still rank as an exact match. "Rotational
  -- Motion" is in this list on purpose: it is the expansion of the "rot mech"
  -- alias, so it is exactly where a demotion would show up first.
  for v_row in
    select unnest(array['Rotational Motion', 'Thermodynamics', 'Kinematics',
                        'Mole Concept', 'Electromagnetic Induction']) as q
  loop
    select count(*) into v_n from public.universal_search(v_row.q, null, 10, 0);
    if v_n = 0 then
      raise exception 'REGRESSION - %L returned nothing', v_row.q;
    end if;
    if not exists (select 1 from public.universal_search(v_row.q, null, 10, 0) r
                    where r.match_type = 'exact') then
      raise exception 'exact match lost for %L', v_row.q;
    end if;
  end loop;

  -- Typo tolerance intact. 'kinamatics' is here by name because it is the
  -- query that a previous change to this code path broke.
  select count(*) into v_n from public.universal_search('rotatinal motion', null, 10, 0);
  if v_n = 0 then raise exception 'typo tolerance regressed'; end if;
  select count(*) into v_n from public.universal_search('kinamatics', null, 10, 0);
  if v_n = 0 then raise exception 'typo tolerance regressed on kinamatics'; end if;

  -- The empty-token guard and the length floor, both unchanged by this file
  -- and both cheap to keep proving.
  select count(*) into v_n from public.universal_search('please help', null, 50, 0);
  if v_n > 10 then
    raise exception 'a pure-filler query returned % rows - the empty-token guard is not working', v_n;
  end if;
  select count(*) into v_n from public.universal_search('a', null, 10, 0);
  if v_n <> 0 then raise exception 'the 2-character floor regressed'; end if;

  -- An unknown token is still an empty result, not a flood. Nothing about
  -- aliases may turn a miss into a match.
  select count(*) into v_n
    from public.universal_search('zzqqxx no such topic zzqqxx', null, 50, 0);
  if v_n <> 0 then
    raise exception 'a nonsense query returned % rows', v_n;
  end if;

  raise notice 'SELF-TEST PASSED: % aliases seeded and all of them reach a real target; the alias pass cannot remove or demote a literal match; the filler, typo, floor and nonsense corpora are unchanged.',
    (select count(*) from public.search_aliases where is_active);
end
$verify$;

commit;
