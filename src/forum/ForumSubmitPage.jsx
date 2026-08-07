import { FileText, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Page } from "../AppShell.jsx";
import { useSession } from "../useSession.js";
import { Button, Note, SectionHead, Surface } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import { forumContributionError } from "./forumErrorMessages.js";
import ForumMathContent from "./ForumMathContent.jsx";
import ForumPublicNotice from "./ForumPublicNotice.jsx";
import { ForumLoadError, ForumLoading, ForumUnavailable } from "./ForumStates.jsx";
import ForumSignInPanel from "./ForumSignInPanel.jsx";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";
import { useForumDraft } from "./useForumDraft.js";
import { useForumIdentity } from "./useForumIdentity.js";
import { useForumSubmitSetup } from "./useForumSubmitSetup.js";

const EMPTY_POST_DRAFT = Object.freeze({ topic: "", title: "", body: "", updated_at: 0 });

export default function ForumSubmitPage({ api = forumApi, authState = null }) {
  const navigate = useNavigate();
  const liveAuth = useSession();
  const { session, loading: authLoading } = authState ?? liveAuth;
  const userId = session?.user?.id ?? null;
  const identity = useForumIdentity(userId, api);
  const setup = useForumSubmitSetup(api);
  const { draft, updateDraft, clearDraft } = useForumDraft({
    kind: "post", target: "new", userId, emptyDraft: EMPTY_POST_DRAFT,
  });
  const [view, setView] = useState("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedTopic = useMemo(
    () => setup.topics.find((topic) => topic.slug === draft.topic),
    [draft.topic, setup.topics],
  );

  if (setup.status === "loading") return (
    <Page crumbs={[{ label: "Student forum", to: "/forum" }, { label: "New discussion" }]} width="reading">
      <ForumLoading kind="thread" />
    </Page>
  );
  if (setup.status === "unavailable") return (
    <Page crumbs={[{ label: "Student forum", to: "/forum" }, { label: "New discussion" }]} width="reading">
      <ForumUnavailable />
    </Page>
  );
  if (setup.status === "error") return (
    <Page crumbs={[{ label: "Student forum", to: "/forum" }, { label: "New discussion" }]} width="reading">
      <ForumLoadError detail={setup.error} onRetry={setup.retry} />
    </Page>
  );

  const publish = async (event) => {
    event.preventDefault();
    setError("");
    if (!draft.topic || draft.title.trim().length < 10 || !draft.body.trim()) {
      setError("Choose a topic, write a title of at least 10 characters, and include your question or context.");
      return;
    }
    if (setup.mode !== "open") {
      setError("Contributions are paused right now. Your draft is saved on this device.");
      return;
    }
    if (!userId || authLoading) {
      setError("Sign in below when you are ready to publish. Your draft is already saved.");
      return;
    }
    if (identity.status !== "ready") {
      setError(identity.status === "needs_username"
        ? "Choose your public username below before publishing."
        : "Your forum identity is still being checked. Your draft is saved.");
      return;
    }

    setBusy(true);
    try {
      const postId = await api.createPost({
        topic: draft.topic, title: draft.title.trim(), body: draft.body,
      });
      clearDraft();
      navigate(`/forum/post/${postId}`);
    } catch (publishError) {
      setError(forumContributionError(publishError, "publish this discussion"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page crumbs={[{ label: "Student forum", to: "/forum" }, { label: "New discussion" }]} width="reading">
      <SectionHead
        as="h1"
        eyebrow="New discussion"
        title="Ask a clear question"
        lead="Include what you tried, where you became stuck, and enough context for another student to help."
      />

      <div className="mb-5">
        <ForumPublicNotice />
      </div>

      {setup.mode !== "open" && (
        <p role="status" className="mb-5 rounded-lg border border-hairline bg-surface-2 p-4 text-sm text-ink-2">
          The forum is currently read-only. You can keep writing locally, but publishing is paused.
        </p>
      )}

      <Surface as="section" className="min-w-0">
        <form onSubmit={publish} className="space-y-5">
          <div>
            <label htmlFor="forum-post-topic" className="text-sm font-medium text-ink">Topic</label>
            <select
              id="forum-post-topic"
              value={draft.topic}
              onChange={(event) => updateDraft({ ...draft, topic: event.target.value })}
              required
              className="mt-2 min-h-11 w-full rounded-md border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink focus:border-accent-line"
            >
              <option value="">Choose a topic</option>
              {setup.topics.map((topic) => <option key={topic.slug} value={topic.slug}>{topic.name}</option>)}
            </select>
            {selectedTopic?.description && <p className="mt-2 text-xs text-ink-3">{selectedTopic.description}</p>}
          </div>

          <div>
            <label htmlFor="forum-post-title" className="text-sm font-medium text-ink">Title</label>
            <input
              id="forum-post-title"
              value={draft.title}
              onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
              minLength={10}
              maxLength={300}
              required
              placeholder="State the exact doubt or preparation question"
              className="mt-2 min-h-11 w-full rounded-md border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent-line"
            />
            <p className="mt-2 text-right text-xs text-ink-3">{draft.title.length}/300</p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="forum-post-body" className="text-sm font-medium text-ink">Question and context</label>
              <div className="flex rounded-md border border-hairline bg-surface-inset p-1" aria-label="Composer view">
                {[
                  ["write", "Write"], ["preview", "Preview"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={view === id}
                    onClick={() => setView(id)}
                    className={`min-h-11 rounded-sm px-4 text-sm ${view === id ? "bg-surface font-semibold text-ink shadow-e1" : "text-ink-2"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {view === "write" ? (
              <textarea
                id="forum-post-body"
                value={draft.body}
                onChange={(event) => updateDraft({ ...draft, body: event.target.value })}
                maxLength={20000}
                required
                rows={12}
                placeholder="Explain what you tried. Markdown and LaTeX such as $F=ma$ are supported."
                className="mt-2 min-h-48 w-full resize-y rounded-md border border-hairline bg-surface-inset px-3 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent-line"
              />
            ) : (
              <div className="mt-2 min-h-48 rounded-md border border-hairline bg-surface-inset p-4">
                {draft.body.trim()
                  ? <ForumMathContent>{draft.body}</ForumMathContent>
                  : <p className="text-sm text-ink-3">Nothing to preview yet.</p>}
              </div>
            )}
            <p className="mt-2 text-right text-xs text-ink-3">{draft.body.length}/20,000</p>
          </div>

          <Note icon={Save}>Draft changes are saved locally on this device as you type.</Note>
          {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy || authLoading} aria-busy={busy}>
            <FileText aria-hidden="true" className="h-4 w-4" />
            {busy ? "Publishing…" : "Publish discussion"}
          </Button>
        </form>
      </Surface>

      <div className="mt-6 space-y-5">
        {!authLoading && !userId && <ForumSignInPanel action="publish this discussion" />}
        {userId && identity.status === "loading" && <ForumLoading kind="thread" />}
        {userId && identity.status === "error" && <ForumLoadError detail={identity.error} onRetry={identity.retry} />}
        {userId && identity.status === "needs_username" && (
          <ForumUsernameClaim api={api} onClaimed={identity.claimed} />
        )}
        {userId && identity.status === "ready" && (
          <p role="status" className="text-sm text-ink-3">Publishing publicly as <strong className="text-ink">{identity.username}</strong>.</p>
        )}
      </div>
    </Page>
  );
}
