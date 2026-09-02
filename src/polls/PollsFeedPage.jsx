// PollsFeedPage.jsx — /polls
//
// The sort and the subject live in the URL query string, not in component
// state, so a student can share "the closing-soon physics polls" as a link
// and the back button behaves the way they expect.

import { Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { Page } from "../AppShell.jsx";
import { useSession } from "../useSession.js";
import { Button, SectionHead, Tabs } from "../ui.jsx";
import PollCard from "./PollCard.jsx";
import { pollApi } from "./pollApi.js";
import { PollsEmpty, PollsLoadError, PollsLoading, PollsUnavailable } from "./PollStates.jsx";
import { usePollFeed } from "./usePolls.js";

const SORTS = [
  { id: "new", label: "Newest" },
  { id: "top", label: "Most voted" },
  { id: "closing", label: "Closing soon" },
];

export default function PollsFeedPage({ api = pollApi, authState = null }) {
  const [params, setParams] = useSearchParams();
  const liveAuth = useSession();
  const { session } = authState ?? liveAuth;

  const sort = SORTS.some((option) => option.id === params.get("sort")) ? params.get("sort") : "new";
  const topic = params.get("subject") || null;

  const feed = usePollFeed({ sort, topic }, api);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const topicName = feed.topics.find((entry) => entry.slug === topic)?.name;

  return (
    <Page crumbs={[{ label: "Polls" }]} width="reading">
      <SectionHead
        as="h1"
        eyebrow="Student polls"
        title="What does everyone else think?"
        lead="Vote, see how the rest of the country answered, and argue about it in the comments. Reading polls and results never needs an account — only voting and commenting do."
        action={
          <Button to="/polls/new" size="sm">
            <Plus aria-hidden="true" className="h-4 w-4" />
            Suggest a poll
          </Button>
        }
      />

      {feed.status === "unavailable" ? (
        <div className="mt-8"><PollsUnavailable /></div>
      ) : (
        <>
          <div className="mt-8 space-y-4">
            <Tabs
              tabs={SORTS}
              value={sort}
              onChange={(value) => update("sort", value === "new" ? null : value)}
              label="Sort polls"
            />

            {feed.topics.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter polls by subject">
                <button
                  type="button"
                  onClick={() => update("subject", null)}
                  aria-pressed={!topic}
                  className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-200 ${
                    !topic ? "border-accent-line bg-accent-soft text-accent" : "border-hairline text-ink-2 hover:text-ink"
                  }`}
                >
                  All subjects
                </button>
                {feed.topics.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => update("subject", entry.slug === topic ? null : entry.slug)}
                    aria-pressed={entry.slug === topic}
                    className={`min-h-11 rounded-md border px-3 text-xs font-medium transition-colors duration-200 ${
                      entry.slug === topic
                        ? "border-accent-line bg-accent-soft text-accent"
                        : "border-hairline text-ink-2 hover:text-ink"
                    }`}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6">
            {feed.status === "loading" && <PollsLoading />}
            {feed.status === "error" && <PollsLoadError detail={feed.error} onRetry={feed.retry} />}
            {feed.status === "ready" && feed.polls.length === 0 && <PollsEmpty topicName={topicName} />}
            {feed.status === "ready" && feed.polls.length > 0 && (
              <ul className="space-y-5">
                {feed.polls.map((poll) => (
                  <li key={poll.id}>
                    <PollCard poll={poll} api={api} signedIn={Boolean(session?.user)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Page>
  );
}
