import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_v1_release";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const preflight = read("preflight.sql");
const audit = read("audit.sql");
const install = read("install.sql");
const postflight = read("postflight.sql");
const rollback = read("rollback.sql");
const readme = read("README.md");
const sums = read("SHA256SUMS.txt").trim().split("\n");
const manifest = JSON.parse(read("source_manifest.json"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function transactionBody(value) {
  const lines = value.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const begin = lines.findIndex((line) => /^begin(?: transaction read only)?;$/i.test(line.trim()));
  const end = lines.findLastIndex((line) => /^(?:commit|rollback);$/i.test(line.trim()));
  return `${lines.slice(0, begin).join("\n").trim()}\n${lines.slice(begin + 1, end).join("\n").trim()}`;
}

const artifactNames = [
  "audit.sql", "install.sql", "postflight.sql", "preflight.sql", "README.md", "rollback.sql",
];

async function productionShapedDatabase({ marker = null } = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      raw_app_meta_data jsonb,
      created_at timestamptz not null default now()
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique,
      full_name text,
      avatar_url text,
      is_admin boolean not null default false,
      created_at timestamptz not null default now()
    );
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
      )
    $$;
    create table public.app_environment (
      id boolean primary key default true check (id),
      name text not null check (name in ('production','staging','test'))
    );
    grant select (id, username, full_name, avatar_url, created_at)
      on table public.profiles to anon, authenticated;
    grant insert, update on table public.profiles to anon, authenticated;
    insert into auth.users (id, email, created_at)
      values ('30000000-0000-4000-8000-000000000001', 'existing@example.invalid', now() - interval '1 day');
    insert into public.profiles (id, username, full_name, is_admin)
      values ('30000000-0000-4000-8000-000000000001', 'Existing_Student', 'Existing student', true);
  `);
  if (marker) {
    await pg.query("insert into public.app_environment (id, name) values (true, $1)", [marker]);
  }
  return pg;
}

describe("Forum v1 production package", () => {
  it("pins every source and artifact hash without carrying a credential", () => {
    expect(manifest.status).toBe("prepared-only-not-authorized-for-production-execution");
    expect(manifest.targetProjectRef).toBe("kezelafqhgqrprpadmlf");
    expect(manifest.generator).toEqual({
      path: "src/scripts/buildForumV1ProductionPackage.js",
      sha256: sha256(readFileSync("src/scripts/buildForumV1ProductionPackage.js", "utf8")
        .replace(/\r\n/g, "\n").trimEnd() + "\n"),
    });
    expect(sums).toHaveLength(artifactNames.length + 1);
    expect(sums).toContain(`${sha256(read("source_manifest.json"))}  source_manifest.json`);

    for (const name of artifactNames) {
      const value = read(name);
      const hash = sha256(value);
      expect(sums).toContain(`${hash}  ${name}`);
      expect(manifest.artifacts[name]).toEqual({
        path: `${directory}/${name}`,
        sha256: hash,
      });
    }
    for (const source of Object.values(manifest.sources)) {
      expect(sha256(readFileSync(source.path, "utf8").replace(/\r\n/g, "\n").trimEnd() + "\n"))
        .toBe(source.sha256);
    }
    for (const value of [preflight, audit, install, postflight, rollback, readme]) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
      expect(value).not.toMatch(/service[_-]?role[_-]?(?:key|secret)\s*=/i);
      expect(value).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
  });

  it("keeps the installer atomic, non-idempotent, guarded, empty, and off", () => {
    expect(install.match(/^begin;$/gm)).toHaveLength(1);
    expect(install.match(/^commit;$/gm)).toHaveLength(1);
    expect(install).not.toMatch(/create\s+(?:table|index|function)[\s\S]{0,80}\bif\s+not\s+exists\b/i);
    const guard = install.indexOf("forum production install requires the empty production environment marker");
    const firstDdl = install.indexOf("create table public.forum_settings");
    expect(guard).toBeGreaterThan(-1);
    expect(firstDdl).toBeGreaterThan(guard);
    expect(install).toContain("insert into public.forum_settings (id, mode) values (true, 'off')");
    expect(install).toContain("create table public.forum_install_state");
    expect(install).toContain("revoke all on table public.forum_install_state from public, anon, authenticated, service_role");
    expect(install).toContain("drop function public.forum_admin_list_reports(integer)");
    expect(install).toContain("create function public.forum_admin_dismiss_report");
    expect(install).toContain("All reviewed postflights run before COMMIT");
  });

  it("embeds every approved transactional body without rewriting it", () => {
    for (const key of [
      "coreMigration",
      "usernamePreflight", "usernameMigration",
      "moderationPreflight", "moderationMigration",
      "dismissalPreflight", "dismissalMigration",
      "corePostflight", "usernamePostflight", "moderationPostflight", "dismissalPostflight",
    ]) {
      const source = readFileSync(manifest.sources[key].path, "utf8");
      expect(install).toContain(transactionBody(source));
    }
    expect(preflight).toContain(readFileSync(manifest.sources.corePreflight.path, "utf8").trim());
    expect(audit).toContain(readFileSync(manifest.sources.usernameAudit.path, "utf8").trim());
    for (const key of [
      "corePostflight", "usernamePostflight", "moderationPostflight", "dismissalPostflight",
    ]) {
      expect(postflight).toContain(readFileSync(manifest.sources[key].path, "utf8").trim());
    }
  });

  it("installs all four reviewed layers and restores the exact profile ACL on rollback", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      await pg.exec(install);
      await pg.exec(postflight);

      let state = await pg.query(`
        select
          public.forum_mode() as mode,
          (select count(*)::integer from public.forum_topics where is_active) as topics,
          to_regprocedure('public.forum_claim_username(text)') is not null as claim,
          to_regprocedure('public.forum_admin_list_reports(integer)') is not null as context,
          to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as dismissal,
          has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as broad_profile_update,
          has_column_privilege('authenticated', 'public.profiles', 'username', 'UPDATE') as username_update,
          has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') as full_name_update
      `);
      expect(state.rows[0]).toEqual({
        mode: "off",
        topics: 6,
        claim: true,
        context: true,
        dismissal: true,
        broad_profile_update: false,
        username_update: false,
        full_name_update: true,
      });

      await pg.exec(rollback);
      state = await pg.query(`
        select
          to_regclass('public.forum_settings') as settings,
          to_regclass('public.forum_install_state') as install_state,
          to_regprocedure('public.forum_claim_username(text)') as claim,
          has_table_privilege('anon', 'public.profiles', 'INSERT') as anon_insert,
          has_table_privilege('anon', 'public.profiles', 'UPDATE') as anon_update,
          has_table_privilege('authenticated', 'public.profiles', 'INSERT') as auth_insert,
          has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as auth_update
      `);
      expect(state.rows[0]).toEqual({
        settings: null,
        install_state: null,
        claim: null,
        anon_insert: true,
        anon_update: true,
        auth_insert: true,
        auth_update: true,
      });
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("refuses a marked clone before the first forum object is created", async () => {
    const pg = await productionShapedDatabase({ marker: "staging" });
    try {
      await expect(pg.exec(install)).rejects.toThrow(/empty production environment marker/i);
      await pg.exec("rollback");
      const state = await pg.query("select to_regclass('public.forum_settings') as settings");
      expect(state.rows[0].settings).toBeNull();
    } finally {
      await pg.close();
    }
  });

  it("refuses unsupported PUBLIC profile write grants before creating forum objects", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec("grant update on table public.profiles to public");
      await expect(pg.exec(install)).rejects.toThrow(/cannot safely snapshot PUBLIC profile write grants/i);
      await pg.exec("rollback");
      const state = await pg.query("select to_regclass('public.forum_settings') as settings");
      expect(state.rows[0].settings).toBeNull();
    } finally {
      await pg.close();
    }
  });

  it("refuses rollback after content or a username claim appears", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(install);
      await pg.exec(`
        insert into public.forum_posts (topic_id, author_id, title, body)
        select id, null, 'Rollback must refuse this post', 'A real discussion now exists.'
        from public.forum_topics where slug = 'physics';
      `);
      await expect(pg.exec(rollback)).rejects.toThrow(/found forum activity/i);
      await pg.exec("rollback");
      expect((await pg.query("select count(*)::integer as count from public.forum_posts")).rows[0].count)
        .toBe(1);

      await pg.exec("delete from public.forum_posts");
      await pg.exec("update public.profiles set username = 'Changed_After_Install' where is_admin");
      await expect(pg.exec(rollback)).rejects.toThrow(/username changes after installation/i);
      await pg.exec("rollback");
      expect((await pg.query("select public.forum_mode() as mode")).rows[0].mode).toBe("off");
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("refuses rollback after the installed topic configuration changes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(install);
      await pg.exec("update public.forum_topics set is_active = false where slug = 'physics'");
      await expect(pg.exec(rollback)).rejects.toThrow(/forum topic changes after installation/i);
      await pg.exec("rollback");
      expect((await pg.query("select count(*)::integer as count from public.forum_topics where is_active"))
        .rows[0].count).toBe(5);
    } finally {
      await pg.close();
    }
  }, 60_000);
});
