import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, RefreshCw } from "lucide-react";
import EditorialTitleField from "./EditorialTitleField.jsx";
import TeacherPicker from "./TeacherPicker.jsx";
import { CONTENT_TYPES, DIFFICULTIES, LANGUAGES } from "./metadata.js";
import { titleCanBeApproved } from "./titleQuality.js";
import { reviewPlaylistQuality, useContentQualityQueue } from "./useContentQuality.js";
import { useTheme } from "./theme.jsx";

function QualitySelect({ label, value, onChange, options }) {
  const { t } = useTheme();
  return (
    <label className={`text-xs font-medium ${t.muted}`}>
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
      >
        <option value="">Choose…</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ReviewCard({ row, onSaved }) {
  const { t } = useTheme();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(row.display_title ?? "");
  const [titleReviewed, setTitleReviewed] = useState(row.title_review_status === "approved");
  const [faculty, setFaculty] = useState(row.faculty ?? []);
  const [facultyStatus, setFacultyStatus] = useState(row.faculty_credit_status ?? "pending");
  const [contentType, setContentType] = useState(row.content_type ?? "");
  const [language, setLanguage] = useState(row.language ?? "");
  const [difficulty, setDifficulty] = useState(row.difficulty ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const facultyValid = facultyStatus === "identified"
    ? faculty.length > 0
    : facultyStatus === "team"
      ? faculty.length === 0 && note.trim().length >= 3
      : facultyStatus === "unknown" && faculty.length === 0;
  const readyToSave = titleReviewed && titleCanBeApproved(title) && facultyValid
    && contentType && language && difficulty;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await reviewPlaylistQuality({
        p_playlist_id: row.playlist_id,
        p_display_title: title.trim(),
        p_teacher_ids: faculty.map((item) => item.teacher_id),
        p_faculty_status: facultyStatus,
        p_content_type: contentType,
        p_language: language,
        p_difficulty: difficulty,
        p_note: note.trim() || null,
      });
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`rounded-xl border ${t.border} ${t.card}`}>
      <button
        type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        className="flex min-h-16 w-full items-center justify-between gap-4 px-4 text-left"
      >
        <span className="min-w-0">
          <span className={`block truncate text-sm font-semibold ${t.text}`}>{row.display_title}</span>
          <span className={`block text-xs ${t.faint}`}>{row.institute}{row.subject ? ` · ${row.subject}` : ""}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {(row.missing_fields ?? []).map((field) => (
              <span key={field} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800">{field}</span>
            ))}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className={`space-y-5 border-t p-4 ${t.divider}`}>
          <EditorialTitleField
            sourceTitle={row.source_title ?? ""}
            value={title} onChange={setTitle}
            reviewed={titleReviewed} onReviewedChange={setTitleReviewed}
          />

          <fieldset className={`rounded-xl border p-4 ${t.border}`}>
            <legend className={`px-1 text-sm font-medium ${t.text}`}>Faculty credit</legend>
            <select
              aria-label="Faculty credit status"
              value={facultyStatus}
              onChange={(event) => {
                setFacultyStatus(event.target.value);
                if (event.target.value !== "identified") setFaculty([]);
              }}
              className={`min-h-11 w-full rounded-lg border px-3 text-sm ${t.border} ${t.input} ${t.text}`}
            >
              <option value="pending">Needs research</option>
              <option value="identified">Named faculty</option>
              <option value="team">Institute/team credit</option>
              <option value="unknown">Source does not identify faculty</option>
            </select>
            {facultyStatus === "identified" && (
              <div className="mt-3"><TeacherPicker value={faculty} onChange={setFaculty} label="Verified faculty records" /></div>
            )}
            {row.legacy_teacher && <p className={`mt-2 text-xs ${t.faint}`}>Legacy source text: {row.legacy_teacher}</p>}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <QualitySelect label="Course type" value={contentType} onChange={setContentType} options={CONTENT_TYPES} />
            <QualitySelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
            <QualitySelect label="Difficulty" value={difficulty} onChange={setDifficulty} options={DIFFICULTIES} />
          </div>

          <label className={`block text-xs font-medium ${t.muted}`}>
            Editorial note {facultyStatus === "team" ? "(required for team credit)" : "(optional)"}
            <textarea
              value={note} onChange={(event) => setNote(event.target.value)} rows={3}
              className={`mt-1 w-full rounded-lg border p-3 text-sm ${t.border} ${t.input} ${t.text}`}
              placeholder="Evidence or reason for this decision"
            />
          </label>

          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <button
            type="button" onClick={save} disabled={busy || !readyToSave}
            className="min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Approve reviewed metadata"}
          </button>
          {!readyToSave && (
            <p className={`text-xs ${t.faint}`}>Review the title, choose an honest faculty status, and complete all three decision fields.</p>
          )}
        </div>
      )}
    </article>
  );
}

export default function ContentQualityPanel() {
  const { t } = useTheme();
  const { rows, loading, error, unavailable, reload } = useContentQualityQueue(false);
  if (unavailable) {
    return (
      <div className={`rounded-xl border border-dashed p-6 ${t.border}`}>
        <p className={`font-medium ${t.text}`}>Content-quality review is not installed yet.</p>
        <p className={`mt-1 text-sm ${t.muted}`}>Apply v10 to disposable staging before enabling it on production.</p>
      </div>
    );
  }
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-base font-semibold ${t.text}`}>Content quality</h2>
          <p className={`mt-1 max-w-2xl text-sm ${t.muted}`}>Approve concise titles, explicit faculty credit and decision metadata. Source text is preserved.</p>
        </div>
        <button type="button" onClick={reload} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm ${t.border} ${t.hover}`}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>
      {error && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</p>}
      {loading ? (
        <div className="mt-5 space-y-3" aria-busy="true">{[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : !error && rows.length === 0 ? (
        <div className={`mt-5 rounded-xl border border-dashed p-8 text-center ${t.border}`}>
          <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-600" />
          <p className={`mt-2 text-sm font-medium ${t.text}`}>Every course passes the current quality rules.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">{rows.map((row) => <ReviewCard key={row.playlist_id} row={row} onSaved={reload} />)}</div>
      )}
    </section>
  );
}
