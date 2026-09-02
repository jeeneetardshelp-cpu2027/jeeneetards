import { AlertTriangle, ExternalLink, LockKeyhole, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../theme.jsx";
import { forumApi } from "./forumApi.js";
import { BRAND_TEAL } from "../brandColors.js";
import ForumSuspensionControl from "./ForumSuspensionControl.jsx";

const LABELS = Object.freeze({
  spam: "Spam or promotion",
  abuse_or_bullying: "Abuse or bullying",
  personal_information: "Personal information",
  sexual_content: "Sexual content",
  self_harm: "Self-harm or suicide concern",
  wrong_or_unsafe_advice: "Wrong or unsafe advice",
  off_topic: "Off topic",
  other: "Something else",
});

export default function ForumReportsPanel({ api = forumApi }) {
  const { t } = useTheme();
  const [state, setState] = useState({
    status: "loading", reports: [], suspensions: [], error: null,
  });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [removeReason, setRemoveReason] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const [reports, suspensions] = await Promise.all([
        api.listReports({ limit: 100 }),
        api.listSuspensions(),
      ]);
      setState({ status: "ready", reports, suspensions, error: null });
    } catch (error) {
      setState({ status: "error", reports: [], suspensions: [], error });
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const act = async (report, action, reason) => {
    setBusyId(report.id);
    setActionError(null);
    try {
      await api.moderate({
        targetType: report.target_type,
        targetId: report.target_id,
        action,
        reason,
        reportId: report.id,
      });
      setState((current) => ({
        ...current,
        reports: current.reports.filter((item) => item.id !== report.id),
      }));
      setRemoveId(null);
      setConfirmation("");
      setRemoveReason("");
    } catch (error) {
      setActionError(error?.message ?? "Could not apply that moderation action.");
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (report) => {
    setBusyId(report.id);
    setActionError(null);
    try {
      await api.dismissReport({ reportId: report.id });
      setState((current) => ({
        ...current,
        reports: current.reports.filter((item) => item.id !== report.id),
      }));
    } catch (error) {
      setActionError(error?.message ?? "Could not dismiss that report.");
    } finally {
      setBusyId(null);
    }
  };

  const suspensionChanged = (result) => {
    setState((current) => {
      const withoutStudent = current.suspensions.filter(
        (item) => item.username.toLowerCase() !== result.username.toLowerCase(),
      );
      return {
        ...current,
        suspensions: result.suspended_until
          ? [{ ...result, is_active: new Date(result.suspended_until).getTime() > Date.now() }, ...withoutStudent]
          : withoutStudent,
      };
    });
  };

  if (state.status === "loading") return <p role="status" className={`text-sm ${t.muted}`}>Loading forum reports…</p>;
  if (state.status === "error") {
    return (
      <div role="alert" className={`rounded-xl border ${t.border} p-5`}>
        <p className={`text-sm font-semibold ${t.text}`}>Could not load forum reports.</p>
        <button type="button" onClick={load} className={`mt-3 min-h-11 text-sm font-semibold ${t.muted}`}>Try again</button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
      <section className={`rounded-2xl border p-5 ${t.card} ${t.border}`} aria-labelledby="forum-suspensions-heading">
        <h3 id="forum-suspensions-heading" className={`text-sm font-semibold ${t.text}`}>Forum suspensions</h3>
        <p className={`mt-1 text-xs ${t.muted}`}>Active and expired restrictions remain here until a moderator lifts or clears them.</p>
        {state.suspensions.length === 0 ? (
          <p className={`mt-3 text-sm ${t.faint}`}>No forum suspensions.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {state.suspensions.map((suspension) => (
              <div key={suspension.username} className={`rounded-xl border p-4 ${t.border}`}>
                <p className={`text-sm font-semibold ${t.text}`}>@{suspension.username}</p>
                <p className={`mt-1 text-xs ${t.muted}`}>
                  {suspension.is_active ? "Active" : "Expired"} · {suspension.reason}
                </p>
                <div className="mt-3">
                  <ForumSuspensionControl
                    username={suspension.username}
                    existing={suspension}
                    api={api}
                    onChanged={suspensionChanged}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {state.reports.length === 0 && (
        <div className={`rounded-2xl border border-dashed ${t.border} p-8 text-center`}>
          <p className={`text-sm font-semibold ${t.text}`}>No open forum reports</p>
          <p className={`mt-1 text-sm ${t.muted}`}>Student discussion reports will appear here.</p>
        </div>
      )}
      {state.reports.map((report) => {
        const urgent = report.reason === "self_harm" || report.priority === "urgent";
        const removing = removeId === report.id;
        const busy = busyId === report.id;
        return (
          <article
            key={report.id}
            className={`rounded-2xl border p-5 ${t.card} ${urgent ? "border-danger-line" : t.border}`}
            aria-label={`${urgent ? "Urgent " : ""}forum report ${report.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {urgent ? <ShieldAlert aria-hidden="true" className="h-5 w-5 text-danger" /> : <AlertTriangle aria-hidden="true" className={`h-5 w-5 ${t.muted}`} />}
                  <h3 className={`text-sm font-semibold ${t.text}`}>{LABELS[report.reason] ?? report.reason}</h3>
                  {urgent && <span className="rounded-full bg-danger px-2 py-1 text-[11px] font-semibold text-danger-ink">Urgent human review</span>}
                </div>
                <p className={`mt-2 text-xs ${t.faint}`}>
                  {report.target_type} #{report.target_id} · post #{report.post_id ?? "unavailable"}
                  {report.topic_slug ? ` · ${report.topic_slug}` : ""}
                </p>
              </div>
              {report.post_id && (
                <a
                  href={`/forum/post/${report.post_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${t.muted}`}
                >
                  Open discussion <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            <div className={`mt-4 rounded-xl border ${t.border} p-4`}>
              <p className={`text-sm font-semibold ${t.text}`}>{report.post_title || "Discussion unavailable"}</p>
              <p className={`mt-1 text-xs ${t.faint}`}>Target author: {report.target_author_username || "Deleted or unavailable student"}</p>
              <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed ${t.muted}`}>
                {report.content_preview || "The reported content no longer exists."}
              </p>
            </div>
            {report.note && <p className={`mt-3 text-sm ${t.muted}`}><strong>Reporter note:</strong> {report.note}</p>}
            {urgent && (
              <p className="mt-3 rounded-lg bg-danger-soft p-3 text-xs leading-relaxed text-danger">
                Do not treat this as an ordinary takedown ticket. Review promptly; this reason never auto-hides content.
              </p>
            )}

            {!report.target_exists && (
              <p role="status" className={`mt-4 text-sm ${t.muted}`}>
                The reported target no longer exists. Dismissing this report closes the queue item without changing discussion content.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {report.target_exists && (
                <>
                {/* text-white stays literal: ink on BRAND_TEAL, a fill that is
                    the same colour in both themes, so a theme token would be
                    the bug. Same idiom as adminUI.jsx. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(report, "hide", "Reviewed forum report")}
                  className="min-h-11 rounded-lg px-3 text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: BRAND_TEAL }}
                >
                  {report.target_is_hidden ? "Keep hidden and resolve" : "Hide and resolve"}
                </button>
                {report.target_is_hidden && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => act(report, "unhide", "Reviewed forum report: content restored")}
                    className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-50`}
                  >
                    Restore and resolve
                  </button>
                )}
                {report.target_type === "post" && (
                  <>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => act(report, "lock", "Reviewed forum report")}
                      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-50`}
                    >
                      <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
                      {report.post_is_locked ? "Keep locked and resolve" : "Lock and resolve"}
                    </button>
                    {report.post_is_locked && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(report, "unlock", "Reviewed forum report: discussion unlocked")}
                        className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-50`}
                      >
                        Unlock and resolve
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setRemoveId(report.id); setActionError(null); }}
                  className="min-h-11 rounded-lg border border-danger-line px-3 text-xs font-semibold text-danger disabled:opacity-50"
                >
                  Permanently remove…
                </button>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => dismiss(report)}
                className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-50`}
              >
                Dismiss report without changing content
              </button>
              {report.target_author_username && (
                <ForumSuspensionControl
                  username={report.target_author_username}
                  existing={state.suspensions.find(
                    (item) => item.username.toLowerCase() === report.target_author_username.toLowerCase(),
                  )}
                  api={api}
                  onChanged={suspensionChanged}
                />
              )}
            </div>

            {removing && (
              <div className={`mt-4 rounded-xl border border-danger-line p-4 ${t.card}`}>
                <p className={`text-sm font-semibold ${t.text}`}>Permanent removal cannot be undone.</p>
                <label className={`mt-3 block text-xs ${t.muted}`}>
                  Removal reason
                  <input
                    value={removeReason}
                    onChange={(event) => setRemoveReason(event.target.value)}
                    className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
                  />
                </label>
                <label className={`mt-3 block text-xs ${t.muted}`}>
                  Type REMOVE to confirm
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || confirmation !== "REMOVE" || removeReason.trim().length < 3}
                    onClick={() => act(report, "remove", removeReason)}
                    className="min-h-11 rounded-lg bg-danger px-3 text-xs font-semibold text-danger-ink disabled:opacity-40"
                  >
                    Confirm permanent removal
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => { setRemoveId(null); setConfirmation(""); setRemoveReason(""); }}
                    className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${t.muted}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
