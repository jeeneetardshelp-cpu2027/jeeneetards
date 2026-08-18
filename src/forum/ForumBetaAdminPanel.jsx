import { ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../theme.jsx";
import { BRAND_TEAL } from "../brandColors.js";
import { forumApi } from "./forumApi.js";

// Exactly the format rule forum_username_is_allowed() applies in SQL
// (forum_username_claim_v1.sql). A stricter client pattern here previously
// demanded an alphanumeric first AND last character, so an admin could not
// enrol a student who had legitimately claimed `rohit_` or `-deep` -- and the
// rejection message blamed the length, sending them looking in the wrong
// place. The reserved-name and profanity rules stay server-side only: this
// field takes an already-claimed username, so the database has necessarily
// enforced them already, and duplicating a blocklist in the bundle would
// leave two copies to drift.
const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,30}$/;

function readableDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : date.toLocaleString();
}

export default function ForumBetaAdminPanel({ api = forumApi }) {
  const { t } = useTheme();
  const [state, setState] = useState({ status: "loading", mode: null, members: [], error: "" });
  const [username, setUsername] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: "" }));
    try {
      const [mode, members] = await Promise.all([api.getMode(), api.listBetaMembers()]);
      setState({ status: "ready", mode, members, error: "" });
    } catch (error) {
      setState({ status: "error", mode: null, members: [], error: error?.message || "Could not load closed-beta controls." });
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const addMember = async (event) => {
    event.preventDefault();
    const candidate = username.trim();
    setActionError("");
    if (!USERNAME_PATTERN.test(candidate)) {
      setActionError("Enter an existing forum username: 3 to 30 letters, numbers, hyphens or underscores.");
      return;
    }
    setBusy("add");
    try {
      await api.setBetaMember({ username: candidate, enabled: true });
      setUsername("");
      await load();
    } catch (error) {
      setActionError(error?.message || "Could not add that beta member.");
    } finally {
      setBusy("");
    }
  };

  const removeMember = async (member) => {
    setBusy(`remove:${member.username}`);
    setActionError("");
    try {
      await api.setBetaMember({ username: member.username, enabled: false });
      await load();
    } catch (error) {
      setActionError(error?.message || "Could not remove that beta member.");
    } finally {
      setBusy("");
    }
  };

  const setMode = async (mode) => {
    setBusy(`mode:${mode}`);
    setActionError("");
    try {
      const nextMode = await api.setMode(mode);
      setState((current) => ({ ...current, mode: nextMode }));
      setConfirmation("");
    } catch (error) {
      setActionError(error?.message || "Could not change the forum mode.");
    } finally {
      setBusy("");
    }
  };

  if (state.status === "loading") {
    return <p role="status" className={`text-sm ${t.muted}`}>Loading closed-beta controls…</p>;
  }
  if (state.status === "error") {
    return (
      <div role="alert" className={`rounded-xl border ${t.border} p-5`}>
        <p className={`text-sm font-semibold ${t.text}`}>Could not load closed-beta controls.</p>
        <p className={`mt-2 text-sm ${t.muted}`}>{state.error}</p>
        <button type="button" onClick={load} className={`mt-3 min-h-11 text-sm font-semibold ${t.muted}`}>Try again</button>
      </div>
    );
  }

  const canActivate = state.members.length > 0 && confirmation === "BETA" && !busy;
  const standardMode = ["off", "beta"].includes(state.mode);

  return (
    <div className="space-y-6">
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}

      <section className={`rounded-2xl border ${t.card} ${t.border} p-5`} aria-labelledby="forum-beta-mode-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="forum-beta-mode-heading" className={`text-base font-semibold ${t.text}`}>Forum mode</h3>
            <p className={`mt-1 text-sm ${t.muted}`}>Current mode: <strong className={t.text}>{state.mode}</strong></p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${t.border} ${t.muted}`}>
            {state.members.length} beta {state.members.length === 1 ? "member" : "members"}
          </span>
        </div>

        {!standardMode && (
          <p role="alert" className="mt-4 rounded-lg border border-danger-line bg-danger-soft p-3 text-sm text-danger">
            Mode changes are locked here because the forum is currently {state.mode}. Use the separately reviewed operational procedure.
          </p>
        )}

        {state.mode === "off" && (
          <div className="mt-5">
            <p className={`text-sm leading-relaxed ${t.muted}`}>
              Activating beta makes visible discussions publicly readable and permits only enrolled usernames to contribute.
              Type <strong className={t.text}>BETA</strong> to confirm.
            </p>
            <label className={`mt-3 block text-xs ${t.muted}`}>
              Activation confirmation
              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className={`mt-1 min-h-11 w-full max-w-xs rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
              />
            </label>
            <button
              type="button"
              disabled={!canActivate}
              onClick={() => setMode("beta")}
              className="mt-3 min-h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: BRAND_TEAL }}
            >
              Activate closed beta
            </button>
            {state.members.length === 0 && <p className={`mt-2 text-xs ${t.faint}`}>Add at least one invited username before activation.</p>}
          </div>
        )}

        {state.mode === "beta" && (
          <div className="mt-5">
            <p className={`text-sm ${t.muted}`}>Stopping beta immediately pauses all forum reads and writes; memberships are retained.</p>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setMode("off")}
              className="mt-3 min-h-11 rounded-lg border border-danger-line px-4 text-sm font-semibold text-danger disabled:opacity-40"
            >
              Stop closed beta
            </button>
          </div>
        )}
      </section>

      <section className={`rounded-2xl border ${t.card} ${t.border} p-5`} aria-labelledby="forum-beta-members-heading">
        <div className="flex items-start gap-3">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 text-accent" />
          <div>
            <h3 id="forum-beta-members-heading" className={`text-base font-semibold ${t.text}`}>Invited student usernames</h3>
            <p className={`mt-1 text-sm ${t.muted}`}>Students must sign in and claim a forum username before they can be enrolled.</p>
          </div>
        </div>

        <form onSubmit={addMember} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`min-w-0 flex-1 text-xs ${t.muted}`}>
            Existing forum username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="off"
              className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
            />
          </label>
          <button
            type="submit"
            disabled={Boolean(busy)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-40"
            style={{ backgroundColor: BRAND_TEAL }}
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" /> Add tester
          </button>
        </form>

        {state.members.length === 0 ? (
          <p className={`mt-5 rounded-lg border border-dashed ${t.border} p-4 text-sm ${t.muted}`}>No beta members are enrolled.</p>
        ) : (
          <ul className={`mt-5 divide-y ${t.divider}`}>
            {state.members.map((member) => (
              <li key={member.username} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className={`text-sm font-semibold ${t.text}`}>@{member.username}</p>
                  <p className={`mt-1 text-xs ${t.faint}`}>
                    Added {readableDate(member.added_at)} by {member.added_by_username ? `@${member.added_by_username}` : "an administrator"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => removeMember(member)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-danger-line px-3 text-xs font-semibold text-danger disabled:opacity-40"
                >
                  <UserMinus aria-hidden="true" className="h-4 w-4" /> Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
