-- ============================================================
-- CHAPTER CHAMPIONS v1 - PRODUCTION ROLLBACK
-- Drops the one function this package added. Nothing else: no data was
-- created and no existing object was changed. The frontend degrades
-- gracefully once the RPC is gone (isMissingCatalogRpc -> the champions
-- board simply does not render), so this is safe at any time.
-- ============================================================

do $target_guard$
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing (not the production project)';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: app_environment is not production-empty';
  end if;
end
$target_guard$;

drop function if exists public.get_chapter_champions(bigint);

select
  'CHAPTER CHAMPIONS v1 ROLLBACK VERIFIED' as result,
  to_regprocedure('public.get_chapter_champions(bigint)') is null as function_removed;
