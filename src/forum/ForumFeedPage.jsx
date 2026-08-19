import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { Page } from "../AppShell.jsx";
import { Button, SectionHead } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import ForumFeedControls from "./ForumFeedControls.jsx";
import ForumPostCard from "./ForumPostCard.jsx";
import ForumVoteGate from "./ForumVoteGate.jsx";
import { normalizeForumSort } from "./forumCursor.js";
import {
  ForumEmpty, ForumLoadError, ForumLoading, ForumUnavailable,
} from "./ForumStates.jsx";
import { useForumFeed } from "./useForumFeed.js";
import { useForumVoteAccess } from "./useForumVoteAccess.js";

export default function ForumFeedPage({ api = forumApi, authState = null }) {
  const [params, setParams] = useSearchParams();
  const sort = normalizeForumSort(params.get("sort"));
  const topic = params.get("topic") || "";
  const query = (params.get("q") || "").trim().slice(0, 100);
  const feed = useForumFeed({ sort, topic: topic || null, query: query || null, api });
  const voteAccess = useForumVoteAccess({ api, authState });
  const betaWriter = feed.mode === "beta"
    && voteAccess.canVote
    && voteAccess.identity.betaMember;
  const voting = feed.mode === "open" || betaWriter ? {
    api,
    canVote: voteAccess.canVote,
    onBlocked: voteAccess.requestAccess,
  } : null;

  const topicName = useMemo(
    () => feed.topics.find((item) => item.slug === topic)?.name ?? "",
    [feed.topics, topic],
  );

  const changeFilters = useCallback((changes) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (Object.hasOwn(changes, "sort")) {
        const value = normalizeForumSort(changes.sort);
        if (value === "hot") next.delete("sort");
        else next.set("sort", value);
      }
      if (Object.hasOwn(changes, "topic")) {
        if (changes.topic) next.set("topic", changes.topic);
        else next.delete("topic");
      }
      if (Object.hasOwn(changes, "query")) {
        const value = String(changes.query || "").trim().slice(0, 100);
        if (value) next.set("q", value);
        else next.delete("q");
      }
      return next;
    });
  }, [setParams]);

  return (
    <Page crumbs={[{ label: "Student forum" }]} width="reading">
      <SectionHead
        as="h1"
        eyebrow="Student discussions"
        title="Ask, explain and prepare together"
        lead="Read preparation questions and answers from other students, or share a clear doubt of your own."
        action={feed.status === "ready" && (feed.mode === "open" || betaWriter)
          ? <Button to="/forum/submit">Start a discussion</Button>
          : null}
      />

      <ForumFeedControls
        sort={query ? "new" : sort}
        topic={topic}
        query={query}
        topics={feed.topics}
        onChange={changeFilters}
      />

      {voteAccess.requested && !voteAccess.canVote && (
        <div className="mt-6">
          <ForumVoteGate access={voteAccess} api={api} />
        </div>
      )}

      <div className="mt-6" aria-live="polite">
        {feed.status === "loading" && <ForumLoading />}
        {feed.status === "unavailable" && <ForumUnavailable />}
        {feed.status === "error" && <ForumLoadError detail={feed.error} onRetry={feed.retry} />}
        {feed.status === "ready" && feed.posts.length === 0 && (
          <ForumEmpty query={query} topicName={topicName} />
        )}
        {feed.status === "ready" && feed.posts.length > 0 && (
          <>
            <p className="mb-3 text-xs text-ink-3">
              {query ? `Results for “${query}”` : topicName || "All visible discussions"}
            </p>
            <div className="space-y-4">
              {feed.posts.map((post) => (
                <ForumPostCard
                  key={post.id}
                  post={post}
                  voting={voting}
                  reporting={{ api, authState }}
                />
              ))}
            </div>

            {feed.pageError && (
              <div className="mt-5">
                <ForumLoadError detail={feed.pageError} onRetry={feed.loadMore} />
              </div>
            )}
            {feed.hasMore && !feed.pageError && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="secondary"
                  onClick={feed.loadMore}
                  disabled={feed.loadingMore}
                  aria-busy={feed.loadingMore}
                >
                  {feed.loadingMore ? "Loading more…" : "Load more discussions"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
