import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { loadForumDraft } from "./forumDraftStorage.js";
import { useForumDraft } from "./useForumDraft.js";

const EMPTY_DRAFT = Object.freeze({ body: "", updated_at: 0 });
const descriptor = { kind: "comment", target: 42 };

beforeEach(() => localStorage.clear());

describe("useForumDraft identity isolation", () => {
  it("does not give a guest draft to a different user who signs in", () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useForumDraft({ ...descriptor, userId, emptyDraft: EMPTY_DRAFT }),
      { initialProps: { userId: null } },
    );

    act(() => result.current.updateDraft({ body: "first person's private work" }));
    expect(result.current.draft.body).toBe("first person's private work");

    rerender({ userId: "student-2" });

    expect(result.current.draft).toEqual(EMPTY_DRAFT);
    expect(loadForumDraft(localStorage, descriptor)).toMatchObject({
      body: "first person's private work",
    });
    expect(loadForumDraft(localStorage, { ...descriptor, userId: "student-2" })).toBeNull();
  });

  it("clears only the active identity's draft", () => {
    const { result, rerender } = renderHook(
      ({ userId }) => useForumDraft({ ...descriptor, userId, emptyDraft: EMPTY_DRAFT }),
      { initialProps: { userId: null } },
    );
    act(() => result.current.updateDraft({ body: "guest work" }));

    rerender({ userId: "student-2" });
    act(() => result.current.updateDraft({ body: "student work" }));
    act(() => result.current.clearDraft());

    expect(loadForumDraft(localStorage, descriptor)).toMatchObject({ body: "guest work" });
    expect(loadForumDraft(localStorage, { ...descriptor, userId: "student-2" })).toBeNull();
  });
});
