// Build a disposable-staging, rollback-always rehearsal for Forum v1.
// This script only reads local SQL and writes review artifacts. It never opens
// a database or reads environment credentials.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  preflight: "src/migrations/forum_v1_preflight.sql",
  core: "src/migrations/forum_v1.sql",
  postflight: "src/migrations/forum_v1_postflight.sql",
};
const outputDir = resolve(root, "staging/forum_v1_rehearsal");
const outputName = "rollback_rehearsal.sql";
const outputPath = resolve(outputDir, outputName);

const missing = Object.values(sources).filter((path) => !existsSync(resolve(root, path)));
if (missing.length > 0) throw new Error(`REFUSING: missing ${missing.join(", ")}`);

const normalize = (value) => value.replace(/\r\n/g, "\n").trimEnd() + "\n";
const read = (path) => normalize(readFileSync(resolve(root, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function unwrapTransaction(source, label) {
  const normalized = normalize(source);
  const beginMatch = /\nbegin(?: transaction read only)?;\n/i.exec(normalized);
  const begin = beginMatch?.index ?? -1;
  const commit = normalized.lastIndexOf("\ncommit;\n");
  if (begin === -1 || commit === -1 || commit <= begin) {
    throw new Error(`REFUSING: ${label} no longer has one reviewable transaction wrapper`);
  }
  const before = normalized.slice(0, begin);
  const body = normalized.slice(begin + beginMatch[0].length, commit);
  const after = normalized.slice(commit + "\ncommit;\n".length).trim();
  if (after) {
    throw new Error(`REFUSING: ${label} transaction structure drifted`);
  }
  return `${before}\n${body.trim()}\n`;
}

const preflight = read(sources.preflight);
const core = read(sources.core);
const postflight = read(sources.postflight);
const coreBody = unwrapTransaction(core, "forum_v1.sql");
const postflightBody = unwrapTransaction(postflight, "forum_v1_postflight.sql");
const coreHash = sha256(core);

const rehearsal = `-- ============================================================================
-- FORUM v1 ROLLBACK-ALWAYS STAGING REHEARSAL
-- DISPOSABLE STAGING ONLY. NEVER RUN ON PRODUCTION.
--
-- Exact core SHA-256: ${coreHash}
-- Generated from the reviewed preflight, core and postflight sources.
-- The core/postflight transaction wrappers are removed only so this entire
-- rehearsal can end in one unconditional ROLLBACK.
--
-- Requirements:
--   * public.app_environment has exactly the staging marker
--   * at least one existing admin profile linked to auth.users
--   * at least four non-admin profiles linked to auth.users and older than 10m
--
-- The selected usernames are changed only inside this transaction. Every
-- schema object, fixture row, username change and forum action is rolled back.
-- If the SQL client stops on an error, execute ROLLBACK immediately.
-- ============================================================================

-- Exact read-only preflight runs before the rehearsal transaction.
${preflight}

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $forum_stage_guard$
declare environment_count integer;
begin
  if to_regclass('public.app_environment') is null then
    raise exception 'REFUSING: app_environment is missing';
  end if;
  select count(*) into environment_count
  from public.app_environment where id = true and lower(name) = 'staging';
  if environment_count <> 1 then
    raise exception 'REFUSING: forum rehearsal requires exactly one staging marker';
  end if;
  if to_regclass('public.forum_posts') is not null then
    raise exception 'REFUSING: forum objects already exist';
  end if;
end;
$forum_stage_guard$;

-- Exact reviewed core, with only its outer BEGIN/COMMIT removed.
-- SOURCE SHA-256: ${coreHash}
${coreBody}

-- Exact structural postflight, inside the rollback-always transaction.
${postflightBody}

-- Select real, existing staging identities. No auth.users row is manufactured;
-- the rehearsal refuses if staging has not been provisioned adequately.
do $forum_stage_identities$
declare
  admin_id uuid;
  students uuid[];
begin
  select p.id into admin_id
  from public.profiles p join auth.users u on u.id = p.id
  where p.is_admin is true
  order by p.created_at, p.id
  limit 1;

  select array_agg(id order by created_at, id) into students
  from (
    select p.id, u.created_at
    from public.profiles p join auth.users u on u.id = p.id
    where coalesce(p.is_admin, false) is false
      and u.created_at <= now() - interval '10 minutes'
      and p.id is distinct from admin_id
    order by u.created_at, p.id
    limit 4
  ) candidates;

  if admin_id is null then
    raise exception 'REFUSING: staging needs one admin profile';
  end if;
  if coalesce(cardinality(students), 0) <> 4 then
    raise exception 'REFUSING: staging needs four non-admin users older than 10 minutes';
  end if;

  perform set_config('forum_stage.admin', admin_id::text, true);
  perform set_config('forum_stage.author', students[1]::text, true);
  perform set_config('forum_stage.voter', students[2]::text, true);
  perform set_config('forum_stage.reporter2', students[3]::text, true);
  perform set_config('forum_stage.reporter3', students[4]::text, true);

  -- Prove the username blocker without requiring persistent staging profile
  -- changes. reporter3 stays username-less for the negative test and can still
  -- file a safety report; the other three get valid transaction-local handles.
  update public.profiles
  set username = 'fs_' || right(replace(id::text, '-', ''), 27)
  where id = any(students[1:3]);
  update public.profiles set username = null where id = students[4];
end;
$forum_stage_identities$;

-- Security-invoker helpers catch expected failures while preserving the real
-- caller role. They are temporary in effect because the outer transaction
-- always rolls back.
create function public.__forum_stage_direct_table_denied()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1 from public.forum_posts limit 1;
  raise exception 'ROLE TEST: direct forum_posts SELECT unexpectedly succeeded';
exception when insufficient_privilege then
  return true;
end;
$$;
revoke all on function public.__forum_stage_direct_table_denied() from public;
grant execute on function public.__forum_stage_direct_table_denied() to anon, authenticated;

create function public.__forum_stage_username_gate()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.forum_create_post(
    'physics', 'This title should not be accepted', 'The profile has no username.'
  );
  raise exception 'USERNAME TEST: username-less publishing unexpectedly succeeded';
exception when sqlstate '22023' then
  if sqlerrm not like 'choose a 3 to 30 character username%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_username_gate() from public;
grant execute on function public.__forum_stage_username_gate() to authenticated;

create function public.__forum_stage_read_only_gate()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.forum_create_post(
    'physics', 'This title should be blocked in read only', 'Read only must reject publishing.'
  );
  raise exception 'MODE TEST: read-only publishing unexpectedly succeeded';
exception when sqlstate '55000' then
  if sqlerrm not like 'forum is not open%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_read_only_gate() from public;
grant execute on function public.__forum_stage_read_only_gate() to authenticated;

create function public.__forum_stage_cursor_gate(p_post_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform * from public.get_forum_feed(
    p_sort => 'hot', p_cursor_created_at => now(), p_cursor_id => p_post_id
  );
  raise exception 'CURSOR TEST: incomplete cursor unexpectedly succeeded';
exception when sqlstate '22023' then
  if sqlerrm not like 'incomplete forum cursor%' then raise; end if;
  return true;
end;
$$;
revoke all on function public.__forum_stage_cursor_gate(bigint) from public;
grant execute on function public.__forum_stage_cursor_gate(bigint) to anon, authenticated;

-- Real authenticated role + admin JWT claims: open the transaction-local forum.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_admin_set_mode('open') as opened_mode;
reset role;

-- Real authenticated role + username-less student: publishing is rejected by
-- the hard database gate even though EXECUTE is granted.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter3'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.__forum_stage_username_gate() as username_gate_passed;
reset role;

do $forum_stage_username_assert$
begin
  if current_setting('request.jwt.claim.sub') <> current_setting('forum_stage.reporter3') then
    raise exception 'USERNAME TEST: JWT subject drifted';
  end if;
end;
$forum_stage_username_assert$;

-- Real authenticated author creates two posts, including literal LIKE symbols.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.author'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config(
  'forum_stage.post_id',
  public.forum_create_post(
    'physics',
    'Why does the normal force become zero?',
    'I understand the equation, but not the physical reason.'
  )::text,
  true
);
select public.forum_create_post(
  'mathematics',
  'Understanding a literal 100% result',
  'What does 100%_complete mean in C:\\notes?'
) as search_fixture_post;
select set_config(
  'forum_stage.comment_id',
  public.forum_create_comment(
    current_setting('forum_stage.post_id')::bigint,
    null,
    'The track can push but it cannot pull the object.'
  )::text,
  true
);
reset role;

-- Real authenticated voter exercises RPC grant, auth.uid(), vote trigger and
-- private viewer state. Direct table access must still fail.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.voter'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select * from public.forum_cast_vote(
  'post', current_setting('forum_stage.post_id')::bigint, 1::smallint
);
select public.__forum_stage_direct_table_denied() as authenticated_table_denied;
reset role;

-- Real anonymous role can use only the public read RPCs. Search metacharacters
-- are literal, not wildcard operators, and incomplete cursors fail clearly.
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
select count(*) as anonymous_topic_count from public.get_forum_topics();
select count(*) as anonymous_feed_count from public.get_forum_feed();
select count(*) as literal_percent_matches from public.get_forum_feed(p_query => '%');
select count(*) as literal_underscore_matches from public.get_forum_feed(p_query => '_complete');
select count(*) as literal_backslash_matches from public.get_forum_feed(p_query => 'C:\\notes');
select public.__forum_stage_cursor_gate(current_setting('forum_stage.post_id')::bigint)
  as incomplete_cursor_rejected;
select public.__forum_stage_direct_table_denied() as anonymous_table_denied;
reset role;

do $forum_stage_read_assert$
declare
  percent_count integer;
  underscore_count integer;
  slash_count integer;
begin
  select count(*) into percent_count from public.get_forum_feed(p_query => '%');
  select count(*) into underscore_count from public.get_forum_feed(p_query => '_complete');
  select count(*) into slash_count from public.get_forum_feed(p_query => 'C:\\notes');
  if percent_count <> 1 or underscore_count <> 1 or slash_count <> 1 then
    raise exception 'SEARCH TEST: literal LIKE escaping failed (%%, _, \\) = (%, %, %)',
      percent_count, underscore_count, slash_count;
  end if;
end;
$forum_stage_read_assert$;

-- Three distinct authenticated reporters trigger auto-hide. The fourth user
-- deliberately has no username, proving reports remain a safety action rather
-- than a publishing privilege.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.voter'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter2'), true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;
select set_config('request.jwt.claim.sub', current_setting('forum_stage.reporter3'), true);
set local role authenticated;
select public.forum_submit_report('post', current_setting('forum_stage.post_id')::bigint, 'spam', null);
reset role;

-- Admin verifies the queue, counters and karma, restores the auto-hidden post,
-- then switches to read-only for the final role test.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select count(*) as admin_pending_reports from public.forum_admin_list_reports();
select count(*) as score_drift_rows from public.forum_recount_metrics(false);
select count(*) as karma_drift_rows from public.forum_recount_karma(false);
select public.forum_admin_moderate(
  'post', current_setting('forum_stage.post_id')::bigint,
  'unhide', 'staging rehearsal restore', null
);
select public.forum_admin_set_mode('read_only') as read_only_mode;
reset role;

-- Real authenticated role is now read-only, while the post remains readable.
select set_config('request.jwt.claim.sub', current_setting('forum_stage.author'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select public.__forum_stage_read_only_gate() as read_only_write_blocked;
select count(*) as authenticated_read_rows
from public.get_forum_post(current_setting('forum_stage.post_id')::bigint);
reset role;

select set_config('request.jwt.claim.sub', current_setting('forum_stage.admin'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
do $forum_stage_final_assert$
begin
  if (select score from public.forum_posts
      where id = current_setting('forum_stage.post_id')::bigint) <> 1 then
    raise exception 'VOTE TEST: expected score 1';
  end if;
  if (select count(*) from public.forum_reports
      where target_type = 'post'
        and target_id = current_setting('forum_stage.post_id')::bigint) <> 3 then
    raise exception 'REPORT TEST: expected three distinct reports';
  end if;
  if exists (select 1 from public.forum_recount_metrics(false))
     or exists (select 1 from public.forum_recount_karma(false)) then
    raise exception 'RECOUNT TEST: metric drift detected';
  end if;
  if public.forum_mode() <> 'read_only' then
    raise exception 'MODE TEST: expected read_only';
  end if;
  if (select count(*) from public.get_forum_topics()) <> 6 then
    raise exception 'ROLE TEST: expected six readable topics';
  end if;
end;
$forum_stage_final_assert$;

-- The only terminal action for a successful rehearsal.
rollback;

-- These checks run after rollback against the restored staging database.
select
  (select name from public.app_environment where id = true) as environment_after,
  to_regclass('public.forum_posts') is null as forum_posts_removed,
  to_regclass('public.forum_votes') is null as forum_votes_removed,
  to_regprocedure('public.forum_create_post(text,text,text)') is null as forum_rpcs_removed;
`;

const readme = `# Forum v1 disposable-staging rehearsal

This package is rollback-only. It does not authorize a persistent staging or
production installation.

## Preconditions

- Use a disposable Supabase staging project marked by
  \`public.app_environment(id=true, name='staging')\`.
- The staging project must already contain one admin profile and four non-admin
  users older than ten minutes. The SQL refuses to manufacture auth users.
- Stop site traffic to this disposable project while the single transaction is
  running.

The rehearsal assigns temporary usernames to three selected users and clears a
fourth username to test the hard claim gate. The final \`ROLLBACK\` restores all
of them.

If the disposable clone is empty, the separately reviewed
\`provision_test_accounts.sql\` creates the required five non-login
\`@staging.invalid\` fixtures. Run \`teardown_test_accounts.sql\` immediately
after the successful rehearsal. Both scripts carry an independent staging
guard; neither contains or requires a service-role credential in the file.

## Run

1. Verify \`rollback_rehearsal.sha256.txt\` against \`rollback_rehearsal.sql\`.
2. Paste the entire SQL file into the disposable staging SQL editor as one run.
3. If any statement errors or the client stops, execute \`rollback;\` immediately
   in the same SQL editor session.
4. A successful run ends with one row where:
   - \`environment_after = staging\`
   - \`forum_posts_removed = true\`
   - \`forum_votes_removed = true\`
   - \`forum_rpcs_removed = true\`

If that final row is not all true, the schema persisted. Do not retry the
rehearsal. Run the guarded \`src/migrations/forum_v1_rollback.sql\`, then verify
whether the SQL client honours explicit multi-statement transactions before
doing anything else.

The first real-project refusal and subsequent staging runs are recorded in
\`REAL_STAGING_NOTES.md\`.

## What it proves

- The reviewed migration and postflight execute on staging-shaped PostgreSQL.
- The real \`authenticated\` and \`anon\` database roles can reach only their
  granted RPCs.
- \`auth.uid()\` ownership, username gate, voting, literal search, cursor
  validation, reports, auto-hide, moderation, recounts and read-only mode work.
- Browser roles cannot select forum base tables.
- The complete transaction restores the original staging state.

## Feed cursor contract

\`p_cursor_id\` marks a cursor as present. Such a cursor must also supply
\`p_cursor_created_at\`; Hot additionally requires \`p_cursor_hot\`, and Top
additionally requires \`p_cursor_score\`. New needs no rank or score field.
Incomplete cursors raise an error instead of returning an unexplained empty
page.

## What it cannot prove

Because uncommitted schema is invisible to PostgREST connections and the whole
package rolls back, this rehearsal cannot test a real HTTP JWT through
PostgREST. That requires a later, explicitly approved persistent staging
installation plus dedicated test accounts. Do not describe this rollback-only
rehearsal as an end-to-end API test.

## Launch blocker carried forward

The database correctly refuses publishing without \`profiles.username\`. The
application still needs a username-claim flow, reserved-name rules, uniqueness
error handling, and a reviewed backfill/claim strategy for existing profiles
before forum writing can launch.
`;

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, normalize(rehearsal), "utf8");
const digest = sha256(readFileSync(outputPath));
writeFileSync(resolve(outputDir, "rollback_rehearsal.sha256.txt"), `${digest}  ${outputName}\n`, "utf8");
writeFileSync(resolve(outputDir, "README.md"), readme, "utf8");
writeFileSync(resolve(outputDir, "source_manifest.json"), `${JSON.stringify({
  status: "rollback-only-not-authorized-for-persistent-apply",
  generatedAt: new Date().toISOString(),
  sources: {
    preflight: { path: sources.preflight, sha256: sha256(preflight) },
    core: { path: sources.core, sha256: coreHash },
    postflight: { path: sources.postflight, sha256: sha256(postflight) },
  },
  artifact: { path: `staging/forum_v1_rehearsal/${outputName}`, sha256: digest },
}, null, 2)}\n`, "utf8");

console.log(`Created ${outputPath}`);
console.log(`SHA-256 ${digest}`);
console.log("No database connection was made; artifact always ends with ROLLBACK.");
