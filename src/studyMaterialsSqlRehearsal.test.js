import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const migration = readFileSync("src/migrations/study_materials_v1.sql", "utf8");
const curriculumMigration = readFileSync(
  "src/migrations/study_materials_v2_catalog.sql",
  "utf8",
);
const ncertSeed = readFileSync(
  "docs/sql/study_materials_ncert_kinematics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11PhysicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_physics_seed_2026-08-05.sql",
  "utf8",
);

async function productionShapedDatabase() {
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
      id bigint primary key, subject_id bigint not null references public.subjects(id),
      name text not null, slug text not null, display_order integer not null default 0
    );
    create table public.videos (
      id bigint primary key, chapter_id bigint references public.chapters(id)
    );

    insert into public.learning_goals values
      (1, 'JEE', 'jee', 1), (2, 'NEET', 'neet', 2),
      (3, 'Olympiad', 'olympiad', 3), (4, 'School Boards', 'school', 4);
    insert into public.boards values (1, 'CBSE', 'cbse', 1);
    insert into public.class_levels values
      (10, 'Class 10', 'class-10', 1),
      (11, 'Class 11', 'class-11', 2),
      (12, 'Class 12', 'class-12', 3);
    insert into public.subjects values
      (1, 'Physics', 'physics', 1), (2, 'Chemistry', 'chemistry', 2);
    insert into public.chapters values
      (100, 1, 'Motion in a Straight Line', 'motion-in-a-straight-line', 1),
      (101, 1, 'Kinematics', 'kinematics', 2),
      (28, 1, 'Units and Measurements', 'units-and-measurements', 3),
      (82, 1, 'Laws of Motion', 'laws-of-motion', 4),
      (6, 1, 'Newton''s Laws of Motion (NLM)', 'newtons-laws-of-motion-nlm', 5),
      (7, 1, 'Friction', 'friction', 6),
      (21, 1, 'Work, Energy and Power', 'work-energy-and-power', 7),
      (22, 1, 'System of Particles and Centre of Mass', 'system-of-particles-and-centre-of-mass', 8),
      (27, 1, 'Rotational Motion', 'rotational-motion', 9),
      (81, 1, 'Gravitation', 'gravitation', 10),
      (24, 1, 'Mechanical Properties of Solids', 'mechanical-properties-of-solids', 11),
      (26, 1, 'Mechanical Properties of Fluids', 'mechanical-properties-of-fluids', 12),
      (25, 1, 'Thermal Properties of Matter', 'thermal-properties-of-matter', 13),
      (23, 1, 'Thermodynamics', 'thermodynamics', 14),
      (275, 1, 'Kinetic Theory of Gases', 'kinetic-theory-of-gases', 15),
      (84, 1, 'Oscillations and Waves', 'oscillations-and-waves', 16),
      (200, 2, 'Redox Reactions', 'redox-reactions', 1);
    insert into public.videos values (1000, 100);

    grant select on public.learning_goals, public.boards,
      public.class_levels, public.subjects, public.chapters
      to anon, authenticated;
  `);
  await pg.exec(migration);
  return pg;
}

describe("study materials v1 local SQL rehearsal", () => {
  it("loads the complete NCERT Class 11 Physics set once across all three curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11PhysicsSeed);
      await pg.exec(ncertClass11PhysicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 14, scopes: 51 });

      const sources = await pg.query(`
        select source_url, page_count
          from public.study_materials
         order by source_url
      `);
      expect(sources.rows).toHaveLength(14);
      expect(sources.rows[0]).toEqual({
        source_url: "https://ncert.nic.in/textbook/pdf/keph101.pdf",
        page_count: 12,
      });
      expect(sources.rows.at(-1)).toEqual({
        source_url: "https://ncert.nic.in/textbook/pdf/keph207.pdf",
        page_count: 22,
      });

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics'
        )
      `);
      expect(jee.rows).toHaveLength(14);
      expect(Number(jee.rows[0].total_count)).toBe(14);

      const kinematics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'kinematics'
        )
      `);
      expect(kinematics.rows).toHaveLength(2);

      const oscillations = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'oscillations-and-waves'
        )
      `);
      expect(oscillations.rows).toHaveLength(2);
    } finally {
      await pg.close();
    }
  });

  it("exposes CBSE material taxonomy even when no matching course exists", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertSeed);
      await pg.exec(curriculumMigration);
      await pg.exec("set role anon");

      const curriculum = await pg.query(`
        select level, slug, name, resource_count::integer
          from public.get_study_material_curriculum(
            p_goal_slug => 'school',
            p_board_slug => 'cbse',
            p_class_slug => 'class-11',
            p_subject_slug => 'physics'
          )
      `);
      expect(curriculum.rows).toEqual(expect.arrayContaining([
        { level: "goal", slug: "school", name: "School Boards", resource_count: 1 },
        { level: "board", slug: "cbse", name: "CBSE", resource_count: 1 },
        { level: "class", slug: "class-11", name: "Class 11", resource_count: 1 },
        { level: "subject", slug: "physics", name: "Physics", resource_count: 1 },
        { level: "chapter", slug: "kinematics", name: "Kinematics", resource_count: 1 },
      ]));

      await pg.exec("reset role");
    } finally {
      await pg.close();
    }
  });

  it("publishes the reviewed NCERT chapter once across JEE, NEET and CBSE scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertSeed);
      await pg.exec(ncertSeed);

      const material = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'kinematics'
        )
      `);
      expect(material.rows).toHaveLength(1);
      expect(material.rows[0]).toMatchObject({
        title: "Motion in a Straight Line — NCERT Physics",
        material_type: "full_notes",
        source_name: "NCERT",
        source_url: "https://ncert.nic.in/textbook/pdf/keph102.pdf",
        page_count: 14,
      });
      expect(material.rows[0].scopes).toHaveLength(3);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 1, scopes: 3 });
    } finally {
      await pg.close();
    }
  });

  it("executes and returns one shared approved resource in directory and lecture scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      const approved = await pg.query(`
        insert into public.study_materials (
          title, material_type, source_name, source_url, file_format,
          rights_status, review_status, published_at
        ) values (
          'Straight-line motion formula sheet', 'formula_sheet', 'Official source',
          'https://example.edu/motion-formulas.pdf', 'pdf',
          'official_source', 'approved', now()
        ) returning id
      `);
      const materialId = approved.rows[0].id;
      await pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values
          (${materialId}, 1, 11, 1, 100),
          (${materialId}, 2, 11, 1, 100);
        insert into public.study_material_videos (material_id, video_id)
        values (${materialId}, 1000);

        insert into public.study_materials (
          title, material_type, source_name, source_url, rights_status
        ) values (
          'Unreviewed notes', 'short_notes', 'Unknown',
          'https://example.edu/unreviewed', 'creator_permission'
        );
      `);

      const directory = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics',
          p_chapter_slug => 'motion-in-a-straight-line'
        )
      `);
      expect(directory.rows).toHaveLength(1);
      expect(directory.rows[0]).toMatchObject({
        title: "Straight-line motion formula sheet",
        material_type: "formula_sheet",
        total_count: 1,
      });
      expect(directory.rows[0].scopes).toHaveLength(2);

      const lecture = await pg.query(`
        select * from public.get_study_materials(
          p_chapter_id => 100,
          p_video_id => 1000
        )
      `);
      expect(lecture.rows).toHaveLength(1);
      expect(lecture.rows[0].id).toBe(materialId);

      await pg.exec("set role anon");
      const publicRows = await pg.query("select title from public.study_materials order by title");
      expect(publicRows.rows.map((row) => row.title)).toEqual([
        "Straight-line motion formula sheet",
      ]);
      await pg.exec("reset role");
    } finally {
      await pg.close();
    }
  });

  it("rejects mismatched chapter subjects and non-School board scopes", async () => {
    const pg = await productionShapedDatabase();
    try {
      const inserted = await pg.query(`
        insert into public.study_materials (
          title, material_type, source_name, source_url,
          rights_status, review_status, published_at
        ) values (
          'Reviewed notes', 'full_notes', 'Creator',
          'https://example.edu/reviewed-notes',
          'creator_permission', 'approved', now()
        ) returning id
      `);
      const materialId = inserted.rows[0].id;

      await expect(pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, class_level_id, subject_id, chapter_id
        ) values (${materialId}, 1, 11, 2, 100)
      `)).rejects.toThrow(/chapter and subject do not match/i);

      await expect(pg.exec(`
        insert into public.study_material_scopes (
          material_id, learning_goal_id, board_id, class_level_id
        ) values (${materialId}, 1, 1, 11)
      `)).rejects.toThrow(/must use the School learning goal/i);
    } finally {
      await pg.close();
    }
  });
});
