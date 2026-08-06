import { AlertTriangle, ExternalLink, LockKeyhole, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "../theme.jsx";
import { forumApi } from "./forumApi.js";
import { BRAND_TEAL } from "../brandColors.js";

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
  const [state, setState] = useState({ status: "loading", reports: [], error: null });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [removeId, setRemoveId] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [removeReason, setRemoveReason] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading", error: null }));
    try {
      const reports = await api.listReports({ limit: 100 });
      setState({ status: "ready", reports, error: null });
    } catch (error) {
      setState({ status: "error", reports: [], error });
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

  if (state.status === "loading") return <p role="status" className={`text-sm ${t.muted}`}>Loading forum reports…</p>;
  if (state.status === "error") {
    return (
      <div role="alert" className={`rounded-xl border ${t.border} p-5`}>
        <p className={`text-sm font-semibold ${t.text}`}>Could not load forum reports.</p>
        <button type="button" onClick={load} className={`mt-3 min-h-11 text-sm font-semibold ${t.muted}`}>Try again</button>
      </div>
    );
  }
  if (state.reports.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed ${t.border} p-8 text-center`}>
        <p className={`text-sm font-semibold ${t.text}`}>No open forum reports</p>
        <p className={`mt-1 text-sm ${t.muted}`}>Student discussion reports will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && <p role="alert" className="text-sm text-danger">{actionError}</p>}
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

            {!report.target_exists ? (
              <p role="alert" className={`mt-4 text-sm ${t.muted}`}>
                This target no longer exists. The current backend cannot dismiss the remaining report without a separate reviewed RPC.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
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
              </div>
            )}

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
