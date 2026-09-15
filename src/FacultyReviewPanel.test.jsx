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

  // 8 Sep 2026: names that existing faculty already answered to were approved
  // "as new" and made 40 duplicate teachers. The database now refuses that
  // (check_violation, hint duplicate_faculty) unless the call says it is a
  // different person, and this panel is where a curator says so.
  const duplicateRefusal = () => Object.assign(
    new Error('Existing faculty already match "ABJ Sir": Amit Bijarnia (#7). Link this name to them, or confirm it is a different person to create a separate record.'),
    { code: "23514", hint: "duplicate_faculty" },
  );

  it("asks before creating a person existing faculty already answer to", async () => {
    mocks.action.mockRejectedValueOnce(duplicateRefusal()).mockResolvedValueOnce({ ok: true });
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    const confirm = await screen.findByRole("button", { name: /different person/i });
    expect(screen.getByText(/Existing faculty already match/)).toBeTruthy();
    // The first attempt never claims to have checked: no acknowledgement sent.
    expect(mocks.action).toHaveBeenCalledTimes(1);
    expect(mocks.action.mock.calls[0]).toEqual([
      "approve_faculty_review_group_as_new",
      { p_normalized: "abj", p_display_name: "ABJ Sir", p_verified: false },
    ]);
    expect(mocks.action.mock.calls[0][1]).not.toHaveProperty("p_duplicate_acknowledged");

    fireEvent.click(confirm);
    await waitFor(() => expect(mocks.action).toHaveBeenCalledTimes(2));
    expect(mocks.action.mock.calls[1]).toEqual([
      "approve_faculty_review_group_as_new",
      { p_normalized: "abj", p_display_name: "ABJ Sir", p_verified: false, p_duplicate_acknowledged: true },
    ]);
  });

  it("offers no override for any other failure", async () => {
    mocks.action.mockRejectedValueOnce(Object.assign(new Error("not authorized"), { code: "42501" }));
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    expect(await screen.findByText("not authorized")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("offers no override for a check_violation that is not the duplicate check", async () => {
    mocks.action.mockRejectedValueOnce(Object.assign(new Error("new row violates check constraint"), { code: "23514" }));
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    expect(await screen.findByText(/violates check constraint/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("forgets the confirmation once the name is edited, because that name was not checked", async () => {
    mocks.action.mockRejectedValueOnce(duplicateRefusal());
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));
    await screen.findByRole("button", { name: /different person/i });

    fireEvent.change(screen.getByLabelText(/Create as a new person/i), { target: { value: "Abhay Jain" } });

    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("offers no override for the hint without the database's check_violation code", async () => {
    mocks.action.mockRejectedValueOnce(Object.assign(new Error("something else"), { code: "P0001", hint: "duplicate_faculty" }));
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    expect(await screen.findByText("something else")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("does not ask again when the confirmed attempt is refused too", async () => {
    // Asking a second time would loop the curator; the refusal is shown instead.
    mocks.action.mockRejectedValueOnce(duplicateRefusal()).mockRejectedValueOnce(duplicateRefusal());
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));
    fireEvent.click(await screen.findByRole("button", { name: /different person/i }));

    await waitFor(() => expect(mocks.action).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Existing faculty already match/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("names who matched and links to them, even when they are not among the suggested faculty", async () => {
    // Typed "Alakh Pandey" over a course credited "ABJ Sir": the database
    // refuses on the typed name, and Alakh Pandey is not in this group's
    // candidates, so without this the only ways out were "create anyway" --
    // the 8 Sep duplicate -- or rejecting the name.
    mocks.action
      .mockRejectedValueOnce(Object.assign(
        new Error('Existing faculty already match "Alakh Pandey": Alakh Pandey (#29). Link this name to them, or confirm it is a different person to create a separate record.'),
        { code: "23514", hint: "duplicate_faculty", details: '[{"slug": "alakh-pandey", "teacher_id": 29, "display_name": "Alakh Pandey"}]' },
      ))
      .mockResolvedValueOnce({ ok: true });
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.change(screen.getByLabelText(/Create as a new person/i), { target: { value: "Alakh Pandey" } });
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    const link = await screen.findByRole("button", { name: "Link to Alakh Pandey" });
    expect(screen.getByRole("alert").textContent).toContain("Alakh Pandey (#29)");
    fireEvent.click(link);
    await waitFor(() => expect(mocks.action).toHaveBeenLastCalledWith(
      "approve_group_as_existing",
      { p_normalized: "abj", p_teacher_id: 29, p_add_alias: true },
    ));
  });

  it("shows the refusal for a name typed with a trailing space", async () => {
    // The call sends the trimmed name, so the alert must compare trimmed too,
    // or a refusal would vanish without a word.
    mocks.action.mockRejectedValueOnce(duplicateRefusal());
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.change(screen.getByLabelText(/Create as a new person/i), { target: { value: "ABJ Sir " } });
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    expect(await screen.findByRole("button", { name: /different person/i })).toBeTruthy();
  });

  it("never shows one group's refusal under another group with the same typed name", async () => {
    // Confirming there would create a teacher for the FIRST group's courses.
    const OTHER = {
      normalized: "abj two", kind: "single", total_occurrences: 1,
      variants: [{ proposal_id: 3, raw_teacher: "A.B.J. Sir", occurrences: 1 }],
      candidates: [],
    };
    mocks.review = { groups: [SINGLE, OTHER], loading: false, error: null, unavailable: false, reload };
    mocks.action.mockRejectedValueOnce(duplicateRefusal());
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir \(3\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));
    await screen.findByRole("button", { name: /different person/i });

    fireEvent.click(screen.getByRole("button", { name: /A\.B\.J\. Sir/ }));
    fireEvent.change(screen.getByLabelText(/Create as a new person/i), { target: { value: "ABJ Sir" } });

    expect(screen.queryByRole("button", { name: /different person/i })).toBeNull();
  });

  it("holds the name still while a request is out, so a refusal cannot land on an edited name", async () => {
    let settle;
    mocks.action.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    render(<FacultyReviewPanel />);
    fireEvent.click(screen.getByRole("button", { name: /ABJ Sir/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create separately/i }));

    expect(screen.getByLabelText(/Create as a new person/i).disabled).toBe(true);
    settle({ ok: true });
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });
});
