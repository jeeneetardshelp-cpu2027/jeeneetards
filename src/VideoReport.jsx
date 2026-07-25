// "Report an issue" on the watch page. Production accepts reports only from
// authenticated students; anonymous users get the same compact account form
// used by ratings and no write is attempted until a session exists.
import { useState } from "react";
import { Flag } from "lucide-react";
import { supabase } from "./supabaseClient";
import { useSession } from "./useSession.js";
import { useTheme } from "./theme.jsx";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";
import StudentAuth from "./StudentAuth.jsx";
import { BRAND_TEAL } from "./brandColors.js";

const ACCENT = { teal: BRAND_TEAL, red: "#dc2626" };
const MAX_NOTE = 1000;

const REASONS = [
  { value: "broken", label: "Video won't play" },
  { value: "wrong-category", label: "Wrong subject / chapter" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

export function reportErrorMessage(error) {
  const text = String(error?.message ?? "").toLowerCase();
  if (/equivalent pending report|already.*report|duplicate/.test(text))
    return "You've already reported this issue. We'll review it.";
  if (/hourly report limit|rate limit|too many/.test(text))
    return "You've sent several reports recently. Please try again later.";
  if (/not authorized|permission denied|reporter_id.*required|jwt/.test(text))
    return "Your session expired. Sign in again, then retry.";
  if (/1000|too long|oversized/.test(text))
    return `Keep the note within ${MAX_NOTE} characters.`;
  if (/unknown target|does not exist|not found/.test(text))
    return "This lecture is no longer available to report.";
  return "Couldn't send your report. Please try again.";
}

export function reportUiEnabled({
  released = RELEASE_FEATURES.contentReporting,
  development = import.meta.env.DEV,
  search = typeof window === "undefined" ? "" : window.location.search,
} = {}) {
  // Exact local-development opt-in only. Vite replaces DEV with false in a
  // production build, so a copied preview URL cannot activate the control.
  return released || (development && new URLSearchParams(search).get("previewReports") === "1");
}

export function VideoReportForm({ videoId, videoTitle }) {
  const { t } = useTheme();
  const { session, loading: authLoading } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const reporterId = session?.user?.id;
    if (!reporterId) {
      setError("Sign in before submitting a report.");
      return;
    }
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    if (note.length > MAX_NOTE) {
      setError(`Keep the note within ${MAX_NOTE} characters.`);
      return;
    }

    setBusy(true);
    setError(null);
    const { error: submissionError } = await supabase.from("content_reports").insert({
      target_type: "video",
      target_id: videoId,
      reason,
      note: note.trim() || null,
      reporter_id: reporterId,
    });
    setBusy(false);
    if (submissionError) {
      setError(reportErrorMessage(submissionError));
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <p role="status" className={`mt-3 text-xs ${t.faint}`}>
        Thanks — we'll review this lecture.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-xs ${t.faint} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500`}
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        Report an issue
      </button>
    );
  }

  if (authLoading) {
    return (
      <div className={`mt-3 rounded-xl border ${t.border} ${t.card} p-4`}>
        <p role="status" className={`text-sm ${t.muted}`}>Checking sign-in…</p>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <section className={`mt-3 rounded-xl border ${t.border} ${t.card} p-4`} aria-labelledby="report-sign-in-title">
        <h3 id="report-sign-in-title" className={`text-sm font-semibold ${t.text}`}>
          Sign in to report this lecture
        </h3>
        <p className={`mt-1 text-xs ${t.muted}`}>
          Accounts prevent duplicate and automated reports. Your report is visible only to moderators.
        </p>
        <StudentAuth enabled />
        <button
          type="button"
          onClick={close}
          className={`mt-2 min-h-11 rounded-lg px-2 text-xs ${t.faint} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500`}
        >
          Cancel
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className={`mt-3 rounded-xl border ${t.border} ${t.card} p-4`}>
      <p className={`text-xs font-medium ${t.muted}`}>
        Report: <span className={t.text}>{videoTitle}</span>
      </p>

      <fieldset className="mt-2">
        <legend className="sr-only">Reason for reporting</legend>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((option) => {
            const selected = reason === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                disabled={busy}
                onClick={() => {
                  setReason(option.value);
                  setError(null);
                }}
                className={`min-h-11 rounded-full border px-3 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 ${
                  selected ? "text-white" : `${t.muted} ${t.hover}`
                }`}
                style={{
                  borderColor: ACCENT.teal,
                  backgroundColor: selected ? ACCENT.teal : "transparent",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className={`mt-3 block text-xs ${t.muted}`}>
        Additional details (optional)
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={MAX_NOTE}
          disabled={busy}
          placeholder="What went wrong?"
          className={`mt-1 w-full resize-y rounded-lg border ${t.border} ${t.input} ${t.text} p-2 text-sm outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50`}
        />
      </label>
      <p className={`mt-1 text-right text-xs ${t.faint}`}>{note.length}/{MAX_NOTE}</p>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT.teal }}
        >
          {busy ? "Sending…" : "Submit report"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={close}
          className={`min-h-11 rounded-lg px-2 text-xs ${t.faint} hover:underline focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50`}
        >
          Cancel
        </button>
        {error && (
          <span role="alert" className="text-xs" style={{ color: ACCENT.red }}>
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

// Backend hardening and the signed-in staging browser gate have both passed.
// Product activation remains explicit in releaseCapabilities.js so a future
// backend rollback can remove the control without deleting this component.
export default function VideoReport(props) {
  if (!reportUiEnabled()) return null;
  return <VideoReportForm {...props} />;
}
