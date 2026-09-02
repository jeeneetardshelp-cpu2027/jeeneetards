import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const preflight = readFileSync(
  "src/migrations/profile_public_identity_privacy_v1_preflight.sql",
  "utf8",
);
const migration = readFileSync(
  "src/migrations/profile_public_identity_privacy_v1.sql",
  "utf8",
);
const postflight = readFileSync(
  "src/migrations/profile_public_identity_privacy_v1_postflight.sql",
  "utf8",
);
const legacyMigration = readFileSync(
  "src/migrations/fix_profile_is_admin_select_disclosure.sql",
  "utf8",
);
const communitySchema = readFileSync("community_schema.sql", "utf8");
const stagingBuilder = readFileSync("src/scripts/buildStagingBootstrap.js", "utf8");

const USER_ID = "10000000-0000-4000-8000-000000000001";

async function database() {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique,
      full_name text,
      avatar_url text,
      created_at timestamptz not null default now(),
      is_admin boolean not null default false
    );
    insert into auth.users (id) values ('${USER_ID}');
    insert into public.profiles (id, username, full_name, avatar_url, is_admin)
      values ('${USER_ID}', 'chosen_student', 'Private student', 'https://example.invalid/avatar.png', true);

    -- Reproduce both ways the leak can exist: a PUBLIC table grant and the
    -- historical browser-role column grants.
    grant select on table public.profiles to public;
    grant select (id, username, full_name, avatar_url, created_at)
      on table public.profiles to anon, authenticated;
    grant select on table public.profiles to service_role;

    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
      )
    $$;
    create function public.forum_get_my_identity()
    returns table (username text, needs_username boolean)
    language sql stable security definer set search_path = '' as $$
      select p.username, p.username is null
      from public.profiles p where p.id = auth.uid()
    $$;
  `);
  return pg;
}

async function setRole(pg, role) {
  await pg.exec(`set role ${role}`);
}

describe("public profile identity privacy v1", () => {
  it("ships an atomic, data-free, username-only migration and fresh-install contract", () => {
    expect(preflight).toContain("begin transaction read only");
    expect(migration).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(migration.trimEnd()).toMatch(/commit;$/i);
    expect(migration).toContain(
      "revoke select on table public.profiles from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select (username) on table public.profiles to anon, authenticated",
    );
    expect(migration).toContain("grant select on table public.profiles to service_role");
    expect(migration).not.toMatch(/grant\s+select\s*\([^)]*(?:full_name|avatar_url|\bid\b)/i);
    expect(migration).not.toMatch(/\b(?:insert|update|delete|truncate)\s+(?:into|public\.profiles|table)/i);
    expect(postflight).toContain("begin transaction read only");

    expect(legacyMigration).toContain(
      "grant select (username) on table public.profiles to anon, authenticated",
    );
    expect(legacyMigration).not.toMatch(
      /grant\s+select\s*\([^)]*(?:full_name|avatar_url|\bid\b)/i,
    );
    expect(communitySchema).toContain(
      "revoke select on table public.profiles from public, anon, authenticated",
    );
    expect(communitySchema).toContain(
      "grant select (username) on table public.profiles to anon, authenticated",
    );
    expect(stagingBuilder).toContain(
      '"src/migrations/profile_public_identity_privacy_v1.sql"',
    );
  });

  it("keeps only username readable to browser roles and preserves sanctioned functions", async () => {
    const pg = await database();
    try {
      await pg.exec(preflight);
      await pg.exec(migration);
      await pg.exec(postflight);

      // Prove reruns cannot reopen the exposure, including the legacy file.
      await pg.exec(migration);
      await pg.exec(legacyMigration);
      await pg.exec(postflight);

      const privileges = await pg.query(`
        select
          has_table_privilege('anon', 'public.profiles', 'select') as anon_table,
          has_table_privilege('authenticated', 'public.profiles', 'select') as auth_table,
          has_column_privilege('anon', 'public.profiles', 'username', 'select') as anon_username,
          has_column_privilege('authenticated', 'public.profiles', 'username', 'select') as auth_username,
          has_column_privilege('anon', 'public.profiles', 'full_name', 'select') as anon_full_name,
          has_column_privilege('anon', 'public.profiles', 'avatar_url', 'select') as anon_avatar,
          has_column_privilege('anon', 'public.profiles', 'id', 'select') as anon_id,
          has_column_privilege('authenticated', 'public.profiles', 'created_at', 'select') as auth_created,
          has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'select') as auth_admin,
          has_table_privilege('service_role', 'public.profiles', 'select') as service_table
      `);
      expect(privileges.rows[0]).toEqual({
        anon_table: false,
        auth_table: false,
        anon_username: true,
        auth_username: true,
        anon_full_name: false,
        anon_avatar: false,
        anon_id: false,
        auth_created: false,
        auth_admin: false,
        service_table: true,
      });

      await setRole(pg, "anon");
      await expect(pg.query("select username from public.profiles"))
        .resolves.toMatchObject({ rows: [{ username: "chosen_student" }] });
      await expect(pg.query("select full_name from public.profiles"))
        .rejects.toThrow(/permission denied/i);
      await expect(pg.query("select avatar_url from public.profiles"))
        .rejects.toThrow(/permission denied/i);
      await expect(pg.query("select * from public.profiles"))
        .rejects.toThrow(/permission denied/i);
      await pg.exec("reset role");

      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [USER_ID]);
      await setRole(pg, "authenticated");
      await expect(pg.query("select username from public.profiles"))
        .resolves.toMatchObject({ rows: [{ username: "chosen_student" }] });
      await expect(pg.query("select id, full_name from public.profiles"))
        .rejects.toThrow(/permission denied/i);
      await expect(pg.query("select public.is_admin() as allowed"))
        .resolves.toMatchObject({ rows: [{ allowed: true }] });
      await expect(pg.query("select * from public.forum_get_my_identity()"))
        .resolves.toMatchObject({
          rows: [{ username: "chosen_student", needs_username: false }],
        });
      await pg.exec("reset role");

      await setRole(pg, "service_role");
      await expect(pg.query("select * from public.profiles"))
        .resolves.toMatchObject({ rows: [{ username: "chosen_student" }] });
      await pg.exec("reset role");
    } finally {
      await pg.close();
    }
  });
});
