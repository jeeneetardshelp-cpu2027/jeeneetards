import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { buildCommentTree } from "./buildCommentTree.js";
import { compactNumber, timeAgo } from "./forumFormatting.js";
import ForumMathContent from "./ForumMathContent.jsx";
import ForumVoteControl from "./ForumVoteControl.jsx";

function descendantCount(comment) {
  return comment.replies.reduce((total, reply) => total + 1 + descendantCount(reply), 0);
}

function CommentNode({ comment, depth = 0, voting = null }) {
  const [collapsed, setCollapsed] = useState(false);
  const descendants = descendantCount(comment);
  const addIndent = depth > 0 && depth <= 3;

  return (
    <li className={addIndent ? "border-l border-hairline pl-3 sm:pl-5" : ""}>
      <article className="min-w-0 rounded-lg py-4" aria-label={`Answer by ${comment.author_username}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span className="font-medium text-ink-2">{comment.author_username || "Deleted student"}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>
          {comment.edited_at && <span>(edited)</span>}
          {!voting && (
            <span className="inline-flex items-center gap-1" aria-label={`${comment.score} score`}>
              <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
              {compactNumber(comment.score)}
            </span>
          )}
        </div>

        <ForumMathContent className={`mt-3 ${comment.is_tombstone ? "italic text-ink-3" : ""}`}>
          {comment.body}
        </ForumMathContent>

        {voting && !comment.is_tombstone && (
          <div className="mt-3">
            <ForumVoteControl
              targetType="comment"
              targetId={comment.id}
              score={comment.score}
              upvoteCount={comment.upvote_count}
              downvoteCount={comment.downvote_count}
              viewerVote={comment.viewer_vote}
              canVote={voting.canVote}
              api={voting.api}
              onBlocked={voting.onBlocked}
              compact
            />
          </div>
        )}

        {descendants > 0 && (
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            {collapsed
              ? <ChevronRight aria-hidden="true" className="h-4 w-4" />
              : <ChevronDown aria-hidden="true" className="h-4 w-4" />}
            {collapsed ? `Show ${descendants} hidden ${descendants === 1 ? "reply" : "replies"}` : "Collapse replies"}
          </button>
        )}
      </article>

      {!collapsed && comment.replies.length > 0 && (
        <ul className="space-y-1">
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} depth={depth + 1} voting={voting} />
          ))}
        </ul>
      )}
    </li>
  );
}
export default function ForumCommentThread({ comments, voting = null }) {
  const tree = useMemo(() => buildCommentTree(comments), [comments]);
  if (!tree.length) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-6 text-center sm:p-8">
        <h2 className="text-base font-semibold text-ink">No answers yet</h2>
        <p className="mt-2 text-sm text-ink-2">This discussion has no visible student answers.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface px-4 sm:px-6">
      {tree.map((comment) => <CommentNode key={comment.id} comment={comment} voting={voting} />)}
    </ul>
  );
}
