import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_admin_identity_reconciliation_2026-08-19";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const audit = read("audit.sql");
const readme = read("README.md");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const TARGET_ID = "83000000-0000-4000-8000-000000000001";
const OTHER_ID = "83000000-0000-4000-8000-000000000002";

async function productionShape({
  targetAdmin = false,
  otherAdmin = true,
  targetUsername = "alecc_daddy",
  otherUsername = null,
  targetConfirmed = true,
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
     values ($1, 'jeeneetardshelp@gmail.com', case when $2 then now() else null end),
            ($3, 'other@staging.invalid', now())`,
    [TARGET_ID, targetConfirmed, OTHER_ID],
  );
  await pg.query(
    `insert into public.profiles (id, username, is_admin)
     values ($1, $2, $3), ($4, $5, $6)`,
    [TARGET_ID, targetUsername, targetAdmin, OTHER_ID, otherUsername, otherAdmin],
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
    select username, is_admin from public.profiles order by id
  `)).rows;
}

const common = {
  forum_mode_is_off: true,
  total_admins: 1,
  existing_admin_has_auth_user: true,
  target_auth_user_count: 1,
  target_profile_count: 1,
  target_email_confirmed: true,
  database_changed: false,
};

describe("forum administrator identity-reconciliation package", () => {
  it.each([
    ["the observed split identities", {}, {
      existing_admin_email_matches_target: false,
      existing_admin_email_confirmed: true,
      existing_admin_username_missing: true,
      target_username_is_alecc_daddy: true,
      target_username_missing: false,
      target_is_admin: false,
      existing_admin_is_target_account: false,
      alecc_daddy_profile_count: 1,
      alecc_daddy_belongs_to_target_account: true,
    }],
    ["the target is admin but lacks a username", {
      targetAdmin: true, otherAdmin: false, targetUsername: null, otherUsername: "other_student",
    }, {
      existing_admin_email_matches_target: true,
      existing_admin_email_confirmed: true,
      existing_admin_username_missing: true,
      target_username_is_alecc_daddy: false,
      target_username_missing: true,
      target_is_admin: true,
      existing_admin_is_target_account: true,
      alecc_daddy_profile_count: 0,
      alecc_daddy_belongs_to_target_account: false,
    }],
    ["the exact target is already admin", {
      targetAdmin: true, otherAdmin: false, otherUsername: "other_student",
    }, {
      existing_admin_email_matches_target: true,
      existing_admin_email_confirmed: true,
      existing_admin_username_missing: false,
      target_username_is_alecc_daddy: true,
      target_username_missing: false,
      target_is_admin: true,
      existing_admin_is_target_account: true,
      alecc_daddy_profile_count: 1,
      alecc_daddy_belongs_to_target_account: true,
    }],
    ["alecc_daddy belongs to the other administrator", {
      targetUsername: "target_student", otherUsername: "alecc_daddy",
    }, {
      existing_admin_email_matches_target: false,
      existing_admin_email_confirmed: true,
      existing_admin_username_missing: false,
      target_username_is_alecc_daddy: false,
      target_username_missing: false,
      target_is_admin: false,
      existing_admin_is_target_account: false,
      alecc_daddy_profile_count: 1,
      alecc_daddy_belongs_to_target_account: false,
    }],
  ])("returns booleans without changing profiles for %s", async (_label, options, expected) => {
    const pg = await productionShape(options);
    const before = await state(pg);
    try {
      const results = await pg.exec(audit);
      const row = results.find((result) => result.rows?.[0]?.total_admins !== undefined).rows[0];
      expect(row).toEqual({ ...common, ...expected });
      expect(await state(pg)).toEqual(before);
    } finally {
      await pg.close();
    }
  });

  it.each([
    ["there are no admins", { targetAdmin: false, otherAdmin: false }],
    ["there are multiple admins", { targetAdmin: true, otherAdmin: true }],
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

  it("pins hashes and exposes no raw identity fields", () => {
    const sums = read("SHA256SUMS.txt").trim().split("\n");
    expect(sums).toContain(`${sha256(audit)}  audit.sql`);
    expect(sums).toContain(`${sha256(readme)}  README.md`);
    expect(audit).toContain("begin transaction read only");
    expect(audit).toContain("false as database_changed");
    expect(audit).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create)\b/i);
    expect(audit).not.toMatch(/\bu\.email\s+as\b/i);
    expect(audit).not.toMatch(/\b(profile_id|auth_id)\s+as\b/i);
    expect(audit).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(audit).not.toMatch(/postgres(?:ql)?:\/\//i);
  });
});
