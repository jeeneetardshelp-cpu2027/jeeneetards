import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const artifactPath = "staging/forum_v1_rehearsal/rollback_rehearsal.sql";
const artifact = readFileSync(artifactPath, "utf8");
const hashLine = readFileSync(
  "staging/forum_v1_rehearsal/rollback_rehearsal.sha256.txt",
  "utf8",
).trim();
const manifest = JSON.parse(readFileSync(
  "staging/forum_v1_rehearsal/source_manifest.json",
  "utf8",
));
const readme = readFileSync("staging/forum_v1_rehearsal/README.md", "utf8");
const provision = readFileSync(
  "staging/forum_v1_rehearsal/provision_test_accounts.sql",
  "utf8",
);
const teardown = readFileSync(
  "staging/forum_v1_rehearsal/teardown_test_accounts.sql",
  "utf8",
);
const realStagingNotes = readFileSync(
  "staging/forum_v1_rehearsal/REAL_STAGING_NOTES.md",
  "utf8",
);
const core = readFileSync("src/migrations/forum_v1.sql", "utf8").replace(/\r\n/g, "\n");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

describe("forum v1 staging rehearsal package", () => {
  it("pins the exact reviewed sources and generated artifact", () => {
    const artifactHash = sha256(artifact);
    expect(hashLine).toBe(`${artifactHash}  rollback_rehearsal.sql`);
    expect(manifest.status).toBe("rollback-only-not-authorized-for-persistent-apply");
    expect(manifest.sources.core.sha256).toBe(sha256(core));
    expect(manifest.artifact.sha256).toBe(artifactHash);
    expect(artifact).toContain(`Exact core SHA-256: ${manifest.sources.core.sha256}`);
  });

  it("uses real browser roles and keeps the terminal rollback contract", () => {
    expect(artifact.match(/set local role authenticated;/g)?.length).toBeGreaterThanOrEqual(8);
    expect(artifact).toContain("set local role anon;");
    expect(artifact).toContain("request.jwt.claim.sub");
    expect(artifact).toContain("__forum_stage_direct_table_denied");
    expect(artifact).toContain("username_gate_passed");
    expect(artifact).toContain("incomplete_cursor_rejected");
    expect(artifact).toContain("rollback;\n\n-- These checks run after rollback");
    expect(artifact.match(/^\s*commit;\s*$/gim)).toHaveLength(1);

    const rehearsalStart = artifact.indexOf("\nbegin;\n", artifact.indexOf("\ncommit;\n"));
    const rehearsalRollback = artifact.lastIndexOf("\nrollback;\n");
    expect(rehearsalStart).toBeGreaterThan(-1);
    expect(rehearsalRollback).toBeGreaterThan(rehearsalStart);
    expect(artifact.slice(rehearsalStart, rehearsalRollback)).not.toMatch(
      /(^|\n)\s*commit;\s*($|\n)/i,
    );
    expect(readme).toContain("cannot test a real HTTP JWT through");
    expect(readme).toContain("username-claim flow");
  });

  it("preserves the approved atomic non-idempotent migration", () => {
    expect(core).toContain("\nbegin;\n");
    expect(core).toContain("\ncommit;\n");
    expect(core).toContain("create table public.forum_settings");
    expect(core).not.toMatch(/create table if not exists public\.forum_/i);
  });

  it("guards, scopes and pairs disposable account provisioning with teardown", () => {
    const guardIndex = provision.indexOf("name = 'staging'");
    const insertIndex = provision.indexOf("insert into auth.users");
    const adminGrantIndex = provision.indexOf("is_admin =");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(guardIndex);
    expect(adminGrantIndex).toBeGreaterThan(insertIndex);
    expect(provision).toContain("staging auth/profile store is not empty");
    expect(provision).toContain("now() - interval '20 minutes'");
    expect(
      provision.match(/forum-rehearsal-(?:admin|student-[1-4])@staging\.invalid/g),
    ).toHaveLength(5);
    expect(provision).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(provision).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(provision).not.toMatch(/service[_-]?role[_-]?(?:key|secret)\s*=/i);

    expect(teardown.indexOf("name = 'staging'"))
      .toBeLessThan(teardown.indexOf("delete from auth.users"));
    expect(teardown).toContain("confdeltype = 'c'");
    expect(teardown).toContain("profile cascade did not finish");
    expect(teardown).toContain("exact five-user fixture set was not found");
    expect(readme).toContain("provision_test_accounts.sql");
    expect(readme).toContain("teardown_test_accounts.sql");
    expect(realStagingNotes).toContain("passed fail-closed prerequisite guard");
    expect(realStagingNotes).toContain("REFUSING: staging needs one admin profile");
  });

  it("executes as one rollback-always rehearsal in ephemeral PostgreSQL", async () => {
    const pg = new PGlite();
    try {
      await pg.exec(`
        create role anon;
        create role authenticated;
        create role service_role;
        create schema auth;
        create table auth.users (
          id uuid primary key,
          aud varchar,
          role varchar,
          email varchar,
          email_confirmed_at timestamptz,
          raw_app_meta_data jsonb,
          raw_user_meta_data jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz
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
        create function public.handle_new_user() returns trigger
        language plpgsql security definer set search_path = public as $$
        begin
          insert into public.profiles (id, full_name, avatar_url)
          values (
            new.id,
            new.raw_user_meta_data ->> 'full_name',
            new.raw_user_meta_data ->> 'avatar_url'
          );
          return new;
        end;
        $$;
        create trigger on_auth_user_created after insert on auth.users
          for each row execute function public.handle_new_user();
        create function public.protect_profile_admin_flag() returns trigger
        language plpgsql security definer set search_path = '' as $$
        begin
          if coalesce(auth.role(), '') <> 'service_role'
             and new.is_admin is distinct from old.is_admin then
            raise exception 'profiles.is_admin may only be changed by service_role';
          end if;
          return new;
        end;
        $$;
        create trigger trg_protect_profile_admin_flag
          before update on public.profiles
          for each row execute function public.protect_profile_admin_flag();
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
        insert into public.app_environment (id, name) values (true, 'staging');
      `);

      await pg.exec(provision);

      await pg.exec(artifact);

      const restored = await pg.query(`
        select
          (select name from public.app_environment where id) as environment,
          to_regclass('public.forum_posts') as forum_posts,
          to_regprocedure('public.forum_create_post(text,text,text)') as create_rpc,
          (select count(*)::integer from public.profiles where username is null) as null_usernames,
          (select count(*)::integer from public.profiles) as profiles,
          (select count(*)::integer from public.profiles where is_admin) as admins
      `);
      expect(restored.rows[0]).toEqual({
        environment: "staging",
        forum_posts: null,
        create_rpc: null,
        null_usernames: 0,
        profiles: 5,
        admins: 1,
      });

      await pg.exec(teardown);
      const cleaned = await pg.query(`
        select
          (select count(*)::integer from auth.users) as auth_users,
          (select count(*)::integer from public.profiles) as profiles
      `);
      expect(cleaned.rows[0]).toEqual({ auth_users: 0, profiles: 0 });
    } finally {
      await pg.close();
    }
  }, 60_000);
});
