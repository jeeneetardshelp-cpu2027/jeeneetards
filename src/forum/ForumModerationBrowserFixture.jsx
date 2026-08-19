import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import ForumPostPage from "./ForumPostPage.jsx";
import ForumReportsPanel from "./ForumReportsPanel.jsx";
import "../index.css";

const post = {
  id: 42, topic_slug: "physics", topic_name: "Physics", author_username: "orbit_student",
  title: "How should I approach this rotational mechanics doubt?",
  body: "I tried the hinge as origin. Does this justify $L_i=L_f$?",
  is_solved: false, is_locked: false, score: 18, upvote_count: 20, downvote_count: 2,
  viewer_vote: 0, comment_count: 1, created_at: "2026-08-05T08:30:00.000Z", edited_at: null,
};
const comments = [{
  id: 91, post_id: 42, parent_id: null, depth: 0, author_username: "physics_helper",
  body: "Choose the point that removes the unknown reaction torque.", is_tombstone: false,
  score: 7, upvote_count: 8, downvote_count: 1, viewer_vote: 0,
  created_at: "2026-08-05T09:00:00.000Z", edited_at: null,
}];
const report = {
  id: 8, target_type: "comment", target_id: 91, reason: "self_harm", priority: "urgent",
  note: "Please review quickly", post_id: 42, topic_slug: "physics",
  post_title: post.title, target_author_username: "physics_helper",
  content_preview: "The exact reported answer preview.", target_exists: true, target_is_hidden: false,
  target_is_deleted: false, post_is_locked: false,
};

function ReadyMarker() {
  useEffect(() => { document.documentElement.dataset.forumModerationMounted = "true"; }, []);
  return null;
}

function Fixture() {
  const screen = new URLSearchParams(window.location.search).get("screen") || "student";
  const api = {
    getMode: async () => "read_only",
    getPost: async () => post,
    getComments: async () => comments,
    getMyIdentity: async () => ({ username: "reporting-student", needs_username: false }),
    castVote: async () => ({ viewer_vote: 0, score: 18, upvote_count: 20, downvote_count: 2 }),
    createComment: async () => 92,
    submitReport: async ({ reason }) => {
      document.documentElement.dataset.submittedReportReason = reason;
      return 8;
    },
    listReports: async () => [report],
    listSuspensions: async () => [],
    setSuspension: async ({ username, days, reason }) => {
      document.documentElement.dataset.suspensionUsername = username;
      document.documentElement.dataset.suspensionDays = String(days);
      document.documentElement.dataset.suspensionReason = reason;
      return {
        username,
        suspended_until: "2026-09-18T00:00:00.000Z",
        reason,
      };
    },
    moderate: async ({ action }) => {
      document.documentElement.dataset.moderationAction = action;
      return null;
    },
  };
  const authState = { session: { user: { id: "reporting-student" } }, loading: false };
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[screen === "admin" ? "/admin-forum" : "/forum/post/42"]}>
        <ReadyMarker />
        <Routes>
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} authState={authState} />} />
          <Route path="/admin-forum" element={<main className="min-h-screen bg-canvas p-4"><ForumReportsPanel api={api} /></main>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
