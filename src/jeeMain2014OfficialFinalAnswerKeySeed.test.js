import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { paperIncludesAnswerKey, paperIncludesSolutions } from "./studyMaterialLandings.js";

const seed = readFileSync(
  "docs/sql/study_materials_jee_main_2014_official_final_answer_key_seed_2026-09-04.sql",
  "utf8",
);
const manifest = JSON.parse(readFileSync(
  "docs/study-materials/jee-main-2014-official-final-answer-key-manifest.json",
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
  await db.exec(`
    alter table public.study_materials
      add column paper_kind text,
      add column paper_year integer,
      add column exam_session text,
      add column exam_shift text;
  `);
  return db;
}

describe("JEE Main 2014 official final answer-key package", () => {
  it("contains the complete official Paper 1 final answer key", () => {
    expect(manifest.resources).toHaveLength(1);
    expect(manifest.coverage).toContain("offline Sets E-H");
    expect(manifest.verification).toContain("All eight pages");
    expect(manifest.exclusions).toContain("Paper 2 KEY2.pdf");
    expect(manifest.hostingPolicy).toContain("not mirrored");

    const [resource] = manifest.resources;
    expect(resource.title).toBe("JEE Main 2014 Final Answer Key (Paper 1 B.E./B.Tech)");
    expect(resource.officialFilename).toBe("FINAL JEE14 KEY.pdf");
    expect(resource.officialHeading).toBe("JEE(Main) - 2014 Final Key");
    expect(resource.offlineExamDate).toBe("2014-04-06");
    expect(resource.offlineSets).toEqual(["E", "F", "G", "H"]);
    expect(resource.onlineExamDates).toEqual([
      "2014-04-09", "2014-04-11", "2014-04-12", "2014-04-19",
    ]);
    expect(resource.pageCount).toBe(8);
    expect(resource.sourceUrl).toBe(
      "https://web.archive.org/web/20140513105647id_/http://jeemain.nic.in:80/jeemainapp/PDF/FINAL%20JEE14%20KEY.pdf",
    );
    expect(resource.sha256).toBe("CA3AF766C9444D58F76B1D2187A83E482D45790D5D79A5CFC916077088CA5C0B");
    expect(seed).toContain(resource.title);
    expect(seed).toContain(resource.sourceUrl);
    expect(paperIncludesAnswerKey(resource)).toBe(true);
    expect(paperIncludesSolutions(resource)).toBe(false);
  });

  it("keeps the provisional key, Paper 2 and unofficial solutions out", () => {
    expect(manifest.exclusions).toContain("earlier consolidated answerkey.pdf");
    expect(manifest.exclusions).toContain("candidate response/OMR records");
    expect(manifest.exclusions).toContain("third-party worked solutions");
    expect(seed).toContain("does not include worked solutions");
  });

  it("is link-only, structured, transactional, rerunnable and fail-closed", () => {
    expect(seed).toMatch(/^--[\s\S]*\nbegin;/i);
    expect(seed).toContain("'previous_year_paper'");
    expect(seed).toContain("'official_source'");
    expect(seed).toContain("'answer_key'");
    expect(seed).toContain("paper_year");
    expect(seed).toContain("Linked only; not mirrored or redistributed by JEENEETARD");
    expect(seed).toContain("on conflict (title, source_url) do update set");
    expect(seed).toContain("source URL collisions");
    expect(seed).toContain("title collisions");
    expect(seed).toContain("expected 1 material");
    expect(seed).toContain("expected exactly 1 total scope");
    expect(seed).toContain("expected 1 JEE-only scope");
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

  it("rehearses twice against a production-shaped schema without drift", async () => {
    const db = await productionShapedDatabase();
    try {
      await db.exec(seed);
      await db.exec(seed);

      const materials = await db.query(`
        select count(*)::integer as count
          from public.study_materials
         where title = 'JEE Main 2014 Final Answer Key (Paper 1 B.E./B.Tech)'
           and rights_status = 'official_source'
           and review_status = 'approved'
           and paper_kind = 'answer_key'
           and paper_year = 2014
           and exam_session is null
           and exam_shift is null
      `);
      expect(materials.rows[0].count).toBe(1);

      const scopes = await db.query(`
        select count(*)::integer as count
          from public.study_material_scopes s
          join public.study_materials m on m.id = s.material_id
          join public.learning_goals g on g.id = s.learning_goal_id
         where m.title = 'JEE Main 2014 Final Answer Key (Paper 1 B.E./B.Tech)'
           and g.slug = 'jee'
           and s.board_id is null
           and s.class_level_id is null
           and s.subject_id is null
           and s.chapter_id is null
      `);
      expect(scopes.rows[0].count).toBe(1);
    } finally {
      await db.close();
    }
  });
});
