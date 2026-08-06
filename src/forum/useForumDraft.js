import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearForumDraft, forumDraftKey, loadForumDraft, saveForumDraft,
} from "./forumDraftStorage.js";

function browserStorage() {
  try { return window.localStorage; } catch { return null; }
}

export function useForumDraft({ kind, target = "new", userId = null, emptyDraft }) {
  const storage = browserStorage();
  const descriptor = useMemo(() => ({ kind, target, userId }), [kind, target, userId]);
  const activeKey = useMemo(() => forumDraftKey(descriptor), [descriptor]);
  const readDraft = useCallback(
    () => loadForumDraft(storage, descriptor) ?? emptyDraft,
    [descriptor, emptyDraft, storage],
  );
  const [draftState, setDraftState] = useState(() => ({
    key: activeKey,
    value: readDraft(),
  }));
  const draft = draftState.key === activeKey ? draftState.value : readDraft();

  useEffect(() => {
    setDraftState({ key: activeKey, value: readDraft() });
  }, [activeKey, readDraft]);

  const updateDraft = useCallback((next) => {
    setDraftState((current) => {
      const currentDraft = current.key === activeKey ? current.value : readDraft();
      const value = typeof next === "function" ? next(currentDraft) : next;
      const saved = { ...value, updated_at: Date.now() };
      saveForumDraft(storage, descriptor, saved);
      return { key: activeKey, value: saved };
    });
  }, [activeKey, descriptor, readDraft, storage]);

  const clearDraft = useCallback(() => {
    clearForumDraft(storage, descriptor);
    setDraftState({ key: activeKey, value: emptyDraft });
  }, [activeKey, descriptor, emptyDraft, storage]);

  return { draft, updateDraft, clearDraft };
}
