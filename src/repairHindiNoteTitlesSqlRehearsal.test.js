// repairHindiNoteTitlesSqlRehearsal.test.js
//
// WHAT IS REAL HERE. These tests EXECUTE
// supabase/migrations/20260902220000_repair_hindi_note_titles.sql on a real
// PostgreSQL engine (PGlite, Postgres compiled to WASM), against a
// study_materials table taken verbatim from the production baseline dump — so
// the CHECK constraints, the column types, the unique constraint and the
// migration's own preflight and postflight DO blocks all actually run. The
// damaged rows are seeded from repairHindiNoteTitles.fixture.js, which is what
// production actually held, captured read-only before the repair.
//
// WHY THAT FIXTURE EXISTS. An earlier draft of this file could not fail. It
// built its own fixture by masking the migration's recovered titles and then
// asserted the mask matched — mask(x) === mask(x), true for any string. Swap
// two titles between ids and all twelve tests stayed green; an adversarial
// review reproduced exactly that. Two of these rows share a damaged title byte
// for byte, so the mask can never tell them apart. The chapter scope is what
// does, and it now comes from the fixture rather than from the file under test.
//
// WHAT IS NOT REAL. Only the rows this repair touches are seeded, plus control
// rows that must NOT be touched. So this proves CORRECTNESS and IDEMPOTENCE; it
// says nothing about timing, though the UPDATEs are keyed by primary key.

import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

import { PRODUCTION_ROWS } from "./repairHindiNoteTitles.fixture.js";

const BASELINE = "supabase/migrations/20260831140005_production_baseline.sql";
const REPAIR = "supabase/migrations/20260902220000_repair_hindi_note_titles.sql";
const SEEDS = [
  "docs/sql/study_materials_ncert_class10_hindi_a_seed_2026-08-05.sql",
  "docs/sql/study_materials_ncert_class10_hindi_b_seed_2026-08-05.sql",
];

const baseline = readFileSync(BASELINE, "utf8");
const repair = readFileSync(REPAIR, "utf8");

/** Pull one CREATE TABLE statement out of the baseline dump. */
function baselineTable(name) {
  const head = `CREATE TABLE IF NOT EXISTS "public"."${name}" (`;
  const start = baseline.indexOf(head);
  expect(start, `baseline has no table ${name}`).toBeGreaterThan(-1);
  const end = baseline.indexOf("\n);", start);
  return `${baseline.slice(start, end)}\n);`;
}

/** The damage: every non-ASCII character collapsed to one '?'. */
const mask = (s) => [...s].map((c) => (c.codePointAt(0) < 128 ? c : "?")).join("");

const SQL_STR = "'((?:[^']|'')*)'";
const unq = (s) => s.replace(/''/g, "'");

/** What the migration says it will write, parsed out of the file itself. */
function updates() {
  const re = new RegExp(
    "-- id (\\d+) -- ([^\\n]*)\\n"
    + "update public\\.study_materials\\n"
    + "\\s*set title = " + SQL_STR + ",\\n"
    + "\\s*description = " + SQL_STR + "\\n"
    + "\\s*where id = (\\d+)\\n", "g");
  const rows = [];
  let m;
  while ((m = re.exec(repair)) !== null) {
    expect(Number(m[5]), "the comment id and the WHERE id disagree").toBe(Number(m[1]));
    rows.push({ id: Number(m[1]), comment: m[2].trim(), title: unq(m[3]), description: unq(m[4]) });
  }
  expect(rows.length, "no UPDATE statements parsed out of the migration").toBeGreaterThan(0);
  return rows;
}

/** Every (title, description) pair the original seed packages actually contain. */
function seededPairs() {
  const pairs = [];
  for (const file of SEEDS) {
    const text = readFileSync(file, "utf8");
    const re = new RegExp("\\(\\s*" + SQL_STR + "\\s*,\\s*\\n\\s*" + SQL_STR + "\\s*,", "g");
    let m;
    while ((m = re.exec(text)) !== null) pairs.push({ title: unq(m[1]), description: unq(m[2]) });
  }
  expect(pairs.length, "no rows parsed out of the seed packages").toBeGreaterThan(0);
  return pairs;
}

const UPDATES = updates();
const SEEDED = seededPairs();
const PROD = Object.fromEntries(PRODUCTION_ROWS.map((r) => [r.id, r]));

// Control rows that must survive untouched.
const CONTROL = {
  id: 87,
  title: "How do Organisms Reproduce? - NCERT Science",
  description: "Official NCERT chapter covering asexual and sexual reproduction.",
};
const LOOKALIKE = { id: 9001, title: "??? - NCERT ??????", description: "??? ???" };

let pg;

async function seed(rows) {
  for (const r of rows) {
    await pg.query(
      `insert into public.study_materials
         (id, title, description, material_type, source_name, source_url,
          rights_status, review_status, published_at)
       values ($1, $2, $3, 'full_notes', 'NCERT', $4, 'official_source', 'approved', now())`,
      [r.id, r.title, r.description, `https://example.test/${r.id}`],
    );
  }
}

async function rowOf(id) {
  const { rows } = await pg.query(
    "select title, description from public.study_materials where id = $1", [id]);
  return rows[0];
}

beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(baselineTable("study_materials"));
  // Seeded from what PRODUCTION held, not from the migration under test.
  await seed(PRODUCTION_ROWS.map((r) => ({
    id: r.id, title: r.damagedTitle, description: r.damagedDescription,
  })));
  await seed([CONTROL, LOOKALIKE]);
}, 120_000);

// ===========================================================================
// The mapping. This is the failure that matters: writing a real Hindi title
// onto the wrong row is silent, plausible-looking damage nobody catches by eye.
// ===========================================================================
describe("every row is repaired with ITS OWN title", () => {
  it("covers exactly the rows production has damaged, no more and no fewer", () => {
    expect(UPDATES.map((u) => u.id).sort((a, b) => a - b))
      .toEqual(PRODUCTION_ROWS.map((r) => r.id).sort((a, b) => a - b));
    expect(new Set(UPDATES.map((u) => u.id)).size).toBe(UPDATES.length);
    expect(new Set(UPDATES.map((u) => u.title)).size, "two rows given the same title")
      .toBe(UPDATES.length);
  });

  it.each(UPDATES.map((u) => [u.id, u.title]))(
    "gives id %s a title belonging to its own chapter", (id, title) => {
      // Chapter names come from study_material_scopes, which was never damaged,
      // and from the fixture rather than the migration. This catches a swap.
      const prod = PROD[id];
      expect(prod, `id ${id} is not in the production fixture`).toBeTruthy();
      expect(prod.chapters.length).toBeGreaterThan(0);
      for (const chapter of prod.chapters) {
        expect(title, `id ${id} does not mention its chapter ${chapter}`).toContain(chapter);
      }
      if (prod.chapters.length === 1) {
        expect(title.startsWith(prod.chapters[0] + " - NCERT "),
          `id ${id}: ${JSON.stringify(title)} should lead with ${JSON.stringify(prod.chapters[0])}`)
          .toBe(true);
      }
    });

  it("masks back to the exact string production is holding", () => {
    for (const u of UPDATES) {
      expect(mask(u.title), `id ${u.id} title`).toBe(PROD[u.id].damagedTitle);
      expect(mask(u.description), `id ${u.id} description`).toBe(PROD[u.id].damagedDescription);
    }
  });

  it("writes only text that appears verbatim in the original seed packages", () => {
    // Nothing is invented or retyped: every value is recovered from a file that
    // was never damaged.
    for (const u of UPDATES) {
      const hit = SEEDED.find((s) => s.title === u.title && s.description === u.description);
      expect(hit, `id ${u.id}: ${JSON.stringify(u.title)} is in no seed package`).toBeTruthy();
    }
  });

  it("keeps the colliding pairs apart, which the mask alone cannot", () => {
    // Two pairs hold byte-identical damaged titles. If the mask were the only
    // check, swapping either pair would go completely unnoticed.
    const byDamage = {};
    for (const r of PRODUCTION_ROWS) (byDamage[r.damagedTitle] ||= []).push(r.id);
    const collisions = Object.values(byDamage).filter((v) => v.length > 1);
    expect(collisions.length, "the collisions this guard exists for are gone").toBeGreaterThan(0);
    for (const ids of collisions) {
      for (const id of ids) {
        const u = UPDATES.find((x) => x.id === id);
        expect(u.title.startsWith(PROD[id].chapters[0]),
          `id ${id} got a title from its collision partner`).toBe(true);
      }
    }
  });

  it("agrees with its own comment about which chapter each row is", () => {
    for (const u of UPDATES) {
      expect(u.title.startsWith(u.comment.split(" + ")[0]),
        `id ${u.id}: comment says ${JSON.stringify(u.comment)} but title is ${JSON.stringify(u.title)}`)
        .toBe(true);
    }
  });
});

describe("the database really is holding the damage this repair describes", () => {
  it("stores every target as pure ASCII question marks before the repair", async () => {
    for (const r of PRODUCTION_ROWS) {
      const { rows } = await pg.query(
        `select length(title) as chars, octet_length(title) as bytes
           from public.study_materials where id = $1`, [r.id]);
      expect(Number(rows[0].chars), `id ${r.id}`).toBe(Number(rows[0].bytes));
      expect(r.damagedTitle).toContain("?");
    }
  });
});

describe("running the repair", () => {
  it("restores the Devanagari in every target row", async () => {
    await pg.exec(repair);
    for (const u of UPDATES) {
      const row = await rowOf(u.id);
      expect(row.title, `id ${u.id}`).toBe(u.title);
      expect(row.description, `id ${u.id}`).toBe(u.description);
      expect(row.title).not.toContain("?");
    }
  });

  it("leaves real multibyte text behind, not more ASCII", async () => {
    await pg.exec(repair);
    const { rows } = await pg.query(
      `select count(*)::int as n from public.study_materials
        where id = any($1) and length(title) = octet_length(title)`,
      [UPDATES.map((u) => u.id)]);
    expect(rows[0].n).toBe(0);
  });

  it("does not touch the English row whose question mark is real", async () => {
    await pg.exec(repair);
    const row = await rowOf(CONTROL.id);
    expect(row.title).toBe(CONTROL.title);
    expect(row.description).toBe(CONTROL.description);
  });

  it("repairs exactly the rows it names and no others", async () => {
    await pg.exec(repair);
    const row = await rowOf(LOOKALIKE.id);
    expect(row.title, "a look-alike row was repaired by accident").toBe(LOOKALIKE.title);
  });
});

describe("it is safe to run twice", () => {
  it("is a no-op the second time", async () => {
    await pg.exec(repair);
    const after1 = await Promise.all(UPDATES.map((u) => rowOf(u.id)));
    await pg.exec(repair);
    const after2 = await Promise.all(UPDATES.map((u) => rowOf(u.id)));
    expect(after2).toEqual(after1);
  });

  it("leaves a row alone once somebody has fixed it by hand", async () => {
    const u = UPDATES[0];
    await pg.query(
      "update public.study_materials set title = $2, description = $3 where id = $1",
      [u.id, "हाथ से ठीक किया हुआ शीर्षक", "हाथ से लिखा विवरण"]);
    await pg.exec(repair);
    const row = await rowOf(u.id);
    expect(row.title).toBe("हाथ से ठीक किया हुआ शीर्षक");
    expect(row.description).toBe("हाथ से लिखा विवरण");
  });

  it("finishes a row that was only half fixed", async () => {
    // Title corrected by hand, description still broken. An earlier draft
    // guarded on the exact damaged TITLE, skipped this row, and then failed its
    // own postflight over the description it had refused to touch.
    const u = UPDATES[0];
    await pg.query("update public.study_materials set title = $2 where id = $1", [u.id, u.title]);
    await pg.exec(repair);
    const row = await rowOf(u.id);
    expect(row.description).toBe(u.description);
    expect(row.description).not.toContain("?");
  });
});

describe("the postflight refuses to call a failed repair a success", () => {
  it("aborts if a target row is missing", async () => {
    await pg.query("delete from public.study_materials where id = $1", [UPDATES[0].id]);
    await expect(pg.exec(repair)).rejects.toThrow(/do not exist/i);
  });

  it("aborts if a repaired row still holds a question mark", async () => {
    await pg.exec(`
      create function public.break_it() returns trigger language plpgsql as $$
      begin
        new.title := '??? - NCERT ??????';
        new.description := '??? ???';
        return new;
      end $$;
      create trigger break_it before update on public.study_materials
        for each row execute function public.break_it();
    `);
    await expect(pg.exec(repair)).rejects.toThrow(/question mark|pure ASCII/i);
  });

it("aborts on mojibake that is multibyte and carries no question marks", async () => {
    // The failure the other two checks cannot see. A client encoding that
    // mangles UTF-8 into some OTHER multibyte sequence produces text with no
    // '?' in it that is not pure ASCII either — so only the code-point check
    // catches it.
    await pg.exec(`
      create function public.mojibake_it() returns trigger language plpgsql as $$
      begin
        new.title := 'Ã¤Â¸Â­ - NCERT Ã¥Â­Â¦';
        new.description := 'Ã¤Â¸Â­Ã¦Â-Â‡';
        return new;
      end $$;
      create trigger mojibake_it before update on public.study_materials
        for each row execute function public.mojibake_it();
    `);
    await expect(pg.exec(repair)).rejects.toThrow(/Devanagari character/i);
  });

  it("aborts if the Devanagari is silently flattened to ASCII", async () => {
    await pg.exec(`
      create function public.flatten_it() returns trigger language plpgsql as $$
      begin
        new.title := 'plain ascii title';
        new.description := 'plain ascii description';
        return new;
      end $$;
      create trigger flatten_it before update on public.study_materials
        for each row execute function public.flatten_it();
    `);
    await expect(pg.exec(repair)).rejects.toThrow(/pure ASCII/i);
  });
});
