import { CheckCircle2, MessageCircle, TrendingUp } from "lucide-react";
import { Link } from "react-router";
import { Surface } from "../ui.jsx";
import { compactNumber, previewText, timeAgo } from "./forumFormatting.js";
import { forumTopicStyle } from "./forumTopicColors.js";
import ForumVoteControl from "./ForumVoteControl.jsx";

export default function ForumPostCard({ post, voting = null }) {
  return (
    <Surface as="article" lift className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <span
          className="rounded-sm border px-2.5 py-1 font-medium"
          style={forumTopicStyle(post.topic_slug)}
        >
          {post.topic_name}
        </span>
        <span>by {post.author_username || "Deleted student"}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
        {post.edited_at && <span>(edited)</span>}
      </div>

      <h2 className="mt-4 text-lg font-semibold leading-snug text-ink sm:text-xl">
        <Link className="inline-flex min-h-11 items-center rounded-sm hover:text-accent" to={`/forum/post/${post.id}`}>
          {post.title}
        </Link>
      </h2>
      {post.body_preview && (
        <p className="mt-3 line-clamp-3 break-words text-sm leading-relaxed text-ink-2">
          {previewText(post.body_preview)}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-3">
        {voting ? (
          <ForumVoteControl
            targetType="post"
            targetId={post.id}
            score={post.score}
            upvoteCount={post.upvote_count}
            downvoteCount={post.downvote_count}
            viewerVote={post.viewer_vote}
            canVote={voting.canVote}
            api={voting.api}
            onBlocked={voting.onBlocked}
            compact
          />
        ) : (
          <span className="inline-flex items-center gap-1.5" aria-label={`${post.score} score`}>
            <TrendingUp aria-hidden="true" className="h-4 w-4" />
            {compactNumber(post.score)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          {compactNumber(post.comment_count)} {Number(post.comment_count) === 1 ? "answer" : "answers"}
        </span>
        {post.is_solved && (
          <span className="inline-flex items-center gap-1.5 font-medium text-accent">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Solved
          </span>
        )}
      </div>
    </Surface>
  );
}
