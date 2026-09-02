// searchGapLogSqlContract.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE the staged migration
// supabase/migrations/20260902210000_search_gap_log.sql on a real PostgreSQL
// engine (PGlite, Postgres compiled to WASM), including its own
// self-verification DO block. The privacy claims this table makes are claims
// about RLS, grants and function privileges, and the only honest way to check
// those is to ask a running Postgres. `set role anon` here is the same role
// the browser's anon key maps to in production.
//
// The search key helpers (normalize_search_text, translit_devanagari,
// search_latin_key) are not re-typed: they are extracted verbatim from the
// production baseline dump, so the grouping behaviour tested is production's.
//
// WHAT IS NOT REAL. auth.uid(), auth.role() and profiles are minimal
// stand-ins built the way src/forumV1SqlRehearsal.test.js builds them, and
// the migration is NOT applied to production (see its DO-NOT-APPLY banner).

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const MIGRATION = "supabase/migrations/20260902210000_search_gap_log.sql";

const baseline = readFileSync(BASELINE, "utf8");
const migration = readFileSync(MIGRATION, "utf8");

/** Pull one CREATE OR REPLACE FUNCTION statement out of the baseline dump. */
function baselineFunction(name) {
  const head = `CREATE OR REPLACE FUNCTION "public"."${name}"(`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no function ${name}`).toBeGreaterThan(-1);
  const rest = baseline.slice(start);
  const opened = /\sAS (\$[A-Za-z_]*\$)/.exec(rest);
  expect(opened, `no dollar-quoted body for ${name}`).toBeTruthy();
  const bodyStart = opened.index + opened[0].length;
  const closed = rest.indexOf(opened[1], bodyStart);
  return rest.slice(0, rest.indexOf(";", closed + opened[1].length) + 1);
}

const ADMIN = "00000000-0000-4000-8000-000000000001";
const STUDENT = "00000000-0000-4000-8000-000000000002";

let pg;

async function asRole(role, uid, run) {
  await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await pg.query("select set_config('request.jwt.claim.role', $1, false)", [role]);
  await pg.exec(`set role ${role}`);
  try {
    return await run();
  } finally {
    await pg.exec("reset role");
  }
}

const rowCount = async () => {
  const { rows } = await pg.query("select count(*)::int as n from public.search_gap_log");
  return rows[0].n;
};

const allRows = async () => {
  const { rows } = await pg.query(
    "select query_text, query_key, result_count from public.search_gap_log order by id",
  );
  return rows;
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;

    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select nullif(current_setting('request.jwt.claim.role', true), '')
    $$;

    create table public.profiles (
      id uuid primary key references auth.users(id) on delete cascade,
      is_admin boolean not null default false
    );
    create function public.is_admin() returns boolean
    language sql stable security definer set search_path = 'public' as $$
      select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
    $$;

    grant usage on schema public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    grant execute on function auth.role() to anon, authenticated, service_role;
    grant execute on function public.is_admin() to anon, authenticated, service_role;
  `);

  // The real search key, straight from the baseline.
  for (const fn of ["normalize_search_text", "translit_devanagari", "search_latin_key"]) {
    await pg.exec(baselineFunction(fn));
  }
  await pg.exec(
    "grant execute on function public.search_latin_key(text) to anon, authenticated, service_role",
  );

  await pg.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${STUDENT}');
    insert into public.profiles (id, is_admin) values ('${ADMIN}', true), ('${STUDENT}', false);
  `);

  // The migration itself, self-verification DO block and all.
  await pg.exec(migration);
});

describe("search gap log migration", () => {
  it("is in the chain only because the Privacy Policy names it", () => {
    // This file used to assert a DO NOT APPLY banner, which was the only thing
    // standing between `supabase db push` and collecting student-typed text the
    // policy did not mention. The banner came off on 2 Sep 2026 when the
    // disclosure landed, and the guard inverts rather than disappears: the file
    // now sits in supabase/migrations/, so a push WILL create the table, and
    // the policy must therefore keep naming it. Deleting the disclosure while
    // this file is in the chain fails here (and in legalTruth.test.js).
    expect(MIGRATION).toMatch(/^supabase\/migrations\//);
    expect(readFileSync("src/PrivacyPolicy.jsx", "utf8")).toContain("search_gap_log");
    expect(migration).toContain("search_gap_log");
    expect(migration).not.toContain("DO NOT APPLY YET");
    expect(migration.trimEnd()).toMatch(/commit;$/i);
  });

  it("stores the query and nothing that identifies who typed it", async () => {
    const { rows } = await pg.query(`
      select column_name, is_nullable, data_type
        from information_schema.columns
       where table_schema = 'public' and table_name = 'search_gap_log'
       order by ordinal_position
    `);
    expect(rows.map((r) => r.column_name)).toEqual([
      "id", "query_text", "query_key", "result_count", "created_at",
    ]);
    // Named explicitly rather than implied by the list above, so that adding
    // one of these later fails here as well as in the migration's self-test.
    for (const forbidden of [
      "user_id", "session_id", "ip", "ip_address", "device_id",
      "fingerprint", "client_id", "anon_id", "user_agent", "referrer",
    ]) {
      expect(rows.map((r) => r.column_name)).not.toContain(forbidden);
    }
  });

  it("enables RLS with exactly one policy: admins read", async () => {
    const { rows: rls } = await pg.query(`
      select c.relrowsecurity
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = 'search_gap_log'
    `);
    expect(rls[0].relrowsecurity).toBe(true);

    const { rows: policies } = await pg.query(`
      select policyname, cmd, roles::text, qual
        from pg_policies
       where schemaname = 'public' and tablename = 'search_gap_log'
    `);
    expect(policies).toHaveLength(1);
    expect(policies[0].cmd).toBe("SELECT");
    expect(policies[0].roles).toContain("authenticated");
    expect(policies[0].qual).toMatch(/is_admin/);
  });

  it("grants anon nothing on the table and authenticated only SELECT", async () => {
    const { rows } = await pg.query(`
      select grantee, privilege_type
        from information_schema.role_table_grants
       where table_schema = 'public' and table_name = 'search_gap_log'
         and grantee in ('anon', 'authenticated', 'PUBLIC')
    `);
    expect(rows.filter((r) => r.grantee === "anon")).toEqual([]);
    expect(rows.filter((r) => r.grantee === "PUBLIC")).toEqual([]);
    expect(rows.filter((r) => r.grantee === "authenticated").map((r) => r.privilege_type))
      .toEqual(["SELECT"]);

    const { rows: priv } = await pg.query(`
      select has_table_privilege('anon', 'public.search_gap_log', 'SELECT') as anon_select,
             has_table_privilege('anon', 'public.search_gap_log', 'INSERT') as anon_insert,
             has_table_privilege('authenticated', 'public.search_gap_log', 'INSERT') as auth_insert,
             has_function_privilege('anon', 'public.log_search_gap(text, integer)', 'EXECUTE') as anon_exec
    `);
    expect(priv[0]).toEqual({
      anon_select: false, anon_insert: false, auth_insert: false, anon_exec: true,
    });
  });

  it("ships the writer as SECURITY DEFINER with an empty search_path", async () => {
    const { rows } = await pg.query(`
      select p.prosecdef, p.proconfig::text
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'log_search_gap'
    `);
    expect(rows).toHaveLength(1);
    expect(rows[0].prosecdef).toBe(true);
    expect(rows[0].proconfig).toMatch(/search_path=/);
  });

  it("lets anon log a gap but never read the log back", async () => {
    const before = await rowCount();
    await asRole("anon", null, async () => {
      await pg.query("select public.log_search_gap($1, $2)", ["thermodynamics cheat sheet", 0]);
      await expect(
        pg.query("select * from public.search_gap_log"),
      ).rejects.toThrow(/permission denied/i);
    });
    expect(await rowCount()).toBe(before + 1);
  });

  it("hides the log from a signed-in student and shows it to an admin", async () => {
    await asRole("authenticated", STUDENT, async () => {
      const { rows } = await pg.query("select * from public.search_gap_log");
      expect(rows).toEqual([]);          // RLS, not an error: the policy denies
    });
    await asRole("authenticated", ADMIN, async () => {
      const { rows } = await pg.query("select * from public.search_gap_log");
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it("refuses a direct insert even from an admin", async () => {
    await asRole("authenticated", ADMIN, async () => {
      await expect(
        pg.query("insert into public.search_gap_log (query_text, query_key) values ('x','x')"),
      ).rejects.toThrow(/permission denied/i);
    });
  });

  it("normalises the stored key the way universal_search matches", async () => {
    await pg.query("select public.log_search_gap($1, 0)", ["  Rotational  MOTION!  "]);
    const [row] = (await allRows()).filter((r) => r.query_key.includes("rotational"));
    expect(row.query_text).toBe("Rotational  MOTION!");   // trimmed, as typed
    expect(row.query_key).toBe("rotational motion");      // search_latin_key
  });

  it("collapses a Devanagari and a Latin spelling of one gap onto one row", async () => {
    // translit_devanagari maps both to the same key, so the second call is a
    // duplicate and adds nothing — which is the point of keying on it.
    const before = await rowCount();
    await pg.query("select public.log_search_gap($1, 0)", ["गति"]);
    const afterFirst = await rowCount();
    expect(afterFirst).toBe(before + 1);
    const { rows } = await pg.query(
      "select query_key from public.search_gap_log order by id desc limit 1",
    );
    await pg.query("select public.log_search_gap($1, 0)", [rows[0].query_key]);
    expect(await rowCount()).toBe(afterFirst);
  });

  it("dedupes the same query inside the window", async () => {
    const before = await rowCount();
    await pg.query("select public.log_search_gap($1, 0)", ["organic chemistry mechanisms"]);
    await pg.query("select public.log_search_gap($1, 0)", ["Organic Chemistry Mechanisms"]);
    await pg.query("select public.log_search_gap($1, 0)", ["organic  chemistry  mechanisms!"]);
    expect(await rowCount()).toBe(before + 1);
  });

  it("ignores a query too short to be a search", async () => {
    const before = await rowCount();
    await pg.query("select public.log_search_gap($1, 0)", ["k"]);
    await pg.query("select public.log_search_gap($1, 0)", ["  "]);
    await pg.query("select public.log_search_gap($1, 0)", [null]);
    await pg.query("select public.log_search_gap($1, 0)", ["!!! ???"]);
    expect(await rowCount()).toBe(before);
  });

  it("caps what it stores instead of rejecting a long paste", async () => {
    const long = `alpha ${"x".repeat(400)}`;
    await pg.query("select public.log_search_gap($1, 0)", [long]);
    const { rows } = await pg.query(`
      select query_text, query_key from public.search_gap_log
       where query_text like 'alpha %' order by id desc limit 1
    `);
    expect(rows[0].query_text).toHaveLength(120);
    expect(rows[0].query_key.length).toBeLessThanOrEqual(120);
  });

  it("clamps a client-asserted result count", async () => {
    await pg.query("select public.log_search_gap($1, $2)", ["nonsense count probe", -5]);
    await pg.query("select public.log_search_gap($1, $2)", ["another count probe", 99999999]);
    const rows = await allRows();
    const negative = rows.find((r) => r.query_text === "nonsense count probe");
    const huge = rows.find((r) => r.query_text === "another count probe");
    expect(negative.result_count).toBe(0);
    expect(huge.result_count).toBe(100000);
  });

  it("stops a flood at the per-minute ceiling instead of raising", async () => {
    // 60 distinct keys per minute is the ceiling; a script cycling strings
    // gets a quiet no-op rather than an error it could probe.
    const before = await rowCount();
    for (let i = 0; i < 90; i += 1) {
      await pg.query("select public.log_search_gap($1, 0)", [`flood probe ${i} zzq`]);
    }
    const after = await rowCount();
    expect(after).toBeGreaterThan(before);
    expect(after).toBeLessThanOrEqual(60);
  });

  it("is safe to re-run", async () => {
    await expect(pg.exec(migration)).resolves.toBeTruthy();
  });
});
