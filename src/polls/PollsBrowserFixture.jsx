// PollsBrowserFixture.jsx — the poll feed rendered against a stub API.
//
// Why this exists: polls_v1.sql is not installed anywhere yet, so opening
// /polls against the real database would only ever show "Could not load
// polls". This fixture mounts the REAL PollsFeedPage with a fake api object,
// so the layout, the voting interaction, the picture grid and the share row
// can all be looked at before a single line of SQL is run in production.
//
// Same approach as ForumRendererBrowserFixture.jsx. It is a dev-only entry
// point: nothing imports it, and it is not part of any route.

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import PollsFeedPage from "./PollsFeedPage.jsx";
import "../index.css";

// Inline SVGs rather than real image URLs, so the fixture renders identically
// with no network and the screenshot is deterministic.
const diagram = (label, tint) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
     <rect width="320" height="180" fill="${tint}"/>
     <text x="160" y="96" font-family="system-ui" font-size="22" font-weight="600"
           fill="#ffffff" text-anchor="middle">${label}</text>
   </svg>`,
)}`;

const TOPICS = [
  { slug: "physics", name: "Physics", kind: "academic", description: null },
  { slug: "chemistry", name: "Chemistry", kind: "academic", description: null },
  { slug: "mathematics", name: "Mathematics", kind: "academic", description: null },
  { slug: "strategy", name: "Strategy", kind: "non_academic", description: null },
];

const option = (id, position, label, extra = {}) => ({
  id, position, label, image_url: null, vote_count: null, share: null, viewer_choice: false, ...extra,
});

const POLLS = [
  {
    id: 1,
    slug: "how-many-hours-do-you-actually-study-each-day-1",
    question: "How many hours do you actually study each day?",
    detail: "Be honest — the average is more useful than the aspiration.",
    topic_slug: "strategy",
    topic_name: "Strategy",
    author_username: "ravi_2027",
    status: "live",
    published_at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    closes_at: new Date(Date.now() + 4 * 86400_000).toISOString(),
    vote_count: 1284,
    comment_count: 37,
    viewer_option_id: null,
    results_visible: false,
    options: [
      option(11, 1, "Under 2 hours"),
      option(12, 2, "2 to 4 hours"),
      option(13, 3, "4 to 6 hours"),
      option(14, 4, "More than 6 hours"),
    ],
  },
  {
    id: 2,
    slug: "which-free-body-diagram-is-correct-for-the-block-2",
    question: "Which free body diagram is correct for the block on the incline?",
    detail: null,
    topic_slug: "physics",
    topic_name: "Physics",
    author_username: "meera_neet",
    status: "live",
    published_at: new Date(Date.now() - 26 * 3600_000).toISOString(),
    closes_at: null,
    vote_count: 412,
    comment_count: 12,
    viewer_option_id: 22,
    results_visible: true,
    options: [
      option(21, 1, "Diagram A", { image_url: diagram("A", "#3B6FE0"), vote_count: 96, share: 23.3 }),
      option(22, 2, "Diagram B", { image_url: diagram("B", "#13919B"), vote_count: 241, share: 58.5, viewer_choice: true }),
      option(23, 3, "Diagram C", { image_url: diagram("C", "#CF8526"), vote_count: 75, share: 18.2 }),
    ],
  },
  {
    id: 3,
    slug: "which-chapter-did-you-leave-until-last-3",
    question: "Which chapter did you leave until absolutely last?",
    detail: null,
    topic_slug: "chemistry",
    topic_name: "Chemistry",
    author_username: "late_reviser",
    status: "closed",
    published_at: new Date(Date.now() - 9 * 86400_000).toISOString(),
    closes_at: new Date(Date.now() - 86400_000).toISOString(),
    vote_count: 902,
    comment_count: 64,
    viewer_option_id: null,
    results_visible: true,
    options: [
      option(31, 1, "Chemical kinetics", { vote_count: 128, share: 14.2 }),
      option(32, 2, "Coordination compounds", { vote_count: 505, share: 56.0 }),
      option(33, 3, "Electrochemistry", { vote_count: 269, share: 29.8 }),
    ],
  },
];

// A stub with just enough behaviour to make voting feel real: casting a vote
// moves the tick, reveals the shares, and updates the totals.
function createFixtureApi() {
  let polls = JSON.parse(JSON.stringify(POLLS));

  const reveal = (poll) => {
    const total = poll.options.reduce((sum, o) => sum + (o.vote_count ?? 0), 0) || 1;
    return {
      ...poll,
      results_visible: true,
      options: poll.options.map((o) => ({
        ...o,
        vote_count: o.vote_count ?? 0,
        share: Math.round(((o.vote_count ?? 0) / total) * 1000) / 10,
      })),
    };
  };

  return {
    getMode: async () => "open",
    getTopics: async () => TOPICS,
    getFeed: async ({ sort = "new", topic = null } = {}) => {
      let rows = polls.filter((poll) => !topic || poll.topic_slug === topic);
      if (sort === "top") rows = [...rows].sort((a, b) => b.vote_count - a.vote_count);
      if (sort === "closing") {
        rows = [...rows].sort((a, b) =>
          new Date(a.closes_at ?? 8.64e15) - new Date(b.closes_at ?? 8.64e15));
      }
      return rows;
    },
    getPoll: async (slug) => polls.find((poll) => poll.slug === slug) ?? null,
    getComments: async () => [],
    castVote: async (pollId, optionId) => {
      polls = polls.map((poll) => {
        if (poll.id !== pollId) return poll;
        const previous = poll.options.find((o) => o.viewer_choice);
        const options = poll.options.map((o) => ({
          ...o,
          vote_count: (o.vote_count ?? 0)
            + (o.id === optionId ? 1 : 0)
            - (previous && o.id === previous.id ? 1 : 0),
          viewer_choice: o.id === optionId,
        }));
        return reveal({
          ...poll,
          options,
          viewer_option_id: optionId,
          vote_count: poll.vote_count + (previous ? 0 : 1),
        });
      });
      return undefined;
    },
    clearVote: async (pollId) => {
      polls = polls.map((poll) => {
        if (poll.id !== pollId) return poll;
        const previous = poll.options.find((o) => o.viewer_choice);
        return reveal({
          ...poll,
          viewer_option_id: null,
          vote_count: poll.vote_count - (previous ? 1 : 0),
          options: poll.options.map((o) => ({
            ...o,
            viewer_choice: false,
            vote_count: (o.vote_count ?? 0) - (previous && o.id === previous.id ? 1 : 0),
          })),
        });
      });
      return undefined;
    },
    addComment: async () => 1,
    deleteComment: async () => undefined,
    report: async () => undefined,
  };
}

function Fixture() {
  const [api] = useState(() => createFixtureApi());
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={["/polls"]}>
        <PollsFeedPage api={api} authState={{ session: { user: { id: "fixture" } }, loading: false }} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
