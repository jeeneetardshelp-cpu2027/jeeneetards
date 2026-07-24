import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const hooks = vi.hoisted(() => ({
  capability: null,
  search: null,
}));

vi.mock("./useFaculty.js", () => ({
  useFacultyImportCapability: () => hooks.capability,
  useAdminTeacherSearch: () => hooks.search,
}));
vi.mock("./useBrowse.js", () => ({ useDebouncedValue: (value) => value }));

import TeacherPicker from "./TeacherPicker.jsx";

const ABJ_ONE = {
  teacher_id: 7, display_name: "Amit Bijarnia", verified: true,
  matched_on: "ABJ Sir", alias_status: "verified", is_ambiguous: true,
  institutes: "Competishun", subjects: "Physics", course_count: 3,
};
const ABJ_TWO = {
  teacher_id: 8, display_name: "Amit Bijarnia", verified: true,
  matched_on: "ABJ Sir", alias_status: "verified", is_ambiguous: true,
  institutes: "Example Academy", subjects: "Chemistry", course_count: 1,
};

beforeEach(() => {
  hooks.capability = {
    supported: true, loading: false, error: null, unavailable: false, retry: vi.fn(),
  };
  hooks.search = { results: [ABJ_ONE, ABJ_TWO], loading: false, error: null };
});

describe("TeacherPicker", () => {
  it("does not render an unsafe picker when the atomic import capability is absent", () => {
    hooks.capability = {
      supported: false, loading: false, error: null, unavailable: true, retry: vi.fn(),
    };
    render(<TeacherPicker value={[]} onChange={() => {}} />);
    expect(screen.getByText(/registry not installed yet/i)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: /search faculty registry/i })).toBeNull();
  });

  it("preserves links until the curator explicitly enables replacement", () => {
    const replace = vi.fn();
    render(
      <TeacherPicker value={[]} onChange={() => {}} replace={false} onReplaceChange={replace} />,
    );
    expect(screen.getByText(/links will be preserved/i)).toBeDefined();
    expect(screen.queryByRole("textbox", { name: /search faculty registry/i })).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(replace).toHaveBeenCalledWith(true);
  });

  it("shows every tied candidate and selects nothing automatically", () => {
    const change = vi.fn();
    render(<TeacherPicker value={[]} onChange={change} />);
    fireEvent.change(screen.getByRole("textbox", { name: /search faculty registry/i }), {
      target: { value: "ABJ" },
    });
    expect(screen.getByText(/several faculty match equally/i)).toBeDefined();
    expect(screen.getAllByText("Amit Bijarnia")).toHaveLength(2);
    expect(screen.getByText(/Competishun · Physics/)).toBeDefined();
    expect(screen.getByText(/Example Academy · Chemistry/)).toBeDefined();
    expect(change).not.toHaveBeenCalled();
  });

  it("adds exactly the candidate the curator clicks", () => {
    const change = vi.fn();
    render(<TeacherPicker value={[]} onChange={change} />);
    fireEvent.change(screen.getByRole("textbox", { name: /search faculty registry/i }), {
      target: { value: "ABJ" },
    });
    const buttons = screen.getAllByRole("button", { name: /Amit Bijarnia/i });
    fireEvent.click(buttons[1]);
    expect(change).toHaveBeenCalledWith([ABJ_TWO]);
  });
});
