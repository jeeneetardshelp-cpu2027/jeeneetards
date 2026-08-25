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
