import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adoptGuestForumDraft, clearForumDraft, loadForumDraft, saveForumDraft,
} from "./forumDraftStorage.js";

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function useForumDraft({ kind, target = "new", userId = null, emptyDraft }) {
  const storage = browserStorage();
  const descriptor = useMemo(() => ({ kind, target }), [kind, target]);
  const [draft, setDraftState] = useState(() => (
    loadForumDraft(storage, { ...descriptor, userId }) ?? emptyDraft
  ));

  useEffect(() => {
    const stored = userId
      ? adoptGuestForumDraft(storage, descriptor, userId)
      : loadForumDraft(storage, descriptor);
    setDraftState(stored ?? emptyDraft);
  }, [descriptor, emptyDraft, storage, userId]);

  const updateDraft = useCallback((next) => {
    setDraftState((current) => {
      const value = typeof next === "function" ? next(current) : next;
      const saved = { ...value, updated_at: Date.now() };
      saveForumDraft(storage, { ...descriptor, userId }, saved);
      return saved;
    });
  }, [descriptor, storage, userId]);

  const clearDraft = useCallback(() => {
    clearForumDraft(storage, { ...descriptor, userId });
    clearForumDraft(storage, descriptor);
    setDraftState(emptyDraft);
  }, [descriptor, emptyDraft, storage, userId]);

  return { draft, updateDraft, clearDraft };
}
