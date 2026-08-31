// PollReviewPanel.jsx — the admin side of student-submitted polls.
//
// Two queues in one panel:
//   1. Waiting for review — approve or reject each submission. Every picture
//      link is RENDERED here, not just printed, because "check the image"
//      means looking at it, and a URL that reads like a diagram can serve
//      anything.
//   2. Reported content — polls and comments students have flagged.
//
// Plus the mode switch, which is what actually opens polls to the public.

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, EyeOff, X } from "lucide-react";
import { useTheme } from "../theme.jsx";
import { pollApi } from "./pollApi.js";
import { pollActionError } from "./pollErrorMessages.js";
import { timeAgo } from "./pollFormatting.js";

const MODES = [
  { id: "off", label: "Off", detail: "Nothing is readable. Shared links explain themselves." },
  { id: "read_only", label: "Read only", detail: "Polls are readable. No voting, no comments." },
  { id: "open", label: "Open", detail: "Voting, comments and submissions are live." },
];

function useAsync(run, deps) {
  const [state, setState] = useState({ status: "loading", data: [], error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: "loading" }));
    try {
      const data = await run();
      setState({ status: "ready", data, error: "" });
    } catch (error) {
      setState({ status: "error", data: [], error: error.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function PendingPoll({ poll, api, onDone, t }) {
  const [note, setNote] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const decide = async (decision) => {
    setBusy(true);
    setError("");
    try {
      await api.adminReview(
        poll.id,
        decision,
        note.trim() || null,
        decision === "approve" && closesAt ? new Date(closesAt).toISOString() : null,
      );
      await onDone();
    } catch (caught) {
      setError(pollActionError(caught, "save your review decision"));
    } finally {
      setBusy(false);
    }
  };

  const options = Array.isArray(poll.options) ? poll.options : [];
  const withPictures = options.filter((option) => option.image_url);

  return (
    <li className={`rounded-xl border ${t.border} ${t.card} p-4`}>
      <div className={`flex flex-wrap items-center gap-2 text-xs ${t.faint}`}>
        <span className="font-medium">{poll.topic_name}</span>
        <span aria-hidden="true">·</span>
        <span>by {poll.author_username || "unknown"}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={poll.created_at}>{timeAgo(poll.created_at)}</time>
      </div>

      <p className={`mt-2 text-base font-semibold ${t.text}`}>{poll.question}</p>
      {poll.detail && <p className={`mt-1 text-sm ${t.muted}`}>{poll.detail}</p>}

      <ol className={`mt-3 space-y-1 text-sm ${t.muted}`}>
        {options.map((option) => (
          <li key={option.id}>
            {option.position}. {option.label}
            {option.image_url && (
              <span className={`ml-2 break-all text-xs ${t.faint}`}>{option.image_url}</span>
            )}
          </li>
        ))}
      </ol>

      {withPictures.length > 0 && (
        <>
          <p className={`mt-3 flex items-center gap-1.5 text-xs ${t.faint}`}>
            <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
            Look at each picture before approving — the link is only checked for its host.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {withPictures.map((option) => (
              <img
                key={option.id}
                src={option.image_url}
                alt={`Option ${option.position}: ${option.label}`}
                className={`aspect-video w-40 rounded-md border ${t.border} object-cover`}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={`text-xs ${t.muted}`}>
          Note to the student (required to reject)
          <input
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            className={`mt-1 min-h-11 w-full rounded-md border ${t.border} ${t.input} px-3 text-sm ${t.text}`}
          />
        </label>
        <label className={`text-xs ${t.muted}`}>
          Close voting at (optional)
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
            className={`mt-1 min-h-11 w-full rounded-md border ${t.border} ${t.input} px-3 text-sm ${t.text}`}
          />
        </label>
      </div>

      {error && <p role="alert" className={`mt-3 text-sm ${t.muted}`}>{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("approve")}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-40"
        >
          <Check aria-hidden="true" className="h-4 w-4" /> Approve and publish
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("reject")}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border ${t.border} px-4 text-sm font-medium ${t.text} ${t.hover} disabled:opacity-40`}
        >
          <X aria-hidden="true" className="h-4 w-4" /> Reject
        </button>
      </div>
    </li>
  );
}

function ReportRow({ report, api, onDone, t }) {
  const [busy, setBusy] = useState(false);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`rounded-xl border ${t.border} ${t.card} p-4`}>
      <div className={`flex flex-wrap items-center gap-2 text-xs ${t.faint}`}>
        <span className="font-medium uppercase">{report.target_type}</span>
        <span aria-hidden="true">·</span>
        <span>{report.reason}</span>
        <span aria-hidden="true">·</span>
        <span>by {report.reporter_username || "unknown"}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={report.created_at}>{timeAgo(report.created_at)}</time>
      </div>

      <p className={`mt-2 text-sm font-medium ${t.text}`}>{report.poll_question}</p>
      {report.target_type === "comment" && (
        <p className={`mt-1 whitespace-pre-line text-sm ${t.muted}`}>“{report.comment_body}”</p>
      )}
      {report.detail && <p className={`mt-2 text-xs ${t.faint}`}>Note: {report.detail}</p>}

      <div className="mt-3 flex flex-wrap gap-3">
        {report.target_type === "comment" && !report.comment_removed && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => {
              await api.adminSetCommentRemoved(report.comment_id, true);
              await api.adminResolveReport(report.id, "actioned");
            })}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border ${t.border} px-3 text-sm ${t.text} ${t.hover} disabled:opacity-40`}
          >
            <EyeOff aria-hidden="true" className="h-4 w-4" /> Hide comment
          </button>
        )}
        {report.target_type === "poll" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => act(async () => {
              await api.adminSetStatus(report.poll_id, "hidden");
              await api.adminResolveReport(report.id, "actioned");
            })}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border ${t.border} px-3 text-sm ${t.text} ${t.hover} disabled:opacity-40`}
          >
            <EyeOff aria-hidden="true" className="h-4 w-4" /> Take poll down
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => api.adminResolveReport(report.id, "dismissed"))}
          className={`min-h-11 rounded-md px-3 text-sm ${t.muted} ${t.hover} disabled:opacity-40`}
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}

export default function PollReviewPanel({ api = pollApi }) {
  const { t } = useTheme();
  const [mode, setMode] = useState(null);
  const [modeError, setModeError] = useState("");

  const pending = useAsync(() => api.adminListPending(), [api]);
  const reports = useAsync(() => api.adminListReports(), [api]);

  useEffect(() => {
    let active = true;
    api.getMode().then((value) => { if (active) setMode(value); }).catch(() => {});
    return () => { active = false; };
  }, [api]);

  const changeMode = async (next) => {
    setModeError("");
    try {
      setMode(await api.adminSetMode(next));
    } catch (error) {
      setModeError(pollActionError(error, "change the poll mode"));
    }
  };

  return (
    <div className="space-y-10">
      <section aria-labelledby="poll-mode-heading">
        <h3 id="poll-mode-heading" className={`mb-1 text-sm font-semibold ${t.text}`}>
          Poll mode
        </h3>
        <p className={`mb-3 text-xs ${t.faint}`}>
          This is the real switch. The release flag only decides whether the pages are routed.
        </p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => changeMode(entry.id)}
              title={entry.detail}
              className={`min-h-11 rounded-md border px-3 text-sm font-medium ${
                mode === entry.id ? `${t.text} border-accent-line` : `${t.faint} ${t.border}`
              } ${t.hover}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {mode && (
          <p className={`mt-2 text-xs ${t.faint}`}>
            {MODES.find((entry) => entry.id === mode)?.detail}
          </p>
        )}
        {modeError && <p role="alert" className={`mt-2 text-sm ${t.muted}`}>{modeError}</p>}
      </section>

      <section aria-labelledby="poll-pending-heading">
        <h3 id="poll-pending-heading" className={`mb-3 text-sm font-semibold ${t.text}`}>
          Waiting for review {pending.status === "ready" ? `(${pending.data.length})` : ""}
        </h3>
        {pending.status === "loading" && <p className={`text-sm ${t.faint}`}>Loading…</p>}
        {pending.status === "error" && <p className={`text-sm ${t.muted}`}>{pending.error}</p>}
        {pending.status === "ready" && pending.data.length === 0 && (
          <p className={`text-sm ${t.faint}`}>Nothing waiting. </p>
        )}
        {pending.status === "ready" && pending.data.length > 0 && (
          <ul className="space-y-4">
            {pending.data.map((poll) => (
              <PendingPoll key={poll.id} poll={poll} api={api} onDone={pending.reload} t={t} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="poll-reports-heading">
        <h3 id="poll-reports-heading" className={`mb-3 text-sm font-semibold ${t.text}`}>
          Reported poll content {reports.status === "ready" ? `(${reports.data.length})` : ""}
        </h3>
        {reports.status === "loading" && <p className={`text-sm ${t.faint}`}>Loading…</p>}
        {reports.status === "error" && <p className={`text-sm ${t.muted}`}>{reports.error}</p>}
        {reports.status === "ready" && reports.data.length === 0 && (
          <p className={`text-sm ${t.faint}`}>Nothing reported.</p>
        )}
        {reports.status === "ready" && reports.data.length > 0 && (
          <ul className="space-y-4">
            {reports.data.map((report) => (
              <ReportRow key={report.id} report={report} api={api} onDone={reports.reload} t={t} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
