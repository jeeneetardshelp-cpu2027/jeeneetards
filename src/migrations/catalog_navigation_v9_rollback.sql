-- Roll back catalogue navigation v9.
--
-- This removes only the two public read functions. The frontend then falls
-- back automatically to the legacy Guided read path and hides facet counts.
-- The two additive indexes are deliberately retained: they contain no data of
-- their own and dropping them would take another table lock for no benefit.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback_guard$
declare
  v_bad_environment boolean := false;
begin
  if to_regclass('public.app_environment') is not null then
    execute $query$
      select exists (
        select 1
        from public.app_environment
        where lower(coalesce(name, '')) in ('staging', 'test', 'development', 'dev')
      )
    $query$ into v_bad_environment;
  end if;
  if v_bad_environment then
    raise exception 'REFUSING: production rollback was pointed at a non-production environment';
  end if;
end
$rollback_guard$;

drop function if exists public.browse_facet_counts(
  text, text, text, text, bigint, text[], text[], text[], text);
drop function if exists public.get_browse_curriculum(text, text, text);

do $rollback_check$
begin
  if to_regprocedure('public.get_browse_curriculum(text,text,text)') is not null
     or to_regprocedure('public.browse_facet_counts(text,text,text,text,bigint,text[],text[],text[],text)') is not null then
    raise exception 'ROLLBACK: a v9 function still exists';
  end if;
end
$rollback_check$;

commit;
