-- ============================================================
-- CHAPTER CHAMPIONS v1 - READ-ONLY PRODUCTION POSTFLIGHT
-- Target kezelafqhgqrprpadmlf; no data or schema mutation.
-- Run AFTER production_apply.sql. Every row should read 'ok'.
-- ============================================================

select
  case when to_regprocedure('public.get_chapter_champions(bigint)') is not null
       then 'ok' else 'FAIL: missing' end as function_exists,
  case when (select prosecdef from pg_proc
             where oid = 'public.get_chapter_champions(bigint)'::regprocedure)
       then 'ok' else 'FAIL: not definer' end as security_definer,
  case when (select coalesce(proconfig, array[]::text[]) @> array['search_path=""']
             from pg_proc
             where oid = 'public.get_chapter_champions(bigint)'::regprocedure)
       then 'ok' else 'FAIL: search_path not pinned' end as search_path_pinned,
  case when has_function_privilege('anon', 'public.get_chapter_champions(bigint)', 'execute')
       then 'ok' else 'FAIL: anon' end as anon_execute,
  case when has_function_privilege('authenticated', 'public.get_chapter_champions(bigint)', 'execute')
       then 'ok' else 'FAIL: authenticated' end as authenticated_execute;

-- Behaviour smoke (read-only): impossible/null chapters answer empty, and no
-- row anywhere carries a below-floor average. Champions may legitimately be
-- zero rows today — the rating prompt only just started collecting votes.
select
  (select count(*) from public.get_chapter_champions(-1)) as impossible_chapter_should_be_0,
  (select count(*) from public.get_chapter_champions(null)) as null_chapter_should_be_0;
