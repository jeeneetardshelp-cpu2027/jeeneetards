// notes store — device-local per-lesson study notes. These pin the two things
// that keep the store honest: it never renders corrupt data, and a note's
// timestamp survives round-trips so the panel can seek back to it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getNotes, addNote, updateNote, deleteNote, clearNotes,
} from "./notes.js";

const KEY = "ll_notes_v1";

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
afterEach(() => localStorage.clear());

describe("addNote / getNotes", () => {
  it("stores a timestamped note keyed by playlist and video", () => {
    const note = addNote({ playlistId: 5, videoId: "abc", text: "  Newton's 2nd law  ", t: 42.9 });
    expect(note).toMatchObject({ text: "Newton's 2nd law", t: 42 }); // trimmed + floored
    expect(typeof note.id).toBe("string");
    const notes = getNotes(5, "abc");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ text: "Newton's 2nd law", t: 42 });
  });

  it("keeps each lesson's notes separate", () => {
    addNote({ playlistId: 5, videoId: "abc", text: "one" });
    addNote({ playlistId: 5, videoId: "xyz", text: "two" });
    addNote({ playlistId: 9, videoId: "abc", text: "three" });
    expect(getNotes(5, "abc").map((n) => n.text)).toEqual(["one"]);
    expect(getNotes(5, "xyz").map((n) => n.text)).toEqual(["two"]);
    expect(getNotes(9, "abc").map((n) => n.text)).toEqual(["three"]);
  });

  it("accepts an untimed note (t null) and rejects empty text", () => {
    expect(addNote({ playlistId: 5, videoId: "abc", text: "no timestamp" })).toMatchObject({ t: null });
    expect(addNote({ playlistId: 5, videoId: "abc", text: "   " })).toBeNull();
    expect(getNotes(5, "abc")).toHaveLength(1);
  });

  it("rejects a bad identity without throwing", () => {
    expect(addNote({ playlistId: 0, videoId: "abc", text: "x" })).toBeNull();
    expect(addNote({ playlistId: 5, videoId: "", text: "x" })).toBeNull();
    expect(getNotes(0, "abc")).toEqual([]);
  });

  it("orders timestamped notes by playback second, untimed notes last", () => {
    addNote({ playlistId: 5, videoId: "abc", text: "late", t: 300 });
    addNote({ playlistId: 5, videoId: "abc", text: "untimed A" });
    addNote({ playlistId: 5, videoId: "abc", text: "early", t: 10 });
    addNote({ playlistId: 5, videoId: "abc", text: "untimed B" });
    expect(getNotes(5, "abc").map((n) => n.text)).toEqual([
      "early", "late", "untimed A", "untimed B",
    ]);
  });
});

describe("updateNote / deleteNote", () => {
  it("edits a note's text", () => {
    const n = addNote({ playlistId: 5, videoId: "abc", text: "typo" });
    const updated = updateNote({ playlistId: 5, videoId: "abc", id: n.id, text: "fixed" });
    expect(updated.text).toBe("fixed");
    expect(getNotes(5, "abc")[0].text).toBe("fixed");
  });

  it("refuses to blank a note via update", () => {
    const n = addNote({ playlistId: 5, videoId: "abc", text: "keep" });
    expect(updateNote({ playlistId: 5, videoId: "abc", id: n.id, text: "  " })).toBeNull();
    expect(getNotes(5, "abc")[0].text).toBe("keep");
  });

  it("removes one note and reports whether it existed", () => {
    const a = addNote({ playlistId: 5, videoId: "abc", text: "a" });
    addNote({ playlistId: 5, videoId: "abc", text: "b" });
    expect(deleteNote({ playlistId: 5, videoId: "abc", id: a.id })).toBe(true);
    expect(getNotes(5, "abc").map((n) => n.text)).toEqual(["b"]);
    expect(deleteNote({ playlistId: 5, videoId: "abc", id: "missing" })).toBe(false);
  });

  it("prunes the bucket when its last note is deleted", () => {
    const a = addNote({ playlistId: 5, videoId: "abc", text: "only" });
    deleteNote({ playlistId: 5, videoId: "abc", id: a.id });
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toEqual({});
  });
});

describe("resilience", () => {
  it("returns [] and clears the store on corrupt JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(getNotes(5, "abc")).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("drops malformed notes but keeps the valid ones", () => {
    localStorage.setItem(KEY, JSON.stringify({
      5: {
        abc: [
          { id: "ok", text: "real", t: 12, at: 1 },
          { id: "bad", text: "", t: 5, at: 2 },        // empty text
          { text: "noid", t: 5, at: 3 },               // missing id
          { id: "badt", text: "bad time", t: -4, at: 4 }, // negative t
        ],
      },
    }));
    const notes = getNotes(5, "abc");
    expect(notes.map((n) => n.text)).toEqual(["real"]);
  });

  it("never throws when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => addNote({ playlistId: 5, videoId: "abc", text: "x" })).not.toThrow();
  });

  // Not throwing is not the same as telling the truth. writeAll used to
  // swallow the failure and addNote returned the note anyway, so the panel
  // took it as saved, cleared the textarea, and the note was gone with nothing
  // said. These pin the report, not just the survival.
  it("addNote returns null when the device refuses the write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(addNote({ playlistId: 5, videoId: "abc", text: "lost?" })).toBeNull();
  });

  it("updateNote returns null when the device refuses the write", () => {
    const note = addNote({ playlistId: 5, videoId: "abc", text: "before" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(updateNote({ playlistId: 5, videoId: "abc", id: note.id, text: "after" })).toBeNull();
  });

  it("deleteNote reports false and leaves the note in place when the write is refused", () => {
    const note = addNote({ playlistId: 5, videoId: "abc", text: "keep me" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(deleteNote({ playlistId: 5, videoId: "abc", id: note.id })).toBe(false);
    vi.restoreAllMocks();
    // Still on the device: a UI that had hidden it would have been lying.
    expect(getNotes(5, "abc").map((x) => x.text)).toEqual(["keep me"]);
  });
});

describe("clearNotes", () => {
  it("wipes every device note", () => {
    addNote({ playlistId: 5, videoId: "abc", text: "a" });
    addNote({ playlistId: 9, videoId: "xyz", text: "b" });
    clearNotes();
    expect(getNotes(5, "abc")).toEqual([]);
    expect(getNotes(9, "xyz")).toEqual([]);
  });
});
