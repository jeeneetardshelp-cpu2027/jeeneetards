import { useState } from "react";
import { useTheme } from "../theme.jsx";
import { BRAND_TEAL } from "../brandColors.js";
import { forumApi } from "./forumApi.js";

const DURATIONS = Object.freeze([1, 7, 30, 90, 365]);

export default function ForumSuspensionControl({
  username,
  existing = null,
  api = forumApi,
  onChanged = () => {},
}) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const cleanReason = reason.trim();
  const validReason = cleanReason.length >= 3 && cleanReason.length <= 500;
  const hasExisting = Boolean(existing);
  const isActive = Boolean(existing?.is_active);

  const apply = async (nextDays) => {
    setBusy(true);
    setError("");
    setConfirmation("");
    try {
      const result = await api.setSuspension({
        username,
        days: nextDays,
        reason: cleanReason,
      });
      onChanged(result);
      setReason("");
      setOpen(false);
      setConfirmation(nextDays == null
        ? `Suspension lifted for ${username}.`
        : `${username} is suspended for ${nextDays} day${nextDays === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught?.message ?? "Could not change that suspension.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        disabled={busy}
        onClick={() => { setOpen((current) => !current); setError(""); setConfirmation(""); }}
        className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-50`}
      >
        {hasExisting ? "Manage suspension…" : "Suspend author…"}
      </button>

      {confirmation && (
        <p role="status" className="mt-2 text-xs" style={{ color: BRAND_TEAL }}>
          {confirmation}
        </p>
      )}

      {open && (
        <div className={`mt-3 rounded-xl border p-4 ${t.border} ${t.card}`}>
          <p className={`text-sm font-semibold ${t.text}`}>
            {hasExisting ? `Manage @${username}` : `Suspend @${username}`}
          </p>
          {hasExisting && (
            <p className={`mt-1 text-xs ${t.muted}`}>
              {isActive
                ? `Suspended until ${new Date(existing.suspended_until).toLocaleString()}.`
                : "This suspension has expired but has not yet been cleared."}
            </p>
          )}
          <label className={`mt-3 block text-xs ${t.muted}`}>
            Duration
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
            >
              {DURATIONS.map((value) => (
                <option key={value} value={value}>{value} day{value === 1 ? "" : "s"}</option>
              ))}
            </select>
          </label>
          <label className={`mt-3 block text-xs ${t.muted}`}>
            Moderation reason (3–500 characters)
            <textarea
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              className={`mt-1 min-h-24 w-full rounded-lg border px-3 py-2 text-sm ${t.border} ${t.input} ${t.text}`}
            />
          </label>
          <p className={`mt-1 text-right text-[11px] ${t.faint}`}>{cleanReason.length}/500</p>
          {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !validReason}
              onClick={() => apply(days)}
              className="min-h-11 rounded-lg bg-danger px-3 text-xs font-semibold text-danger-ink disabled:opacity-40"
            >
              {hasExisting ? "Update suspension" : "Confirm suspension"}
            </button>
            {hasExisting && (
              <button
                type="button"
                disabled={busy || !validReason}
                onClick={() => apply(null)}
                className={`min-h-11 rounded-lg border px-3 text-xs font-semibold ${t.border} ${t.muted} disabled:opacity-40`}
              >
                {isActive ? "Lift suspension" : "Clear expired suspension"}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => { setOpen(false); setReason(""); setError(""); }}
              className={`min-h-11 rounded-lg px-3 text-xs font-semibold ${t.muted}`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
