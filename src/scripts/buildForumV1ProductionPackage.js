// Build the review-only Forum v1 production installation package.
//
// This script reads local, already-reviewed SQL sources and writes local
// artifacts. It never reads credentials, opens a database connection, or
// authorizes execution. The generated installer is one explicit transaction
// and leaves the database forum mode OFF.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputDir = resolve(root, "production/forum_v1_release");
const targetProjectRef = "kezelafqhgqrprpadmlf";
const generatorPath = "src/scripts/buildForumV1ProductionPackage.js";

const sources = {
  corePreflight: "src/migrations/forum_v1_preflight.sql",
  coreMigration: "src/migrations/forum_v1.sql",
  corePostflight: "src/migrations/forum_v1_postflight.sql",
  coreRollback: "src/migrations/forum_v1_rollback.sql",
  usernamePreflight: "src/migrations/forum_username_claim_v1_preflight.sql",
  usernameAudit: "src/migrations/forum_username_claim_v1_audit.sql",
  usernameMigration: "src/migrations/forum_username_claim_v1.sql",
  usernamePostflight: "src/migrations/forum_username_claim_v1_postflight.sql",
  moderationPreflight: "src/migrations/forum_moderation_context_v1_preflight.sql",
  moderationAudit: "src/migrations/forum_moderation_context_v1_audit.sql",
  moderationMigration: "src/migrations/forum_moderation_context_v1.sql",
  moderationPostflight: "src/migrations/forum_moderation_context_v1_postflight.sql",
  dismissalPreflight: "src/migrations/forum_report_dismissal_v1_preflight.sql",
  dismissalAudit: "src/migrations/forum_report_dismissal_v1_audit.sql",
  dismissalMigration: "src/migrations/forum_report_dismissal_v1.sql",
  dismissalPostflight: "src/migrations/forum_report_dismissal_v1_postflight.sql",
};

const normalize = (value) => String(value).replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (path) => normalize(readFileSync(resolve(root, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sourceText = Object.fromEntries(
  Object.entries(sources).map(([name, path]) => [name, read(path)]),
);
const sourceHashes = Object.fromEntries(
  Object.entries(sourceText).map(([name, value]) => [name, sha256(value)]),
);

function transactionBody(source, label) {
  const lines = normalize(source).split("\n");
  const beginIndex = lines.findIndex((line) => /^\s*begin(?: transaction read only)?;\s*$/i.test(line));
  let endIndex = -1;
  for (let index = lines.length - 1; index > beginIndex; index -= 1) {
    if (/^\s*(?:commit|rollback);\s*$/i.test(lines[index])) {
      endIndex = index;
      break;
    }
  }
  if (beginIndex < 0 || endIndex <= beginIndex) {
    throw new Error(`REFUSING: ${label} transaction wrapper drifted`);
  }
  const trailing = lines.slice(endIndex + 1).join("\n").trim();
  if (trailing) throw new Error(`REFUSING: ${label} has SQL after its transaction`);
  return `${lines.slice(0, beginIndex).join("\n").trim()}\n${lines
    .slice(beginIndex + 1, endIndex).join("\n").trim()}\n`;
}

function coreRollbackOperations(source) {
  const startMarker = "drop trigger if exists trg_forum_anonymize_profile on public.profiles;";
  const endMarker = "notify pgrst, 'reload schema';";
  const start = source.indexOf(startMarker);
  const end = source.lastIndexOf(endMarker);
  if (start < 0 || end <= start) throw new Error("REFUSING: core rollback structure drifted");
  return `${source.slice(start, end).trim()}\n`;
}

const coreBody = transactionBody(sourceText.coreMigration, sources.coreMigration);
const usernamePreflightBody = transactionBody(
  sourceText.usernamePreflight,
  sources.usernamePreflight,
);
const usernameBody = transactionBody(sourceText.usernameMigration, sources.usernameMigration);
const moderationPreflightBody = transactionBody(
  sourceText.moderationPreflight,
  sources.moderationPreflight,
);
const moderationBody = transactionBody(
  sourceText.moderationMigration,
  sources.moderationMigration,
);
const dismissalPreflightBody = transactionBody(
  sourceText.dismissalPreflight,
  sources.dismissalPreflight,
);
const dismissalBody = transactionBody(
  sourceText.dismissalMigration,
  sources.dismissalMigration,
);
const corePostflightBody = transactionBody(sourceText.corePostflight, sources.corePostflight);
const usernamePostflightBody = transactionBody(
  sourceText.usernamePostflight,
  sources.usernamePostflight,
);
const moderationPostflightBody = transactionBody(
  sourceText.moderationPostflight,
  sources.moderationPostflight,
);
const dismissalPostflightBody = transactionBody(
  sourceText.dismissalPostflight,
  sources.dismissalPostflight,
);
const rollbackOperations = coreRollbackOperations(sourceText.coreRollback);

const sourceHashHeader = Object.entries(sources)
  .map(([name, path]) => `-- ${name}: ${sourceHashes[name]}  ${path}`)
  .join("\n");

const productionGuard = (label) => `do $forum_production_guard$
declare
  existing text[] := '{}'::text[];
  object_name text;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: ${label} requires public.app_environment';
  end if;
  if exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: ${label} requires the empty production environment marker';
  end if;
  if to_regclass('public.profiles') is null
     or to_regclass('auth.users') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('auth.uid()') is null
     or to_regprocedure('auth.role()') is null then
    raise exception 'REFUSING: ${label} identity/admin dependencies are incomplete';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon')
     or not exists (select 1 from pg_roles where rolname = 'authenticated')
     or not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'REFUSING: ${label} browser/service roles are incomplete';
  end if;

  foreach object_name in array array[
    'forum_settings', 'forum_topics', 'forum_posts', 'forum_comments',
    'forum_votes', 'forum_user_stats', 'forum_reports',
    'forum_moderation_log', 'forum_suspensions', 'forum_rate_events',
    'forum_install_state'
  ] loop
    if to_regclass('public.' || object_name) is not null then
      existing := array_append(existing, object_name);
    end if;
  end loop;
  if cardinality(existing) > 0 then
    raise exception 'REFUSING: ${label} found existing forum objects: %',
      array_to_string(existing, ', ');
  end if;
  if to_regprocedure('public.forum_mode()') is not null
     or to_regprocedure('public.forum_claim_username(text)') is not null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null
     or to_regclass('public.forum_profiles_username_ci_idx') is not null then
    raise exception 'REFUSING: ${label} found existing forum functions or indexes';
  end if;
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'PUBLIC' and privilege_type in ('INSERT', 'UPDATE')
  ) or exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'PUBLIC' and privilege_type in ('INSERT', 'UPDATE')
  ) then
    raise exception 'REFUSING: ${label} cannot safely snapshot PUBLIC profile write grants';
  end if;
  if exists (
    select 1 from (
      select lower(btrim(username))
      from public.profiles
      where username is not null
      group by lower(btrim(username))
      having count(*) > 1
    ) collisions
  ) then
    raise exception 'REFUSING: ${label} found case-insensitive username collisions';
  end if;
end;
$forum_production_guard$;`;

const profileAuditSelect = `with classified as (
  select
    username,
    username = btrim(username)
      and btrim(coalesce(username, '')) ~ '^[A-Za-z0-9_-]{3,30}$' as valid_format,
    lower(btrim(coalesce(username, ''))) ~
      '^(admin|administrator|mod|moderator|staff|support|official|system|root|automod)([-_]?[0-9]+)?$'
      or lower(btrim(coalesce(username, ''))) in (
        'anonymous', 'deleted_student', 'deleted-student',
        'fuck', 'fucker', 'bitch', 'chutiya', 'madarchod', 'bhenchod'
      )
      or lower(btrim(coalesce(username, ''))) ~ '^jeeneetards?(help)?([-_].*)?$'
      as reserved
  from public.profiles
), collisions as (
  select count(*)::integer as groups
  from (
    select lower(btrim(username))
    from public.profiles where username is not null
    group by lower(btrim(username)) having count(*) > 1
  ) duplicate_groups
)
select
  count(*)::integer as profile_rows,
  count(*) filter (where username is not null and valid_format and not reserved)::integer
    as valid_usernames,
  count(*) filter (where username is null or not valid_format)::integer
    as missing_or_invalid_usernames,
  count(*) filter (where username is not null and reserved)::integer
    as reserved_usernames,
  (select groups from collisions) as case_insensitive_collision_groups,
  has_table_privilege('anon', 'public.profiles', 'INSERT') as anon_profile_insert,
  has_table_privilege('anon', 'public.profiles', 'UPDATE') as anon_profile_update,
  has_table_privilege('authenticated', 'public.profiles', 'INSERT') as authenticated_profile_insert,
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as authenticated_profile_update
from classified;`;

const preflight = `-- ============================================================================
-- FORUM v1 PRODUCTION PREFLIGHT — READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. THIS FILE DOES NOT AUTHORIZE THE INSTALLER.
-- ============================================================================
${sourceHashHeader}

-- Exact reviewed core preflight, unchanged.
${sourceText.corePreflight.trim()}

begin transaction read only;
set local statement_timeout = '60s';
${productionGuard("forum production preflight")}

${profileAuditSelect}

select
  current_database() as database_name,
  'empty-production-marker'::text as environment_guard,
  false as database_changed;
commit;
`;

const audit = `-- ============================================================================
-- FORUM v1 PRODUCTION EXISTING-PROFILE AUDIT — READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

-- Exact reviewed username audit, unchanged.
${sourceText.usernameAudit.trim()}

begin transaction read only;
${productionGuard("forum production audit")}
${profileAuditSelect}
select false as database_changed;
commit;
`;

const installState = `create table public.forum_install_state (
  id boolean primary key default true check (id),
  installed_at timestamptz not null default now(),
  baseline_username_fingerprint text not null,
  installed_topic_fingerprint text not null,
  anon_insert_table boolean not null,
  anon_update_table boolean not null,
  authenticated_insert_table boolean not null,
  authenticated_update_table boolean not null,
  anon_insert_columns text[] not null,
  anon_update_columns text[] not null,
  authenticated_insert_columns text[] not null,
  authenticated_update_columns text[] not null
);
revoke all on table public.forum_install_state from public, anon, authenticated, service_role;

insert into public.forum_install_state (
  id, baseline_username_fingerprint, installed_topic_fingerprint,
  anon_insert_table, anon_update_table,
  authenticated_insert_table, authenticated_update_table,
  anon_insert_columns, anon_update_columns,
  authenticated_insert_columns, authenticated_update_columns
)
select
  true,
  coalesce((
    select md5(coalesce(
      jsonb_agg(jsonb_build_array(p.id, p.username) order by p.id), '[]'::jsonb
    )::text)
    from public.profiles p where p.username is not null
  ), md5('')),
  (select md5(jsonb_agg(jsonb_build_array(
    t.id, t.slug, t.name, t.description, t.kind, t.display_order, t.is_active
  ) order by t.id)::text) from public.forum_topics t),
  has_table_privilege('anon', 'public.profiles', 'INSERT'),
  has_table_privilege('anon', 'public.profiles', 'UPDATE'),
  has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  coalesce((select array_agg(column_name order by column_name)
    from information_schema.column_privileges where table_schema = 'public'
      and table_name = 'profiles' and grantee = 'anon' and privilege_type = 'INSERT'), '{}'::text[]),
  coalesce((select array_agg(column_name order by column_name)
    from information_schema.column_privileges where table_schema = 'public'
      and table_name = 'profiles' and grantee = 'anon' and privilege_type = 'UPDATE'), '{}'::text[]),
  coalesce((select array_agg(column_name order by column_name)
    from information_schema.column_privileges where table_schema = 'public'
      and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'INSERT'), '{}'::text[]),
  coalesce((select array_agg(column_name order by column_name)
    from information_schema.column_privileges where table_schema = 'public'
      and table_name = 'profiles' and grantee = 'authenticated' and privilege_type = 'UPDATE'), '{}'::text[]);
`;

const install = `-- ============================================================================
-- FORUM v1 PRODUCTION INSTALL — ATOMIC, NON-IDEMPOTENT, MODE OFF
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE PRODUCTION APPROVAL.
-- ============================================================================
${sourceHashHeader}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';

${productionGuard("forum production install")}

-- Exact reviewed core migration with only its outer transaction removed.
${coreBody.trim()}

-- Snapshot the profile ACL and username baseline needed for a truthful rollback.
${installState.trim()}

-- Exact reviewed username preflight, now that the core exists in this transaction.
${usernamePreflightBody.trim()}

-- Exact reviewed username-claim migration body.
${usernameBody.trim()}

-- Exact reviewed moderation-context preflight and migration bodies.
${moderationPreflightBody.trim()}
${moderationBody.trim()}

-- Exact reviewed report-dismissal preflight and migration bodies.
${dismissalPreflightBody.trim()}
${dismissalBody.trim()}

-- All reviewed postflights run before COMMIT. Any failure rolls back everything.
${corePostflightBody.trim()}
${usernamePostflightBody.trim()}
${moderationPostflightBody.trim()}
${dismissalPostflightBody.trim()}

do $forum_production_terminal_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'FORUM PRODUCTION INSTALL: forum mode is not off';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6 then
    raise exception 'FORUM PRODUCTION INSTALL: expected six active topics';
  end if;
  if (select count(*) from public.forum_install_state) <> 1 then
    raise exception 'FORUM PRODUCTION INSTALL: rollback state was not captured';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events) then
    raise exception 'FORUM PRODUCTION INSTALL: installation created non-seed forum data';
  end if;
end;
$forum_production_terminal_assert$;

notify pgrst, 'reload schema';
commit;

select
  public.forum_mode() as forum_mode,
  (select count(*) from public.forum_topics where is_active) = 6 as six_topics_installed,
  to_regprocedure('public.forum_claim_username(text)') is not null as username_claim_installed,
  to_regprocedure('public.forum_admin_list_reports(integer)') is not null as moderation_context_installed,
  to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as dismissal_installed,
  (select count(*) from public.forum_posts) = 0 as no_posts_created,
  (select count(*) from public.forum_reports) = 0 as no_reports_created,
  (select count(*) from public.forum_install_state) = 1 as rollback_state_captured;
`;

const postflightGuard = `begin transaction read only;
do $forum_production_postflight_guard$
begin
  if to_regclass('public.app_environment') is null
     or exists (select 1 from public.app_environment) then
    raise exception 'REFUSING: production postflight requires the empty production marker';
  end if;
  if to_regclass('public.forum_install_state') is null then
    raise exception 'REFUSING: production postflight install state is missing';
  end if;
end;
$forum_production_postflight_guard$;
commit;`;

const postflight = `-- ============================================================================
-- FORUM v1 PRODUCTION POSTFLIGHT — READ ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- ============================================================================
${sourceHashHeader}

${postflightGuard}

-- Exact reviewed structural postflights, unchanged.
${sourceText.corePostflight.trim()}
${sourceText.usernamePostflight.trim()}
${sourceText.moderationPostflight.trim()}
${sourceText.dismissalPostflight.trim()}

begin transaction read only;
do $forum_production_postflight_assert$
declare
  leaked record;
begin
  if public.forum_mode() <> 'off' then
    raise exception 'production postflight: forum mode is not off';
  end if;
  if exists (
    select 1 from information_schema.table_privileges
    where table_schema = 'public' and table_name like 'forum\\_%' escape '\\'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) or exists (
    select 1 from information_schema.column_privileges
    where table_schema = 'public' and table_name like 'forum\\_%' escape '\\'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
  ) then
    select grantee, table_name, privilege_type into leaked
    from information_schema.table_privileges
    where table_schema = 'public' and table_name like 'forum\\_%' escape '\\'
      and grantee in ('PUBLIC', 'anon', 'authenticated') limit 1;
    raise exception 'production postflight: browser table privilege leaked: %.% %',
      leaked.grantee, leaked.table_name, leaked.privilege_type;
  end if;
  if exists (
    select 1
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'forum\\_%' escape '\\' or p.proname like 'get_forum\\_%' escape '\\')
      and p.prosecdef
      and not coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  ) then
    raise exception 'production postflight: a forum security-definer function has a mutable search path';
  end if;
  if (select count(*) from public.forum_topics where is_active) <> 6
     or exists (select 1 from public.forum_topics where slug in ('motivation', 'general') and is_active) then
    raise exception 'production postflight: launch topic set drifted';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_votes)
     or exists (select 1 from public.forum_user_stats)
     or exists (select 1 from public.forum_reports)
     or exists (select 1 from public.forum_moderation_log)
     or exists (select 1 from public.forum_suspensions)
     or exists (select 1 from public.forum_rate_events) then
    raise exception 'production postflight: unexpected forum data exists';
  end if;
end;
$forum_production_postflight_assert$;

select
  public.forum_mode() as forum_mode,
  (select count(*) from public.forum_topics where is_active) as active_topics,
  (select count(*) from public.forum_posts) as posts,
  (select count(*) from public.forum_comments) as comments,
  (select count(*) from public.forum_reports) as reports,
  to_regprocedure('public.forum_claim_username(text)') is not null as username_claim_ready,
  to_regprocedure('public.forum_admin_list_reports(integer)') is not null as moderation_context_ready,
  to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as dismissal_ready,
  false as database_changed;
commit;
`;

const rollback = `-- ============================================================================
-- FORUM v1 PRODUCTION ROLLBACK — DESTRUCTIVE, GUARDED, PRE-LAUNCH ONLY
-- TARGET PROJECT (operator check): ${targetProjectRef}
-- PREPARED ONLY. RUNNING THIS FILE REQUIRES SEPARATE PRODUCTION APPROVAL.
--
-- It refuses unless mode is OFF, every non-seed forum table is empty, and the
-- non-null username fingerprint still matches installation time. It restores
-- the exact anon/authenticated profiles INSERT/UPDATE ACL snapshot.
-- ============================================================================
${sourceHashHeader}

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

-- Core object list derived from ${sources.coreRollback}
-- SOURCE SHA-256: ${sourceHashes.coreRollback}
${rollbackOperations.trim()}

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
`;

const readme = `# Forum v1 production installation package

Status: **prepared locally; not authorized for production execution**

Target operator check: Supabase project \`${targetProjectRef}\`.

SQL cannot read a Supabase project reference. The fail-closed database guard
therefore requires \`public.app_environment\` to exist with **zero rows**, the
production convention in this repository, and refuses any existing forum
object, case-insensitive username collision, or unsupported PUBLIC profile
write grant. The operator must still confirm the project reference in the
Supabase dashboard before any future run.

## Files and future run order

1. \`preflight.sql\` — read-only; run and retain every result row.
2. \`audit.sql\` — read-only existing-profile and ACL counts.
3. \`install.sql\` — first production mutation; requires a separate deliberate
   approval of its exact SHA-256 and a fresh, verified PITR/backup restore point.
4. \`postflight.sql\` — read-only after installation.

Do not run \`rollback.sql\` automatically. It is a separately destructive,
separately approved recovery action. It refuses unless mode remains \`off\`, all
forum activity tables are empty, and no non-null username changed after install.

## Atomicity and failure behavior

\`install.sql\` is one explicit transaction. The reviewed core, username claim,
moderation context and dismissal migrations have only their outer transaction
wrappers removed. Their guards and every reviewed postflight run before the
single COMMIT. Any assertion failure aborts the transaction; do not retry until
the error and database state are reviewed.

The package is deliberately non-idempotent. Do not add \`if not exists\` to the
installer. A rerun must fail on existing objects rather than guess at drift.

The install leaves \`forum_settings.mode = 'off'\`, creates no posts/comments/
votes/reports/moderation rows, and does not enable the frontend release flag.

## Rollback state

The username migration replaces broad profile INSERT/UPDATE grants with safe
column grants. \`forum_install_state\` privately snapshots the exact pre-install
anon/authenticated table and column ACLs, a fingerprint of existing non-null
usernames, and the installed topic configuration. Browser and service roles
receive no access to that table. The rollback restores and verifies the ACL
snapshot before dropping it, and refuses username or topic drift.

## Hash review

Re-run \`npm.cmd run build:forum-production\`, recompute every entry in
\`SHA256SUMS.txt\`, compare \`source_manifest.json\`, and review the full SQL.
The builder never reads credentials or connects to Supabase.

No frontend flag flip, deployment, forum-mode change, production fixture, or
HTTP write test is authorized by this package.
`;

const artifacts = {
  "preflight.sql": normalize(preflight),
  "audit.sql": normalize(audit),
  "install.sql": normalize(install),
  "postflight.sql": normalize(postflight),
  "rollback.sql": normalize(rollback),
  "README.md": normalize(readme),
};

mkdirSync(outputDir, { recursive: true });
for (const [name, value] of Object.entries(artifacts)) {
  writeFileSync(resolve(outputDir, name), value, "utf8");
}

const artifactHashes = Object.fromEntries(
  Object.entries(artifacts).map(([name, value]) => [name, sha256(value)]),
);
const manifest = {
  status: "prepared-only-not-authorized-for-production-execution",
  targetProjectRef,
  sourcePolicy: "exact reviewed bodies; outer transaction wrappers removed only inside atomic installer",
  generator: { path: generatorPath, sha256: sha256(read(generatorPath)) },
  sources: Object.fromEntries(Object.entries(sources).map(([name, path]) => [name, {
    path,
    sha256: sourceHashes[name],
  }])),
  artifacts: Object.fromEntries(Object.entries(artifactHashes).map(([name, hash]) => [name, {
    path: `production/forum_v1_release/${name}`,
    sha256: hash,
  }])),
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
writeFileSync(
  resolve(outputDir, "source_manifest.json"),
  manifestText,
  "utf8",
);
const reviewHashes = {
  ...artifactHashes,
  "source_manifest.json": sha256(manifestText),
};
const sums = Object.entries(reviewHashes)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, hash]) => `${hash}  ${name}`)
  .join("\n") + "\n";
writeFileSync(resolve(outputDir, "SHA256SUMS.txt"), sums, "utf8");

console.log(`Created ${outputDir}`);
for (const [name, hash] of Object.entries(artifactHashes)) console.log(`${hash}  ${name}`);
console.log("No database connection was made; production execution is not authorized.");
