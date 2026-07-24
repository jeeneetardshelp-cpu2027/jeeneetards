-- ============================================================
--  STAGING EVIDENCE QUERIES — read-only. SELECTs only, no writes, no DDL.
--
--  Run this in the staging SQL Editor AFTER `npm run test:integration`
--  finishes, and paste the whole output back. It collects the evidence the
--  review asked for that the Node suite cannot reach over PostgREST
--  (pg_proc, routine grants, trigger state).
--
--  Do NOT run against production.
-- ============================================================

-- ------------------------------------------------------------
-- A. Migration audit, grouped by run_id and verdict
-- ------------------------------------------------------------
select
    run_id,
    verdict,
    count(*)          as rows,
    min(migrated_at)  as run_started
  from public.class_levels_migration_audit
 group by run_id, verdict
 order by run_started, verdict;

-- A2. one line per run, so multiple runs are easy to compare
select
    run_id,
    count(*)                                          as playlists_audited,
    count(*) filter (where verdict = 'agree')         as agree,
    count(*) filter (where verdict = 'array-only')    as array_only,
    count(*) filter (where verdict = 'junction-only') as junction_only,
    count(*) filter (where verdict = 'both-empty')    as both_empty,
    min(migrated_at)                                  as run_started
  from public.class_levels_migration_audit
 group by run_id
 order by run_started;

-- ------------------------------------------------------------
-- B. FINAL DRIFT COUNT — must be 0
-- ------------------------------------------------------------
select count(*) as drifted_playlists
  from public.playlists p
 where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
       is distinct from
       (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x);

-- B2. if the count above is not 0, this names the offenders
select p.id, p.title, p.class_levels as array_says,
       public.derived_class_levels(p.id) as junction_says
  from public.playlists p
 where (select array_agg(distinct x order by x) from unnest(coalesce(p.class_levels,'{}')) x)
       is distinct from
       (select array_agg(distinct x order by x) from unnest(public.derived_class_levels(p.id)) x)
 order by p.id;

-- ------------------------------------------------------------
-- C. Installed public functions (security mode + search_path)
-- ------------------------------------------------------------
select
    p.proname                                   as function_name,
    pg_get_function_identity_arguments(p.oid)   as arguments,
    case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end as security,
    coalesce(array_to_string(p.proconfig, ', '), '-')                as settings
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
 order by p.proname, arguments;

-- ------------------------------------------------------------
-- D. EXECUTE grants on those functions (who can call what)
-- ------------------------------------------------------------
select
    r.routine_name,
    r.grantee,
    r.privilege_type
  from information_schema.routine_privileges r
 where r.routine_schema = 'public'
 order by r.routine_name, r.grantee;

-- D2. the security-critical ones, explicitly: anon must appear NOWHERE here
select r.routine_name, r.grantee
  from information_schema.routine_privileges r
 where r.routine_schema = 'public'
   and r.routine_name in ('import_playlist','create_course','set_video_taxonomy',
                          'clear_video_taxonomy','migrate_class_levels',
                          'purge_migration_audit','validate_import_payload',
                          'seed_blocking_drift_fixture','clear_blocking_drift_fixture')
 order by r.routine_name, r.grantee;

-- ------------------------------------------------------------
-- E. Trigger state
-- ------------------------------------------------------------
select t.tgname as trigger_name,
       c.relname as on_table,
       pg_get_triggerdef(t.oid) as definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
 where not t.tgisinternal
   and c.relnamespace = 'public'::regnamespace
 order by c.relname, t.tgname;

-- ------------------------------------------------------------
-- F. CLEANUP CONFIRMATION — every "remaining" count must be 0,
--    EXCEPT the permanent staging drift fixtures (expected: 5).
-- ------------------------------------------------------------
select 'test playlists (TESTPL%)'          as kind,
       count(*) as remaining, 0 as expected
  from public.playlists where youtube_playlist_id like 'TESTPL%'
union all
select 'test channels (TESTCH%)',
       count(*), 0
  from public.institutes_channels where youtube_channel_id like 'TESTCH%'
union all
select 'videos on test channels',
       count(*), 0
  from public.videos v
  join public.institutes_channels c on c.id = v.channel_id
 where c.youtube_channel_id like 'TESTCH%'
union all
select 'manual create_course leftovers (CC %)',
       count(*), 0
  from public.playlists where title like 'CC %'
union all
select 'direct-insert fixtures (DA insert %)',
       count(*), 0
  from public.playlists where title like 'DA insert %'
union all
select 'blocking drift fixtures (removed by the suite)',
       count(*), 0
  from public.playlists where title like 'DRIFTFX blocking%'
union all
select 'permanent drift fixtures (kept on purpose)',
       count(*), 5
  from public.playlists
 where title like 'DRIFTFX %' and title not like 'DRIFTFX blocking%'
 order by kind;

-- F2. overall row counts, for context
select
    (select count(*) from public.playlists)             as playlists,
    (select count(*) from public.videos)                as videos,
    (select count(*) from public.institutes_channels)   as channels,
    (select count(*) from public.playlist_class_levels) as playlist_class_links,
    (select count(*) from public.playlist_boards)       as playlist_board_links;
