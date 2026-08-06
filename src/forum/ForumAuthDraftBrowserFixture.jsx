import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { ThemeProvider } from "../theme.jsx";
import ForumSubmitPage from "./ForumSubmitPage.jsx";
import "../index.css";

const topics = [
  { id: 1, slug: "physics", name: "Physics", description: "Mechanics, electricity, optics and modern physics.", kind: "academic" },
  { id: 2, slug: "chemistry", name: "Chemistry", description: "Physical, organic and inorganic chemistry.", kind: "academic" },
];

function Fixture() {
  const claim = new URLSearchParams(window.location.search).get("screen") === "claim";
  const api = {
    getMode: async () => "open",
    getTopics: async () => topics,
    getMyIdentity: async () => ({ username: null, needs_username: true }),
    claimUsername: async (username) => username,
    createPost: async () => 42,
  };
  const authState = claim
    ? { session: { user: { id: "browser-fixture-student" } }, loading: false }
    : { session: null, loading: false };

  useEffect(() => {
    document.documentElement.dataset.forumAuthDraftMounted = "true";
  }, []);

  return (
    <ThemeProvider>
      <MemoryRouter initialEntries={["/forum/submit"]}>
        <ForumSubmitPage api={api} authState={authState} />
      </MemoryRouter>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")).render(<Fixture />);
