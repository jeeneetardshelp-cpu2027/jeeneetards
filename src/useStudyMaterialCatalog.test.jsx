import { describe, expect, it, vi } from "vitest";
import {
  fetchStudyMaterialCatalog,
  mapStudyMaterialCatalog,
  scopeStudyMaterialCatalog,
} from "./useStudyMaterialCatalog.js";

const rows = [
  { level: "goal", entity_id: 4, slug: "school", name: "School Boards", resource_count: 1 },
  { level: "board", entity_id: 1, slug: "cbse", name: "CBSE", resource_count: 1 },
  { level: "class", entity_id: 11, slug: "class-11", name: "Class 11", resource_count: 1 },
  { level: "subject", entity_id: 1, slug: "physics", name: "Physics", resource_count: 1 },
  { level: "chapter", entity_id: 1, slug: "kinematics", name: "Kinematics", resource_count: 1 },
];

describe("study-material curriculum", () => {
  it("maps material-backed taxonomy levels without relying on course rows", () => {
    expect(mapStudyMaterialCatalog(rows)).toEqual({
      goals: [{ id: 4, slug: "school", name: "School Boards", count: 1 }],
      boards: [{ id: 1, slug: "cbse", name: "CBSE", count: 1 }],
      classes: [{ id: 11, slug: "class-11", name: "Class 11", count: 1 }],
      subjects: [{ id: 1, slug: "physics", name: "Physics", count: 1 }],
      chapters: [{ id: 1, slug: "kinematics", name: "Kinematics", count: 1 }],
    });
  });

  it("passes the active material filter path through one bounded RPC", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    const result = await fetchStudyMaterialCatalog({ rpc }, {
      goal: "school", board: "cbse", stage: "class-11", subject: "physics",
    });

    expect(rpc).toHaveBeenCalledWith("get_study_material_curriculum", {
      p_goal_slug: "school",
      p_board_slug: "cbse",
      p_class_slug: "class-11",
      p_subject_slug: "physics",
    });
    expect(result.data.chapters[0].slug).toBe("kinematics");
  });

  // The RPC answers for the whole library when a level is unfiltered, so with
  // no subject chosen `chapters` was every chapter of every subject of every
  // exam — the hundreds of options that made the chapter control unusable.
  it("offers no chapters until a subject is chosen", () => {
    const full = mapStudyMaterialCatalog(rows);

    expect(scopeStudyMaterialCatalog(full, { goal: "school" }).chapters).toEqual([]);
    expect(scopeStudyMaterialCatalog(full, { goal: "school", subject: "physics" }).chapters)
      .toEqual(full.chapters);
  });

  it("offers no class, board or subject list until an exam is chosen", () => {
    const scoped = scopeStudyMaterialCatalog(mapStudyMaterialCatalog(rows), {});

    expect(scoped.goals).toHaveLength(1);
    expect(scoped.boards).toEqual([]);
    expect(scoped.classes).toEqual([]);
    expect(scoped.subjects).toEqual([]);
    expect(scoped.chapters).toEqual([]);
  });

  it("scopes what the hook hands components, not only what a select renders", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: rows, error: null }));
    const result = await fetchStudyMaterialCatalog({ rpc }, { goal: "school" });

    expect(result.data.chapters).toEqual([]);
    expect(result.data.subjects).toHaveLength(1);
  });
});
