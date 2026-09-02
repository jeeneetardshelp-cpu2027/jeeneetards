import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const forumV1 = readFileSync("src/migrations/forum_v1.sql", "utf8");
const preflight = readFileSync("src/migrations/forum_username_claim_v1_preflight.sql", "utf8");
const migration = readFileSync("src/migrations/forum_username_claim_v1.sql", "utf8");
const postflight = readFileSync("src/migrations/forum_username_claim_v1_postflight.sql", "utf8");
const rollback = readFileSync("src/migrations/forum_username_claim_v1_rollback.sql", "utf8");
const audit = readFileSync("src/migrations/forum_username_claim_v1_audit.sql", "utf8");

const IDS = {
  admin: "10000000-0000-4000-8000-000000000001",
  claimed: "10000000-0000-4000-8000-000000000002",
  first: "10000000-0000-4000-8000-000000000003",
  second: "10000000-0000-4000-8000-000000000004",
  missingProfile: "10000000-0000-4000-8000-000000000005",
  legacyInvalid: "10000000-0000-4000-8000-000000000006",
};

async function setIdentity(pg, id, role = "authenticated") {
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await pg.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
}

async function database() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique, full_name text, avatar_url text,
      is_admin boolean not null default false,
      created_at timestamptz not null default now()
    );
    grant select, insert, update on public.profiles to anon, authenticated;
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    $$;
    create table public.app_environment (
      id boolean primary key default true check (id),
      name text not null check (name in ('production','staging','test'))
    );
    insert into public.app_environment (id, name) values (true, 'test');
    insert into auth.users (id, created_at) values
      ('${IDS.admin}', now() - interval '1 day'),
      ('${IDS.claimed}', now() - interval '1 day'),
      ('${IDS.first}', now() - interval '1 day'),
      ('${IDS.second}', now() - interval '1 day'),
      ('${IDS.missingProfile}', now() - interval '1 day'),
      ('${IDS.legacyInvalid}', now() - interval '1 day');
    insert into public.profiles (id, username, is_admin) values
      ('${IDS.admin}', 'forum_admin', true),
      ('${IDS.claimed}', 'ExistingStudent', false),
      ('${IDS.first}', null, false),
      ('${IDS.second}', null, false),
      ('${IDS.legacyInvalid}', 'admin', false);
  `);
  await pg.exec(forumV1);
  return pg;
}

describe("forum username claim SQL delta", () => {
  it("is atomic, guarded, and keeps direct username writes behind the RPC", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(preflight).toContain("case-insensitive username collision groups require manual review");
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("case_insensitive_collision_groups");
    expect(migration.trimStart().startsWith("-- Forum username claim v1.")).toBe(true);
    expect(migration).toContain("begin;");
    expect(migration).toContain("create unique index forum_profiles_username_ci_idx");
    expect(migration).toContain("revoke insert, update on table public.profiles");
    expect(migration).not.toMatch(/create (?:function|unique index) if not exists/i);
    expect(rollback).toContain("app_environment is missing");
    expect(rollback).toContain("not in ('staging', 'test')");
  });

  it("claims once, rejects reserved and case-colliding handles, and supports legacy profiles", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(migration);
      await pg.exec(postflight);

      await setIdentity(pg, IDS.first);
      const before = await pg.query("select * from public.forum_get_my_identity()");
      expect(before.rows[0]).toEqual({ username: null, needs_username: true });
      const claimed = await pg.query("select public.forum_claim_username('New-Student') as username");
      expect(claimed.rows[0].username).toBe("New-Student");
      await expect(pg.query("select public.forum_claim_username('AnotherName')"))
        .rejects.toThrow(/already been claimed/i);

      await setIdentity(pg, IDS.second);
      await expect(pg.query("select public.forum_claim_username('new-student')"))
        .rejects.toThrow(/already taken/i);
      await expect(pg.query("select public.forum_claim_username('moderator1')"))
        .rejects.toThrow(/cannot be reserved/i);
      await expect(pg.query("select public.forum_claim_username('bad name')"))
        .rejects.toThrow(/3 to 30/i);

      await setIdentity(pg, IDS.missingProfile);
      const inserted = await pg.query("select public.forum_claim_username('Backfilled_User') as username");
      expect(inserted.rows[0].username).toBe("Backfilled_User");
      const profile = await pg.query("select username from public.profiles where id = $1", [IDS.missingProfile]);
      expect(profile.rows[0].username).toBe("Backfilled_User");

      await setIdentity(pg, IDS.legacyInvalid);
      await expect(pg.query("select * from public.forum_get_my_identity()"))
        .resolves.toMatchObject({ rows: [{ username: null, needs_username: true }] });
      await expect(pg.query("select public.forum_claim_username('Recovered_User')"))
        .resolves.toMatchObject({ rows: [{ forum_claim_username: "Recovered_User" }] });
    } finally {
      await pg.close();
    }
  });

  it("lets a claimed hyphenated handle pass the real publishing gate", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await setIdentity(pg, IDS.first);
      await pg.query("select public.forum_claim_username('hyphen-student')");
      await setIdentity(pg, IDS.admin);
      await pg.query("select public.forum_admin_set_mode('open')");
      await setIdentity(pg, IDS.first);
      const result = await pg.query(`
        select public.forum_create_post(
          'physics', 'A valid question title', 'A valid question body with enough detail.'
        ) as id
      `);
      expect(Number(result.rows[0].id)).toBeGreaterThan(0);
    } finally {
      await pg.close();
    }
  });

  it("restores the original forum contract through the guarded test rollback", async () => {
    const pg = await database();
    try {
      await pg.exec(migration);
      await pg.exec(rollback);
      const state = await pg.query(`
        select
          to_regprocedure('public.forum_claim_username(text)') is null as claim_removed,
          to_regclass('public.forum_profiles_username_ci_idx') is null as index_removed
      `);
      expect(state.rows[0]).toEqual({ claim_removed: true, index_removed: true });
    } finally {
      await pg.close();
    }
  });
});
