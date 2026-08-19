import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_admin_bootstrap_alecc_daddy_2026-08-19";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const preflight = read("preflight.sql");
const grant = read("grant.sql");
const postflight = read("postflight.sql");
const rollback = read("rollback.sql");
const readme = read("README.md");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const TARGET_ID = "81000000-0000-4000-8000-000000000001";
const OTHER_ID = "81000000-0000-4000-8000-000000000002";

async function productionShape({
  email = "jeeneetardshelp@gmail.com",
  username = "alecc_daddy",
  confirmed = true,
  targetAdmin = false,
  otherAdmin = false,
  environment = null,
  mode = "off",
  forumSettings = true,
} = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create schema auth;
    create table auth.users (
      id uuid primary key,
      email text,
      email_confirmed_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      username text unique,
      is_admin boolean not null default false,
      created_at timestamptz not null default now()
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
    create function public.forum_mode() returns text
    language sql stable set search_path = '' as $$
      select mode from public.forum_settings where id = true
    $$;
    create function public.forum_username_is_allowed(value text) returns boolean
    language sql immutable set search_path = '' as $$
      select value ~ '^[A-Za-z0-9_-]{3,30}$'
    $$;
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select false
    $$;
  `);
  if (forumSettings) {
    await pg.query(
      "insert into public.forum_settings (id, mode) values (true, $1)",
      [mode],
    );
  }
  await pg.query(
    `insert into auth.users (id, email, email_confirmed_at)
     values ($1, $2, case when $3 then now() else null end),
            ($4, 'other@staging.invalid', now())`,
    [TARGET_ID, email, confirmed, OTHER_ID],
  );
  await pg.query(
    `insert into public.profiles (id, username, is_admin)
     values ($1, $2, $3), ($4, 'other_student', $5)`,
    [TARGET_ID, username, targetAdmin, OTHER_ID, otherAdmin],
  );
  if (environment) {
    await pg.query(
      "insert into public.app_environment (id, name) values (true, $1)",
      [environment],
    );
  }
  return pg;
}

async function adminState(pg) {
  return (await pg.query(`
    select username, is_admin from public.profiles order by username
  `)).rows;
}

describe("forum admin bootstrap production package", () => {
  it("promotes only the exact confirmed target and rolls back exactly", async () => {
    const pg = await productionShape();
    try {
      await pg.exec(preflight);
      expect(await adminState(pg)).toEqual([
        { username: "alecc_daddy", is_admin: false },
        { username: "other_student", is_admin: false },
      ]);

      await pg.exec(grant);
      await pg.exec(postflight);
      expect(await adminState(pg)).toEqual([
        { username: "alecc_daddy", is_admin: true },
        { username: "other_student", is_admin: false },
      ]);

      await pg.exec(rollback);
      expect(await adminState(pg)).toEqual([
        { username: "alecc_daddy", is_admin: false },
        { username: "other_student", is_admin: false },
      ]);
    } finally {
      await pg.close();
    }
  });

  it.each([
    ["wrong email", { email: "wrong@staging.invalid" }],
    ["wrong username", { username: "alecc-daddy" }],
    ["unconfirmed email", { confirmed: false }],
    ["existing target admin", { targetAdmin: true }],
    ["another existing admin", { otherAdmin: true }],
    ["staging marker", { environment: "staging" }],
    ["forum already open", { mode: "open" }],
  ])("refuses %s without changing either profile", async (_label, options) => {
    const pg = await productionShape(options);
    const before = await adminState(pg);
    try {
      await expect(pg.exec(grant)).rejects.toThrow(/REFUSING/);
      await pg.exec("rollback");
      expect(await adminState(pg)).toEqual(before);
    } finally {
      await pg.close();
    }
  });

  it("makes the read-only preflight refuse a missing forum settings row", async () => {
    const pg = await productionShape({ forumSettings: false });
    const before = await adminState(pg);
    try {
      await expect(pg.exec(preflight)).rejects.toThrow(/REFUSING/);
      await pg.exec("rollback");
      expect(await adminState(pg)).toEqual(before);
    } finally {
      await pg.close();
    }
  });

  it("pins the package hashes and contains no credential-shaped values", () => {
    const sums = read("SHA256SUMS.txt").trim().split("\n");
    for (const name of ["preflight.sql", "grant.sql", "postflight.sql", "rollback.sql", "README.md"]) {
      expect(sums).toContain(`${sha256(read(name))}  ${name}`);
    }
    for (const value of [preflight, grant, postflight, rollback, readme]) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
      expect(value).not.toMatch(/service[_-]?role[_-]?(?:key|secret)\s*=/i);
      expect(value).not.toMatch(/postgres(?:ql)?:\/\//i);
    }
    expect(readme).toContain("Prepared only");
    expect(grant).toContain("requires zero existing administrators");
    expect(grant).toContain("expected exactly one confirmed non-admin target");
  });
});
