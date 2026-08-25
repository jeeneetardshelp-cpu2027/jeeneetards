// NotesPanel — the student's own notes for one lesson, saved on the device.
//
// This is the first surface on the watch page that lets a student STUDY, not
// just watch: write a note, and it stays attached to this lesson (and, when the
// player was running, to the second it was taken at, so the timestamp jumps the
// video back there). Notes live in localStorage (see notes.js) — device-local,
// no account needed — which is exactly why the panel says so plainly.

import { useCallback, useEffect, useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { addNote, deleteNote, getNotes } from "./notes.js";

// "12:34" or "1:02:07". Exported so its edge cases are unit-tested directly.
export function formatTimestamp(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const pad = (n) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export default function NotesPanel({
  playlistId, videoId, getCurrentTime = null, onSeek = null,
}) {
  const pid = Number(playlistId);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");

  const refresh = useCallback(() => {
    setNotes(getNotes(pid, videoId));
  }, [pid, videoId]);

  useEffect(() => { refresh(); }, [refresh]);

  // A missing identity means there is no lesson to attach notes to — render
  // nothing rather than an orphaned, un-saveable panel.
  if (!Number.isInteger(pid) || pid <= 0 || !videoId) return null;

  const submit = (event) => {
    event?.preventDefault?.();
    const clean = text.trim();
    if (!clean) return;
    // Capture the playback second at the moment of saving. Exact when the
    // student paused to write (the common case); at most a few seconds stale
    // while the video plays. null when the player has not started yet.
    const raw = typeof getCurrentTime === "function" ? getCurrentTime() : null;
    const t = Number.isFinite(raw) && raw >= 0 ? raw : null;
    if (addNote({ playlistId: pid, videoId, text: clean, t })) {
      setText("");
      refresh();
    }
  };

  const remove = (id) => {
    deleteNote({ playlistId: pid, videoId, id });
    refresh();
  };

  const onKeyDown = (event) => {
    // Cmd/Ctrl+Enter saves; a bare Enter keeps making a new line, because a
    // study note is often more than one line.
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit(event);
  };

  const canSave = text.trim().length > 0;

  return (
    <section
      aria-labelledby="lesson-notes-heading"
      className="mt-6 rounded-xl border border-hairline bg-surface-2 p-4 sm:p-5"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Study here</p>
        <h2 id="lesson-notes-heading" className="mt-1 text-lg font-semibold text-ink">My notes</h2>
        <p className="mt-1 text-xs text-ink-3">Saved on this device, private to you.</p>
      </div>

      <form onSubmit={submit} className="mt-4">
        <label htmlFor="lesson-note-input" className="sr-only">Add a note for this lesson</label>
        <textarea
          id="lesson-note-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Jot a formula, a doubt, or the minute it finally clicks…"
          className="w-full resize-y rounded-lg border border-hairline bg-surface p-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Add note
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="mt-4 rounded-lg border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink-2">
          No notes on this lesson yet. Whatever you write stays with the lesson, so
          you can pick up where your thinking left off.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start gap-2 rounded-lg border border-hairline bg-surface p-3"
            >
              {note.t != null && (
                onSeek ? (
                  <button
                    type="button"
                    onClick={() => onSeek(note.t)}
                    aria-label={`Jump to ${formatTimestamp(note.t)}`}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-accent hover:bg-surface-2"
                  >
                    <Clock aria-hidden="true" className="h-3 w-3" /> {formatTimestamp(note.t)}
                  </button>
                ) : (
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-xs font-semibold text-ink-3">
                    <Clock aria-hidden="true" className="h-3 w-3" /> {formatTimestamp(note.t)}
                  </span>
                )
              )}
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-ink">
                {note.text}
              </p>
              <button
                type="button"
                onClick={() => remove(note.id)}
                aria-label="Delete note"
                className="mt-0.5 inline-flex min-h-8 shrink-0 items-center rounded-md p-1 text-ink-3 transition hover:text-ink"
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
