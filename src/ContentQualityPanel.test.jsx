import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "./theme.jsx";

const review = vi.fn();
const reload = vi.fn();
const queue = vi.fn();

vi.mock("./useContentQuality.js", () => ({
  useContentQualityQueue: () => queue(),
  reviewPlaylistQuality: (...args) => review(...args),
}));
vi.mock("./TeacherPicker.jsx", () => ({
  default: ({ onChange }) => (
    <button type="button" onClick={() => onChange([{ teacher_id: 7, display_name: "Amit Bijarnia" }])}>
      Choose Amit Bijarnia
    </button>
  ),
}));

import ContentQualityPanel from "./ContentQualityPanel.jsx";

const ROW = {
  playlist_id: 11,
  display_title: "newton's laws of motion",
  source_title: "newton's laws of motion",
  legacy_teacher: "ABJ Sir",
  institute: "Competishun",
  subject: "Physics",
  content_type: null,
  language: null,
  difficulty: null,
  title_review_status: "pending",
  faculty_credit_status: "pending",
  faculty: [],
  missing_fields: ["title-review", "faculty-credit", "course-type"],
};

beforeEach(() => {
  review.mockReset().mockResolvedValue({ quality_ready: true });
  reload.mockReset().mockResolvedValue(undefined);
  queue.mockReturnValue({ rows: [ROW], loading: false, error: null, unavailable: false, reload });
});

describe("ContentQualityPanel", () => {
  it("sends one explicit reviewed title, faculty identity and metadata decision", async () => {
    render(<ThemeProvider><ContentQualityPanel /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: /newton's laws of motion/i }));
    fireEvent.click(screen.getByRole("button", { name: "Use suggestion" }));

    // The controlled parent is intentionally not faked here; edit the field to
    // the same suggested value, then confirm the title review.
    fireEvent.change(screen.getByPlaceholderText("Complete Kinematics"), {
      target: { value: "Newton's Laws of Motion" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Faculty credit status"), { target: { value: "identified" } });
    fireEvent.click(screen.getByRole("button", { name: "Choose Amit Bijarnia" }));
    fireEvent.change(screen.getByLabelText("Course type"), { target: { value: "full-course" } });
    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "hinglish" } });
    fireEvent.change(screen.getByLabelText("Difficulty"), { target: { value: "advanced" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve reviewed metadata" }));

    await waitFor(() => expect(review).toHaveBeenCalledWith({
      p_playlist_id: 11,
      p_display_title: "Newton's Laws of Motion",
      p_teacher_ids: [7],
      p_faculty_status: "identified",
      p_content_type: "full-course",
      p_language: "hinglish",
      p_difficulty: "advanced",
      p_note: null,
    }));
    expect(reload).toHaveBeenCalled();
  });

  it("hides the workflow honestly when v10 is not installed", () => {
    queue.mockReturnValue({ rows: [], loading: false, error: null, unavailable: true, reload });
    render(<ThemeProvider><ContentQualityPanel /></ThemeProvider>);
    expect(screen.getByText(/not installed yet/i)).toBeTruthy();
  });
});

