import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => readFileSync(resolve(root, name), "utf8").trim();
const hardening = read("src/migrations/content_reports_hardening_v10.sql");
const preflight = read("src/migrations/content_reports_hardening_v10_preflight.sql");
const rollback = read("src/migrations/content_reports_hardening_v10_rollback.sql");

const guard = `-- Generated production wrapper. Data-preserving and transactional.
begin;

do $$
declare
  v_environment text;
begin
  if to_regclass('public.app_environment') is not null then
    execute 'select name from public.app_environment where id = true limit 1'
      into v_environment;
  end if;
  if v_environment in ('staging', 'test') then
    raise exception using errcode = '42501',
      message = 'refusing: target identifies as staging/test';
  end if;
  if to_regclass('public.content_reports') is null then
    raise exception 'content_reports table is missing';
  end if;
  if to_regclass('public.content_reports_id_seq') is null then
    raise exception 'content_reports identity sequence is missing';
  end if;
end;
$$;`;

const postflight = `
commit;

-- Every boolean below must be true. Environment should be unmarked-production-candidate.
select
  case
    when to_regclass('public.app_environment') is null
      then 'unmarked-production-candidate'
    else 'marked-non-staging-candidate'
  end as environment_after,
  (select count(*) from public.content_reports) as report_rows_after,
  not has_table_privilege('anon', 'public.content_reports', 'INSERT')
    as anon_insert_revoked,
  has_table_privilege('authenticated', 'public.content_reports', 'INSERT')
    as authenticated_insert_granted,
  not has_sequence_privilege('anon', 'public.content_reports_id_seq', 'USAGE')
    as anon_sequence_revoked,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_reports'
      and policyname = 'signed-in users report own'
      and roles = array['authenticated']::name[]
  ) as authenticated_policy_installed,
  not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'content_reports'
      and policyname = 'anyone reports'
  ) as legacy_policy_removed,
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.content_reports'::regclass
      and tgname = 'trg_enforce_content_report_submission'
      and not tgisinternal
  ) as hardening_trigger_installed;`;

const files = new Map([
  ["content_reports_v10_production_preflight.sql", `${preflight}\n`],
  ["content_reports_v10_production.sql", `${guard}\n\n${hardening}\n${postflight}\n`],
  ["content_reports_v10_production_rollback.sql", `${rollback}\n`],
]);

const manifest = [];
for (const [name, source] of files) {
  writeFileSync(resolve(root, name), source, "utf8");
  const hash = createHash("sha256").update(source).digest("hex");
  manifest.push(`${hash}  ${name}`);
  console.log(`✓ ${name} (${source.split(/\r?\n/).length} lines)`);
}
writeFileSync(
  resolve(root, "content_reports_v10_production.sha256.txt"),
  `${manifest.join("\n")}\n`,
  "utf8",
);
console.log("✓ content_reports_v10_production.sha256.txt");
