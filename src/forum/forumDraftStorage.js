const PREFIX = "jeeneetard:forum-draft:v1";

function safePart(value) {
  return encodeURIComponent(String(value ?? "new")).replace(/%/g, "_");
}

export function forumDraftKey({ kind, target = "new", userId = null }) {
  const owner = userId ? `user:${safePart(userId)}` : "guest";
  return `${PREFIX}:${kind}:${safePart(target)}:${owner}`;
}

export function loadForumDraft(storage, descriptor) {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(forumDraftKey(descriptor)) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveForumDraft(storage, descriptor, draft) {
  if (!storage) return false;
  try {
    storage.setItem(forumDraftKey(descriptor), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearForumDraft(storage, descriptor) {
  if (!storage) return;
  try { storage.removeItem(forumDraftKey(descriptor)); } catch {
    // Storage can be disabled or full; in-memory form state still works.
  }
}
