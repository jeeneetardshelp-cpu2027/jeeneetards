import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { paperIncludesAnswerKey, paperIncludesSolutions } from "./studyMaterialLandings.js";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2023_official_final_answer_keys_seed_2026-08-27.sql",
  "utf8",
);
const existingFinalKeysSeed = readFileSync(
  "docs/sql/study_materials_jee_main_official_final_answer_keys_seed_2026-08-25.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2023-official-final-answer-keys-manifest.json",
  "utf8",
));
const migration = readFileSync("src/migrations/study_materials_v1.sql", "utf8");

async function productionShapedDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;

    create function public.is_admin()
    returns boolean language sql stable as $$ select false $$;

    create table public.learning_goals (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.boards (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.class_levels (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.subjects (
      id bigint primary key, name text not null, slug text not null unique,
      display_order integer not null default 0
    );
    create table public.chapters (
      id bigint primary key,
      subject_id bigint not null references public.subjects(id),
      name text not null, slug text not null, display_order integer not null default 0,
      unique (subject_id, name), unique (subject_id, slug)
    );
    create table public.videos (
      id bigint primary key, chapter_id bigint references public.chapters(id)
    );

    insert into public.learning_goals values (1, 'JEE', 'jee', 1);
    insert into public.boards values (1, 'CBSE', 'cbse', 1);
    insert into public.class_levels values (12, 'Class 12', 'class-12', 1);
    insert into public.subjects values (1, 'Physics', 'physics', 1);
    insert into public.chapters values (1, 1, 'Kinematics', 'kinematics', 1);
    insert into public.videos values (1, 1);

    grant select on public.learning_goals, public.boards,
      public.class_levels, public.subjects, public.chapters
      to anon, authenticated;
  `);
  await db.exec(migration);
  return db;
}

describe("JEE Main 2023 official final answer-key package", () => {
  it("contains the two distinct official Paper 1 final answer keys", () => {
    expect(manifest.resources).toHaveLength(2);
    expect(manifest.exclusions).toContain("superseded 24 April 2023");
    expect(manifest.exclusions).toContain("Paper 2 B.Arch/B.Planning");
    expect(manifest.hostingPolicy).toContain("not mirrored");
    expect(manifest.resources.map(({ examYear, session }) => [examYear, session])).toEqual([
      [2023, 1], [2023, 2],
    ]);
    expect(new Set(manifest.resources.map(({ sourceUrl }) => sourceUrl)).size).toBe(2);
    expect(new Set(manifest.resources.map(({ sha256 }) => sha256)).size).toBe(2);

    for (const resource of manifest.resources) {
      expect(resource.title).toContain("JEE Main 2023");
      expect(resource.title).toContain("Final Answer Key");
      expect(resource.title).toContain("Paper 1 B.E./B.Tech");
      expect(resource.sourceUrl).toMatch(
        /^https:\/\/cdnbbsr\.s3waas\.gov\.in\/.+\.pdf$/,
      );
      expect(resource.sha256).toMatch(/^[A-F0-9]{64}$/);
      expect(resource.pageCount).toBe(12);
      expect(seed).toContain(resource.title);
      expect(seed).toContain(resource.sourceUrl);
      expect(seed).toContain(`, ${resource.examYear}, ${resource.pageCount})`);
      expect(paperIncludesAnswerKey(resource)).toBe(true);
      expect(paperIncludesSolutions(resource)).toBe(false);
    }
  });

  it("excludes the superseded provisional Session 2 URL", () => {
    expect(seed).not.toContain("2023042419.pdf");
    expect(manifest.resources.every(({ sourceUrl }) => !sourceUrl.endsWith("2023042419.pdf"))).toBe(true);
  });

  it("is link-only, transactional, rerunnable and fail-closed", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("source URL collisions");
    expect(seed).toContain("title collisions");
    expect(seed).toContain("expected 2 materials");
    expect(seed).toContain("expected exactly 2 total scopes");
    expect(seed).toContain("expected 2 JEE-only scopes");
    expect(seed).toContain("metadata mismatches");
    expect(seed.trimEnd()).toMatch(/commit;$/i);
  });

  it("uses one exam-level JEE scope without false attachments", () => {
    expect(seed).toContain("where slug = 'jee'");
    expect(seed).toContain("material_id, learning_goal_id");
    expect(seed).toContain("board_id is null");
    expect(seed).toContain("class_level_id is null");
    expect(seed).toContain("subject_id is null");
    expect(seed).toContain("chapter_id is null");
    expect(seed).not.toContain("where slug = 'neet'");
    expect(seed).not.toContain("where slug = 'school'");
  });

  it("rehearses twice against the study-material schema without drift", async () => {
    const db = await productionShapedDatabase();
    try {
      await db.exec(existingFinalKeysSeed);
      await db.exec(seed);
      await db.exec(seed);

      const materials = await db.query(`
        select count(*)::integer as count
          from public.study_materials
         where title like 'JEE Main 2023%Final Answer Key (Paper 1 B.E./B.Tech)'
           and rights_status = 'official_source'
           and review_status = 'approved'
      `);
      expect(materials.rows[0].count).toBe(2);

      const scopes = await db.query(`
        select count(*)::integer as count
          from public.study_material_scopes s
          join public.study_materials m on m.id = s.material_id
          join public.learning_goals g on g.id = s.learning_goal_id
         where m.title like 'JEE Main 2023%Final Answer Key (Paper 1 B.E./B.Tech)'
           and g.slug = 'jee'
           and s.board_id is null
           and s.class_level_id is null
           and s.subject_id is null
           and s.chapter_id is null
      `);
      expect(scopes.rows[0].count).toBe(2);

      const allFinalKeys = await db.query(`
        select count(*)::integer as count
          from public.study_materials
         where title like 'JEE Main % Final Answer Key (Paper 1 B.E./B.Tech)'
      `);
      expect(allFinalKeys.rows[0].count).toBe(8);
    } finally {
      await db.close();
    }
  });
});
