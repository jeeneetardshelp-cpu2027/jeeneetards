// ModerationDigest.jsx — one glance at everything waiting for the owner.
//
// The four moderation queues (content reports, forum reports, poll
// suggestions, written reviews) each live in their own admin tab, so the
// only way to know whether ANYTHING needed attention was to open every tab
// in turn. This strip sits above the tabs and answers that question with
// four counters, each a button that jumps to the matching tab.
//
// It is a read-only signpost: every number comes from the same call (or a
// cheap head-count over the same filter) the tab itself uses, and no
// moderation action happens here. Honesty rule: a counter whose fetch
// failed says "couldn't check" — it never shows a 0 it cannot vouch for.

import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { useTheme } from "./theme.jsx";
import { forumApi } from "./forum/forumApi.js";
import { pollApi } from "./polls/pollApi.js";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

// The list RPCs cap their page size; at the cap we only know "at least this
// many", so the counter says "100+" instead of pretending to an exact count.
const FORUM_REPORT_LIMIT = 100;
const POLL_PENDING_LIMIT = 50;

export const DIGEST_SOURCES = Object.freeze([
  {
    id: "content",
    label: "Content reports",
    tab: "reports",
    feature: "contentReporting",
    noun: "pending",
  },
  {
    id: "forum",
    label: "Forum reports",
    tab: "reports",
    feature: "forum",
    noun: "open",
  },
  {
    id: "polls",
    label: "Poll suggestions",
    tab: "polls",
    feature: "polls",
    noun: "waiting for review",
  },
  {
    id: "reviews",
    label: "Written reviews",
    tab: "reviews",
    feature: "courseRatingSubmission",
    noun: "visible to students",
  },
]);

// One fetcher per source. Each mirrors the read path its tab already uses —
// same table, same filter, same RPC — so this can never disagree with the
// tab about what "waiting" means.
async function countContentReports() {
  // Same filter as useReports.js, but head-only: the row bodies stay home.
  const { count, error } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return { count: count ?? 0, clipped: false };
}

async function countForumReports(forum) {
  // forum_admin_list_reports already returns only status = 'pending'.
  const rows = await forum.listReports({ limit: FORUM_REPORT_LIMIT });
  return { count: rows.length, clipped: rows.length >= FORUM_REPORT_LIMIT };
}

async function countPollSuggestions(polls) {
  const rows = await polls.adminListPending(POLL_PENDING_LIMIT);
  return { count: rows.length, clipped: rows.length >= POLL_PENDING_LIMIT };
}

async function countVisibleReviews() {
  // Reviews have no "reviewed" flag — the queue is every written review that
  // is still visible to students. Hidden ones were already dealt with.
  const { data, error } = await supabase.rpc("admin_list_reviews");
  if (error) throw error;
  return {
    count: (data ?? []).filter((r) => !r.review_hidden).length,
    clipped: false,
  };
}

function initialCounters(features) {
  const counters = {};
  for (const source of DIGEST_SOURCES) {
    counters[source.id] =
      features[source.feature] === false
        ? { status: "off" }
        : { status: "loading" };
  }
  return counters;
}

export function useModerationDigest({
  features = RELEASE_FEATURES,
  forum = forumApi,
  polls = pollApi,
} = {}) {
  const [counters, setCounters] = useState(() => initialCounters(features));

  const reload = useCallback(async () => {
    const next = initialCounters(features);
    if (!isSupabaseConfigured) {
      for (const source of DIGEST_SOURCES) {
        if (next[source.id].status !== "off")
          next[source.id] = { status: "unavailable" };
      }
      setCounters(next);
      return;
    }

    const fetchers = {
      content: countContentReports,
      forum: () => countForumReports(forum),
      polls: () => countPollSuggestions(polls),
      reviews: countVisibleReviews,
    };

    // Each source settles on its own: one broken queue must not blank the
    // other three, and a failure becomes "unavailable" — never a fake 0.
    await Promise.all(
      DIGEST_SOURCES.map(async (source) => {
        if (next[source.id].status === "off") return;
        try {
          const { count, clipped } = await fetchers[source.id]();
          next[source.id] = { status: "ready", count, clipped };
        } catch {
          next[source.id] = { status: "unavailable" };
        }
      })
    );
    setCounters(next);
  }, [features, forum, polls]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { counters, reload };
}

function CounterBody({ state, noun, t }) {
  if (state.status === "off") {
    return (
      <>
        <span className={`mt-1 block text-2xl font-semibold ${t.faint}`}>—</span>
        <span className={`mt-0.5 block text-xs ${t.faint}`}>Not released yet</span>
      </>
    );
  }
  if (state.status === "loading") {
    return (
      <>
        <span className={`mt-1 block text-2xl font-semibold ${t.faint}`}>…</span>
        <span className={`mt-0.5 block text-xs ${t.faint}`}>Checking…</span>
      </>
    );
  }
  if (state.status === "unavailable") {
    return (
      <>
        <span className={`mt-1 block text-2xl font-semibold ${t.faint}`}>—</span>
        <span className={`mt-0.5 block text-xs ${t.muted}`}>
          Couldn't check — open the tab
        </span>
      </>
    );
  }
  if (state.count === 0) {
    return (
      <>
        <span className={`mt-1 block text-2xl font-semibold ${t.faint}`}>0</span>
        <span className={`mt-0.5 block text-xs ${t.faint}`}>Nothing waiting</span>
      </>
    );
  }
  return (
    <>
      <span className={`mt-1 block text-2xl font-semibold ${t.text}`}>
        {state.clipped ? `${state.count}+` : state.count}
      </span>
      <span className={`mt-0.5 block text-xs ${t.muted}`}>{noun}</span>
    </>
  );
}

export default function ModerationDigest({
  onOpenTab,
  features = RELEASE_FEATURES,
  forum = forumApi,
  polls = pollApi,
}) {
  const { t } = useTheme();
  const { counters } = useModerationDigest({ features, forum, polls });

  return (
    <section aria-label="Waiting for moderation" className="mb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DIGEST_SOURCES.map((source) => {
          const state = counters[source.id];
          const attention = state.status === "ready" && state.count > 0;
          return (
            <button
              key={source.id}
              type="button"
              onClick={() => onOpenTab(source.tab)}
              className={`min-h-11 rounded-2xl border p-4 text-left transition ${t.card} ${
                attention ? t.accentBorder : t.border
              } ${t.hover}`}
            >
              <span className={`block text-xs font-medium ${t.muted}`}>
                {source.label}
              </span>
              <CounterBody state={state} noun={source.noun} t={t} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
