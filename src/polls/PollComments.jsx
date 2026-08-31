// PollComments.jsx — the discussion under a poll.
//
// Flat, not threaded. The forum needs a reply tree because an answer to an
// answer is the point there; under a poll, nesting mostly produces arguments
// nobody can follow on a phone. Newest first, because a poll's comments are a
// running reaction rather than a reference thread.
//
// Comment bodies are rendered as PLAIN TEXT, deliberately. The forum runs
// markdown + KaTeX through a vetted renderer; a poll comment does not need
// that, and not invoking a renderer at all is the cheapest way to be certain
// nothing can be injected here.

import { Flag, Send, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { Button, EmptyState, Surface } from "../ui.jsx";
import { pollApi } from "./pollApi.js";
import { pollActionError } from "./pollErrorMessages.js";
import { commentLabel, timeAgo } from "./pollFormatting.js";
import PollReportControl from "./PollReportControl.jsx";

const MAX_BODY = 1500;

function CommentRow({ comment, api, signedIn, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api.deleteComment(comment.id);
      await onChanged();
    } catch (caught) {
      setError(pollActionError(caught, "delete your comment"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-4">
      <article aria-label={`Comment by ${comment.author_username || "a student"}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
          <span className="font-medium text-ink-2">{comment.author_username || "Deleted student"}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>
          {comment.edited_at && <span>(edited)</span>}
        </div>

        {/* whitespace-pre-line keeps the student's own line breaks without
            interpreting anything else in what they typed. */}
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink">
          {comment.body}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {comment.is_mine && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-3 transition-colors duration-200 hover:text-ink disabled:opacity-40"
            >
              <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
          {!comment.is_mine && (
            <PollReportControl
              targetType="comment"
              targetId={comment.id}
              api={api}
              signedIn={signedIn}
              icon={Flag}
            />
          )}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-ink-2">{error}</p>}
      </article>
    </li>
  );
}

function Composer({ pollId, api, signedIn, onPosted }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();
  const remaining = MAX_BODY - body.length;

  if (!signedIn) {
    return (
      <Surface as="section" className="text-sm text-ink-2">
        <Link to="/signin" className="font-semibold text-accent">Sign in</Link>{" "}
        to join the discussion. You can read every comment without an account.
      </Surface>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (trimmed.length < 2) {
      setError("Write at least a couple of words.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.addComment(pollId, trimmed);
      setBody("");
      await onPosted();
    } catch (caught) {
      setError(pollActionError(caught, "post your comment"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-hairline bg-surface p-4 sm:p-6">
      <label htmlFor={fieldId} className="text-sm font-medium text-ink">
        Add your reasoning
      </label>
      <textarea
        id={fieldId}
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY))}
        rows={3}
        placeholder="Explain why you picked what you picked. Keep it about the question, not the person."
        className="mt-3 w-full rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink outline-none transition-colors duration-200 placeholder:text-ink-3 focus:border-accent-line focus:bg-surface"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className={`text-num text-xs ${remaining < 100 ? "text-ink-2" : "text-ink-3"}`}>
          {remaining} characters left
        </span>
        <Button type="submit" size="sm" disabled={busy}>
          <Send aria-hidden="true" className="h-4 w-4" />
          {busy ? "Posting…" : "Post comment"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-ink-2">{error}</p>}
    </form>
  );
}

export default function PollComments({
  pollId, comments, totalCount = null, api = pollApi, signedIn = false, onChanged,
}) {
  // get_poll_comments caps at 100 rows, so the loaded list is not the count.
  // Heading from the poll's own comment_count, or the feed card would say
  // "300 comments" and this page would say "100" about the same poll.
  const total = Number.isFinite(Number(totalCount)) ? Number(totalCount) : comments.length;
  const truncated = total > comments.length;

  return (
    <section id="comments" className="mt-10 scroll-mt-24" aria-labelledby="poll-comments-title">
      <h2 id="poll-comments-title" className="text-h3 text-ink">
        {commentLabel(total)}
      </h2>
      {truncated && (
        <p className="mt-2 text-xs text-ink-3">
          Showing the {comments.length} most recent.
        </p>
      )}

      <div className="mt-5">
        <Composer pollId={pollId} api={api} signedIn={signedIn} onPosted={onChanged} />
      </div>

      <div className="mt-5">
        {comments.length === 0 ? (
          <EmptyState
            title="No comments yet"
            detail="Vote first, then tell everyone why."
          />
        ) : (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface px-4 sm:px-6">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                api={api}
                signedIn={signedIn}
                onChanged={onChanged}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
