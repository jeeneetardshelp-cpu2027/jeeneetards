import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const directory = "staging/forum_closed_beta_v1_persistent";
const install = readFileSync(`${directory}/install.sql`, "utf8");
const hashLine = readFileSync(`${directory}/install.sql.sha256.txt`, "utf8").trim();
const manifest = JSON.parse(readFileSync(`${directory}/source_manifest.json`, "utf8"));
const readme = readFileSync(`${directory}/README.md`, "utf8");
const helper = readFileSync(`${directory}/http_fixture_helper.sql`, "utf8");
const helperRollback = readFileSync(
  `${directory}/http_fixture_helper_rollback.sql`, "utf8",
);
const verifier = readFileSync("src/scripts/verifyForumClosedBetaJwtStaging.js", "utf8");
const betaRollback = readFileSync("src/migrations/forum_closed_beta_v1_rollback.sql", "utf8");
const liveEvidenceRaw = readFileSync(
  `${directory}/REAL_STAGING_JWT_EVIDENCE_2026-08-07.json`, "utf8",
);
const liveEvidence = JSON.parse(liveEvidenceRaw);
const liveNotes = readFileSync(`${directory}/REAL_STAGING_NOTES.md`, "utf8");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const baselineSources = [
  "src/migrations/forum_v1.sql",
  "src/migrations/forum_username_claim_v1.sql",
  "src/migrations/forum_moderation_context_v1.sql",
  "src/migrations/forum_report_dismissal_v1.sql",
];

describe("forum closed-beta persistent staging and JWT package", () => {
  it("pins every reviewed input behind a pre-DDL staging and emptiness guard", () => {
    const artifactHash = sha256(install);
    expect(hashLine).toBe(`${artifactHash}  install.sql`);
    expect(manifest.status).toBe("persistent-disposable-staging-only-not-executed");
    expect(manifest.artifact.sha256).toBe(artifactHash);
    for (const source of Object.values(manifest.sources)) {
      expect(source.sha256).toBe(sha256(read(source.path)));
    }
    expect(install).toContain(
      `Migration SHA-256: ${manifest.sources.migration.sha256}`,
    );
    const guard = install.indexOf(
      "persistent closed beta requires exactly one staging marker",
    );
    const firstBetaDdl = install.indexOf("alter table public.forum_settings");
    expect(guard).toBeGreaterThan(-1);
    expect(firstBetaDdl).toBeGreaterThan(guard);
    expect(install).toContain("staging identity store is not empty");
    expect(install).toContain("staging forum data is not empty");
    expect(install).toContain("no_beta_members_created");
    expect(readme).toContain("nine fields and every field must be `true`");
    expect(readme).toContain("assertion is a stop condition");
  });

  it("keeps the temporary fixture helper staging-only and service-role-only", () => {
    const guard = helper.indexOf("requires exactly one staging marker");
    const create = helper.indexOf(
      "create function public.forum_stage_prepare_beta_http_fixtures",
    );
    expect(guard).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(guard);
    expect(helper).toContain("auth.role() <> 'service_role'");
    expect(helper).toContain("forum mode must remain off");
    expect(helper).toContain("exactly three distinct fixture user ids are required");
    expect(helper).toContain("@staging.invalid");
    expect(helper).toContain("now() - interval '20 minutes'");
    expect(helper).toContain("to service_role;");
    expect(helperRollback).toContain(
      "drop function if exists public.forum_stage_prepare_beta_http_fixtures",
    );
  });

  it("uses real JWTs, proves beta boundaries, and records shape-only evidence", () => {
    expect(verifier).toContain("auth.admin.createUser");
    expect(verifier).toContain("auth.signInWithPassword");
    expect(verifier).toContain("decodeJwtPayload");
    expect(verifier).toContain("forum_is_beta_member");
    expect(verifier).toContain("forum_admin_set_beta_member");
    expect(verifier).toContain("non-member publishing is denied in beta");
    expect(verifier).toContain("non-member can submit urgent safety report");
    expect(verifier).toContain('p_reason: "self_harm"');
    expect(verifier).toContain("removed member immediately loses beta write access");
    expect(verifier).toContain("non-member can write when mode is open");
    expect(verifier).toContain("read-only blocks publishing before membership evaluation");
    expect(verifier).toContain("const expectedCheckCount = 31");
    expect(verifier).toContain("verification count drifted");
    expect(verifier).toContain("beta_members: betaMemberCount");
    expect(verifier).toContain("fixture_user_stats");
    expect(verifier).toContain("raw_response_shape");
    expect(verifier).toContain("evidence detail missing raw_response_shape");
    expect(verifier).toContain("[REDACTED]");
    expect(verifier).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(verifier).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(verifier).not.toMatch(/service_role\s*=\s*["'][^"']+/i);
  });

  it("preserves a clean, zero-residue real staging evidence file", () => {
    expect(liveEvidence.project_ref).toBe("essmxonestbrgmgrtywn");
    expect(liveEvidence.environment).toBe("staging");
    expect(liveEvidence.tests).toHaveLength(31);
    expect(liveEvidence.tests.every((check) => (
      check.passed === true && check.detail?.raw_response_shape
    ))).toBe(true);
    expect(liveEvidence.fatal).toBeNull();
    expect(liveEvidence.cleanup).toMatchObject({ attempted: true, completed: true });
    expect(Object.values(liveEvidence.cleanup.residue).every((count) => count === 0))
      .toBe(true);
    expect(liveEvidenceRaw).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
    expect(liveEvidenceRaw).not.toContain("@staging.invalid");
    expect(liveEvidenceRaw).not.toMatch(/https:\/\/[^\s"]+\.supabase\.co/i);
    expect(liveNotes).toContain(`${sha256(liveEvidenceRaw)}`);
    expect(readme).toContain("REAL_STAGING_JWT_EVIDENCE_2026-08-07.json");
  });

  it("installs persistently and restores the reviewed baseline in PGlite", async () => {
    const pg = new PGlite();
    try {
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
        insert into public.app_environment (id, name) values (true, 'staging');
      `);
      for (const source of baselineSources) await pg.exec(read(source));

      await pg.exec(install);
      let state = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') is not null as beta_table,
          to_regprocedure('public.forum_is_beta_member()') is not null as beta_check,
          (select count(*)::integer from public.forum_beta_members) as beta_members,
          (select count(*)::integer from public.forum_posts) as posts
      `);
      expect(state.rows[0]).toEqual({
        mode: "off",
        beta_table: true,
        beta_check: true,
        beta_members: 0,
        posts: 0,
      });

      await pg.exec(helper);
      state = await pg.query(`
        select
          to_regprocedure(
            'public.forum_stage_prepare_beta_http_fixtures(text,uuid[])'
          ) is not null as helper_installed,
          has_function_privilege(
            'authenticated',
            'public.forum_stage_prepare_beta_http_fixtures(text,uuid[])',
            'EXECUTE'
          ) as authenticated_execute
      `);
      expect(state.rows[0]).toEqual({
        helper_installed: true,
        authenticated_execute: false,
      });

      await pg.exec(helperRollback);
      await pg.exec(betaRollback);
      state = await pg.query(`
        select
          public.forum_mode() as mode,
          to_regclass('public.forum_beta_members') as beta_table,
          to_regprocedure('public.forum_is_beta_member()') as beta_check,
          to_regprocedure(
            'public.forum_stage_prepare_beta_http_fixtures(text,uuid[])'
          ) as helper
      `);
      expect(state.rows[0]).toEqual({
        mode: "off",
        beta_table: null,
        beta_check: null,
        helper: null,
      });
    } finally {
      await pg.close();
    }
  }, 60_000);
});
