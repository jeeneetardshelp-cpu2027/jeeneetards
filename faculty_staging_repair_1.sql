-- ============================================================
-- faculty_staging_repair_1.sql — staging defects found by run e92a38
--
-- Apply ONLY to the disposable staging project that already received the
-- original faculty_staging_delta.sql. Fresh deltas contain the corrected source.
-- No content rows are created or changed by this repair.
-- ============================================================

-- PostgreSQL's [:alnum:] class keeps Devanagari base letters but drops their
-- combining vowel marks. Normalize separators instead so complete Indic words
-- survive. This is a comparison key, never proof of identity.
create or replace function public.normalize_person_name(p_name text)
returns text language sql immutable as $$
  select nullif(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              lower(coalesce(p_name, '')), '[''’`´]', '', 'g'),
            '[[:punct:][:space:]]+', ' ', 'g'),
          '\y(sir|maam|mam|madam|mister|mr|mrs|ms|miss|dr|doctor|prof|professor|ji|bhaiya|bhaiyya|guruji)\y',
          ' ', 'g'),
        '\s+', ' ', 'g')
    ), '');
$$;

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

-- pg_trgm's schema varies by project. This staging project reported `public`;
-- other Supabase projects may use `extensions`. Discover it and compile a
-- schema-qualified wrapper so fresh source never depends on search_path.
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
  execute format(
    'alter function public.search_teachers_internal(text, int, boolean)
       set search_path = public, %I, pg_temp', v_schema);
  execute format(
    'alter function public.search_rank(text, text)
       set search_path = public, %I, pg_temp', v_schema);
end
$install_catalog_similarity$;

-- The already-created functions still contain unqualified similarity(). Their
-- own search_path is therefore set to the schema reported by this project.

-- Expression-index values were produced by the previous immutable normalizer.
-- Changing the function body does not rebuild them automatically.
reindex index public.idx_chapters_name_trgm;
reindex index public.idx_playlists_title_trgm;
reindex index public.idx_videos_title_trgm;
reindex index public.idx_institutes_name_trgm;
reindex index public.idx_chapters_name_pattern;
reindex index public.idx_playlists_title_pattern;
reindex index public.idx_videos_title_pattern;

-- Fail this migration rather than allowing another false-green test run.
do $$
declare v_person text; v_search text;
begin
  v_person := public.normalize_person_name('डॉ. अमित बिजारणिया');
  if v_person <> 'डॉ अमित बिजारणिया' then
    raise exception 'Unicode person normalization is still broken: %', v_person;
  end if;

  v_search := public.normalize_search_text('भौतिक-विज्ञान');
  if v_search <> 'भौतिक विज्ञान' then
    raise exception 'Unicode catalogue normalization is still broken: %', v_search;
  end if;

  if public.catalog_similarity('amit', 'amit') <> 1 then
    raise exception 'pg_trgm similarity wrapper is not reachable';
  end if;

  -- Resolve both previously failing paths while the faculty tables are empty.
  perform * from public.search_teachers('amit', 5);
  perform * from public.universal_search('kinematics', array['chapter'], 5, 0);
end $$;
