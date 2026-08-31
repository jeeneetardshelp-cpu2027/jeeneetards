// PollReportControl.jsx — "Report" on a poll or a comment.
//
// Uses the shared Drawer so the reporting flow looks and behaves the same as
// everywhere else in the product. Deliberately smaller than the forum's
// version: no self-harm branch, because a poll comment is not the surface
// where that conversation happens, and a half-built crisis path is worse than
// an honest general "Something else".

import { Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, Drawer } from "../ui.jsx";
import { pollApi } from "./pollApi.js";
import { pollActionError } from "./pollErrorMessages.js";

export const POLL_REPORT_REASONS = Object.freeze([
  { value: "spam", label: "Spam or promotion" },
  { value: "abuse", label: "Abuse or bullying" },
  { value: "personal_information", label: "Personal information" },
  { value: "misinformation", label: "Wrong or unsafe information" },
  { value: "off_topic", label: "Off topic" },
  { value: "other", label: "Something else" },
]);

const MAX_DETAIL = 500;

export default function PollReportControl({
  targetType, targetId, api = pollApi, signedIn = false, compact = true,
}) {
  const triggerRef = useRef(null);
  const sentRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // When the report is sent, the trigger button unmounts (replaced by the
  // "Reported" status), so the Drawer's return-focus target is gone and focus
  // would fall to <body>. Move focus onto the confirmation instead, so a
  // keyboard/screen-reader user hears the outcome and keeps their place.
  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const label = targetType === "poll" ? "poll" : "comment";

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError("");
  };

  const send = async () => {
    if (!reason) {
      setError("Choose a reason so an admin knows what to look at.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.report(targetType, targetId, reason, detail.trim() || null);
      setSent(true);
      setOpen(false);
    } catch (caught) {
      setError(pollActionError(caught, "send your report"));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <span
        ref={sentRef}
        tabIndex={-1}
        role="status"
        className="inline-flex min-h-11 items-center text-xs text-ink-3 outline-none"
      >
        Reported. An admin will look at this.
      </span>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-11 items-center gap-1.5 text-ink-3 transition-colors duration-200 hover:text-ink ${
          compact ? "text-xs" : "text-sm"
        }`}
      >
        <Flag aria-hidden="true" className="h-3.5 w-3.5" />
        Report
      </button>

      <Drawer
        open={open}
        onClose={close}
        title={`Report this ${label}`}
        returnFocusTo={triggerRef}
        footer={
          signedIn ? (
            <div className="flex justify-end gap-3">
              <Button variant="secondary" size="sm" onClick={close} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={send} disabled={busy}>
                {busy ? "Sending…" : "Send report"}
              </Button>
            </div>
          ) : null
        }
      >
        {!signedIn ? (
          <p className="text-sm text-ink-2">
            <Link to="/signin" className="font-semibold text-accent">Sign in</Link>{" "}
            to report content. Reports are tied to an account so the queue can be trusted.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Tell us what is wrong with this {label}. Reports are private and go to an admin.
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">Reason</legend>
              {POLL_REPORT_REASONS.map((entry) => {
                const checked = reason === entry.value;
                return (
                  <label
                    key={entry.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors duration-200 ${
                      checked
                        ? "border-accent-line bg-accent-soft text-ink"
                        : "border-hairline bg-surface text-ink-2 hover:bg-surface-2"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`poll-report-${targetType}-${targetId}`}
                      value={entry.value}
                      checked={checked}
                      onChange={() => setReason(entry.value)}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    <span className="font-medium">{entry.label}</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="mt-4 block text-sm font-medium text-ink">
              Anything else? (optional)
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value.slice(0, MAX_DETAIL))}
                rows={3}
                className="mt-2 w-full rounded-md border border-hairline bg-surface-2 p-3 text-sm font-normal text-ink outline-none focus:border-accent-line focus:bg-surface"
              />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-ink-2">{error}</p>}
          </>
        )}
      </Drawer>
    </>
  );
}
