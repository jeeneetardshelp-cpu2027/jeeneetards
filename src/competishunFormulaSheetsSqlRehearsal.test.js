import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/study_materials_v1.sql", "utf8");
const catalogMigration = readFileSync("src/migrations/study_materials_v2_catalog.sql", "utf8");
const seed = readFileSync(
  "docs/sql/study_materials_competishun_formula_sheets_seed_2026-08-06.sql",
  "utf8",
);

async function formulaSheetDatabase() {
  const pg = new PGlite();
  await pg.exec(`
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
      name text not null, slug text not null,
      display_order integer not null default 0,
      unique (subject_id, name), unique (subject_id, slug)
    );
    create table public.videos (
      id bigint primary key,
      chapter_id bigint references public.chapters(id)
    );

    insert into public.learning_goals values
      (1, 'JEE', 'jee', 1),
      (2, 'NEET', 'neet', 2),
      (3, 'School Boards', 'school', 3);
    insert into public.boards values (1, 'CBSE', 'cbse', 1);
    insert into public.class_levels values
      (11, 'Class 11', 'class-11', 1),
      (12, 'Class 12', 'class-12', 2);
    insert into public.subjects values
      (1, 'Physics', 'physics', 1),
      (2, 'Chemistry', 'chemistry', 2),
      (3, 'Mathematics', 'mathematics', 3);
    insert into public.chapters values
      (101, 3, 'Statistics', 'statistics', 1),
      (102, 2, 'Ionic Equilibrium', 'ionic-equilibrium', 1),
      (103, 1, 'Friction', 'friction', 1),
      (104, 2, 'Organic Reaction Mechanisms', 'organic-reaction-mechanisms', 2),
      (105, 3, 'Relations and Functions', 'relations-and-functions', 2),
      (106, 1, 'Work, Energy and Power', 'work-energy-and-power', 2),
      (107, 2, 'Chemical Equilibrium', 'chemical-equilibrium', 3),
      (108, 2, 'Some Basic Principles of Organic Chemistry', 'some-basic-principles-of-organic-chemistry', 4),
      (109, 3, 'Quadratic Equations', 'quadratic-equations', 3),
      (110, 2, 'Chemical Bonding and Molecular Structure', 'chemical-bonding-and-molecular-structure', 5),
      (111, 1, 'Newton''s Laws of Motion (NLM)', 'newtons-laws-of-motion-nlm', 3),
      (112, 2, 'Structural Isomerism', 'structural-isomerism', 6),
      (113, 2, 'Stereoisomerism', 'stereoisomerism', 7),
      (114, 3, 'Trigonometry', 'trigonometry', 4),
      (115, 2, 'Purification and Characterisation of Organic Compounds', 'purification-and-characterisation-of-organic-compounds', 8),
      (116, 3, 'Fundamentals of Mathematics', 'fundamentals-of-mathematics', 5),
      (117, 1, 'System of Particles and Centre of Mass', 'system-of-particles-and-centre-of-mass', 4),
      (118, 3, 'Sets', 'sets', 6),
      (119, 2, 'Mole Concept', 'mole-concept', 9),
      (120, 1, 'Basic Mathematics for Physics', 'basic-mathematics-for-physics', 5);
    insert into public.videos values (1001, 111), (1002, 108);
  `);
  await pg.exec(migration);
  await pg.exec(catalogMigration);
  return pg;
}

describe("Competishun formula-sheet SQL rehearsal", () => {
  it("is rerunnable and returns the intended JEE and NEET directories", async () => {
    const pg = await formulaSheetDatabase();
    try {
      await pg.exec(seed);
      await pg.exec(seed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 20, scopes: 36 });

      const jee = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_material_type => 'formula_sheet'
      )`);
      expect(jee.rows).toHaveLength(20);
      expect(Number(jee.rows[0].total_count)).toBe(20);
      expect(jee.rows.every((row) => row.source_name === "Competishun")).toBe(true);
      expect(jee.rows.every((row) => row.rights_status === "creator_permission")).toBe(true);
      expect(jee.rows.every((row) => row.preview_image_url?.endsWith(".jpg"))).toBe(true);

      const neet = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_material_type => 'formula_sheet'
      )`);
      expect(neet.rows).toHaveLength(14);
      expect(Number(neet.rows[0].total_count)).toBe(14);

      const neetMath = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'neet', p_subject_slug => 'mathematics',
        p_material_type => 'formula_sheet'
      )`);
      expect(neetMath.rows).toHaveLength(0);

      const jeeMath = await pg.query(`select * from public.get_study_materials(
        p_goal_slug => 'jee', p_subject_slug => 'mathematics',
        p_material_type => 'formula_sheet'
      )`);
      expect(jeeMath.rows).toHaveLength(6);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("makes chapter scopes visible beside matching lectures", async () => {
    const pg = await formulaSheetDatabase();
    try {
      await pg.exec(seed);

      const nlmLecture = await pg.query(`select * from public.get_study_materials(
        p_chapter_id => 111, p_video_id => 1001,
        p_material_type => 'formula_sheet'
      )`);
      expect(nlmLecture.rows).toHaveLength(1);
      expect(nlmLecture.rows[0].title).toContain("Newton's Laws of Motion");

      const organicLecture = await pg.query(`select * from public.get_study_materials(
        p_chapter_id => 108, p_video_id => 1002,
        p_material_type => 'formula_sheet'
      )`);
      expect(organicLecture.rows).toHaveLength(2);
      expect(organicLecture.rows.map((row) => row.title).sort()).toEqual([
        "GOC 1: Basic Organic Chemistry Formula Sheet",
        "IUPAC Nomenclature Formula Sheet",
      ]);

      const structural = await pg.query(`select * from public.get_study_materials(
        p_chapter_id => 112, p_material_type => 'formula_sheet'
      )`);
      const stereo = await pg.query(`select * from public.get_study_materials(
        p_chapter_id => 113, p_material_type => 'formula_sheet'
      )`);
      expect(structural.rows).toHaveLength(1);
      expect(stereo.rows).toHaveLength(1);
      expect(structural.rows[0].id).toBe(stereo.rows[0].id);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("exposes material-backed chapter filters for both goal pages", async () => {
    const pg = await formulaSheetDatabase();
    try {
      await pg.exec(seed);
      const jeeNodes = await pg.query(`select * from public.get_study_material_curriculum(
        p_goal_slug => 'jee'
      ) where level = 'chapter'`);
      const neetNodes = await pg.query(`select * from public.get_study_material_curriculum(
        p_goal_slug => 'neet'
      ) where level = 'chapter'`);
      expect(jeeNodes.rows).toHaveLength(20);
      // Fourteen distinct science chapters: Isomerism spans two chapters,
      // while GOC 1 and IUPAC intentionally share one chapter.
      expect(neetNodes.rows).toHaveLength(14);
      expect(neetNodes.rows.some((row) => row.slug === "statistics")).toBe(false);
      expect(neetNodes.rows.some((row) => row.slug === "friction")).toBe(true);
    } finally {
      await pg.close();
    }
  }, 30_000);
});
