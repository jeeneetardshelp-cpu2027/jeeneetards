import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  review: null,
  action: vi.fn(),
}));
vi.mock("./useFacultyReview.js", () => ({
  useFacultyReview: () => mocks.review,
  runFacultyReviewAction: (...args) => mocks.action(...args),
}));
vi.mock("./theme.jsx", () => ({
  useTheme: () => ({ t: { text: "", muted: "", faint: "", border: "", card: "", hover: "", divider: "" } }),
}));
vi.mock("./TeacherPicker.jsx", () => ({
  default: ({ onChange }) => (
    <button type="button" onClick={() => onChange([
      { teacher_id: 7, display_name: "Amit" },
      { teacher_id: 8, display_name: "Priya" },
    ])}>Choose two faculty</button>
  ),
}));

import FacultyReviewPanel from "./FacultyReviewPanel.jsx";

const reload = vi.fn().mockResolvedValue(undefined);
const SINGLE = {
  normalized: "abj", kind: "single", total_occurrences: 3,
  variants: [{ proposal_id: 1, raw_teacher: "ABJ Sir", occurrences: 3 }],
  candidates: [{ teacher_id: 7, display_name: "Amit Bijarnia", institutes: "Competishun", subjects: "Physics", course_count: 5 }],
};
const MULTI = {
  normalized: "amit priya", kind: "multi-person", total_occurrences: 1,
  variants: [{ proposal_id: 2, raw_teacher: "Amit & Priya", occurrences: 1 }],
  candidates: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.action.mockResolvedValue({ ok: true });
  mocks.review = { groups: [SINGLE], loading: false, error: null, unavailable: false, reload };
});

describe("FacultyReviewPanel", () => {
  it("feature-gates itself before the staging migration is installed", () => {
    mocks.review = { groups: [], loading: false, error: null, unavailable: true, reload };
    render(<FacultyReviewPanel />);
    expect(screen.getByText(/not installed yet/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Scan legacy names/i })).toBeNull();
  });

  // scan_free_text_teachers classifies by spelling, so "Magnet Brains" trips
  // no organisation keyword and arrives labelled `single` — offered as a
  // person to approve, which would list an institute in the faculty
  // directory. The separating fact is that every course carrying the name
  // sits on a channel of that name, and the panel now says so.
  it("warns when a proposal is only the channel’s own name", async () => {
    mocks.review = {
      groups: [{
        normalized: "magnet brains", kind: "single", total_occurrences: 10,
        variants: [{ proposal_id: 9, raw_teacher: "Magnet Brains", occurrences: 10 }],
        candidates: [],
        context: { total: 10, channelNamed: 10, isChannelName: true, channels: [{ name: "Magnet Brains", count: 10 }] },
      }],
      loading: false, error: null, unavailable: false, reload,
    };
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Magnet Brains/ }));
    expect(await screen.findByText(/likely the channel itself rather than a person/i)).toBeTruthy();
  });

  it("does NOT warn for a person whose channel merely carries their name", async () => {
    // Mohit Tyagi has 32 self-named courses and is a real teacher. A warning
    // here would tell the curator to reject somebody who exists.
    mocks.review = {
      groups: [{
        normalized: "mohit tyagi", kind: "single", total_occurrences: 6,
        variants: [{ proposal_id: 10, raw_teacher: "Mohit Tyagi", occurrences: 6 }],
        candidates: [],
        context: { total: 6, channelNamed: 1, isChannelName: false, channels: [{ name: "Competishun+", count: 5 }] },
      }],
      loading: false, error: null, unavailable: false, reload,
    };
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Mohit Tyagi/ }));
    expect(screen.queryByText(/likely the channel itself/i)).toBeNull();
  });

  it("shows which channels a name teaches on, so a split can be decided", () => {
    mocks.review = {
      groups: [{
        normalized: "sachin kapur", kind: "multi-person", total_occurrences: 14,
        variants: [{ proposal_id: 11, raw_teacher: "Dr. Sachin Kapur & Pushpendu Sir", occurrences: 14 }],
        candidates: [],
        context: { total: 14, channelNamed: 0, isChannelName: false, channels: [{ name: "Unacademy NEET", count: 14 }] },
      }],
      loading: false, error: null, unavailable: false, reload,
    };
    render(<FacultyReviewPanel />);
    // The summary line is built from several JSX interpolations, so it is
    // several text nodes in one span and getByText cannot see it whole.
    expect(document.body.textContent).toContain("on Unacademy NEET (14)");
  });
  it("does not link a candidate until the curator explicitly clicks it", async () => {
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    expect(screen.getByText(/Possible existing faculty/i)).toBeDefined();
    expect(mocks.action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Amit Bijarnia/i }));
    await waitFor(() => expect(mocks.action).toHaveBeenCalledWith(
      "approve_group_as_existing",
      { p_normalized: "abj", p_teacher_id: 7, p_add_alias: true },
    ));
  });

  it("requires at least two explicit records for a multi-person split", async () => {
    mocks.review = { groups: [MULTI], loading: false, error: null, unavailable: false, reload };
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Amit & Priya/i }));
    const split = screen.getByRole("button", { name: /Split into selected faculty/i });
    expect(split.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Choose two faculty/i }));
    expect(split.disabled).toBe(false);
    fireEvent.click(split);
    await waitFor(() => expect(mocks.action).toHaveBeenCalledWith(
      "split_faculty_review_group",
      { p_normalized: "amit priya", p_teacher_ids: [7, 8], p_override_kind: false },
    ));
  });
});
