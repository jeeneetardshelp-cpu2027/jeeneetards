// PollPage.jsx — /polls/:slug
//
// The shareable surface. Everything a link recipient needs is above the
// fold: the question, the options, the count, and the share row.

import { Timer, Users } from "lucide-react";
import { useParams } from "react-router";
import { Page } from "../AppShell.jsx";
import { useSession } from "../useSession.js";
import { Button, MetaItem, Pill, Surface } from "../ui.jsx";
import { forumTopicStyle } from "../forum/forumTopicColors.js";
import PollComments from "./PollComments.jsx";
import PollOptionList from "./PollOptionList.jsx";
import PollReportControl from "./PollReportControl.jsx";
import ShareControl, { pollShareUrl } from "./ShareControl.jsx";
import { pollApi } from "./pollApi.js";
import { closesIn, timeAgo, voteLabel } from "./pollFormatting.js";
import { PollsLoadError, PollsLoading, PollsUnavailable } from "./PollStates.jsx";
import { usePoll } from "./usePolls.js";
import { usePollVote } from "./usePollVote.js";

function MissingPoll() {
  return (
    <Surface as="section" className="text-center">
      <h1 className="text-xl font-semibold text-ink">Poll not found</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
        This poll may have been closed, taken down for review, or the link may be incorrect.
      </p>
      <Button to="/polls" variant="secondary" size="sm" className="mt-6">
        See all polls
      </Button>
    </Surface>
  );
}

function PollDetail({ thread, api, signedIn }) {
  const { poll, busy, error, needsAuth, choose, clear } = usePollVote(thread.poll, { api, signedIn });
  const closing = closesIn(poll.closes_at);
  const closed = poll.status === "closed" || closing === "Closed";
  const voted = Boolean(poll.viewer_option_id) || (poll.options ?? []).some((o) => o.viewer_choice);

  const refresh = async () => {
    await thread.refreshComments(poll.id);
    await thread.refreshPoll();
  };

  return (
    <>
      <Surface as="article" aria-labelledby="poll-question">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-3">
          <span className="rounded-sm border px-2.5 py-1 font-medium" style={forumTopicStyle(poll.topic_slug)}>
            {poll.topic_name}
          </span>
          {poll.author_username && <span>suggested by {poll.author_username}</span>}
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

        <h1 id="poll-question" className="mt-5 text-h2 text-ink">{poll.question}</h1>
        {poll.detail && (
          <p className="mt-4 text-sm leading-relaxed text-ink-2">{poll.detail}</p>
        )}

        <div className="mt-7">
          <PollOptionList
            poll={poll}
            busy={busy}
            disabled={closed}
            onChoose={choose}
            labelledBy="poll-question"
          />
        </div>

        {!poll.results_visible && !closed && (
          <p className="mt-4 text-xs text-ink-3">
            Pick an option to see how everyone else answered.
          </p>
        )}
        {needsAuth && (
          <p role="status" className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink-2">
            <Button to="/signin" variant="quiet" size="sm" className="px-0">Sign in</Button>{" "}
            to vote. Reading this poll and its comments never needs an account.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded-md border border-hairline bg-surface-2 p-3 text-sm text-ink-2">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-x-5 gap-y-4 border-t border-hairline pt-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <MetaItem icon={Users}>{voteLabel(poll.vote_count)}</MetaItem>
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
            <PollReportControl targetType="poll" targetId={poll.id} api={api} signedIn={signedIn} />
          </div>
          <ShareControl
            url={pollShareUrl(poll.slug)}
            title={poll.question}
            text={poll.question}
          />
        </div>
      </Surface>

      <PollComments
        pollId={poll.id}
        comments={thread.comments}
        totalCount={poll.comment_count}
        api={api}
        signedIn={signedIn}
        onChanged={refresh}
      />
    </>
  );
}

export default function PollPage({ api = pollApi, authState = null }) {
  const { slug } = useParams();
  const liveAuth = useSession();
  const { session } = authState ?? liveAuth;
  const thread = usePoll(slug, api);
  // The last crumb names the poll once it has loaded, the way the mock-test
  // page names its exam — not a generic "Poll" beside an h1 that already says
  // the question. Until then it says what the page is doing.
  const crumb = thread.status === "ready"
    ? thread.poll.question
    : thread.status === "not_found" ? "Not found" : "Poll";

  return (
    <Page crumbs={[{ label: "Polls", to: "/polls" }, { label: crumb }]} width="reading">
      {thread.status === "loading" && <PollsLoading rows={1} />}
      {thread.status === "unavailable" && <PollsUnavailable />}
      {thread.status === "error" && <PollsLoadError detail={thread.error} onRetry={thread.retry} />}
      {thread.status === "not_found" && <MissingPoll />}
      {thread.status === "ready" && (
        <PollDetail thread={thread} api={api} signedIn={Boolean(session?.user)} />
      )}
    </Page>
  );
}
