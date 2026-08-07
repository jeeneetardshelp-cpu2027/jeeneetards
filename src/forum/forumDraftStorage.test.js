import { describe, expect, it } from "vitest";
import {
  clearForumDraft, forumDraftKey, loadForumDraft, saveForumDraft,
} from "./forumDraftStorage.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe("forum draft storage", () => {
  it("isolates post and answer drafts by target and signed-in owner", () => {
    const guest = forumDraftKey({ kind: "post" });
    const student = forumDraftKey({ kind: "post", userId: "student-1" });
    const answer = forumDraftKey({ kind: "comment", target: 42, userId: "student-1" });
    expect(new Set([guest, student, answer]).size).toBe(3);
  });

  it("keeps guest and signed-in drafts in separate storage", () => {
    const storage = memoryStorage();
    const descriptor = { kind: "post", target: "new" };
    saveForumDraft(storage, descriptor, { title: "guest work", updated_at: 20 });
    saveForumDraft(storage, { ...descriptor, userId: "student-1" }, { title: "student work", updated_at: 10 });

    expect(loadForumDraft(storage, descriptor)).toMatchObject({ title: "guest work" });
    expect(loadForumDraft(storage, { ...descriptor, userId: "student-1" }))
      .toMatchObject({ title: "student work" });
  });

  it("fails closed around corrupt or unavailable storage without losing in-memory work", () => {
    const broken = {
      getItem: () => "{not-json",
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(loadForumDraft(broken, { kind: "post" })).toBeNull();
    expect(saveForumDraft(broken, { kind: "post" }, { title: "work" })).toBe(false);
    expect(() => clearForumDraft(broken, { kind: "post" })).not.toThrow();
  });
});
