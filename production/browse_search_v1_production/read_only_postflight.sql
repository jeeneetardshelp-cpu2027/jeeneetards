-- ============================================================
-- BROWSE SEARCH v1 - READ-ONLY PRODUCTION POSTFLIGHT
-- Target kezelafqhgqrprpadmlf; no data or schema mutation.
-- Run AFTER production_apply.sql. Every row should read 'ok'.
-- ============================================================

-- 1. All four functions exist with the exact signatures the frontend calls.
select
  case when to_regprocedure('public.search_query_tokens(text)') is not null then 'ok' else 'FAIL' end as search_query_tokens,
  case when to_regprocedure('public.search_playlist_ids(text)') is not null then 'ok' else 'FAIL' end as search_playlist_ids,
  case when to_regprocedure('public.search_video_ids(text)') is not null then 'ok' else 'FAIL' end as search_video_ids,
  case when to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null
       then 'ok' else 'FAIL' end as browse_facet_counts;

-- 2. anon AND authenticated can execute all four (public /browse contract).
select
  p.proname,
  case when has_function_privilege('anon', p.oid, 'execute') then 'ok' else 'FAIL: anon' end as anon_exec,
  case when has_function_privilege('authenticated', p.oid, 'execute') then 'ok' else 'FAIL: authenticated' end as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('search_query_tokens','search_playlist_ids','search_video_ids','browse_facet_counts')
order by p.proname;

-- 3. The two `%>`-using functions carry pg_trgm's schema on their search_path.
select
  p.proname,
  case when array_to_string(p.proconfig, ',') like '%' ||
            (select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm')
            || '%'
       then 'ok' else 'FAIL: pg_trgm schema not pinned' end as search_path_pinned
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('search_playlist_ids','search_video_ids')
order by p.proname;

-- 4. browse_facet_counts now routes search through search_playlist_ids.
select case
  when pg_get_functiondef(
    to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)')::oid)
    like '%search_playlist_ids%' then 'ok' else 'FAIL: still using ILIKE' end as facet_counts_routed;

-- 5. Behaviour: the headline leak is closed and the floor holds (read-only calls).
select
  (select count(*) from public.search_playlist_ids('friction problems'))
   + (select count(*) from public.search_video_ids('friction problems')) as friction_hits_should_be_gt_0,
  (select count(*) from public.search_playlist_ids('a'))
   + (select count(*) from public.search_video_ids('a')) as single_char_should_be_0,
  (select count(*) from public.browse_facet_counts(null,null,null,null,null,null,null,null,'friction problems') where n > 0)
    as facet_rows_for_matching_search_should_be_gt_0,
  (select count(*) from public.browse_facet_counts(null,null,null,null,null,null,null,null,null) where n > 0)
    as facet_rows_no_search_should_be_gt_0;
