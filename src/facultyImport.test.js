import { describe, expect, it } from "vitest";
import {
  courseImportRpc, playlistImportRpc, selectedTeacherIds, withFacultySelection, withSourceTitle,
} from "./facultyImport.js";

const BASE = { title: "Kinematics" };
const ABJ = { teacher_id: 7, display_name: "Amit Bijarnia" };
const NS = { teacher_id: 9, display_name: "Nitin Sachan" };

describe("faculty import's three-state contract", () => {
  it("omits teacher_ids when replacement is off, preserving existing links", () => {
    const payload = withFacultySelection(BASE, {
      capability: true, replace: false, selected: [ABJ],
    });
    expect(Object.hasOwn(payload, "teacher_ids")).toBe(false);
    expect(playlistImportRpc(payload)).toBe("import_playlist");
  });

  it("includes an empty array only for an explicit clear", () => {
    const payload = withFacultySelection(BASE, {
      capability: true, replace: true, selected: [],
    });
    expect(payload.teacher_ids).toEqual([]);
    expect(playlistImportRpc(payload)).toBe("import_playlist_with_teachers");
  });

  it("preserves selected order for instructor and co-instructor", () => {
    const payload = withFacultySelection(BASE, {
      capability: true, replace: true, selected: [ABJ, NS],
    });
    expect(payload.teacher_ids).toEqual([7, 9]);
    expect(courseImportRpc(payload)).toBe("create_course_with_teachers");
  });

  it("refuses to send teacher_ids before capability is proven", () => {
    expect(() => withFacultySelection(BASE, {
      capability: false, replace: true, selected: [ABJ],
    })).toThrow(/not installed/i);
  });

  it("refuses invalid and duplicate selected ids", () => {
    expect(() => selectedTeacherIds([{ teacher_id: "ABJ" }])).toThrow(/valid id/i);
    expect(() => selectedTeacherIds([ABJ, ABJ])).toThrow(/selected twice/i);
  });

  it("captures a source title only when the database proves support", () => {
    expect(withSourceTitle({ title: "Curated" }, " Raw YouTube title ", false))
      .toEqual({ title: "Curated" });
    expect(withSourceTitle({ title: "Curated" }, " Raw YouTube title ", true))
      .toEqual({ title: "Curated", source_title: "Raw YouTube title" });
    expect(playlistImportRpc({ title: "Curated", source_title: "Raw" }))
      .toBe("import_playlist_with_quality");
  });
});
