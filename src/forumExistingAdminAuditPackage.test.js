import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_existing_admin_audit_2026-08-19";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const audit = read("audit.sql");
const readme = read("README.md");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const TARGET_ID = "82000000-0000-4000-8000-000000000001";
const OTHER_ID = "82000000-0000-4000-8000-000000000002";

async function productionShape({
  targetAdmin = true,
  otherAdmin = false,
  otherEmail = "other@staging.invalid",
  environment = null,
  mode = "off",
} = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz
    );
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique,
      is_admin boolean not null default false
    );
    create table public.app_environment (
      id boolean primary key default true check (id),
      name text not null check (name in ('production','staging','test'))
    );
    create table public.forum_install_state (
      id boolean primary key default true check (id)
    );
    create table public.forum_settings (
      id boolean primary key default true check (id),
      mode text not null
    );
    insert into public.forum_install_state (id) values (true);
    insert into public.forum_settings (id, mode) values (true, '${mode}');
    create function public.forum_mode() returns text
    language sql stable set search_path = '' as $$
      select mode from public.forum_settings where id = true
    $$;
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select false
    $$;
  `);
  await pg.query(
    `insert into auth.users (id, email, email_confirmed_at)
     values ($1, 'jeeneetardshelp@gmail.com', now()),
            ($2, $3, now())`,
    [TARGET_ID, OTHER_ID, otherEmail],
  );
  await pg.query(
    `insert into public.profiles (id, username, is_admin)
     values ($1, 'alecc_daddy', $2), ($3, 'other_student', $4)`,
    [TARGET_ID, targetAdmin, OTHER_ID, otherAdmin],
  );
  if (environment) {
    await pg.query(
      "insert into public.app_environment (id, name) values (true, $1)",
      [environment],
    );
  }
  return pg;
}

async function state(pg) {
  return (await pg.query(`
    select username, is_admin from public.profiles order by username
  `)).rows;
}

describe("forum existing-admin read-only audit package", () => {
  it.each([
    ["the exact target is the existing admin", { targetAdmin: true }, {
      total_admins: 1, exact_target_is_admin: true, other_admin_count: 0,
      admin_usernames: ["alecc_daddy"],
    }],
    ["another profile is the existing admin", { targetAdmin: false, otherAdmin: true }, {
      total_admins: 1, exact_target_is_admin: false, other_admin_count: 1,
      admin_usernames: ["other_student"],
    }],
    ["an admin has no Auth email", { targetAdmin: false, otherAdmin: true, otherEmail: null }, {
      total_admins: 1, exact_target_is_admin: false, other_admin_count: 1,
      admin_usernames: ["other_student"],
    }],
    ["both profiles are admins", { targetAdmin: true, otherAdmin: true }, {
      total_admins: 2, exact_target_is_admin: true, other_admin_count: 1,
      admin_usernames: ["alecc_daddy", "other_student"],
    }],
  ])("runs without changing profiles when %s", async (_label, options, expected) => {
    const pg = await productionShape(options);
    const before = await state(pg);
    try {
      const results = await pg.exec(audit);
      const row = results.find((result) => result.rows?.[0]?.total_admins !== undefined).rows[0];
      expect(row).toEqual({
        forum_mode_is_off: true,
        ...expected,
        database_changed: false,
      });
      expect(await state(pg)).toEqual(before);
    } finally {
      await pg.close();
    }
  });

  it.each([
    ["there are no admins", { targetAdmin: false }],
    ["the environment is staging", { environment: "staging" }],
    ["forum mode is open", { mode: "open" }],
  ])("refuses without changing profiles when %s", async (_label, options) => {
    const pg = await productionShape(options);
    const before = await state(pg);
    try {
      await expect(pg.exec(audit)).rejects.toThrow(/REFUSING/);
      await pg.exec("rollback");
      expect(await state(pg)).toEqual(before);
    } finally {
      await pg.close();
    }
  });

  it("pins hashes, stays read-only, and returns no raw identity fields", () => {
    const sums = read("SHA256SUMS.txt").trim().split("\n");
    expect(sums).toContain(`${sha256(audit)}  audit.sql`);
    expect(sums).toContain(`${sha256(readme)}  README.md`);
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("false as database_changed");
    expect(audit).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create)\b/i);
    expect(audit).not.toMatch(/\bu\.email\s+as\b/i);
    expect(audit).not.toMatch(/\bp\.id\s+as\b/i);
    expect(audit).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(audit).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
});
