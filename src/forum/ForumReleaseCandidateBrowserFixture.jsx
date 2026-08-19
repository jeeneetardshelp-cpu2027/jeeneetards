import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import ForumFeedPage from "./ForumFeedPage.jsx";
import ForumPostPage from "./ForumPostPage.jsx";
import ForumReportsPanel from "./ForumReportsPanel.jsx";
import ForumSubmitPage from "./ForumSubmitPage.jsx";
import "../index.css";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Mechanics, electricity and optics", kind: "academic" },
  { id: 2, slug: "chemistry", name: "Chemistry", description: "Physical, organic and inorganic", kind: "academic" },
  { id: 3, slug: "mathematics", name: "Mathematics", description: "Algebra, calculus and geometry", kind: "academic" },
  { id: 4, slug: "biology", name: "Biology", description: "Botany and zoology", kind: "academic" },
  { id: 5, slug: "strategy", name: "Strategy", description: "Timetables and revision", kind: "non_academic" },
  { id: 6, slug: "exam-admissions", name: "Exam & Admissions", description: "Forms, dates and counselling", kind: "non_academic" },
];

const longFormula = `$$\\underbrace{${"I_1\\omega_1+".repeat(24)}I_n\\omega_n}_{\\text{angular momentum terms}}=L$$`;
const post = {
  id: 42, topic_slug: "physics", topic_name: "Physics", author_username: "orbit_student",
  title: "How should I approach this rotational mechanics doubt?",
  body_preview: "I understand conservation of angular momentum, but I am unsure which point to take moments about.",
  body: `I tried the hinge as origin. Does this justify $L_i=L_f$?\n\n${longFormula}\n\n<script>window.__forumRcXss = true</script>\n\n<img src=x onerror="window.__forumRcImg = true">`,
  is_solved: true, is_locked: false, score: 18, upvote_count: 20, downvote_count: 2,
  viewer_vote: 0, comment_count: 3, hot_rank: 510,
  created_at: "2026-08-05T08:30:00.000Z", edited_at: null,
};
const comments = [
  { id: 1, post_id: 42, parent_id: null, depth: 0, author_username: "physics_helper", body: "Choose the point that removes the unknown reaction torque. Then write $L_i=L_f$.", is_tombstone: false, score: 7, upvote_count: 8, downvote_count: 1, viewer_vote: 0, created_at: "2026-08-05T09:00:00.000Z", edited_at: null },
  { id: 2, post_id: 42, parent_id: 1, depth: 1, author_username: "orbit_student", body: "So the hinge is the cleanest origin here?", is_tombstone: false, score: 2, upvote_count: 2, downvote_count: 0, viewer_vote: 0, created_at: "2026-08-05T09:10:00.000Z", edited_at: null },
  { id: 3, post_id: 42, parent_id: 2, depth: 2, author_username: "physics_helper", body: "Yes. The hinge force contributes zero moment about that point.", is_tombstone: false, score: 3, upvote_count: 3, downvote_count: 0, viewer_vote: 0, created_at: "2026-08-05T09:15:00.000Z", edited_at: null },
];
const missingTargetReport = {
  id: 8, target_type: "comment", target_id: 91, reason: "self_harm", priority: "urgent",
  note: "Please review the available context", post_id: null, topic_slug: null,
  post_title: null, target_author_username: null, content_preview: null,
  target_exists: false, target_is_hidden: false, target_is_deleted: true, post_is_locked: false,
};

function ReadyMarker({ screen }) {
  useEffect(() => {
    document.documentElement.dataset.forumReleaseCandidateMounted = screen;
  }, [screen]);
  return null;
}

function Fixture() {
  const screen = new URLSearchParams(window.location.search).get("screen") || "feed";
  const authState = { session: { user: { id: "forum-rc-student" } }, loading: false };
  const api = {
    getMode: async () => "open",
    getTopics: async () => topics,
    getFeed: async () => [post, { ...post, id: 43, topic_slug: "strategy", topic_name: "Strategy", title: "How do I recover after falling behind my weekly plan?", body_preview: "I missed two days and want a realistic reset.", is_solved: false, score: 6, comment_count: 4 }],
    getPost: async () => post,
    getComments: async () => comments,
    getMyIdentity: async () => ({ username: "forum-rc-student", needs_username: false }),
    claimUsername: async (username) => username,
    createPost: async () => 77,
    createComment: async () => 92,
    castVote: async ({ value }) => ({ viewer_vote: value, score: 18 + value, upvote_count: 20 + Number(value === 1), downvote_count: 2 + Number(value === -1) }),
    submitReport: async ({ reason }) => {
      document.documentElement.dataset.forumRcReportReason = reason;
      return 9;
    },
    listReports: async () => [missingTargetReport],
    listSuspensions: async () => [],
    setSuspension: async () => null,
    moderate: async () => null,
    dismissReport: async ({ reportId }) => {
      document.documentElement.dataset.forumRcDismissedReport = String(reportId);
      return null;
    },
  };
  const entry = screen === "thread" ? "/forum/post/42"
    : screen === "submit" ? "/forum/submit"
      : screen === "admin" ? "/admin-forum" : "/forum";

  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <ReadyMarker screen={screen} />
        <Routes>
          <Route path="/forum" element={<ForumFeedPage api={api} authState={authState} />} />
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} authState={authState} />} />
          <Route path="/forum/submit" element={<ForumSubmitPage api={api} authState={authState} />} />
          <Route path="/admin-forum" element={(
            <main className="min-h-screen bg-canvas p-4">
              <h1 className="mb-5 text-xl font-semibold text-ink">Forum moderation release check</h1>
              <ForumReportsPanel api={api} />
            </main>
          )} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
