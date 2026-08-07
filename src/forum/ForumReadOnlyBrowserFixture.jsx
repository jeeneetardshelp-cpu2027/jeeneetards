import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import ForumFeedPage from "./ForumFeedPage.jsx";
import ForumPostPage from "./ForumPostPage.jsx";
import "../index.css";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Mechanics, electricity and optics", kind: "academic" },
  { id: 2, slug: "chemistry", name: "Chemistry", description: "Physical, organic and inorganic", kind: "academic" },
  { id: 3, slug: "mathematics", name: "Mathematics", description: "Algebra, calculus and geometry", kind: "academic" },
  { id: 4, slug: "biology", name: "Biology", description: "Botany and zoology", kind: "academic" },
  { id: 5, slug: "strategy", name: "Strategy", description: "Timetables and revision", kind: "non_academic" },
  { id: 6, slug: "exam-admissions", name: "Exam & Admissions", description: "Forms, dates and counselling", kind: "non_academic" },
];

const forumPost = {
  id: 42,
  topic_slug: "physics",
  topic_name: "Physics",
  author_username: "orbit_student",
  title: "How should I approach this rotational mechanics doubt?",
  body_preview: "I understand conservation of angular momentum, but I am unsure which point to take moments about.",
  body: `I understand conservation of angular momentum, but I am unsure which point to take moments about.\n\n${
    `$$\\underbrace{${"I_1\\omega_1+".repeat(24)}I_n\\omega_n}_{\\text{angular momentum terms}}=L$$`
  }`,
  is_solved: true,
  is_locked: false,
  score: 18,
  comment_count: 3,
  hot_rank: 510,
  created_at: "2026-08-05T08:30:00.000Z",
  edited_at: null,
};

const comments = [
  { id: 1, post_id: 42, parent_id: null, depth: 0, author_username: "physics_helper", body: "Choose the point that removes the unknown reaction torque. Then write $L_i=L_f$.", is_tombstone: false, score: 7, created_at: "2026-08-05T09:00:00.000Z" },
  { id: 2, post_id: 42, parent_id: 1, depth: 1, author_username: "orbit_student", body: "So the hinge is the cleanest origin here?", is_tombstone: false, score: 2, created_at: "2026-08-05T09:10:00.000Z" },
  { id: 3, post_id: 42, parent_id: 2, depth: 2, author_username: "physics_helper", body: "Yes. The hinge force then contributes zero moment about that point.", is_tombstone: false, score: 3, created_at: "2026-08-05T09:15:00.000Z" },
];

const api = {
  getMode: async () => "read_only",
  getTopics: async () => topics,
  getFeed: async () => [forumPost, {
    ...forumPost,
    id: 43,
    topic_slug: "strategy",
    topic_name: "Strategy",
    author_username: "revision_runner",
    title: "How do I recover after falling behind my weekly plan?",
    body_preview: "I missed two days and want a realistic way to reset without making a punishing timetable.",
    is_solved: false,
    score: 6,
    comment_count: 4,
    hot_rank: 420,
  }],
  getPost: async () => forumPost,
  getComments: async () => comments,
};

function ReadyMarker() {
  useEffect(() => {
    document.documentElement.dataset.forumReadOnlyMounted = "true";
  }, []);
  return null;
}

function Fixture() {
  const thread = new URLSearchParams(window.location.search).get("screen") === "thread";
  const entry = thread ? "/forum/post/42" : "/forum";
  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={[entry]}>
        <ReadyMarker />
        <Routes>
          <Route path="/forum" element={<ForumFeedPage api={api} />} />
          <Route path="/forum/post/:postId" element={<ForumPostPage api={api} />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
