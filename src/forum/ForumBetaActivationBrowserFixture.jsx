import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider, useTheme } from "../theme.jsx";
import ForumBetaAdminPanel from "./ForumBetaAdminPanel.jsx";
import ForumFeedPage from "./ForumFeedPage.jsx";
import ForumSubmitPage from "./ForumSubmitPage.jsx";
import "../index.css";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Mechanics, electricity and optics", kind: "academic" },
  { id: 2, slug: "strategy", name: "Strategy", description: "Timetables and revision", kind: "non_academic" },
];

const post = {
  id: 42,
  topic_slug: "physics",
  topic_name: "Physics",
  author_username: "beta_student",
  title: "How should I approach this rotational mechanics doubt?",
  body_preview: "I understand angular momentum, but I am unsure which point to take moments about.",
  is_solved: false,
  score: 4,
  upvote_count: 5,
  downvote_count: 1,
  viewer_vote: 0,
  comment_count: 2,
  hot_rank: 100,
  created_at: "2026-08-08T06:00:00.000Z",
  edited_at: null,
};

const member = {
  username: "beta_student",
  added_at: "2026-08-08T05:00:00.000Z",
  added_by_username: "forum_admin",
};

function ReadyMarker({ screen }) {
  useEffect(() => {
    document.documentElement.dataset.forumBetaActivationMounted = screen;
  }, [screen]);
  return null;
}

function FixtureTheme({ desired }) {
  const { dark, toggle } = useTheme();
  useEffect(() => {
    if ((desired === "dark") !== dark) toggle();
  }, [dark, desired, toggle]);
  return null;
}

function Fixture() {
  const screen = new URLSearchParams(window.location.search).get("screen") || "admin";
  const desiredTheme = new URLSearchParams(window.location.search).get("theme") === "light" ? "light" : "dark";
  const enrolled = !screen.startsWith("outsider");
  const authState = { session: { user: { id: enrolled ? "beta-member" : "beta-outsider" } }, loading: false };
  const api = {
    getMode: async () => screen === "admin" ? "off" : "beta",
    getTopics: async () => topics,
    getFeed: async () => [post],
    getMyIdentity: async () => ({ username: enrolled ? "beta_student" : "beta_outsider", needs_username: false }),
    getBetaMembership: async () => enrolled,
    createPost: async () => 77,
    castVote: async ({ value }) => ({
      viewer_vote: value,
      score: post.score + value,
      upvote_count: post.upvote_count + Number(value === 1),
      downvote_count: post.downvote_count + Number(value === -1),
    }),
    listBetaMembers: async () => [member],
    setBetaMember: async () => true,
    setMode: async (mode) => mode,
  };
  const entry = screen === "submit" || screen === "outsider-submit" ? "/forum/submit"
    : screen === "admin" ? "/admin-forum-beta" : "/forum";

  return (
    <ThemeProvider>
      <FixtureTheme desired={desiredTheme} />
      <MemoryRouter initialEntries={[entry]}>
        <ReadyMarker screen={screen} />
        <Routes>
          <Route path="/forum" element={<ForumFeedPage api={api} authState={authState} />} />
          <Route path="/forum/submit" element={<ForumSubmitPage api={api} authState={authState} />} />
          <Route path="/admin-forum-beta" element={(
            <main className="min-h-screen bg-canvas p-4">
              <h1 className="mb-5 text-xl font-semibold text-ink">Closed-beta access</h1>
              <ForumBetaAdminPanel api={api} />
            </main>
          )} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
