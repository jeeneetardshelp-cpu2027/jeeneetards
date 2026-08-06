import { describe, expect, it } from "vitest";
import { buildCommentTree } from "./buildCommentTree.js";

const row = (id, parentId = null) => ({ id, parent_id: parentId, body: `comment ${id}` });

describe("buildCommentTree", () => {
  it("nests replies without mutating the source rows", () => {
    const rows = [row(1), row(2, 1), row(3, 2), row(4)];
    const tree = buildCommentTree(rows);

    expect(tree.map((node) => node.id)).toEqual([1, 4]);
    expect(tree[0].replies[0].id).toBe(2);
    expect(tree[0].replies[0].replies[0].id).toBe(3);
    expect(rows.every((node) => !("replies" in node))).toBe(true);
  });

  it("surfaces a reply whose parent is missing at the root", () => {
    const tree = buildCommentTree([row(8, 999), row(9)]);
    expect(tree.map((node) => node.id)).toEqual([8, 9]);
  });

  it("keeps sibling order from the already-sorted RPC response", () => {
    const tree = buildCommentTree([row(1), row(5, 1), row(3, 1), row(4, 1)]);
    expect(tree[0].replies.map((node) => node.id)).toEqual([5, 3, 4]);
  });

  it("returns an empty tree for an empty response", () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});
