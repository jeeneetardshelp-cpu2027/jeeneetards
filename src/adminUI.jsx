// adminUI.jsx — the small themed form pieces shared by every admin form.
// Kept in its own file so AdminPanel.jsx and ImportPlaylistForm.jsx can both
// use them without importing each other in a circle.

import { useState } from "react";
import { useTheme } from "./theme.jsx";
import { CONTENT_TYPES, LANGUAGES, DIFFICULTIES } from "./metadata.js";

export const ACCENT = { teal: "#13919B", navy: "#142A4F", red: "#dc2626" };

export function Labeled({ label, hint, children }) {
  const { t } = useTheme();
  return (
    <label className="block">
      <span className={`block text-xs font-medium ${t.muted}`}>{label}</span>
      {children}
      {hint && <span className={`mt-1 block text-xs ${t.faint}`}>{hint}</span>}
    </label>
  );
}

export function Input(props) {
  const { t } = useTheme();
  return (
    <input
      {...props}
      className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none`}
    />
  );
}

export function Select({ options, placeholder, ...props }) {
  const { t } = useTheme();
  return (
    <select
      {...props}
      className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none`}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

export function SubmitButton({ busy, children, label = "Save" }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      style={{ backgroundColor: ACCENT.teal }}
    >
      {busy ? "Saving…" : children ?? label}
    </button>
  );
}

// One card per form, with its own success/error line underneath.
export function FormCard({
  title,
  description,
  onSubmit,
  busy,
  status,
  submitLabel = "Save",
  children,
}) {
  const { t } = useTheme();
  return (
    <form
      onSubmit={onSubmit}
      className={`rounded-2xl border ${t.card} ${t.border} p-6`}
    >
      <h2 className={`text-base font-semibold ${t.text}`}>{title}</h2>
      {description && <p className={`mt-1 text-sm ${t.muted}`}>{description}</p>}

      <div className="mt-5 space-y-4">{children}</div>

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton busy={busy}>{submitLabel}</SubmitButton>
        {status && (
          <span
            className="text-sm"
            style={{ color: status.ok ? ACCENT.teal : ACCENT.red }}
          >
            {status.message}
          </span>
        )}
      </div>
    </form>
  );
}

// Shared submit plumbing: busy flag + status line, and a reload afterwards.
export function useSubmit(reload) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const run = async (fn, successMessage) => {
    setBusy(true);
    setStatus(null);
    try {
      // fn may return its own message, e.g. "12 added, 3 skipped".
      const result = await fn();
      setStatus({ ok: true, message: result ?? successMessage });
      if (reload) await reload();
      return true;
    } catch (err) {
      setStatus({ ok: false, message: err?.message ?? "Something went wrong." });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, status, run };
}

// The classes a course can be tagged for, re-exported from the shared
// source of truth so existing imports from adminUI keep working.
export { CLASS_LEVELS } from "./classLevels.js";
import { CLASS_LEVELS } from "./classLevels.js";

// NOTE: syncPlaylistClassLevels() used to live here. It was removed in v3.
// It ran AFTER the playlist insert, in a separate request, and swallowed its
// own errors — so a course could be saved with no class levels at all and the
// admin would see "Saved". Class levels are now written inside the
// create_course / import_playlist database transaction, and label→slug
// translation happens in SQL. There is deliberately no client-side path that
// writes playlist_class_levels or playlists.class_levels any more.

// A checkbox group for class levels. `value` is an array like ["11th"].
export function ClassLevelPicker({ value, onChange, label = "Class levels" }) {
  const { t } = useTheme();
  const toggle = (level) =>
    onChange(
      value.includes(level)
        ? value.filter((v) => v !== level)
        : [...value, level]
    );

  return (
    <div>
      <span className={`block text-xs font-medium ${t.muted}`}>{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {CLASS_LEVELS.map((level) => {
          const on = value.includes(level);
          return (
            <button
              key={level}
              type="button"
              onClick={() => toggle(level)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                on ? "text-white" : `${t.muted} ${t.hover}`
              }`}
              style={{
                borderColor: ACCENT.teal,
                backgroundColor: on ? ACCENT.teal : "transparent",
              }}
            >
              {level}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A labelled <select> over {value,label} option lists (metadata vocab).
function VocabSelect({ label, options, value, onChange }) {
  const { t } = useTheme();
  return (
    <Labeled label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none`}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labeled>
  );
}

// The three human-set course facets: content type, language, difficulty.
// Auto-filled facets (duration, captions, embeddable) come from the YouTube
// API, not this form. Controlled via a single {contentType,language,difficulty}
// value object + onChange(patch).
export function CourseMetaFields({ value, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <VocabSelect
        label="Content type"
        options={CONTENT_TYPES}
        value={value.contentType}
        onChange={(v) => onChange({ contentType: v })}
      />
      <VocabSelect
        label="Language"
        options={LANGUAGES}
        value={value.language}
        onChange={(v) => onChange({ language: v })}
      />
      <VocabSelect
        label="Difficulty"
        options={DIFFICULTIES}
        value={value.difficulty}
        onChange={(v) => onChange({ difficulty: v })}
      />
    </div>
  );
}

// Legacy helper retained for older callers. New course creation must request
// an explicitly reviewed student-facing title instead of synthesizing one
// from teacher/taxonomy fragments.
export function buildCourseTitle({ teacher, subject, chapter }) {
  const parts = [teacher, subject, chapter].map((s) => (s ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "Course";
}

// "Laws of Motion" -> "laws-of-motion"   (chapters.slug is NOT NULL)
export function slugify(name) {
  return (name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Sentinel the chapter dropdown uses for its "＋ Create new chapter" row.
// It can't collide with a real chapter id (those are numbers).
export const NEW_CHAPTER = "__new__";

// A subject-aware chapter picker with a built-in "create new" mode.
// Controlled by two values: `value` (a chapter id, "", or NEW_CHAPTER) and
// `newName` (the typed name, only meaningful while value === NEW_CHAPTER).
export function ChapterField({
  chapters,
  subjectId,
  value,
  onChange,
  newName,
  onNewName,
  label = "Chapter (optional)",
}) {
  const { t } = useTheme();

  const options = chapters.filter((c) => String(c.subject_id) === subjectId);
  const creating = value === NEW_CHAPTER;

  return (
    <div>
      <Labeled
        label={label}
        hint={
          !subjectId
            ? null
            : creating
            ? newName
              ? `Will create "${newName.trim()}" if it doesn't exist yet.`
              : "Type the new chapter name below."
            : options.length === 0
            ? "No chapters in this subject yet — choose “Create new chapter”."
            : null
        }
      >
        <select
          value={value}
          disabled={!subjectId}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none`}
        >
          <option value="">{subjectId ? "Choose…" : "Pick a subject first"}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value={NEW_CHAPTER}>＋ Create new chapter…</option>
        </select>
      </Labeled>

      {creating && (
        <div className="mt-2">
          <Input
            value={newName}
            onChange={(e) => onNewName(e.target.value)}
            placeholder="New chapter name, e.g. Laws of Motion"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// Resolves the ChapterField's state into a real chapter id for saving.
//   ""          -> null (no chapter)
//   a number    -> that existing chapter id
//   NEW_CHAPTER -> find-or-create a chapter in this subject, return its id
// Creating needs a subject, and dedupes on (subject_id, name) so the same
// name typed twice reuses the first chapter instead of erroring.
export async function resolveChapterId(supabase, { value, newName, subjectId }) {
  if (value === NEW_CHAPTER) {
    const name = (newName ?? "").trim();
    if (!name) throw new Error("Type a name for the new chapter.");
    if (!subjectId) throw new Error("Pick a subject before creating a chapter.");

    const { data: existing, error: findError } = await supabase
      .from("chapters")
      .select("id")
      .eq("subject_id", Number(subjectId))
      .eq("name", name)
      .maybeSingle();
    throwIfError(findError);
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("chapters")
      .insert({ name, slug: slugify(name), subject_id: Number(subjectId) })
      .select("id")
      .single();
    throwIfError(error);
    return data.id;
  }

  return value ? Number(value) : null;
}

// Turns a Supabase { error } response into a thrown Error, with friendlier
// wording for the two mistakes most likely to happen here.
export function throwIfError(error) {
  if (!error) return;
  if (error.code === "42501") {
    throw new Error(
      "Blocked by row-level security — is this account's profile is_admin = true?"
    );
  }
  if (error.code === "23505") {
    throw new Error("That already exists in the database.");
  }
  throw new Error(error.message);
}
