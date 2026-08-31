// PollOfTheDay — a small homepage teaser for the newest open student poll.
//
// INERT UNTIL POLLS LAUNCH. This card renders nothing unless BOTH are true:
//   1. RELEASE_FEATURES.polls is on (releaseCapabilities.js — the launch
//      decision lives there, not here), and
//   2. the polls feed actually returns at least one open poll.
// While the flag is off the gate returns null BEFORE any hook runs, so the
// homepage makes no poll requests at all — a dormant teaser must not cost
// every student a failed RPC. There is no skeleton and no error state on
// purpose: a teaser that cannot load simply is not there, the same
// hide-when-empty rule every homepage band follows.
//
// One question and one link — voting stays on /polls, where PollCard handles
// it properly. No <Reveal>: reveal blocks ship at opacity:0 until a
// useReveal() root observes them, which has shipped a blank section twice in
// this codebase.

import { Link } from "react-router";
import { ArrowRight, BarChart3 } from "lucide-react";
import { Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import { usePollFeed } from "./polls/usePolls.js";
import { pollApi } from "./polls/pollApi.js";
import { closesIn } from "./polls/pollFormatting.js";

/** The newest poll a student can still vote on, or null. */
export function pickOpenPoll(polls) {
  return (polls ?? []).find(
    (poll) => poll.status !== "closed" && closesIn(poll.closes_at) !== "Closed",
  ) ?? null;
}

export default function PollOfTheDay({ features = RELEASE_FEATURES, api = pollApi }) {
  // The flag gate lives OUTSIDE the component that calls the feed hook —
  // hooks cannot be called conditionally, and the whole point is to make no
  // request while polls are unreleased.
  if (!features.polls) return null;
  return <PollTeaser api={api} />;
}

function PollTeaser({ api }) {
  const { t } = useTheme();
  const { status, polls } = usePollFeed({ sort: "new" }, api);

  if (status !== "ready") return null;
  const poll = pickOpenPoll(polls);
  if (!poll) return null;

  return (
    <section className="pt-4 pb-8" aria-labelledby="poll-of-the-day-heading">
      <Container>
        <div className={`rounded-2xl border ${t.border} ${t.card} p-5 sm:p-6`}>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
            <h2 id="poll-of-the-day-heading" className={`text-sm font-semibold ${t.text}`}>
              Today&apos;s poll
            </h2>
          </div>
          <p className={`mt-3 text-base font-semibold ${t.text}`}>{poll.question}</p>
          <Link
            to={`/polls/${poll.slug}`}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
          >
            Answer it
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </Container>
    </section>
  );
}
