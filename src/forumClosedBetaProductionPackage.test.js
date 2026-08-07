import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_closed_beta_v1_release";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const preflight = read("preflight.sql");
const audit = read("audit.sql");
const install = read("install.sql");
const postflight = read("postflight.sql");
const rollback = read("rollback.sql");
const readme = read("README.md");
const sums = read("SHA256SUMS.txt").trim().split("\n");
const manifest = JSON.parse(read("source_manifest.json"));
const baselineInstall = readFileSync("production/forum_v1_release/install.sql", "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function transactionBody(value) {
  const lines = value.replace(/\r\n/g, "\n").trimEnd().split("\n");
  const begin = lines.findIndex((line) => /^begin(?: transaction read only)?;$/i.test(line.trim()));
  const end = lines.findLastIndex((line) => /^(?:commit|rollback);$/i.test(line.trim()));
  return `${lines.slice(0, begin).join("\n").trim()}\n${lines
    .slice(begin + 1, end).join("\n").trim()}`;
}

function rollbackOperations(value) {
  const startMarker = "drop function public.forum_admin_list_beta_members();";
  const endMarker = "notify pgrst, 'reload schema';";
  const start = value.indexOf(startMarker);
  const end = value.lastIndexOf(endMarker);
  return value.slice(start, end).trim();
}

async function forumV1ProductionDatabase({ marker = null } = {}) {
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
      values (
        '30000000-0000-4000-8000-000000000001',
        'existing@example.invalid',
        now() - interval '1 day'
      );
    insert into public.profiles (id, username, full_name, is_admin)
      values (
        '30000000-0000-4000-8000-000000000001',
        'Existing_Student',
        'Existing student',
        true
      );
  `);
  await pg.exec(baselineInstall);
  if (marker) {
    await pg.query(
      "insert into public.app_environment (id, name) values (true, $1)",
      [marker],
    );
  }
  return pg;
}

const artifactNames = [
  "audit.sql",
  "install.sql",
  "postflight.sql",
  "preflight.sql",
  "README.md",
  "rollback.sql",
];

describe("Forum closed-beta v1 production package", () => {
  it("pins every reviewed source and artifact without carrying credentials", () => {
    expect(manifest.status).toBe("prepared-only-not-authorized-for-production-execution");
    expect(manifest.targetProjectRef).toBe("kezelafqhgqrprpadmlf");
    expect(manifest.generator).toEqual({
      path: "src/scripts/buildForumClosedBetaProductionPackage.js",
      sha256: sha256(readFileSync(
        "src/scripts/buildForumClosedBetaProductionPackage.js",
        "utf8",
      ).replace(/\r\n/g, "\n").trimEnd() + "\n"),
    });
    expect(sums).toHaveLength(artifactNames.length + 1);
    expect(sums).toContain(
      `${sha256(read("source_manifest.json"))}  source_manifest.json`,
    );

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
      const value = readFileSync(source.path, "utf8")
        .replace(/\r\n/g, "\n").trimEnd() + "\n";
      expect(sha256(value)).toBe(source.sha256);
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
    expect(install).not.toMatch(
      /create\s+(?:table|index|function)[\s\S]{0,80}\bif\s+not\s+exists\b/i,
    );
    const guard = install.indexOf(
      "closed-beta production install requires the empty production environment marker",
    );
    const firstDdl = install.indexOf("alter table public.forum_settings");
    expect(guard).toBeGreaterThan(-1);
    expect(firstDdl).toBeGreaterThan(guard);
    expect(install).toContain("requires an unused Forum v1 baseline");
    expect(install).toContain("public.forum_mode() <> 'off'");
    expect(install).toContain("beta members were created");
    expect(install).toContain("baseline_state_retained");
    expect(readme).toContain("nine booleans and every field must be `true`");
    expect(readme).toContain("does not authorize mode `beta`");
  });

  it("embeds the approved bodies without rewriting their SQL", () => {
    for (const key of ["preflight", "migration", "postflight"]) {
      const source = readFileSync(manifest.sources[key].path, "utf8");
      expect(install).toContain(transactionBody(source));
    }
    expect(preflight).toContain(
      readFileSync(manifest.sources.preflight.path, "utf8").trim(),
    );
    expect(audit).toContain(
      readFileSync(manifest.sources.audit.path, "utf8").trim(),
    );
    expect(postflight).toContain(
      readFileSync(manifest.sources.postflight.path, "utf8").trim(),
    );
    expect(rollback).toContain(rollbackOperations(
      readFileSync(manifest.sources.rollback.path, "utf8"),
    ));
  });

  it("installs the delta and rolls back to the intact Forum v1 baseline", async () => {
    const pg = await forumV1ProductionDatabase();
    try {
      await pg.exec(preflight);
      await pg.exec(audit);
      await pg.exec(install);
      await pg.exec(postflight);

      let state = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') is not null as beta_table,
          to_regprocedure('public.forum_is_beta_member()') is not null as beta_check,
          to_regprocedure('public.forum_admin_set_beta_member(text,boolean)') is not null
            as beta_write,
          to_regprocedure('public.forum_admin_list_beta_members()') is not null
            as beta_list,
          (select count(*)::integer from public.forum_beta_members) as beta_members,
          (select count(*)::integer from public.forum_posts) as posts,
          (select count(*)::integer from public.forum_install_state) as baseline_state
      `);
      expect(state.rows[0]).toEqual({
        mode: "off",
        beta_table: true,
        beta_check: true,
        beta_write: true,
        beta_list: true,
        beta_members: 0,
        posts: 0,
        baseline_state: 1,
      });

      await pg.exec(rollback);
      state = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') as beta_table,
          to_regprocedure('public.forum_is_beta_member()') as beta_check,
          to_regclass('public.forum_settings') is not null as baseline_forum,
          to_regprocedure('public.forum_claim_username(text)') is not null as claim,
          to_regprocedure('public.forum_admin_list_reports(integer)') is not null as context,
          to_regprocedure('public.forum_admin_dismiss_report(bigint)') is not null as dismissal,
          (select count(*)::integer from public.forum_install_state) as baseline_state
      `);
      expect(state.rows[0]).toEqual({
        mode: "off",
        beta_table: null,
        beta_check: null,
        baseline_forum: true,
        claim: true,
        context: true,
        dismissal: true,
        baseline_state: 1,
      });
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("refuses a marked clone before the first beta DDL", async () => {
    const pg = await forumV1ProductionDatabase({ marker: "staging" });
    try {
      await expect(pg.exec(install)).rejects.toThrow(/empty production environment marker/i);
      await pg.exec("rollback");
      const state = await pg.query(
        "select to_regclass('public.forum_beta_members') as beta_table",
      );
      expect(state.rows[0].beta_table).toBeNull();
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("refuses installation when the Forum v1 baseline has activity", async () => {
    const pg = await forumV1ProductionDatabase();
    try {
      await pg.exec(`
        insert into public.forum_posts (topic_id, author_id, title, body)
        select id, null, 'Existing post', 'The beta delta must stop.'
        from public.forum_topics where slug = 'physics';
      `);
      await expect(pg.exec(install)).rejects.toThrow(/unused Forum v1 baseline/i);
      await pg.exec("rollback");
      const state = await pg.query(
        "select to_regclass('public.forum_beta_members') as beta_table",
      );
      expect(state.rows[0].beta_table).toBeNull();
    } finally {
      await pg.close();
    }
  }, 60_000);

  it("refuses rollback after beta enrollment or forum activity", async () => {
    const pg = await forumV1ProductionDatabase();
    try {
      await pg.exec(install);
      await pg.exec(`
        insert into public.forum_beta_members (user_id, added_by)
        values (
          '30000000-0000-4000-8000-000000000001',
          '30000000-0000-4000-8000-000000000001'
        );
      `);
      await expect(pg.exec(rollback)).rejects.toThrow(/found beta members/i);
      await pg.exec("rollback");
      expect((await pg.query(
        "select count(*)::integer as count from public.forum_beta_members",
      )).rows[0].count).toBe(1);

      await pg.exec("delete from public.forum_beta_members");
      await pg.exec(`
        insert into public.forum_posts (topic_id, author_id, title, body)
        select id, null, 'Beta activity', 'Rollback must refuse this state.'
        from public.forum_topics where slug = 'physics';
      `);
      await expect(pg.exec(rollback)).rejects.toThrow(/unused Forum v1 baseline/i);
      await pg.exec("rollback");
      expect((await pg.query(
        "select count(*)::integer as count from public.forum_posts",
      )).rows[0].count).toBe(1);
    } finally {
      await pg.close();
    }
  }, 60_000);
});
