import { describe, expect, it, vi } from "vitest";
import {
  fetchStudyMaterials,
  isMissingStudyMaterialsRpc,
  mapStudyMaterial,
  materialTypeLabel,
  STUDY_MATERIAL_PAGE_SIZE,
} from "./useStudyMaterials.js";

const row = {
  id: 7,
  title: "Motion in a straight line formula sheet",
  description: "Core graphs and equations.",
  material_type: "formula_sheet",
  source_name: "Official source",
  source_url: "https://example.edu/motion.pdf",
  preview_image_url: "https://example.edu/motion.jpg",
  file_format: "pdf",
  language: "English",
  exam_year: null,
  page_count: 4,
  is_downloadable: true,
  rights_status: "official_source",
  scopes: [{
    goal: "jee",
    board: null,
    class: "class-11",
    subject: { id: 1, slug: "physics", name: "Physics" },
    chapter: { id: 100, slug: "motion-in-a-straight-line", name: "Motion in a Straight Line" },
  }],
  total_count: 1,
};

describe("study-material mapping", () => {
  it("maps the reviewed RPC row into the shared card shape", () => {
    expect(mapStudyMaterial(row)).toEqual({
      id: 7,
      title: "Motion in a straight line formula sheet",
      description: "Core graphs and equations.",
      type: "formula_sheet",
      typeLabel: "Formula sheets",
      sourceName: "Official source",
      sourceUrl: "https://example.edu/motion.pdf",
      previewImageUrl: "https://example.edu/motion.jpg",
      fileFormat: "pdf",
      language: "English",
      examYear: null,
      pageCount: 4,
      downloadable: true,
      rightsStatus: "official_source",
      scopes: row.scopes,
    });
  });

  it("drops malformed or non-HTTPS sources", () => {
    expect(mapStudyMaterial({ ...row, source_url: "http://example.edu/file" })).toBeNull();
    expect(mapStudyMaterial({ ...row, title: "" })).toBeNull();
    expect(materialTypeLabel("unknown")).toBe("Study material");
  });
});

describe("bounded study-material read", () => {
  it("passes directory and lecture context through one bounded RPC", async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: [row], error: null }));
    const result = await fetchStudyMaterials({ rpc }, {
      goal: "jee",
      stage: "class-11",
      subject: "physics",
      chapter: "motion-in-a-straight-line",
      chapterId: 100,
      videoId: 1000,
      type: "formula_sheet",
      limit: 999,
      offset: -4,
    });

    expect(rpc).toHaveBeenCalledWith("get_study_materials", {
      p_goal_slug: "jee",
      p_board_slug: null,
      p_class_slug: "class-11",
      p_subject_slug: "physics",
      p_chapter_slug: "motion-in-a-straight-line",
      p_chapter_id: 100,
      p_video_id: 1000,
      p_material_type: "formula_sheet",
      p_limit: 100,
      p_offset: 0,
    });
    expect(result.data.items).toHaveLength(1);
    expect(result.data.total).toBe(1);
  });

  it("uses the public page bound by default and identifies an unreleased RPC", async () => {
    const missing = { code: "PGRST202", message: "function does not exist" };
    const rpc = vi.fn(() => Promise.resolve({ data: null, error: missing }));
    const result = await fetchStudyMaterials({ rpc });

    expect(rpc.mock.calls[0][1].p_limit).toBe(STUDY_MATERIAL_PAGE_SIZE);
    expect(result.unavailable).toBe(true);
    expect(isMissingStudyMaterialsRpc(missing)).toBe(true);
  });
});
