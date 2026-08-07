import { MessageSquareText, Save } from "lucide-react";
import { useState } from "react";
import { useSession } from "../useSession.js";
import { Button, Note, Surface } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import { forumContributionError } from "./forumErrorMessages.js";
import ForumMathContent from "./ForumMathContent.jsx";
import ForumPublicNotice from "./ForumPublicNotice.jsx";
import { ForumLoadError, ForumLoading } from "./ForumStates.jsx";
import ForumSignInPanel from "./ForumSignInPanel.jsx";
import ForumUsernameClaim from "./ForumUsernameClaim.jsx";
import { useForumDraft } from "./useForumDraft.js";
import { useForumIdentity } from "./useForumIdentity.js";

const EMPTY_COMMENT_DRAFT = Object.freeze({ body: "", updated_at: 0 });

export default function ForumReplyComposer({ postId, mode, locked, api = forumApi, onPublished, authState = null }) {
  const liveAuth = useSession();
  const { session, loading: authLoading } = authState ?? liveAuth;
  const userId = session?.user?.id ?? null;
  const identity = useForumIdentity(userId, api);
  const { draft, updateDraft, clearDraft } = useForumDraft({
    kind: "comment", target: postId, userId, emptyDraft: EMPTY_COMMENT_DRAFT,
  });
  const [view, setView] = useState("write");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (locked) {
    return (
      <Surface as="section" className="mt-8">
        <h2 className="text-base font-semibold text-ink">This discussion is locked</h2>
        <p className="mt-2 text-sm text-ink-2">Existing answers remain readable, but new answers cannot be added.</p>
      </Surface>
    );
  }
  if (mode !== "open") return null;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!draft.body.trim()) {
      setError("Write your answer before publishing.");
      return;
    }
    if (!userId || authLoading) {
      setError("Sign in below when you are ready to publish. Your answer is already saved.");
      return;
    }
    if (identity.status !== "ready") {
      setError(identity.status === "needs_username"
        ? "Choose your public username below before publishing."
        : "Your forum identity is still being checked. Your answer is saved.");
      return;
    }

    setBusy(true);
    try {
      await api.createComment({ postId, body: draft.body });
      clearDraft();
      onPublished?.();
    } catch (publishError) {
      setError(forumContributionError(publishError, "publish this answer"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-8 space-y-5" aria-labelledby="forum-answer-composer-title">
      <Surface>
        <h2 id="forum-answer-composer-title" className="text-lg font-semibold text-ink">Write an answer</h2>
        <p className="mt-2 text-sm text-ink-2">Explain the reasoning, not only the final result.</p>
        <div className="mt-4"><ForumPublicNotice compact /></div>
        <form onSubmit={submit} className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="forum-answer-body" className="text-sm font-medium text-ink">Your answer</label>
            <div className="flex rounded-md border border-hairline bg-surface-inset p-1" aria-label="Answer composer view">
              {[["write", "Write"], ["preview", "Preview"]].map(([id, label]) => (
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
              id="forum-answer-body"
              value={draft.body}
              onChange={(event) => updateDraft({ ...draft, body: event.target.value })}
              maxLength={10000}
              required
              rows={8}
              placeholder="Show the steps, intuition, or preparation advice that resolves the doubt."
              className="mt-2 min-h-40 w-full resize-y rounded-md border border-hairline bg-surface-inset px-3 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent-line"
            />
          ) : (
            <div className="mt-2 min-h-40 rounded-md border border-hairline bg-surface-inset p-4">
              {draft.body.trim()
                ? <ForumMathContent>{draft.body}</ForumMathContent>
                : <p className="text-sm text-ink-3">Nothing to preview yet.</p>}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <Note icon={Save}>Saved locally as you type.</Note>
            <span className="text-xs text-ink-3">{draft.body.length}/10,000</span>
          </div>
          {error && <p role="alert" className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="mt-5" disabled={busy || authLoading} aria-busy={busy}>
            <MessageSquareText aria-hidden="true" className="h-4 w-4" />
            {busy ? "Publishing…" : "Publish answer"}
          </Button>
        </form>
      </Surface>

      {!authLoading && !userId && <ForumSignInPanel action="publish this answer" />}
      {userId && identity.status === "loading" && <ForumLoading kind="thread" />}
      {userId && identity.status === "error" && <ForumLoadError detail={identity.error} onRetry={identity.retry} />}
      {userId && identity.status === "needs_username" && (
        <ForumUsernameClaim api={api} onClaimed={identity.claimed} />
      )}
      {userId && identity.status === "ready" && (
        <p role="status" className="text-sm text-ink-3">Answering publicly as <strong className="text-ink">{identity.username}</strong>.</p>
      )}
    </section>
  );
}
