// NotesPanel — the watch-page study-notes surface. These assert the behaviour a
// student depends on: a note they write appears, carries the playback time it
// was taken at, jumps the player back when clicked, and can be deleted — plus
// the honest "saved on this device" disclosure.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import NotesPanel, { formatTimestamp } from "./NotesPanel.jsx";

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

describe("formatTimestamp", () => {
  it("formats under and over an hour", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(42)).toBe("0:42");
    expect(formatTimestamp(90)).toBe("1:30");
    expect(formatTimestamp(3727)).toBe("1:02:07");
    expect(formatTimestamp(-5)).toBe("0:00");
  });
});

describe("NotesPanel", () => {
  it("renders nothing without a valid lesson identity", () => {
    const { container } = render(<NotesPanel playlistId={0} videoId="" />);
    expect(container.firstChild).toBeNull();
  });

  it("discloses that notes are device-local", () => {
    render(<NotesPanel playlistId={5} videoId="abc" />);
    expect(screen.getByText(/saved on this device/i)).toBeTruthy();
  });

  it("disables Add until there is text, then saves and clears the box", () => {
    render(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 42} />);
    const box = screen.getByLabelText(/add a note/i);
    const add = screen.getByRole("button", { name: /add note/i });
    expect(add.disabled).toBe(true);

    fireEvent.change(box, { target: { value: "Newton's second law" } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);

    expect(screen.getByText("Newton's second law")).toBeTruthy();
    expect(box.value).toBe("");
    // Timestamp captured from the player and shown on the saved note.
    expect(screen.getByText("0:42")).toBeTruthy();
  });

  it("jumps the player to a note's timestamp when it is clicked", () => {
    const onSeek = vi.fn();
    render(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 130} onSeek={onSeek} />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "key idea" } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    fireEvent.click(screen.getByRole("button", { name: /jump to 2:10/i }));
    expect(onSeek).toHaveBeenCalledWith(130);
  });

  it("saves an untimed note when the player has not started", () => {
    render(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => null} />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "before playing" } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("before playing")).toBeTruthy();
    // No timestamp chip, so no jump control.
    expect(screen.queryByRole("button", { name: /jump to/i })).toBeNull();
  });

  it("deletes a note", () => {
    render(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 10} />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "to be removed" } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("to be removed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /delete note/i }));
    expect(screen.queryByText("to be removed")).toBeNull();
  });

  it("keeps notes separate per lesson (reloads on videoId change)", () => {
    const { rerender } = render(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 5} />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "note for abc" } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("note for abc")).toBeTruthy();

    rerender(<NotesPanel playlistId={5} videoId="xyz" getCurrentTime={() => 5} />);
    expect(screen.queryByText("note for abc")).toBeNull();

    rerender(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 5} />);
    expect(screen.getByText("note for abc")).toBeTruthy();
  });
});

// A course auto-advances a few seconds after a lesson ends, so the lesson can
// change under a student who is still typing. The draft used to follow them
// forward, and the next "Add note" filed it against the wrong lesson.
describe("NotesPanel: a draft when the lesson changes underneath", () => {
  const typeDraft = (value) =>
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value } });

  it("files the note against the lesson it was written on, not the new one", () => {
    const { rerender } = render(
      <NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 12} />,
    );
    typeDraft("half a thought about abc");

    // The course moves on mid-sentence.
    rerender(<NotesPanel playlistId={5} videoId="xyz" getCurrentTime={() => 3} />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    // Not on the lesson now on screen...
    expect(screen.queryByText("half a thought about abc")).toBeNull();
    // ...but on the one it was written against.
    rerender(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 12} />);
    expect(screen.getByText("half a thought about abc")).toBeTruthy();
  });

  it("keeps the half-typed text rather than throwing the student's work away", () => {
    const { rerender } = render(<NotesPanel playlistId={5} videoId="abc" />);
    typeDraft("mid-sentence");
    rerender(<NotesPanel playlistId={5} videoId="xyz" />);
    expect(screen.getByLabelText(/add a note/i).value).toBe("mid-sentence");
  });

  it("says where the note is going, but only once the lesson has actually moved", () => {
    const { rerender } = render(<NotesPanel playlistId={5} videoId="abc" />);
    typeDraft("still on abc");
    expect(screen.queryByText(/lesson moved on/i)).toBeNull();

    rerender(<NotesPanel playlistId={5} videoId="xyz" />);
    expect(screen.getByText(/lesson moved on/i)).toBeTruthy();
  });

  it("does not stamp the new lesson's playback second onto the old lesson's note", () => {
    // getCurrentTime() reports whatever is on screen NOW. Timestamping a note
    // for lesson abc with lesson xyz's position would seek the student to a
    // second that means nothing, so a moved-on note is saved untimed instead.
    const { rerender } = render(
      <NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 12} />,
    );
    typeDraft("no bogus timestamp");
    rerender(<NotesPanel playlistId={5} videoId="xyz" getCurrentTime={() => 999} />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    rerender(<NotesPanel playlistId={5} videoId="abc" getCurrentTime={() => 12} />);
    expect(screen.getByText("no bogus timestamp")).toBeTruthy();
    expect(screen.queryByText("16:39")).toBeNull(); // the new lesson's 999s
    expect(screen.queryByText("0:12")).toBeNull(); // nor the old one, which is stale
  });

  it("releases the lesson again when the box is emptied", () => {
    const { rerender } = render(<NotesPanel playlistId={5} videoId="abc" />);
    typeDraft("abandoned");
    typeDraft("");
    rerender(<NotesPanel playlistId={5} videoId="xyz" />);
    typeDraft("about xyz now");
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("about xyz now")).toBeTruthy();
  });
});

// The device can refuse a write: quota full, or storage blocked in private
// mode. Saying nothing and clearing the box destroyed the only copy.
describe("NotesPanel: when the device refuses to store", () => {
  // The file-level afterEach clears storage but does not restore spies, so a
  // blocked setItem would leak into the next test and fail it somewhere
  // confusing. Restore here rather than widening the shared hook.
  afterEach(() => vi.restoreAllMocks());

  it("keeps the text and says so instead of silently losing the note", () => {
    render(<NotesPanel playlistId={5} videoId="abc" />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "precious" } });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    expect(screen.getByRole("alert").textContent).toMatch(/could not save|couldn.t save/i);
    // The only copy is still in the box.
    expect(screen.getByLabelText(/add a note/i).value).toBe("precious");
  });

  it("does not pretend a note was deleted when the removal did not stick", () => {
    render(<NotesPanel playlistId={5} videoId="abc" />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "stays put" } });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("stays put")).toBeTruthy();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("full"); });
    fireEvent.click(screen.getByRole("button", { name: /delete note/i }));

    expect(screen.getByRole("alert").textContent).toMatch(/could not delete|couldn.t delete/i);
    expect(screen.getByText("stays put")).toBeTruthy();
  });

  it("clears the failure once a later save works", () => {
    render(<NotesPanel playlistId={5} videoId="abc" />);
    fireEvent.change(screen.getByLabelText(/add a note/i), { target: { value: "try one" } });
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByRole("alert")).toBeTruthy();

    spy.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("try one")).toBeTruthy();
  });
});
