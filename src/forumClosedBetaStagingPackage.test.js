import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "staging/forum_closed_beta_v1_rehearsal";
const artifact = readFileSync(`${directory}/rollback_rehearsal.sql`, "utf8");
const hashLine = readFileSync(`${directory}/rollback_rehearsal.sha256.txt`, "utf8").trim();
const manifest = JSON.parse(readFileSync(`${directory}/source_manifest.json`, "utf8"));
const readme = readFileSync(`${directory}/README.md`, "utf8");
const provision = readFileSync(`${directory}/provision_test_accounts.sql`, "utf8");
const teardown = readFileSync(`${directory}/teardown_test_accounts.sql`, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

const baselineSources = [
  "src/migrations/forum_v1.sql",
  "src/migrations/forum_username_claim_v1.sql",
  "src/migrations/forum_moderation_context_v1.sql",
  "src/migrations/forum_report_dismissal_v1.sql",
];

describe("forum closed-beta staging rehearsal package", () => {
  it("pins every reviewed source and the generated artifact", () => {
    const artifactHash = sha256(artifact);
    expect(hashLine).toBe(`${artifactHash}  rollback_rehearsal.sql`);
    expect(manifest.status).toBe("rollback-only-not-authorized-for-persistent-apply");
    expect(manifest.artifact.sha256).toBe(artifactHash);
    for (const source of Object.values(manifest.sources)) {
      expect(source.sha256).toBe(sha256(read(source.path)));
    }
    expect(artifact).toContain(
      `Exact migration SHA-256: ${manifest.sources.migration.sha256}`,
    );
  });

  it("is staging-only, exercises real browser roles, and ends in rollback", () => {
    expect(artifact).toContain("requires exactly one staging marker");
    expect(artifact).toContain("set local role authenticated;");
    expect(artifact).toContain("set local role anon;");
    expect(artifact).toContain("outsider_write_denied");
    expect(artifact).toContain("outsider_report");
    expect(artifact).toContain("member_read_only_denied");
    expect(artifact).toContain("-- All fields in this final row must be true.");
    expect(artifact).toContain("rollback;\n\n-- All fields");
    expect(artifact).not.toMatch(/^\s*commit;\s*$/gim);
    expect(artifact.match(/^\s*rollback;\s*$/gim)).toHaveLength(3);
    expect(readme).toContain("Nothing in this package authorizes that remote step");
    expect(readme).toContain("every field is `true`");
    expect(readme).toContain("provision_test_accounts.sql");
    expect(readme).toContain("teardown_test_accounts.sql");
    expect(readme).toContain("@staging.invalid");
    expect(provision).toContain("reviewed persistent forum baseline is incomplete");
    expect(provision).toContain("staging auth/profile store is not empty");
    expect(teardown).toContain("beta schema persisted");
    expect(teardown).toContain("exact three-user beta fixture set was not found");
    expect(provision).not.toContain("remove the forum schema before provisioning fixtures");
  });

  it("runs the complete delta proof and restores the persistent baseline", async () => {
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
          created_at timestamptz not null default now()
          ,updated_at timestamptz
        );
        create function auth.uid() returns uuid language sql stable as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
        $$;
        create function auth.role() returns text language sql stable as $$
          select nullif(current_setting('request.jwt.claim.role', true), '')
        $$;
        create table public.profiles (
          id uuid primary key references auth.users(id) on delete cascade,
          username text,
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
      for (const source of baselineSources) await pg.exec(read(source));

      await pg.exec(provision);
      await pg.exec(artifact);

      const restored = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') as beta_table,
          to_regprocedure('public.forum_is_beta_member()') as beta_check,
          (select count(*)::integer from public.forum_posts) as posts,
          (select count(*)::integer from public.forum_comments) as comments,
          (select count(*)::integer from public.forum_reports) as reports,
          (select count(*)::integer from public.profiles) as profiles,
          (select count(*)::integer from auth.users) as auth_users
      `);
      expect(restored.rows[0]).toEqual({
        mode: "off",
        beta_table: null,
        beta_check: null,
        posts: 0,
        comments: 0,
        reports: 0,
        profiles: 3,
        auth_users: 3,
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
