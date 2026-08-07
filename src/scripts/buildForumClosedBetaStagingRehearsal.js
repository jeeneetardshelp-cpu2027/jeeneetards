// Build a rollback-always staging rehearsal for the forum closed-beta delta.
// This script reads local SQL and writes review artifacts only. It never opens
// a database connection or reads credentials.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  preflight: "src/migrations/forum_closed_beta_v1_preflight.sql",
  audit: "src/migrations/forum_closed_beta_v1_audit.sql",
  migration: "src/migrations/forum_closed_beta_v1.sql",
  postflight: "src/migrations/forum_closed_beta_v1_postflight.sql",
  rollback: "src/migrations/forum_closed_beta_v1_rollback.sql",
};
const outputDir = resolve(root, "staging/forum_closed_beta_v1_rehearsal");
const outputName = "rollback_rehearsal.sql";
const outputPath = resolve(outputDir, outputName);

const missing = Object.values(sources).filter((path) => !existsSync(resolve(root, path)));
if (missing.length > 0) throw new Error(`REFUSING: missing ${missing.join(", ")}`);

const normalize = (value) => value.replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (path) => normalize(readFileSync(resolve(root, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function unwrapTransaction(source, label, terminator) {
  const normalized = normalize(source);
  const beginMatch = /\nbegin(?: transaction read only)?;\n/i.exec(normalized);
  const begin = beginMatch?.index ?? -1;
  const closing = `\n${terminator};\n`;
  const end = normalized.lastIndexOf(closing);
  if (begin === -1 || end === -1 || end <= begin) {
    throw new Error(`REFUSING: ${label} no longer has one reviewable transaction wrapper`);
  }
  if (normalized.slice(end + closing.length).trim()) {
    throw new Error(`REFUSING: ${label} transaction structure drifted`);
  }
  return `${normalized.slice(0, begin)}\n${normalized
    .slice(begin + beginMatch[0].length, end)
    .trim()}\n`;
}

const sourceText = Object.fromEntries(
  Object.entries(sources).map(([key, path]) => [key, read(path)]),
);
const migrationBody = unwrapTransaction(sourceText.migration, sources.migration, "commit");
const postflightBody = unwrapTransaction(sourceText.postflight, sources.postflight, "rollback");
const migrationHash = sha256(sourceText.migration);

const rehearsal = `-- ============================================================================
-- FORUM CLOSED-BETA v1 ROLLBACK-ALWAYS STAGING REHEARSAL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Exact migration SHA-256: ${migrationHash}
-- Generated from pinned preflight, audit, migration and postflight sources.
-- The migration/postflight wrappers are removed only so the complete delta,
-- role checks and fixtures can end in one unconditional ROLLBACK.
-- ============================================================================

-- Exact read-only gates run before the rehearsal transaction.
${sourceText.preflight}
${sourceText.audit}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $forum_beta_stage_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and lower(name) = 'staging';
  if environment_count <> 1 then
    raise exception 'REFUSING: beta rehearsal requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_posts') is null
     or to_regprocedure('public.forum_claim_username(text)') is null
     or to_regprocedure('public.forum_admin_dismiss_report(bigint)') is null then
    raise exception 'REFUSING: reviewed persistent forum baseline is incomplete';
  end if;
  if to_regclass('public.forum_beta_members') is not null then
    raise exception 'REFUSING: closed-beta delta is already installed';
  end if;
  if public.forum_mode() <> 'off' then
    raise exception 'REFUSING: forum mode must be off';
  end if;
  if exists (select 1 from public.forum_posts)
     or exists (select 1 from public.forum_comments)
     or exists (select 1 from public.forum_reports) then
    raise exception 'REFUSING: beta rehearsal requires an empty disposable forum';
  end if;
end;
$forum_beta_stage_guard$;

-- Exact reviewed migration, with only its outer BEGIN/COMMIT removed.
-- SOURCE SHA-256: ${migrationHash}
${migrationBody}

-- Exact structural postflight inside the rollback-always transaction.
${postflightBody}

do $forum_beta_stage_identities$
declare
  admin_id uuid;
  students uuid[];
begin
  select p.id into admin_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_admin is true
  order by p.created_at, p.id limit 1;

  select array_agg(id order by created_at, id) into students
  from (
    select p.id, u.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p.is_admin, false) is false
      and u.created_at <= now() - interval '10 minutes'
      and p.id is distinct from admin_id
    order by u.created_at, p.id limit 2
  ) candidates;

  if admin_id is null then
    raise exception 'REFUSING: staging needs one admin profile';
  end if;
  if coalesce(cardinality(students), 0) <> 2 then
    raise exception 'REFUSING: staging needs two non-admin users older than 10 minutes';
  end if;

  perform set_config('forum_beta_stage.admin', admin_id::text, true);
  perform set_config('forum_beta_stage.member', students[1]::text, true);
  perform set_config('forum_beta_stage.outsider', students[2]::text, true);
  update public.profiles
  set username = case id
    when admin_id then 'cba_' || right(replace(id::text, '-', ''), 26)
    when students[1] then 'cbm_' || right(replace(id::text, '-', ''), 26)
    else 'cbo_' || right(replace(id::text, '-', ''), 26)
  end
  where id = admin_id or id = any(students);
  perform set_config(
    'forum_beta_stage.member_username',
    (select username from public.profiles where id = students[1]), true
  );
  perform set_config(
    'forum_beta_stage.outsider_username',
    (select username from public.profiles where id = students[2]), true
  );
end;
$forum_beta_stage_identities$;

create function public.__forum_beta_stage_write_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_create_post(
    'physics', 'This non-member post must be rejected',
    'The closed beta writer gate must reject this body.'
  );
  raise exception 'BETA TEST: non-member publishing unexpectedly succeeded';
exception when sqlstate '42501' then
  if sqlerrm not like 'closed beta access is required%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_write_denied() from public;
grant execute on function public.__forum_beta_stage_write_denied() to authenticated;

create function public.__forum_beta_stage_read_only_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_create_post(
    'physics', 'This member post must be paused',
    'Read only mode must still reject a beta member.'
  );
  raise exception 'BETA TEST: read-only publishing unexpectedly succeeded';
exception when sqlstate '55000' then
  if sqlerrm not like 'forum is not open%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_read_only_denied() from public;
grant execute on function public.__forum_beta_stage_read_only_denied() to authenticated;

create function public.__forum_beta_stage_admin_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform public.forum_admin_set_beta_member(
    current_setting('forum_beta_stage.outsider_username'), true
  );
  raise exception 'BETA TEST: non-admin membership mutation unexpectedly succeeded';
exception when sqlstate '42501' then
  if sqlerrm not like 'not authorized%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_beta_stage_admin_denied() from public;
grant execute on function public.__forum_beta_stage_admin_denied() to authenticated;

create function public.__forum_beta_stage_table_denied()
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.forum_beta_members limit 1;
  raise exception 'BETA TEST: direct membership table read unexpectedly succeeded';
exception when insufficient_privilege then return true;
end;
$$;
revoke all on function public.__forum_beta_stage_table_denied() from public;
grant execute on function public.__forum_beta_stage_table_denied() to authenticated;

-- Admin enrolls one student and opens only the closed beta.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_beta_member(
  current_setting('forum_beta_stage.member_username'), true
) as member_enabled;
select public.forum_admin_set_mode('beta') as beta_mode;
reset role;

-- Member publishes successfully.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.member'), true);
set local role authenticated;
select set_config(
  'forum_beta_stage.post_id',
  public.forum_create_post(
    'physics', 'Closed beta force question',
    'I drew the free-body diagram and need help checking the direction.'
  )::text, true
);
select public.forum_create_comment(
  current_setting('forum_beta_stage.post_id')::bigint, null,
  'This member comment proves the shared writer gate.'
) as member_comment;
reset role;

-- Non-member cannot publish or administer membership, cannot read the private
-- table, but can still submit an authenticated safety report.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.outsider'), true);
set local role authenticated;
select public.forum_is_beta_member() as outsider_is_member;
select public.__forum_beta_stage_write_denied() as outsider_write_denied;
select public.__forum_beta_stage_admin_denied() as outsider_admin_denied;
select public.__forum_beta_stage_table_denied() as outsider_table_denied;
select public.forum_submit_report(
  'post', current_setting('forum_beta_stage.post_id')::bigint,
  'other', 'Safety reporting remains available during beta.'
) as outsider_report;
reset role;

-- Anonymous reading remains available, but anonymous beta RPC execution does not.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select count(*) as anonymous_topics from public.get_forum_topics();
select count(*) as anonymous_feed_rows from public.get_forum_feed();
reset role;

-- Open mode deliberately retains later public-write behavior.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_mode('open') as open_mode;
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.outsider'), true);
set local role authenticated;
select public.forum_create_post(
  'mathematics', 'Open mode control question',
  'This succeeds only to prove public mode still has its reviewed meaning.'
) as outsider_open_post;
reset role;

-- Read-only mode still pauses enrolled beta members.
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
set local role authenticated;
select public.forum_admin_set_mode('read_only') as read_only_mode;
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.member'), true);
set local role authenticated;
select public.__forum_beta_stage_read_only_denied() as member_read_only_denied;
reset role;

select set_config('request.jwt.claim.sub', current_setting('forum_beta_stage.admin'), true);
set local role authenticated;
select public.forum_admin_set_mode('off') as restored_mode;
reset role;

do $forum_beta_stage_final_assert$
begin
  if public.forum_mode() <> 'off' then
    raise exception 'BETA TEST: expected mode off before rollback';
  end if;
  if (select count(*) from public.forum_beta_members) <> 1 then
    raise exception 'BETA TEST: expected exactly one beta member';
  end if;
  if (select count(*) from public.forum_posts) <> 2
     or (select count(*) from public.forum_comments) <> 1
     or (select count(*) from public.forum_reports) <> 1 then
    raise exception 'BETA TEST: fixture counts drifted';
  end if;
  if (select count(*) from public.forum_moderation_log where action = 'beta_add') <> 1 then
    raise exception 'BETA TEST: membership audit row missing';
  end if;
  if has_function_privilege('anon', 'public.forum_is_beta_member()', 'execute') then
    raise exception 'BETA TEST: anonymous membership execution leaked';
  end if;
end;
$forum_beta_stage_final_assert$;

-- The only terminal action for a successful rehearsal.
rollback;

-- All fields in this final row must be true.
select
  (select lower(name) = 'staging' from public.app_environment where id = true)
    as environment_is_staging,
  to_regclass('public.forum_beta_members') is null as beta_table_removed,
  to_regprocedure('public.forum_is_beta_member()') is null as beta_check_removed,
  to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is null
    as beta_admin_removed,
  public.forum_mode() = 'off' as forum_mode_restored,
  not exists (select 1 from public.forum_posts) as no_posts_created,
  not exists (select 1 from public.forum_reports) as no_reports_created;
`;

const readme = `# Forum closed-beta v1 disposable-staging rehearsal

This package is rollback-only. It does not authorize a persistent staging or
production installation, beta membership provisioning, or a mode change.

## Preconditions

- Use only a disposable Supabase staging clone marked by
  \`public.app_environment(id=true, name='staging')\`.
- The reviewed persistent Forum v1, username claim, moderation context, and
  report-dismissal packages must already be installed with forum mode \`off\`.
- The forum must contain no posts, comments, or reports.
- The clone needs one admin and two non-admin accounts older than ten minutes.
- Stop traffic to the disposable project for the duration of the rehearsal.

If the disposable clone is empty, use the separately reviewed
\`staging/forum_v1_rehearsal/provision_test_accounts.sql\` first. It creates
five non-login \`@staging.invalid\` fixtures behind its own staging guard. Run
the paired \`teardown_test_accounts.sql\` immediately after this rehearsal and
confirm both fixture-removal fields are true. Neither credential nor a service
role key belongs in this package.

## Run

1. Recompute and compare \`rollback_rehearsal.sha256.txt\`.
2. Paste the complete \`rollback_rehearsal.sql\` into the staging SQL editor.
3. Run it once as one buffer. If any assertion errors, stop and report it; do
   not edit around the failure.
4. Confirm the final result row has seven fields and every field is \`true\`.
5. If fixtures were provisioned, run the paired teardown and verify its final
   removal row before leaving the staging project.

If any final field is false, the delta persisted. Do not retry. Run the guarded
\`forum_closed_beta_v1_rollback.sql\` and verify that the SQL client honours
explicit transactions before doing anything else.

## What it proves

- The pinned delta installs over the reviewed persistent forum baseline.
- Real \`authenticated\` and \`anon\` PostgreSQL roles exercise the grants.
- A beta member writes while a non-member is denied.
- The non-member can still submit a safety report.
- Non-admin membership changes and direct table access are denied.
- Anonymous reads, open-mode compatibility, and read-only pausing still work.
- One final \`ROLLBACK\` restores the original schema, data, usernames and mode.

## What it cannot prove

The uncommitted schema is invisible to separate PostgREST connections. Real
HTTP JWT proof requires a later reviewed persistent staging install and guarded
test accounts. Nothing in this package authorizes that remote step.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, normalize(rehearsal), "utf8");
const artifactHash = sha256(readFileSync(outputPath));
writeFileSync(
  resolve(outputDir, "rollback_rehearsal.sha256.txt"),
  `${artifactHash}  ${outputName}\n`,
  "utf8",
);
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");
writeFileSync(
  resolve(outputDir, "source_manifest.json"),
  `${JSON.stringify({
    status: "rollback-only-not-authorized-for-persistent-apply",
    generatedAt: new Date().toISOString(),
    sources: Object.fromEntries(Object.entries(sources).map(([key, path]) => [key, {
      path,
      sha256: sha256(sourceText[key]),
    }])),
    artifact: {
      path: `staging/forum_closed_beta_v1_rehearsal/${outputName}`,
      sha256: artifactHash,
    },
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Created ${outputPath}`);
console.log(`SHA-256 ${artifactHash}`);
console.log("No database connection was made; artifact always ends with ROLLBACK.");
