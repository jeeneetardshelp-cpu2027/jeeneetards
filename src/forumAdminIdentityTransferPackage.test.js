import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "production/forum_admin_identity_transfer_2026-08-19";
const read = (name) => readFileSync(`${directory}/${name}`, "utf8");
const files = ["audit.sql", "preflight.sql", "transfer.sql", "postflight.sql", "rollback.sql", "README.md"];
const scripts = Object.fromEntries(files.map((name) => [name, read(name)]));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const TARGET_ID = "84000000-0000-4000-8000-000000000001";
const PREVIOUS_ID = "84000000-0000-4000-8000-000000000002";

async function productionShape({
  mode = "off",
  environment = null,
  targetUsername = "alecc_daddy",
  targetConfirmed = true,
  targetAdmin = false,
  previousUsername = null,
  previousConfirmed = true,
  previousAdmin = true,
  includeTarget = true,
} = {}) {
  const pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
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
    create function public.forum_username_is_allowed(p_username text)
    returns boolean language sql immutable set search_path = '' as $$
      select p_username ~ '^[a-z0-9_]{3,24}$'
    $$;
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = '' as $$
      select false
    $$;
  `);
  if (includeTarget) {
    await pg.query(
      `insert into auth.users (id, email, email_confirmed_at)
       values ($1, 'jeeneetardshelp@gmail.com', case when $2 then now() else null end)`,
      [TARGET_ID, targetConfirmed],
    );
    await pg.query(
      `insert into public.profiles (id, username, is_admin) values ($1, $2, $3)`,
      [TARGET_ID, targetUsername, targetAdmin],
    );
  }
  await pg.query(
    `insert into auth.users (id, email, email_confirmed_at)
     values ($1, 'existing-admin@staging.invalid', case when $2 then now() else null end)`,
    [PREVIOUS_ID, previousConfirmed],
  );
  await pg.query(
    `insert into public.profiles (id, username, is_admin) values ($1, $2, $3)`,
    [PREVIOUS_ID, previousUsername, previousAdmin],
  );
  if (environment) {
    await pg.query("insert into public.app_environment (id, name) values (true, $1)", [environment]);
  }
  return pg;
}

async function roles(pg) {
  return (await pg.query("select id, username, is_admin from public.profiles order by id")).rows;
}

function terminalRow(results, key) {
  return results.find((result) => result.rows?.[0]?.[key] !== undefined)?.rows[0];
}

describe("forum administrator identity-transfer package", () => {
  it("audits, transfers atomically, verifies, and restores from captured IDs", async () => {
    const pg = await productionShape();
    const original = await roles(pg);
    try {
      const audit = terminalRow(await pg.exec(scripts["audit.sql"]), "total_admins");
      expect(audit).toEqual({
        forum_mode_is_off: true,
        transfer_state_table_absent: true,
        total_admins: 1,
        existing_admin_ready: true,
        exact_target_ready: true,
        target_username_allowed: true,
        database_changed: false,
      });

      const preflight = terminalRow(await pg.exec(scripts["preflight.sql"]), "exactly_one_current_admin");
      expect(preflight).toEqual({
        forum_mode_is_off: true,
        transfer_state_table_absent: true,
        exactly_one_current_admin: true,
        audited_identity_shape_matches: true,
        database_changed: false,
      });

      const transfer = terminalRow(await pg.exec(scripts["transfer.sql"]), "rollback_state_captured");
      expect(transfer).toEqual({
        forum_mode_is_off: true,
        exactly_one_admin: true,
        exact_target_is_admin: true,
        previous_admin_demoted: true,
        rollback_state_captured: true,
        transfer_state_locked_down: true,
      });
      expect(await roles(pg)).toEqual([
        { id: TARGET_ID, username: "alecc_daddy", is_admin: true },
        { id: PREVIOUS_ID, username: null, is_admin: false },
      ]);
      const captured = (await pg.query(`
        select previous_admin_id, target_admin_id, rolled_back_at
        from public.forum_admin_transfer_state where id = true
      `)).rows[0];
      expect(captured).toEqual({
        previous_admin_id: PREVIOUS_ID,
        target_admin_id: TARGET_ID,
        rolled_back_at: null,
      });

      const postflight = terminalRow(await pg.exec(scripts["postflight.sql"]), "database_changed");
      expect(postflight).toEqual({
        forum_mode_is_off: true,
        exactly_one_admin: true,
        exact_target_is_admin: true,
        previous_admin_demoted: true,
        rollback_state_captured: true,
        transfer_state_locked_down: true,
        database_changed: false,
      });

      const rollback = terminalRow(await pg.exec(scripts["rollback.sql"]), "rollback_recorded");
      expect(rollback).toEqual({
        forum_mode_is_off: true,
        exactly_one_admin: true,
        previous_admin_restored: true,
        exact_target_is_not_admin: true,
        rollback_recorded: true,
      });
      expect(await roles(pg)).toEqual(original);
      expect((await pg.query(`
        select rolled_back_at is not null as recorded
        from public.forum_admin_transfer_state where id = true
      `)).rows[0]).toEqual({ recorded: true });
    } finally {
      await pg.close();
    }
  });

  it.each([
    ["forum mode is open", { mode: "open" }],
    ["the environment is staging", { environment: "staging" }],
    ["there is no current admin", { previousAdmin: false }],
    ["both profiles are admins", { targetAdmin: true }],
    ["the current admin has a username", { previousUsername: "unexpected_admin" }],
    ["the current admin is unconfirmed", { previousConfirmed: false }],
    ["the target is unconfirmed", { targetConfirmed: false }],
    ["the target username drifted", { targetUsername: "different_name" }],
    ["the target profile is missing", { includeTarget: false }],
  ])("refuses the transfer without changing roles when %s", async (_label, options) => {
    const pg = await productionShape(options);
    const before = await roles(pg);
    try {
      await expect(pg.exec(scripts["transfer.sql"])).rejects.toThrow(/REFUSING|query returned no rows/);
      await pg.exec("rollback");
      expect(await roles(pg)).toEqual(before);
      expect((await pg.query(`
        select to_regclass('public.forum_admin_transfer_state') is null as absent
      `)).rows[0]).toEqual({ absent: true });
    } finally {
      await pg.close();
    }
  });

  it("refuses a second transfer and preserves the completed state", async () => {
    const pg = await productionShape();
    try {
      await pg.exec(scripts["transfer.sql"]);
      const after = await roles(pg);
      await expect(pg.exec(scripts["transfer.sql"])).rejects.toThrow(/transfer state already exists/);
      await pg.exec("rollback");
      expect(await roles(pg)).toEqual(after);
    } finally {
      await pg.close();
    }
  });

  it("refuses rollback after previous-identity drift and keeps target admin", async () => {
    const pg = await productionShape();
    try {
      await pg.exec(scripts["transfer.sql"]);
      await pg.query("update public.profiles set username = 'drifted' where id = $1", [PREVIOUS_ID]);
      const before = await roles(pg);
      await expect(pg.exec(scripts["rollback.sql"])).rejects.toThrow(/identity or role state does not match/);
      await pg.exec("rollback");
      expect(await roles(pg)).toEqual(before);
      expect((await pg.query(`
        select rolled_back_at is null as pending
        from public.forum_admin_transfer_state where id = true
      `)).rows[0]).toEqual({ pending: true });
    } finally {
      await pg.close();
    }
  });

  it("pins every hash and keeps credential material out of the package", () => {
    const sums = read("SHA256SUMS.txt").trim().split("\n");
    for (const name of files) {
      expect(sums).toContain(`${sha256(scripts[name])}  ${name}`);
    }
    expect(scripts["audit.sql"]).toContain("begin transaction read only");
    expect(scripts["preflight.sql"]).toContain("begin transaction read only");
    expect(scripts["postflight.sql"]).toContain("begin transaction read only");
    expect(scripts["transfer.sql"]).toContain("affected_rows <> 2");
    expect(scripts["transfer.sql"]).not.toMatch(/admin_transfer_state[\s\S]*references public\.profiles/i);
    expect(scripts["rollback.sql"]).toContain("affected_rows <> 2");
    for (const value of Object.values(scripts)) {
      expect(value).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
      expect(value).not.toMatch(/postgres(?:ql)?:\/\//i);
      expect(value).not.toMatch(/service[_-]?role\s*(?:key|secret)\s*[:=]/i);
    }
  });
});
