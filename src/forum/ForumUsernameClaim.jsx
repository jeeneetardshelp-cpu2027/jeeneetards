import { AtSign, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button, IconTile, Surface } from "../ui.jsx";
import { forumApi } from "./forumApi.js";
import { forumContributionError } from "./forumErrorMessages.js";

export const FORUM_USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

export default function ForumUsernameClaim({ api = forumApi, onClaimed }) {
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const candidate = username.trim();
    if (!FORUM_USERNAME_PATTERN.test(candidate)) {
      setError("Use 3–30 letters, numbers, underscores or hyphens.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const claimed = await api.claimUsername(candidate);
      onClaimed(claimed);
    } catch (claimError) {
      setError(forumContributionError(claimError, "claim this username"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Surface as="section" className="flex flex-col gap-5 sm:flex-row" aria-labelledby="forum-username-title">
      <IconTile icon={AtSign} tint="var(--accent)" />
      <div className="min-w-0 flex-1">
        <h2 id="forum-username-title" className="text-lg font-semibold text-ink">Choose your public forum username</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          This name appears beside your public posts and answers. Your email and real name are not shown.
        </p>
        <form className="mt-5" onSubmit={submit}>
          <label htmlFor="forum-username" className="text-sm font-medium text-ink">Username</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input
              id="forum-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_-]{3,30}"
              autoComplete="nickname"
              required
              className="min-h-11 min-w-0 flex-1 rounded-md border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent-line"
              placeholder="e.g. physics_learner"
            />
            <Button type="submit" size="sm" disabled={busy} aria-busy={busy}>
              {busy ? "Claiming…" : "Claim username"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-3">Letters, numbers, _ and - only. Usernames cannot be changed after claiming.</p>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          Availability and reserved-name rules are checked by the database when you claim.
        </p>
      </div>
    </Surface>
  );
}
