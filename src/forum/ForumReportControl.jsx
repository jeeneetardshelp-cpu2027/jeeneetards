import { AlertTriangle, Flag, HeartHandshake } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Drawer } from "../ui.jsx";
import { useSession } from "../useSession.js";
import ForumSignInPanel from "./ForumSignInPanel.jsx";

export const FORUM_REPORT_REASONS = Object.freeze([
  { value: "spam", label: "Spam or promotion" },
  { value: "abuse_or_bullying", label: "Abuse or bullying" },
  { value: "personal_information", label: "Personal information" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "wrong_or_unsafe_advice", label: "Wrong or unsafe advice" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
]);

const MAX_NOTE = 1000;

export function forumReportError(error) {
  const detail = String(error?.cause?.message ?? error?.message ?? "").toLowerCase();
  if (/already.*pending|duplicate/.test(detail)) return "You have already reported this concern.";
  if (/rate limit|hourly/.test(detail)) return "You have sent several reports recently. Please try again later.";
  if (/target is unavailable|not found/.test(detail)) return "This content is no longer available to report.";
  if (/sign in|jwt|permission denied/.test(detail)) return "Your session expired. Sign in again, then retry.";
  if (/1000|limited/.test(detail)) return `Keep the note within ${MAX_NOTE} characters.`;
  return "Could not send your report. Please try again.";
}

function ReasonChoice({ value, label, reason, setReason, urgent = false }) {
  const checked = reason === value;
  return (
    <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
      checked
        ? urgent ? "border-danger-line bg-danger-soft text-ink" : "border-accent-line bg-accent-soft text-ink"
        : "border-hairline bg-surface text-ink-2 hover:bg-surface-2"
    }`}>
      <input
        type="radio"
        name="forum-report-reason"
        value={value}
        checked={checked}
        onChange={() => setReason(value)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
      <span className="font-medium">{label}</span>
    </label>
  );
}

export default function ForumReportControl({
  targetType, targetId, authState = null, api, compact = false,
}) {
  const liveAuth = useSession();
  const { session, loading } = authState ?? liveAuth;
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [submittedReason, setSubmittedReason] = useState(null);
  const targetLabel = targetType === "post" ? "discussion" : "answer";
  const selfHarm = reason === "self_harm";

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!reason) {
      setError("Choose the concern that best describes this content.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.submitReport({ targetType, targetId, reason, note });
      setSubmittedReason(reason);
    } catch (submissionError) {
      setError(forumReportError(submissionError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink ${compact ? "-ml-2" : ""}`}
        aria-label={`Report this ${targetLabel}`}
      >
        <Flag aria-hidden="true" className="h-4 w-4" /> Report
      </button>

      <Drawer
        open={open}
        onClose={close}
        title={`Report this ${targetLabel}`}
        closeLabel="Close report form"
        returnFocusTo={triggerRef}
      >
        {loading ? (
          <p role="status" className="text-sm text-ink-2">Checking sign-in…</p>
        ) : !session?.user ? (
          <ForumSignInPanel
            action={`report this ${targetLabel}`}
            detail="Your report and identity are visible only to moderators, never to the reported student."
          />
        ) : submittedReason ? (
          <div role="status" className="rounded-lg border border-hairline bg-surface-2 p-5">
            {submittedReason === "self_harm" ? (
              <>
                <HeartHandshake aria-hidden="true" className="h-6 w-6 text-accent" />
                <p className="mt-3 font-semibold text-ink">Sent for urgent human review</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">
                  This concern entered the urgent queue. It does not automatically hide the discussion.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-ink">Report received</p>
                <p className="mt-2 text-sm text-ink-2">A moderator will review it. We do not disclose moderation outcomes.</p>
              </>
            )}
            <Button variant="secondary" size="sm" className="mt-5" onClick={close}>Close</Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <fieldset>
              <legend className="text-sm font-semibold text-ink">What is the concern?</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {FORUM_REPORT_REASONS.map((option) => (
                  <ReasonChoice
                    key={option.value}
                    {...option}
                    reason={reason}
                    setReason={(value) => { setReason(value); setError(null); }}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5 rounded-lg border border-danger-line bg-danger-soft p-4">
              <legend className="px-1 text-sm font-semibold text-ink">Immediate safety concern</legend>
              <ReasonChoice
                value="self_harm"
                label="Self-harm or suicide concern"
                reason={reason}
                setReason={(value) => { setReason(value); setError(null); }}
                urgent
              />
              <p className="mt-3 text-xs leading-relaxed text-ink-2">
                Choose this when a student may be at risk. It goes to urgent human review and is excluded from automatic hiding.
              </p>
              {selfHarm && (
                <div className="mt-3 flex gap-2 rounded-md bg-surface p-3 text-xs leading-relaxed text-ink-2" role="note">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  <p>If someone may be in immediate danger, contact local emergency services and a trusted adult now. This report is not an emergency service.</p>
                </div>
              )}
            </fieldset>

            <label className="mt-5 block text-sm font-medium text-ink" htmlFor={`forum-report-note-${targetType}-${targetId}`}>
              Additional details <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <textarea
              id={`forum-report-note-${targetType}-${targetId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={MAX_NOTE}
              rows={4}
              disabled={busy}
              className="mt-2 min-h-24 w-full resize-y rounded-md border border-hairline bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Add context that will help the moderator."
            />
            <p className="mt-1 text-right text-xs text-ink-3">{note.length}/{MAX_NOTE}</p>

            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="submit" disabled={busy}>{busy ? "Sending…" : selfHarm ? "Send urgent concern" : "Submit report"}</Button>
              <Button variant="secondary" onClick={close} disabled={busy}>Cancel</Button>
            </div>
          </form>
        )}
      </Drawer>
    </>
  );
}
