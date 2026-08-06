export const FORUM_PAGE_SIZE = 25;
export const FORUM_SORTS = new Set(["hot", "new", "top"]);

export function normalizeForumSort(value) {
  const sort = String(value ?? "").toLowerCase();
  return FORUM_SORTS.has(sort) ? sort : "hot";
}

export function effectiveForumSort(sort, query) {
  return String(query ?? "").trim() ? "new" : normalizeForumSort(sort);
}

export function cursorFromForumPost(post, sort, query = "") {
  if (!post?.id || !post?.created_at) return null;
  const effectiveSort = effectiveForumSort(sort, query);
  return {
    id: post.id,
    created_at: post.created_at,
    hot_rank: effectiveSort === "hot" ? post.hot_rank : null,
    score: effectiveSort === "top" ? post.score : null,
  };
}
