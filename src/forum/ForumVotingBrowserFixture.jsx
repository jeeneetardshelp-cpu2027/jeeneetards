import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import ForumFeedPage from "./ForumFeedPage.jsx";
import ForumPostPage from "./ForumPostPage.jsx";
import "../index.css";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Mechanics, electricity and optics", kind: "academic" },
  { id: 2, slug: "strategy", name: "Strategy", description: "Timetables and revision", kind: "non_academic" },
];

const post = {
  id: 42,
  topic_slug: "physics",
  topic_name: "Physics",
  author_username: "orbit_student",
  title: "How should I approach this rotational mechanics doubt?",
  body_preview: "I understand conservation of angular momentum, but I am unsure which point to take moments about.",
  body: "I tried the hinge as origin. Does this justify $L_i=L_f$?",
  is_solved: false,
  is_locked: false,
  score: 18,
  upvote_count: 20,
  downvote_count: 2,
  viewer_vote: 0,
  comment_count: 2,
  hot_rank: 510,
  created_at: "2026-08-05T08:30:00.000Z",
  edited_at: null,
};

const comments = [
  {
    id: 1, post_id: 42, parent_id: null, depth: 0, author_username: "physics_helper",
    body: "Choose the point that removes the unknown reaction torque.", is_tombstone: false,
    score: 7, upvote_count: 8, downvote_count: 1, viewer_vote: 0,
    created_at: "2026-08-05T09:00:00.000Z", edited_at: null,
  },
  {
    id: 2, post_id: 42, parent_id: 1, depth: 1, author_username: "orbit_student",
    body: "So the hinge is the cleanest origin here?", is_tombstone: false,
    score: 2, upvote_count: 2, downvote_count: 0, viewer_vote: 0,
    created_at: "2026-08-05T09:10:00.000Z", edited_at: null,
  },
];

const voteRows = new Map([
  ["post:42", { viewer_vote: 0, score: 18, upvote_count: 20, downvote_count: 2 }],
  ["comment:1", { viewer_vote: 0, score: 7, upvote_count: 8, downvote_count: 1 }],
  ["comment:2", { viewer_vote: 0, score: 2, upvote_count: 2, downvote_count: 0 }],
]);

function castVote({ targetType, targetId, value }) {
  const key = `${targetType}:${targetId}`;
  const current = voteRows.get(key);
  const nextVote = current.viewer_vote === value ? 0 : value;
  const next = {
    viewer_vote: nextVote,
    score: current.score + nextVote - current.viewer_vote,
    upvote_count: current.upvote_count + Number(nextVote === 1) - Number(current.viewer_vote === 1),
    downvote_count: current.downvote_count + Number(nextVote === -1) - Number(current.viewer_vote === -1),
  };
  voteRows.set(key, next);
  return new Promise((resolve) => setTimeout(() => resolve(next), 40));
}

function ReadyMarker() {
  useEffect(() => {
    document.documentElement.dataset.forumVotingMounted = "true";
  }, []);
  return null;
}

function Fixture() {
  const screen = new URLSearchParams(window.location.search).get("screen") || "signed-out";
  const thread = screen === "signed-in";
  const needsUsername = screen === "claim";
  const authState = screen === "signed-out"
    ? { session: null, loading: false }
    : { session: { user: { id: needsUsername ? "claim-student" : "voting-student" } }, loading: false };
  const api = {
    getMode: async () => "open",
    getTopics: async () => topics,
    getFeed: async () => [post],
    getPost: async () => post,
    getComments: async () => comments,
    getMyIdentity: async () => needsUsername
      ? { username: null, needs_username: true }
      : { username: "voting-student", needs_username: false },
    claimUsername: async (username) => username,
    createComment: async () => 90,
    castVote,
  };
  const entry = thread ? "/forum/post/42" : "/forum";
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <ReadyMarker />
        <Routes>
          <Route path="/forum" element={<ForumFeedPage api={api} authState={authState} />} />
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} authState={authState} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
