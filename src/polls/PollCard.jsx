// PollCard.jsx — one poll in the feed, votable in place.
//
// Voting from the feed rather than making a student open the poll first is
// the deliberate engagement decision here: the tap that costs nothing is the
// one people actually make, and seeing the result immediately is what makes
// them scroll to the next one.

import { MessageCircle, Timer, Users } from "lucide-react";
import { Link } from "react-router";
import { MetaItem, Pill, Surface } from "../ui.jsx";
import { forumTopicStyle } from "../forum/forumTopicColors.js";
import PollOptionList from "./PollOptionList.jsx";
import ShareControl, { pollShareUrl } from "./ShareControl.jsx";
import { closesIn, commentLabel, timeAgo, voteLabel } from "./pollFormatting.js";
import { usePollVote } from "./usePollVote.js";
import { pollApi } from "./pollApi.js";

export default function PollCard({ poll: initialPoll, api = pollApi, signedIn = false }) {
  const { poll, busy, error, needsAuth, choose, clear } = usePollVote(initialPoll, { api, signedIn });
  const headingId = `poll-${poll.id}-question`;
  const closing = closesIn(poll.closes_at);
  const closed = poll.status === "closed" || closing === "Closed";
  const voted = Boolean(poll.viewer_option_id) || (poll.options ?? []).some((o) => o.viewer_choice);

  return (
    <Surface as="article" lift className="min-w-0" aria-labelledby={headingId}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-3">
        <span
          className="rounded-sm border px-2.5 py-1 font-medium"
          style={forumTopicStyle(poll.topic_slug)}
        >
          {poll.topic_name}
        </span>
        {poll.author_username && <span>by {poll.author_username}</span>}
        {poll.published_at && (
          <>
            <span aria-hidden="true">·</span>
            <time dateTime={poll.published_at}>{timeAgo(poll.published_at)}</time>
          </>
        )}
        {closed
          ? <Pill tone="quiet">Closed</Pill>
          : closing && <Pill tone="accent"><Timer aria-hidden="true" className="h-3.5 w-3.5" />{closing}</Pill>}
      </div>

      <h3 id={headingId} className="mt-4 text-h3 text-ink">
        <Link to={`/polls/${poll.slug}`} className="transition-colors duration-200 hover:text-accent">
          {poll.question}
        </Link>
      </h3>

      {poll.detail && (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{poll.detail}</p>
      )}

      <div className="mt-6">
        <PollOptionList
          poll={poll}
          busy={busy}
          disabled={closed}
          onChoose={choose}
          labelledBy={headingId}
        />
      </div>

      {needsAuth && (
        <p role="status" className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink-2">
          <Link to="/signin" className="font-semibold text-accent">Sign in</Link>{" "}
          to vote. Reading every poll and its comments never needs an account.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink-2">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <MetaItem icon={Users}>{voteLabel(poll.vote_count)}</MetaItem>
          <Link
            to={`/polls/${poll.slug}#comments`}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs text-ink-3 transition-colors duration-200 hover:text-accent"
          >
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
            {commentLabel(poll.comment_count)}
          </Link>
          {voted && !closed && (
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              className="min-h-11 text-xs font-medium text-ink-3 underline-offset-4 transition-colors duration-200 hover:text-ink hover:underline disabled:opacity-40"
            >
              Clear my vote
            </button>
          )}
        </div>
        <ShareControl
          size="sm"
          url={pollShareUrl(poll.slug)}
          title={poll.question}
          text={poll.question}
        />
      </div>
    </Surface>
  );
}
