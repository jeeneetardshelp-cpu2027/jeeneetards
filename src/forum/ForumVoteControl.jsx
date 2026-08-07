import { ArrowBigDown, ArrowBigUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { compactNumber } from "./forumFormatting.js";
import { forumVoteState, optimisticForumVote } from "./forumVoteState.js";

function voteError(error) {
  const code = String(error?.code ?? "");
  const detail = String(error?.cause?.message ?? error?.message ?? "").toLowerCase();
  if (/new accounts can contribute after 10 minutes/.test(detail))
    return "New accounts can vote after 10 minutes.";
  if (/temporarily suspended/.test(detail)) return "Voting is paused for this account.";
  if (/not open|unavailable/.test(detail) || code === "55000")
    return "Voting is paused right now.";
  if (/session|sign in|jwt|permission/.test(detail) || code === "42501")
    return "Your session may have expired. Sign in and try again.";
  if (/fetch|network|timeout/.test(detail))
    return "Could not reach the server. Your vote was not changed.";
  return "Could not record your vote. Your previous vote was restored.";
}

export default function ForumVoteControl({
  targetType,
  targetId,
  score = 0,
  upvoteCount = 0,
  downvoteCount = 0,
  viewerVote = 0,
  canVote = false,
  api,
  onBlocked,
  onChanged,
  compact = false,
}) {
  const [state, setState] = useState(() => forumVoteState({
    score, upvoteCount, downvoteCount, viewerVote,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    setState(forumVoteState({ score, upvoteCount, downvoteCount, viewerVote }));
    setBusy(false);
    setError("");
  }, [downvoteCount, score, targetId, targetType, upvoteCount, viewerVote]);

  const vote = async (value) => {
    if (!canVote) {
      onBlocked?.();
      return;
    }
    if (busy) return;
    const operation = ++request.current;
    const before = state;
    const optimistic = optimisticForumVote(before, value);
    setState(optimistic);
    setBusy(true);
    setError("");
    try {
      const result = await api.castVote({ targetType, targetId, value });
      if (operation !== request.current) return;
      const reconciled = forumVoteState(result);
      setState(reconciled);
      onChanged?.(reconciled);
    } catch (voteFailure) {
      if (operation !== request.current) return;
      setState(before);
      setError(voteError(voteFailure));
    } finally {
      if (operation === request.current) setBusy(false);
    }
  };

  const label = targetType === "comment" ? "answer" : "discussion";
  const buttonClass = (active) => `grid min-h-11 min-w-11 place-items-center rounded-md border transition-colors ${
    active
      ? "border-accent-line bg-accent-soft text-accent"
      : "border-transparent text-ink-3 hover:border-hairline hover:bg-surface-2 hover:text-ink"
  }`;

  return (
    <div className={compact ? "inline-flex flex-col items-start" : "flex flex-col items-start"}>
      <div
        className="inline-flex items-center rounded-lg border border-hairline bg-surface-inset p-1"
        role="group"
        aria-label={`Vote on this ${label}`}
        aria-busy={busy}
      >
        <button
          type="button"
          aria-label={`Upvote this ${label}`}
          aria-pressed={state.viewerVote === 1}
          disabled={busy}
          onClick={() => vote(1)}
          className={buttonClass(state.viewerVote === 1)}
        >
          <ArrowBigUp
            aria-hidden="true"
            className="h-5 w-5"
            fill={state.viewerVote === 1 ? "currentColor" : "none"}
          />
        </button>
        <span
          className="min-w-10 px-1 text-center text-sm font-semibold tabular-nums text-ink"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${state.score} score`}
        >
          {compactNumber(state.score)}
        </span>
        <button
          type="button"
          aria-label={`Downvote this ${label}`}
          aria-pressed={state.viewerVote === -1}
          disabled={busy}
          onClick={() => vote(-1)}
          className={buttonClass(state.viewerVote === -1)}
        >
          <ArrowBigDown
            aria-hidden="true"
            className="h-5 w-5"
            fill={state.viewerVote === -1 ? "currentColor" : "none"}
          />
        </button>
      </div>
      {error && <p role="alert" className="mt-2 max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
