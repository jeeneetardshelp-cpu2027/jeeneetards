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
const ncertClass12PhysicsSeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_physics_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11ChemistrySeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_chemistry_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass12ChemistrySeed = readFileSync(
  "docs/sql/study_materials_ncert_class12_chemistry_seed_2026-08-05.sql",
  "utf8",
);
const ncertClass11BiologySeed = readFileSync(
  "docs/sql/study_materials_ncert_class11_biology_seed_2026-08-05.sql",
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
      (1, 'Physics', 'physics', 1), (2, 'Chemistry', 'chemistry', 2),
      (3, 'Biology', 'biology', 3);
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
      (300, 1, 'Electrostatics', 'electrostatics', 17),
      (301, 1, 'Capacitance', 'capacitance', 18),
      (302, 1, 'Current Electricity', 'current-electricity', 19),
      (303, 1, 'Moving Charges and Magnetism', 'moving-charges-and-magnetism', 20),
      (304, 1, 'Magnetism and Matter', 'magnetism-and-matter', 21),
      (305, 1, 'Electromagnetic Induction', 'electromagnetic-induction', 22),
      (306, 1, 'Alternating Current', 'alternating-current', 23),
      (307, 1, 'Electromagnetic Waves', 'electromagnetic-waves', 24),
      (308, 1, 'Ray Optics and Optical Instruments', 'ray-optics-and-optical-instruments', 25),
      (309, 1, 'Wave Optics', 'wave-optics', 26),
      (310, 1, 'Dual Nature of Radiation and Matter', 'dual-nature-of-radiation-and-matter', 27),
      (311, 1, 'Atoms', 'atoms', 28),
      (312, 1, 'Modern Physics', 'modern-physics', 29),
      (313, 1, 'Semiconductor Electronics', 'semiconductor-electronics', 30),
      (200, 2, 'Redox Reactions', 'redox-reactions', 1),
      (201, 2, 'Introduction to Chemistry', 'introduction-to-chemistry', 2),
      (202, 2, 'Mole Concept', 'mole-concept', 3),
      (203, 2, 'Atomic Structure', 'atomic-structure', 4),
      (204, 2, 'Periodic Table', 'periodic-table', 5),
      (205, 2, 'Chemical Bonding and Molecular Structure', 'chemical-bonding-and-molecular-structure', 6),
      (206, 2, 'Thermodynamics', 'thermodynamics', 7),
      (207, 2, 'Thermochemistry', 'thermochemistry', 8),
      (208, 2, 'Chemical Equilibrium', 'chemical-equilibrium', 9),
      (209, 2, 'Ionic Equilibrium', 'ionic-equilibrium', 10),
      (210, 2, 'Purification and Characterisation of Organic Compounds', 'purification-and-characterisation-of-organic-compounds', 11),
      (211, 2, 'Some Basic Principles of Organic Chemistry', 'some-basic-principles-of-organic-chemistry', 12),
      (212, 2, 'Structural Isomerism', 'structural-isomerism', 13),
      (213, 2, 'Stereoisomerism', 'stereoisomerism', 14),
      (214, 2, 'Organic Reaction Mechanisms', 'organic-reaction-mechanisms', 15),
      (215, 2, 'Hydrocarbons', 'hydrocarbons', 16),
      (216, 2, 'Solutions', 'solutions', 17),
      (217, 2, 'Electrochemistry', 'electrochemistry', 18),
      (218, 2, 'Chemical Kinetics', 'chemical-kinetics', 19),
      (219, 2, 'The d- and f-Block Elements', 'the-d-and-f-block-elements', 20),
      (220, 2, 'Coordination Compounds', 'coordination-compounds', 21),
      (221, 2, 'Organic Compounds Containing Halogens', 'organic-compounds-containing-halogens', 22),
      (222, 2, 'Organic Compounds Containing Oxygen', 'organic-compounds-containing-oxygen', 23),
      (223, 2, 'Carboxylic Acids and Derivatives', 'carboxylic-acids-and-derivatives', 24),
      (224, 2, 'Organic Compounds Containing Nitrogen', 'organic-compounds-containing-nitrogen', 25),
      (225, 2, 'Amines', 'amines', 26),
      (226, 2, 'Biomolecules', 'biomolecules', 27),
      (400, 3, 'The Living World', 'the-living-world', 1),
      (401, 3, 'Biological Classification', 'biological-classification', 2),
      (402, 3, 'Plant Kingdom', 'plant-kingdom', 3),
      (403, 3, 'Animal Kingdom', 'animal-kingdom', 4),
      (404, 3, 'Morphology of Flowering Plants', 'morphology-of-flowering-plants', 5),
      (405, 3, 'Anatomy of Flowering Plants', 'anatomy-of-flowering-plants', 6),
      (406, 3, 'Structural Organisation in Animals', 'structural-organisation-in-animals', 7),
      (407, 3, 'Cell: The Unit of Life', 'cell-the-unit-of-life', 8),
      (408, 3, 'Biomolecules', 'biomolecules', 9),
      (409, 3, 'Cell Cycle and Cell Division', 'cell-cycle-and-cell-division', 10),
      (410, 3, 'Photosynthesis in Higher Plants', 'photosynthesis-in-higher-plants', 11),
      (411, 3, 'Respiration in Plants', 'respiration-in-plants', 12),
      (412, 3, 'Plant Growth and Development', 'plant-growth-and-development', 13),
      (413, 3, 'Breathing and Exchange of Gases', 'breathing-and-exchange-of-gases', 14),
      (414, 3, 'Body Fluids and Circulation', 'body-fluids-and-circulation', 15),
      (415, 3, 'Excretory Products and Their Elimination', 'excretory-products-and-their-elimination', 16),
      (416, 3, 'Locomotion and Movement', 'locomotion-and-movement', 17),
      (417, 3, 'Neural Control and Coordination', 'neural-control-and-coordination', 18),
      (418, 3, 'Chemical Coordination and Integration', 'chemical-coordination-and-integration', 19);
    insert into public.videos values (1000, 100);

    grant select on public.learning_goals, public.boards,
      public.class_levels, public.subjects, public.chapters
      to anon, authenticated;
  `);
  await pg.exec(migration);
  return pg;
}

describe("study materials v1 local SQL rehearsal", () => {
  it("loads the rationalised NCERT Class 11 Biology set for NEET and CBSE", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11BiologySeed);
      await pg.exec(ncertClass11BiologySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 19, scopes: 38 });

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'biology'
        )
      `);
      expect(class11.rows).toHaveLength(19);
      expect(Number(class11.rows[0].total_count)).toBe(19);

      for (const chapter of [
        'the-living-world',
        'cell-the-unit-of-life',
        'photosynthesis-in-higher-plants',
        'chemical-coordination-and-integration',
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'neet',
            p_class_slug => 'class-11',
            p_subject_slug => 'biology',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const jee = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'biology'
        )
      `);
      expect(jee.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 12 Chemistry set across all curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass12ChemistrySeed);
      await pg.exec(ncertClass12ChemistrySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 10, scopes: 36 });

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-12',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class12.rows).toHaveLength(10);
      expect(Number(class12.rows[0].total_count)).toBe(10);

      for (const [chapter, expected] of [
        ['organic-compounds-containing-oxygen', 2],
        ['carboxylic-acids-and-derivatives', 1],
        ['amines', 1],
      ]) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-12',
            p_subject_slug => 'chemistry',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(expected);
      }

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-11',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class11.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads the rationalised NCERT Class 11 Chemistry set across all curricula", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11ChemistrySeed);
      await pg.exec(ncertClass11ChemistrySeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 9, scopes: 48 });

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-11',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class11.rows).toHaveLength(9);
      expect(Number(class11.rows[0].total_count)).toBe(9);

      for (const chapter of ['thermochemistry', 'ionic-equilibrium', 'organic-reaction-mechanisms']) {
        const result = await pg.query(`
          select * from public.get_study_materials(
            p_goal_slug => 'jee',
            p_class_slug => 'class-11',
            p_subject_slug => 'chemistry',
            p_chapter_slug => '${chapter}'
          )
        `);
        expect(result.rows).toHaveLength(1);
      }

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-12',
          p_subject_slug => 'chemistry'
        )
      `);
      expect(class12.rows).toHaveLength(0);
    } finally {
      await pg.close();
    }
  }, 30_000);

  it("loads both complete NCERT Physics classes without cross-class leakage", async () => {
    const pg = await productionShapedDatabase();
    try {
      await pg.exec(ncertClass11PhysicsSeed);
      await pg.exec(ncertClass12PhysicsSeed);
      await pg.exec(ncertClass12PhysicsSeed);

      const counts = await pg.query(`
        select
          (select count(*)::integer from public.study_materials) as materials,
          (select count(*)::integer from public.study_material_scopes) as scopes
      `);
      expect(counts.rows[0]).toEqual({ materials: 28, scopes: 105 });

      const class12 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'school',
          p_board_slug => 'cbse',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics'
        )
      `);
      expect(class12.rows).toHaveLength(14);
      expect(Number(class12.rows[0].total_count)).toBe(14);

      const electrostatics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics',
          p_chapter_slug => 'electrostatics'
        )
      `);
      expect(electrostatics.rows).toHaveLength(2);

      const modernPhysics = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'neet',
          p_class_slug => 'class-12',
          p_subject_slug => 'physics',
          p_chapter_slug => 'modern-physics'
        )
      `);
      expect(modernPhysics.rows).toHaveLength(4);

      const class11 = await pg.query(`
        select * from public.get_study_materials(
          p_goal_slug => 'jee',
          p_class_slug => 'class-11',
          p_subject_slug => 'physics'
        )
      `);
      expect(class11.rows).toHaveLength(14);
    } finally {
      await pg.close();
    }
  }, 30_000);

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
