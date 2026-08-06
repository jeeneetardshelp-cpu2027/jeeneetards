-- ============================================================================
-- FORUM v1 PRODUCTION ROLLBACK — DESTRUCTIVE, GUARDED, PRE-LAUNCH ONLY
-- TARGET PROJECT (operator check): kezelafqhgqrprpadmlf
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE PRODUCTION APPROVAL.
--
-- It refuses unless mode is OFF, every non-seed forum table is empty, and the
-- non-null username fingerprint still matches installation time. It restores
-- the exact anon/authenticated profiles INSERT/UPDATE ACL snapshot.
-- ============================================================================
-- corePreflight: 3e009b762338b29d9f508addbdbef84a1689026a8e14100c632c48baf43f4d70  src/migrations/forum_v1_preflight.sql
-- coreMigration: 9fcf733655cd268589915254078c1e1d6d68da5fd252d5b9d73b290b283d9866  src/migrations/forum_v1.sql
-- corePostflight: 3a6defe5610c8b7c54504487498bdebc7fe28f500e3d3501cb7e82d3d453d583  src/migrations/forum_v1_postflight.sql
-- coreRollback: a42f830a1ff3b1ade5b85b396bacc452eccbecc3be554458c8e38b06b446ab2a  src/migrations/forum_v1_rollback.sql
-- usernamePreflight: 085a2dbbecb19a2bdb8a4a6338bbf5a5d164e07170e39cc8a30536ce09cceb75  src/migrations/forum_username_claim_v1_preflight.sql
-- usernameAudit: 496e0d6ce4399b685a2dec13786293cc70c5c56b002b4f7c20c3fd1083d60624  src/migrations/forum_username_claim_v1_audit.sql
-- usernameMigration: 6a943438cb3b047ca24d2301d74771e5f1699c4df4d7bc58905af9782f200b72  src/migrations/forum_username_claim_v1.sql
-- usernamePostflight: 3acb1db1efdd01154224f91c2a640bc9b9b77da9ed0978ec2a8950beb917bbda  src/migrations/forum_username_claim_v1_postflight.sql
-- moderationPreflight: 9346899077404d94440b71f5948c9cfe3e19a85f3981f6678d02051ab3c4e088  src/migrations/forum_moderation_context_v1_preflight.sql
-- moderationAudit: 51180449732975a434d9b4a455a6643f36f673859765befe752d12f6991a753c  src/migrations/forum_moderation_context_v1_audit.sql
-- moderationMigration: 3e3c1c0c6399ed1fe3f05644869ae866876d9e494000bacc5406d16f65ca40db  src/migrations/forum_moderation_context_v1.sql
-- moderationPostflight: 8e4bcf635033aabaac581ef2c1ffb49ebc4622beea879832fb8913b9d9c5e83a  src/migrations/forum_moderation_context_v1_postflight.sql
-- dismissalPreflight: acddafe571da9a2aa580446227ed33c16c43f757f97e37da3c564355222bc5e0  src/migrations/forum_report_dismissal_v1_preflight.sql
-- dismissalAudit: f51cce8f708b6a8689a070049e4a516cf4617f250c7476ec2e3b6daf4772f4b3  src/migrations/forum_report_dismissal_v1_audit.sql
-- dismissalMigration: b8cd78449234a6ac5ab38c1abf8281a6dcf1213b68db3a478b1607e6b11c2480  src/migrations/forum_report_dismissal_v1.sql
-- dismissalPostflight: 592b0aa5c32d7a42f26ffc25988115d1b059f3dc41193c47c75b1e648d57b084  src/migrations/forum_report_dismissal_v1_postflight.sql

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

do $forum_production_rollback_guard$
declare
  baseline text;
  current_fingerprint text;
  expected_topics text;
  current_topics text;
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: production rollback requires the empty production marker';
  end if;
  if to_regclass('public.forum_install_state') is null
     or (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'REFUSING: production rollback state is missing or ambiguous';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: production rollback requires forum mode off';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events) then
    raise exception 'REFUSING: production rollback found forum activity';
  end if;
  select baseline_username_fingerprint into baseline
  from public.forum_install_state where id = true;
  select coalesce(md5(coalesce(
    jsonb_agg(jsonb_build_array(p.id, p.username) order by p.id), '[]'::jsonb
  )::text), md5(''))
    into current_fingerprint
  from public.profiles p where p.username is not null;
  if current_fingerprint <> baseline then
    raise exception 'REFUSING: production rollback found username changes after installation';
  end if;
  select installed_topic_fingerprint into expected_topics
  from public.forum_install_state where id = true;
  select md5(jsonb_agg(jsonb_build_array(
    t.id, t.slug, t.name, t.description, t.kind, t.display_order, t.is_active
  ) order by t.id)::text) into current_topics from public.forum_topics t;
  if current_topics is distinct from expected_topics then
    raise exception 'REFUSING: production rollback found forum topic changes after installation';
  end if;
end;
$forum_production_rollback_guard$;

-- Later approved deltas first; the core operations then remove dependencies.
drop function public.forum_admin_dismiss_report(bigint);
drop function public.forum_claim_username(text);
drop function public.forum_get_my_identity();
drop index public.forum_profiles_username_ci_idx;

-- Core object list derived from src/migrations/forum_v1_rollback.sql
-- SOURCE SHA-256: a42f830a1ff3b1ade5b85b396bacc452eccbecc3be554458c8e38b06b446ab2a
drop trigger if exists trg_forum_anonymize_profile on public.profiles;

drop function if exists public.get_forum_topics();
drop function if exists public.get_forum_feed(text,text,text,double precision,integer,timestamptz,bigint,integer);
drop function if exists public.get_forum_post(bigint);
drop function if exists public.get_forum_comments(bigint);
drop function if exists public.forum_create_post(text,text,text);
drop function if exists public.forum_edit_post(bigint,text,text);
drop function if exists public.forum_delete_post(bigint);
drop function if exists public.forum_toggle_solved(bigint);
drop function if exists public.forum_create_comment(bigint,bigint,text);
drop function if exists public.forum_edit_comment(bigint,text);
drop function if exists public.forum_delete_comment(bigint);
drop function if exists public.forum_cast_vote(text,bigint,smallint);
drop function if exists public.forum_submit_report(text,bigint,text,text);
drop function if exists public.forum_admin_set_mode(text);
drop function if exists public.forum_admin_moderate(text,bigint,text,text,bigint);
drop function if exists public.forum_admin_set_suspension(uuid,timestamptz,text);
drop function if exists public.forum_admin_list_reports(integer);
drop function if exists public.forum_recount_metrics(boolean);
drop function if exists public.forum_recount_karma(boolean);

drop table if exists public.forum_rate_events;
drop table if exists public.forum_suspensions;
drop table if exists public.forum_moderation_log;
drop table if exists public.forum_reports;
drop table if exists public.forum_votes;
drop table if exists public.forum_comments;
drop table if exists public.forum_posts;
drop table if exists public.forum_user_stats;
drop table if exists public.forum_topics;
drop table if exists public.forum_settings;

drop function if exists public.forum_anonymize_profile_content();
drop function if exists public.forum_apply_vote_delta();
drop function if exists public.forum_prepare_vote();
drop function if exists public.forum_adjust_karma(uuid,integer);
drop function if exists public.forum_apply_comment_count_delta();
drop function if exists public.forum_apply_user_content_delta();
drop function if exists public.forum_prepare_comment();
drop function if exists public.forum_prepare_post();
drop function if exists public.forum_record_rate_event(uuid,text,bigint,integer,integer);
drop function if exists public.forum_require_reporter();
drop function if exists public.forum_require_writer();
drop function if exists public.forum_require_open();
drop function if exists public.forum_mode();
drop function if exists public.forum_hot_rank(integer,timestamptz);

drop function public.forum_username_is_allowed(text);

do $forum_restore_profile_acl$
declare
  snapshot public.forum_install_state%rowtype;
  all_columns text;
  columns_sql text;
  actual text[];
begin
  select * into strict snapshot from public.forum_install_state where id = true;
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into all_columns
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles';

  execute format('revoke insert (%s) on table public.profiles from anon, authenticated', all_columns);
  execute format('revoke update (%s) on table public.profiles from anon, authenticated', all_columns);
  revoke insert, update on table public.profiles from anon, authenticated;

  if snapshot.anon_insert_table then grant insert on table public.profiles to anon; end if;
  if snapshot.anon_update_table then grant update on table public.profiles to anon; end if;
  if snapshot.authenticated_insert_table then grant insert on table public.profiles to authenticated; end if;
  if snapshot.authenticated_update_table then grant update on table public.profiles to authenticated; end if;

  if cardinality(snapshot.anon_insert_columns) > 0 then
    select string_agg(quote_ident(value), ', ') into columns_sql from unnest(snapshot.anon_insert_columns) value;
    execute format('grant insert (%s) on table public.profiles to anon', columns_sql);
  end if;
  if cardinality(snapshot.anon_update_columns) > 0 then
    select string_agg(quote_ident(value), ', ') into columns_sql from unnest(snapshot.anon_update_columns) value;
    execute format('grant update (%s) on table public.profiles to anon', columns_sql);
  end if;
  if cardinality(snapshot.authenticated_insert_columns) > 0 then
    select string_agg(quote_ident(value), ', ') into columns_sql from unnest(snapshot.authenticated_insert_columns) value;
    execute format('grant insert (%s) on table public.profiles to authenticated', columns_sql);
  end if;
  if cardinality(snapshot.authenticated_update_columns) > 0 then
    select string_agg(quote_ident(value), ', ') into columns_sql from unnest(snapshot.authenticated_update_columns) value;
    execute format('grant update (%s) on table public.profiles to authenticated', columns_sql);
  end if;

  if has_table_privilege('anon', 'public.profiles', 'INSERT') <> snapshot.anon_insert_table
     or has_table_privilege('anon', 'public.profiles', 'UPDATE') <> snapshot.anon_update_table
     or has_table_privilege('authenticated', 'public.profiles', 'INSERT') <> snapshot.authenticated_insert_table
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE') <> snapshot.authenticated_update_table then
    raise exception 'production rollback: table-level profile ACL restoration failed';
  end if;

  select coalesce(array_agg(column_name order by column_name), '{}'::text[]) into actual
  from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'profiles' and grantee = 'anon' and privilege_type = 'INSERT';
  if actual <> snapshot.anon_insert_columns then raise exception 'production rollback: anon INSERT columns drifted'; end if;
  select coalesce(array_agg(column_name order by column_name), '{}'::text[]) into actual
  from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'profiles' and grantee = 'anon' and privilege_type = 'UPDATE';
  if actual <> snapshot.anon_update_columns then raise exception 'production rollback: anon UPDATE columns drifted'; end if;
  select coalesce(array_agg(column_name order by column_name), '{}'::text[]) into actual
  from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'INSERT';
  if actual <> snapshot.authenticated_insert_columns then raise exception 'production rollback: authenticated INSERT columns drifted'; end if;
  select coalesce(array_agg(column_name order by column_name), '{}'::text[]) into actual
  from information_schema.column_privileges where table_schema = 'public'
    and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE';
  if actual <> snapshot.authenticated_update_columns then raise exception 'production rollback: authenticated UPDATE columns drifted'; end if;
end;
$forum_restore_profile_acl$;

drop table public.forum_install_state;
notify pgrst, 'reload schema';
commit;

select
  to_regclass('public.forum_settings') is null as forum_settings_removed,
  to_regclass('public.forum_posts') is null as forum_posts_removed,
  to_regclass('public.forum_install_state') is null as install_state_removed,
  to_regprocedure('public.forum_mode()') is null as forum_mode_removed,
  to_regprocedure('public.forum_claim_username(text)') is null as username_claim_removed,
  to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null as dismissal_removed;
