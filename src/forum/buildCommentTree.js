/**
 * Convert the one-query flat comment result into a nested reply tree.
 * A reply whose parent is absent remains visible as a root.
 */
export function buildCommentTree(rows = []) {
  const byId = new Map();
  for (const row of rows) byId.set(row.id, { ...row, replies: [] });

  const roots = [];
  for (const node of byId.values()) {
    const parentId = node.parent_id ?? null;
    if (parentId === null) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(parentId);
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return roots;
}
