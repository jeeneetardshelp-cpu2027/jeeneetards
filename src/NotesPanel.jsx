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
  // The lesson a half-written note belongs to. The course auto-advances a few
  // seconds after a video ends, so the lesson can change under a student who is
  // still typing. Before this, the draft simply followed them forward and the
  // next "Add note" filed it against a lesson they were not writing about.
  // Clearing the box instead would be the other kind of wrong — it throws away
  // what they wrote. So the draft stays put and remembers where it came from.
  const [anchor, setAnchor] = useState(null);
  // A save or delete the device refused. Empty when there is nothing to say.
  const [failure, setFailure] = useState("");

  const refresh = useCallback(() => {
    setNotes(getNotes(pid, videoId));
  }, [pid, videoId]);

  useEffect(() => { refresh(); }, [refresh]);

  // A missing identity means there is no lesson to attach notes to — render
  // nothing rather than an orphaned, un-saveable panel.
  if (!Number.isInteger(pid) || pid <= 0 || !videoId) return null;

  // The first character typed claims the lesson on screen; emptying the box
  // releases it, so an abandoned draft does not pin a stale lesson forever.
  const onChangeText = (value) => {
    setText(value);
    setFailure("");
    setAnchor((prev) => (value.trim() ? prev ?? { pid, videoId } : null));
  };

  const target = anchor ?? { pid, videoId };
  const movedOn = target.pid !== pid || target.videoId !== videoId;

  const submit = (event) => {
    event?.preventDefault?.();
    const clean = text.trim();
    if (!clean) return;
    // Capture the playback second at the moment of saving. Exact when the
    // student paused to write (the common case); at most a few seconds stale
    // while the video plays. null when the player has not started yet.
    //
    // Only when the note is still being filed against the lesson on screen:
    // once the course has moved on, getCurrentTime() reports the NEW lesson's
    // position, and stamping that on the note would send the student to a
    // second that means nothing. Untimed is honest; a wrong timestamp is not.
    const raw = !movedOn && typeof getCurrentTime === "function" ? getCurrentTime() : null;
    const t = Number.isFinite(raw) && raw >= 0 ? raw : null;
    if (addNote({ playlistId: target.pid, videoId: target.videoId, text: clean, t })) {
      setText("");
      setAnchor(null);
      setFailure("");
      refresh();
    } else {
      // Keep the text. It is the only copy.
      setFailure("Couldn't save. Your browser is out of space or is blocking storage — your note is still here, so you can copy it somewhere safe.");
    }
  };

  const remove = (id) => {
    deleteNote({ playlistId: pid, videoId, id });
    // Check what the device actually holds rather than trusting the return
    // value: if the note is still there, the delete did not stick and saying
    // otherwise would be a lie.
    const remaining = getNotes(pid, videoId);
    setNotes(remaining);
    setFailure(
      remaining.some((note) => note.id === id)
        ? "Couldn't delete that note. Your browser is blocking storage, so it is still saved on this device."
        : "",
    );
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
          onChange={(event) => onChangeText(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Jot a formula, a doubt, or the minute it finally clicks…"
          className="w-full resize-y rounded-lg border border-hairline bg-surface p-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        {movedOn && canSave && (
          <p role="status" className="mt-2 text-xs text-ink-3">
            The lesson moved on while you were writing. This note will be saved to
            the lesson you started it on.
          </p>
        )}
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Add note
          </button>
        </div>
      </form>

      {failure && (
        <p role="alert" className="mt-2 text-sm text-danger">{failure}</p>
      )}

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
