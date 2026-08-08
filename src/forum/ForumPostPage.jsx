import { CheckCircle2, LockKeyhole, MessageCircle, TrendingUp } from "lucide-react";
import { useParams } from "react-router";
import { Page } from "../AppShell.jsx";
import { Button, Pill, SectionHead, Surface } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import ForumCommentThread from "./ForumCommentThread.jsx";
import { compactNumber, timeAgo } from "./forumFormatting.js";
import ForumMathContent from "./ForumMathContent.jsx";
import ForumReplyComposer from "./ForumReplyComposer.jsx";
import ForumReportControl from "./ForumReportControl.jsx";
import ForumVoteControl from "./ForumVoteControl.jsx";
import ForumVoteGate from "./ForumVoteGate.jsx";
import {
  ForumLoadError, ForumLoading, ForumUnavailable,
} from "./ForumStates.jsx";
import { forumTopicStyle } from "./forumTopicColors.js";
import { useForumThread } from "./useForumThread.js";
import { useForumVoteAccess } from "./useForumVoteAccess.js";

function MissingPost() {
  return (
    <Surface as="section" className="text-center">
      <h1 className="text-xl font-semibold text-ink">Discussion not found</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
        This post may have been removed, hidden for review, or the link may be incorrect.
      </p>
      <Button to="/forum" variant="secondary" size="sm" className="mt-6">
        Back to discussions
      </Button>
    </Surface>
  );
}
function ForumPostDataPage({ postId, api, authState }) {
  const thread = useForumThread(postId, api);
  const voteAccess = useForumVoteAccess({ api, authState });

  if (thread.status === "loading") return <ForumLoading kind="thread" />;
  if (thread.status === "unavailable") return <ForumUnavailable />;
  if (thread.status === "error") return <ForumLoadError detail={thread.error} onRetry={thread.retry} />;
  if (thread.status === "not_found") return <MissingPost />;

  const { post } = thread;
  const betaWriter = thread.mode === "beta"
    && voteAccess.canVote
    && voteAccess.identity.betaMember;
  const voting = thread.mode === "open" || betaWriter ? {
    api,
    canVote: voteAccess.canVote,
    onBlocked: voteAccess.requestAccess,
  } : null;
  return (
    <>
      <Surface as="article" className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-ink-3">
          <span className="rounded-sm border px-2.5 py-1 font-medium" style={forumTopicStyle(post.topic_slug)}>
            {post.topic_name}
          </span>
          <span>by {post.author_username || "Deleted student"}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          {post.edited_at && <span>(edited)</span>}
        </div>

        <SectionHead as="h1" className="mt-5" title={post.title} />
        <ForumMathContent className="mt-6 text-[0.95rem]">{post.body}</ForumMathContent>

        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-5 text-xs text-ink-3">
          {voting ? (
            <ForumVoteControl
              targetType="post"
              targetId={post.id}
              score={post.score}
              upvoteCount={post.upvote_count}
              downvoteCount={post.downvote_count}
              viewerVote={post.viewer_vote}
              canVote={voting.canVote}
              api={api}
              onBlocked={voteAccess.requestAccess}
            />
          ) : (
            <span className="inline-flex items-center gap-1.5" aria-label={`${post.score} score`}>
              <TrendingUp aria-hidden="true" className="h-4 w-4" /> {compactNumber(post.score)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            {compactNumber(post.comment_count)} {Number(post.comment_count) === 1 ? "answer" : "answers"}
          </span>
          {post.is_solved && (
            <Pill tone="accent"><CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Solved</Pill>
          )}
          {post.is_locked && (
            <Pill tone="quiet"><LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" /> Locked</Pill>
          )}
          <ForumReportControl
            targetType="post"
            targetId={post.id}
            api={api}
            authState={authState}
          />
        </div>
      </Surface>

      {voteAccess.requested && !voteAccess.canVote && (
        <div className="mt-6">
          {post.is_locked ? (
            <ForumVoteGate access={voteAccess} api={api} />
          ) : (
            <p role="status" className="rounded-lg border border-hairline bg-surface-2 p-4 text-sm text-ink-2">
              Sign in or choose your public username in the answer panel below, then select your vote again.
            </p>
          )}
        </div>
      )}

      <ForumReplyComposer
        postId={post.id}
        mode={thread.mode}
        locked={post.is_locked}
        api={api}
        authState={authState}
        onPublished={thread.retry}
      />

      <section className="mt-8" aria-labelledby="forum-answers-title">
        <SectionHead
          id="forum-answers-title"
          title={`${post.comment_count} ${Number(post.comment_count) === 1 ? "answer" : "answers"}`}
          lead="Answers are shown as a conversation; nested replies can be collapsed."
        />
        <div className="mt-5">
          <ForumCommentThread
            comments={thread.comments}
            voting={voting}
            reporting={{ api, authState }}
          />
        </div>
      </section>
    </>
  );
}

export default function ForumPostPage({ api = forumApi, authState = null }) {
  const { postId: rawPostId } = useParams();
  const postId = Number(rawPostId);
  const valid = Number.isSafeInteger(postId) && postId > 0;

  return (
    <Page
      crumbs={[{ label: "Student forum", to: "/forum" }, { label: valid ? "Discussion" : "Not found" }]}
      width="reading"
    >
      {valid ? <ForumPostDataPage postId={postId} api={api} authState={authState} /> : <MissingPost />}
    </Page>
  );
}
