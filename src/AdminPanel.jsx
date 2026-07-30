// =====================================================================
//  AdminPanel.jsx  —  private content entry at /admin
//
//  Signing in is what unlocks writing. The anon key alone cannot insert
//  anything (row-level security blocks it); the database only accepts
//  rows from a signed-in user whose profile has is_admin = true.
//  See admin_policies.sql.
//
//  Four forms: Channel, Chapter, Video, Course.
// =====================================================================

import { useState, useEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { useAdminData } from "./useAdminData";
import { useReports } from "./useReports.js";
import { useReviewModeration } from "./useReviewModeration.js";
import { useTheme } from "./theme.jsx";
import {
  ACCENT, Labeled, Input, Select, SubmitButton, FormCard, useSubmit,
  throwIfError, ChapterField, resolveChapterId, ClassLevelPicker,
  CourseMetaFields,
} from "./adminUI.jsx";
import ImportPlaylistForm from "./ImportPlaylistForm.jsx";
import TeacherPicker from "./TeacherPicker.jsx";
import EditorialTitleField from "./EditorialTitleField.jsx";
import { titleCanBeApproved } from "./titleQuality.js";
import { courseImportRpc, withFacultySelection } from "./facultyImport.js";
import FacultyReviewPanel from "./FacultyReviewPanel.jsx";
import ContentQualityPanel from "./ContentQualityPanel.jsx";
import { hasAdminAccess } from "./adminAccess.js";
import ManageCatalogPanel from "./ManageCatalogPanel.jsx";

// ---------------------------------------------------------------------
//  Small helpers
// ---------------------------------------------------------------------

// Accepts a full YouTube url, a share link, or a bare id — and ignores
// trailing junk like "&t=1501s". Returns "" if no 11-char id is found.
export function extractVideoId(input) {
  const s = (input ?? "").trim();
  if (!s) return "";
  const fromUrl = s.match(
    /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/
  );
  if (fromUrl) return fromUrl[1];
  const bare = s.match(/^([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
  return bare ? bare[1] : "";
}

// "Laws of Motion" -> "laws-of-motion"   (chapters.slug is NOT NULL)
export function slugify(name) {
  return (name ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// YouTube's oEmbed endpoint is free and needs no API key.
async function fetchYouTubeTitle(videoId) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`
  )}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Video not found on YouTube (or it's private).");
  const json = await res.json();
  return { title: json.title, author: json.author_name };
}

// ---------------------------------------------------------------------
//  1. ADD CHANNEL
// ---------------------------------------------------------------------
function AddChannelForm({ reload }) {
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const { busy, status, run } = useSubmit(reload);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const { error } = await supabase.from("institutes_channels").insert({
        name: name.trim(),
        youtube_channel_id: channelId.trim(),
      });
      throwIfError(error);
    }, `Added channel "${name.trim()}".`);
    if (ok) {
      setName("");
      setChannelId("");
    }
  };

  return (
    <FormCard
      title="Add a channel"
      description="The institute or teacher a video belongs to."
      onSubmit={submit}
      busy={busy}
      status={status}
    >
      <Labeled label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Competishun"
          required
        />
      </Labeled>
      <Labeled
        label="YouTube channel ID"
        hint="From the channel URL, e.g. UCxxxxxxxxxxxxxxxxxxxxxx"
      >
        <Input
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="UC..."
          required
        />
      </Labeled>
    </FormCard>
  );
}

// ---------------------------------------------------------------------
//  2. ADD CHAPTER
// ---------------------------------------------------------------------
function AddChapterForm({ subjects, reload }) {
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const { busy, status, run } = useSubmit(reload);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      const { error } = await supabase.from("chapters").insert({
        name: name.trim(),
        slug: slugify(name),
        subject_id: Number(subjectId),
      });
      throwIfError(error);
    }, `Added chapter "${name.trim()}".`);
    if (ok) setName("");
  };

  return (
    <FormCard
      title="Add a chapter"
      description="Chapters live inside a subject, e.g. Physics › Kinematics."
      onSubmit={submit}
      busy={busy}
      status={status}
    >
      <Labeled label="Chapter name" hint={name ? `Slug: ${slugify(name)}` : null}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Laws of Motion"
          required
        />
      </Labeled>
      <Labeled label="Subject">
        <Select
          options={subjects}
          placeholder="Choose a subject…"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          required
        />
      </Labeled>
    </FormCard>
  );
}

// ---------------------------------------------------------------------
//  3. ADD VIDEO  — title arrives automatically from YouTube
// ---------------------------------------------------------------------
function AddVideoForm({ channels, categories, subjects, chapters, reload }) {
  const [raw, setRaw] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [lookup, setLookup] = useState(null); // 'loading' | 'done' | error text
  const [channelId, setChannelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const { busy, status, run } = useSubmit(reload);

  const videoId = extractVideoId(raw);

  // Fetch the title as soon as a valid 11-character id appears.
  useEffect(() => {
    if (!videoId) {
      setTitle("");
      setAuthor("");
      setLookup(null);
      return;
    }
    let active = true;
    setLookup("loading");
    fetchYouTubeTitle(videoId)
      .then(({ title, author }) => {
        if (!active) return;
        setTitle(title);
        setAuthor(author);
        setLookup("done");
      })
      .catch((err) => {
        if (!active) return;
        setLookup(err.message);
      });
    return () => {
      active = false;
    };
  }, [videoId]);

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (!videoId) throw new Error("That doesn't contain a YouTube video ID.");
      // Resolve the chapter first, creating it if "Create new chapter" was
      // chosen, so the video links to a real chapter id.
      const resolvedChapterId = await resolveChapterId(supabase, {
        value: chapterId,
        newName: newChapterName,
        subjectId,
      });
      const { error } = await supabase.from("videos").insert({
        youtube_video_id: videoId,
        title: title.trim(),
        channel_id: Number(channelId),
        category_id: Number(categoryId),
        subject_id: Number(subjectId),
        chapter_id: resolvedChapterId,
      });
      throwIfError(error);
    }, `Added "${title.trim()}".`);
    if (ok) {
      setRaw("");
      setTitle("");
      setAuthor("");
      setChapterId("");
      setNewChapterName("");
    }
  };

  const { t } = useTheme();

  return (
    <FormCard
      title="Add a video"
      description="Paste a YouTube link or ID — the title is fetched for you."
      onSubmit={submit}
      busy={busy}
      status={status}
    >
      <Labeled
        label="YouTube link or ID"
        hint={
          videoId
            ? `Detected ID: ${videoId}`
            : raw
            ? "No 11-character video ID found yet."
            : "Extra bits like &t=1501s are ignored automatically."
        }
      >
        <Input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          required
        />
      </Labeled>

      {videoId && (
        <div className="flex items-start gap-3">
          <img
            src={`https://img.youtube.com/vi/${videoId}/default.jpg`}
            alt=""
            className="h-12 w-20 shrink-0 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            {lookup === "loading" && (
              <p className={`text-xs ${t.faint}`}>Fetching title from YouTube…</p>
            )}
            {lookup && lookup !== "loading" && lookup !== "done" && (
              <p className="text-xs" style={{ color: "#dc2626" }}>
                {lookup}
              </p>
            )}
            {author && <p className={`text-xs ${t.faint}`}>YouTube channel: {author}</p>}
          </div>
        </div>
      )}

      <Labeled label="Title" hint="Fetched automatically — edit if you like.">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title appears here once the ID is valid"
          required
        />
      </Labeled>

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Channel">
          <Select
            options={channels}
            placeholder="Choose…"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            required
          />
        </Labeled>
        <Labeled label="Category">
          <Select
            options={categories}
            placeholder="Choose…"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          />
        </Labeled>
        <Labeled label="Subject">
          <Select
            options={subjects}
            placeholder="Choose…"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setChapterId(""); // chapters depend on the subject
              setNewChapterName("");
            }}
            required
          />
        </Labeled>
        <ChapterField
          chapters={chapters}
          subjectId={subjectId}
          value={chapterId}
          onChange={setChapterId}
          newName={newChapterName}
          onNewName={setNewChapterName}
        />
      </div>
    </FormCard>
  );
}

// ---------------------------------------------------------------------
//  4. ADD COURSE / PLAYLIST  — pick videos, order = click order
// ---------------------------------------------------------------------
function AddCourseForm({ channels, categories, subjects, videos,
                        learningGoals = [], boards = [], reload }) {
  const [title, setTitle] = useState("");
  const [titleReviewed, setTitleReviewed] = useState(false);
  const [teacher, setTeacher] = useState("");
  const [facultyList, setFacultyList] = useState([]);
  const [facultySupported, setFacultySupported] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [learningGoalId, setLearningGoalId] = useState("");
  const [boardIds, setBoardIds] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [classLevels, setClassLevels] = useState([]);
  const [courseMeta, setCourseMeta] = useState({
    contentType: "", language: "", difficulty: "",
  });
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState([]); // video ids, in lesson order
  const { busy, status, run } = useSubmit(reload);
  const { t } = useTheme();
  const goalSlug = learningGoals.find((g) => String(g.id) === learningGoalId)?.slug;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? videos.filter((v) => v.title.toLowerCase().includes(q))
      : videos;
    return list.slice(0, 25);
  }, [videos, search]);

  const toggle = (id) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const submit = async (e) => {
    e.preventDefault();
    const ok = await run(async () => {
      if (picked.length === 0)
        throw new Error("Pick at least one video for the course.");
      if (!titleCanBeApproved(title))
        throw new Error("Give the course a concise student-facing title.");
      if (!titleReviewed)
        throw new Error("Review and confirm the student-facing title.");
      if (!learningGoalId) throw new Error("Pick a learning goal.");
      if (classLevels.length === 0)
        throw new Error("Pick at least one class level.");

      // ONE call, ONE database transaction. The course, its class levels and
      // its lessons are written together or not at all. We never write
      // playlists.class_levels ourselves — the junction is the source of
      // truth and the database derives the array from it.
      const payload = withFacultySelection({
          title: title.trim(),
          teacher: teacher.trim() || null,
          channel_id: Number(channelId),
          category_id: categoryId ? Number(categoryId) : null,
          learning_goal_id: Number(learningGoalId), // explicit, never derived
          board_ids: boardIds.map(Number),
          subject_id: subjectId ? Number(subjectId) : null,
          class_labels: classLevels,
          content_type: courseMeta.contentType || null,
          language: courseMeta.language || null,
          difficulty: courseMeta.difficulty || null,
          video_ids: picked,
        }, {
          capability: facultySupported,
          // This is a new course: including ids is useful only when at least
          // one explicit registry record was chosen. No selection keeps the
          // legacy text without asserting an identity.
          replace: facultySupported && facultyList.length > 0,
          selected: facultyList,
        });
      const { error } = await supabase.rpc(courseImportRpc(payload), {
        payload,
      });
      throwIfError(error);
    }, `Added course with ${picked.length} lesson(s) for ${classLevels.join(", ")}.`);

    if (ok) {
      setTitle("");
      setTitleReviewed(false);
      setTeacher("");
      setFacultyList([]);
      setClassLevels([]);
      setBoardIds([]);
      setCourseMeta({ contentType: "", language: "", difficulty: "" });
      setPicked([]);
      setSearch("");
    }
  };

  return (
    <FormCard
      title="Add a course"
      description="A course groups existing videos into an ordered lesson list."
      onSubmit={submit}
      busy={busy}
      status={status}
    >
      <EditorialTitleField
        value={title}
        onChange={setTitle}
        reviewed={titleReviewed}
        onReviewedChange={setTitleReviewed}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Teacher">
          <Input
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            placeholder="ABJ Sir"
          />
        </Labeled>
        <Labeled label="Channel">
          <Select
            options={channels}
            placeholder="Choose…"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            required
          />
        </Labeled>
        <Labeled label="Category">
          <Select
            options={categories}
            placeholder="Choose…"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          />
        </Labeled>
        <Labeled label="Learning goal">
          <Select
            options={learningGoals}
            placeholder="Choose…"
            value={learningGoalId}
            onChange={(e) => { setLearningGoalId(e.target.value); setBoardIds([]); }}
            required
          />
        </Labeled>
        <Labeled label="Subject">
          <Select
            options={subjects}
            placeholder="Choose…"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          />
        </Labeled>
      </div>

      {goalSlug === "school" ? (
        <Labeled label="Board(s)">
          <div className="flex flex-wrap gap-3">
            {boards.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={boardIds.includes(String(b.id))}
                  onChange={() =>
                    setBoardIds((prev) =>
                      prev.includes(String(b.id))
                        ? prev.filter((x) => x !== String(b.id))
                        : [...prev, String(b.id)]
                    )
                  }
                />
                {b.name}
              </label>
            ))}
          </div>
        </Labeled>
      ) : null}

      <ClassLevelPicker
        value={classLevels}
        onChange={setClassLevels}
        label="Class levels (pick at least one)"
      />

      <TeacherPicker
        value={facultyList}
        onChange={setFacultyList}
        label="Faculty registry (optional)"
        onCapabilityChange={setFacultySupported}
      />

      <CourseMetaFields
        value={courseMeta}
        onChange={(patch) => setCourseMeta((m) => ({ ...m, ...patch }))}
      />

      <div>
        <span className={`block text-xs font-medium ${t.muted}`}>
          Lessons {picked.length > 0 && `(${picked.length} chosen, in order)`}
        </span>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search existing videos…"
        />

        {picked.length > 0 && (
          <ol className="mt-3 space-y-1">
            {picked.map((id, i) => {
              const v = videos.find((x) => x.id === id);
              return (
                <li key={id} className={`flex items-center gap-2 text-sm ${t.text}`}>
                  <span className="text-xs" style={{ color: ACCENT.teal }}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{v?.title}</span>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={`text-xs ${t.faint} hover:underline`}
                  >
                    remove
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        <div className={`mt-3 max-h-56 overflow-y-auto rounded-lg border ${t.border}`}>
          {matches.length === 0 ? (
            <p className={`p-3 text-sm ${t.faint}`}>No videos match.</p>
          ) : (
            matches.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${t.hover} ${
                  picked.includes(v.id) ? t.text : t.muted
                }`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-sm border"
                  style={{
                    borderColor: ACCENT.teal,
                    backgroundColor: picked.includes(v.id)
                      ? ACCENT.teal
                      : "transparent",
                  }}
                />
                <span className="min-w-0 flex-1 truncate">{v.title}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </FormCard>
  );
}

// ---------------------------------------------------------------------
//  REPORTS  — moderation queue of flagged content.
// ---------------------------------------------------------------------
const REASON_LABELS = {
  broken: "Video won't play",
  "wrong-category": "Wrong subject / chapter",
  inappropriate: "Inappropriate content",
  other: "Something else",
};

function ReportsPanel() {
  const { t } = useTheme();
  const { reports, loading, error, setStatus } = useReports();
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const resolve = async (id, status) => {
    setBusyId(id);
    setActionError(null);
    const err = await setStatus(id, status);
    setBusyId(null);
    if (err) setActionError(err.message);
  };

  if (loading) return <p className={`text-sm ${t.muted}`}>Loading reports…</p>;
  if (error)
    return (
      <p className="text-sm" style={{ color: ACCENT.red }}>
        Couldn't load reports: {error}
      </p>
    );
  if (reports.length === 0)
    return (
      <div className={`rounded-2xl border border-dashed ${t.border} p-12 text-center`}>
        <p className={`text-sm font-semibold ${t.text}`}>No open reports</p>
        <p className={`mt-1 text-sm ${t.muted}`}>Flagged content will appear here.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {actionError && (
        <p className="text-sm" style={{ color: ACCENT.red }}>
          Couldn't update that report: {actionError}
        </p>
      )}
      {reports.map((r) => (
        <div key={r.id} className={`rounded-2xl border ${t.card} ${t.border} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${t.text}`}>
                {REASON_LABELS[r.reason] ?? r.reason}
              </p>
              <p className={`mt-0.5 truncate text-sm ${t.muted}`}>
                {r.target_type}: {r.title}
              </p>
              {r.note && (
                <p className={`mt-2 text-sm ${t.muted}`}>“{r.note}”</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => resolve(r.id, "reviewed")}
                disabled={busyId === r.id}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT.teal }}
              >
                {busyId === r.id ? "…" : "Reviewed"}
              </button>
              <button
                onClick={() => resolve(r.id, "dismissed")}
                disabled={busyId === r.id}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${t.border} ${t.muted} ${t.hover} disabled:opacity-50`}
              >
                {busyId === r.id ? "…" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
//  REVIEWS  —  every written review, hide/un-hide. No public display
//  surface exists yet for review text, so this is proactive moderation
//  (spot-checking) rather than a response to student reports.
// ---------------------------------------------------------------------
function ReviewModerationPanel() {
  const { t } = useTheme();
  const { reviews, loading, error, setHidden } = useReviewModeration();
  const [busyId, setBusyId] = useState(null);

  const toggle = async (review) => {
    setBusyId(review.id);
    await setHidden(review.id, !review.review_hidden);
    setBusyId(null);
  };

  if (loading) return <p className={`text-sm ${t.muted}`}>Loading reviews…</p>;
  if (error)
    return (
      <p className="text-sm" style={{ color: ACCENT.red }}>
        Couldn't load reviews: {error}
      </p>
    );
  if (reviews.length === 0)
    return (
      <div className={`rounded-2xl border border-dashed ${t.border} p-12 text-center`}>
        <p className={`text-sm font-semibold ${t.text}`}>No written reviews yet</p>
        <p className={`mt-1 text-sm ${t.muted}`}>Reviews with text will appear here.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className={`rounded-2xl border ${t.card} ${t.border} p-5 ${r.review_hidden ? "opacity-60" : ""}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${t.text}`}>
                {r.playlist_title} · {r.rating}/5
                {r.review_hidden && (
                  <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: ACCENT.red, color: "white" }}>
                    Hidden
                  </span>
                )}
              </p>
              <p className={`mt-2 text-sm ${t.muted}`}>“{r.review}”</p>
            </div>
            <button
              onClick={() => toggle(r)}
              disabled={busyId === r.id}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium ${t.border} ${t.muted} ${t.hover} disabled:opacity-50`}
            >
              {busyId === r.id ? "…" : r.review_hidden ? "Un-hide" : "Hide"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
//  SIGN IN
// ---------------------------------------------------------------------
function SignIn() {
  const { t } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  };

  return (
    <div className={`flex min-h-screen items-center justify-center ${t.page} p-6`}>
      <form
        onSubmit={submit}
        className={`w-full max-w-sm rounded-2xl border ${t.card} ${t.border} p-6`}
      >
        <h1 className={`text-lg font-semibold ${t.text}`}>Admin sign in</h1>
        <p className={`mt-1 text-sm ${t.muted}`}>
          Only an account marked <code>is_admin</code> can add content.
        </p>

        <div className="mt-5 space-y-4">
          <Labeled label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Labeled>
          <Labeled label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Labeled>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <SubmitButton busy={busy}>Sign in</SubmitButton>
          {error && (
            <span className="text-sm" style={{ color: "#dc2626" }}>
              {error}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------
//  THE PANEL
// ---------------------------------------------------------------------
export default function AdminPanel() {
  const { t } = useTheme();
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [access, setAccess] = useState("signed-out");
  const [accessError, setAccessError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setChecking(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAccess("signed-out");
      setAccessError(null);
      return;
    }
    let active = true;
    setAccess("checking");
    setAccessError(null);
    supabase
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setAccess("error");
          setAccessError("Could not verify administrator access.");
        } else {
          setAccess(hasAdminAccess({ is_admin: data }) ? "allowed" : "denied");
        }
      });
    return () => { active = false; };
  }, [session]);

  // Do not even load the admin form datasets until the profile check passes.
  // Database RLS/RPC checks remain the authoritative security boundary.
  const admin = useAdminData(access === "allowed");
  const [tab, setTab] = useState("import");

  if (!isSupabaseConfigured) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${t.page}`}>
        <p className={`text-sm ${t.text}`}>
          Supabase isn't configured. Add your keys to .env and restart.
        </p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className={`flex min-h-screen items-center justify-center ${t.page}`}>
        <p className={`text-sm ${t.muted}`}>Checking sign-in…</p>
      </div>
    );
  }

  if (!session) return <SignIn />;

  // When getSession first resolves there is one render before the profile
  // request starts. Treat that transitional signed-out value as checking so
  // admin forms never flash for an unverified account.
  if (access === "checking" || access === "signed-out") {
    return (
      <div className={`flex min-h-screen items-center justify-center ${t.page}`}>
        <p className={`text-sm ${t.muted}`}>Checking administrator access…</p>
      </div>
    );
  }

  if (access === "denied" || access === "error") {
    return (
      <main className={`flex min-h-screen items-center justify-center ${t.page} p-6`}>
        <div className={`w-full max-w-md rounded-2xl border ${t.card} ${t.border} p-6`}>
          <h1 className={`text-lg font-semibold ${t.text}`}>
            {access === "denied" ? "Administrator access required" : "Access check failed"}
          </h1>
          <p className={`mt-2 text-sm ${t.muted}`}>
            {accessError ?? "This signed-in account is not marked as an administrator."}
          </p>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="mt-5 min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: ACCENT.teal }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  const TABS = [
    { id: "import", label: "Import Playlist" },
    { id: "manual", label: "Add Manually" },
    { id: "manage", label: "Manage" },
    { id: "quality", label: "Content Quality" },
    { id: "faculty", label: "Faculty Review" },
    { id: "reports", label: "Reports" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <div className={`min-h-screen ${t.page}`}>
      <header
        className={`flex items-center justify-between border-b ${t.divider} px-6 py-4`}
      >
        <div>
          <span className={`text-sm font-semibold ${t.text}`}>Admin</span>
          <span className={`ml-2 text-xs ${t.faint}`}>{session.user.email}</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className={`text-sm ${t.muted} hover:underline`}>
            View site
          </a>
          <button
            onClick={() => supabase.auth.signOut()}
            className={`text-sm ${t.muted} hover:underline`}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className={`mx-auto px-6 py-8 ${
        tab === "manage" ? "max-w-6xl" : "max-w-3xl"
      }`}>
        {/* Tabs */}
        <div className={`scrollbar-none mb-6 flex gap-5 overflow-x-auto border-b ${t.divider}`}>
          {TABS.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`min-h-11 shrink-0 border-b-2 px-1 text-sm font-medium transition ${
                  active ? t.text : `${t.faint} border-transparent`
                }`}
                style={active ? { borderColor: ACCENT.teal } : undefined}
              >
                {tb.label}
              </button>
            );
          })}
        </div>

        {admin.error && (
          <p className="mb-6 text-sm" style={{ color: ACCENT.red }}>
            {admin.error}
          </p>
        )}

        {tab === "reports" ? (
          <ReportsPanel />
        ) : tab === "reviews" ? (
          <ReviewModerationPanel />
        ) : tab === "quality" ? (
          <ContentQualityPanel />
        ) : tab === "faculty" ? (
          <FacultyReviewPanel />
        ) : tab === "manage" ? (
          <ManageCatalogPanel
            channels={admin.channels}
            learningGoals={admin.learningGoals}
            classLevelRows={admin.classLevelRows}
            chapters={admin.chapters}
          />
        ) : tab === "import" ? (
          <ImportPlaylistForm
            channels={admin.channels}
            categories={admin.categories}
            subjects={admin.subjects}
            chapters={admin.chapters}
            classLevelRows={admin.classLevelRows}
            learningGoals={admin.learningGoals}
            boards={admin.boards}
            reload={admin.reload}
          />
        ) : (
          <div className="space-y-6">
            <AddVideoForm
              channels={admin.channels}
              categories={admin.categories}
              subjects={admin.subjects}
              chapters={admin.chapters}
              reload={admin.reload}
            />
            <AddCourseForm
              channels={admin.channels}
              categories={admin.categories}
              subjects={admin.subjects}
              videos={admin.videos}
              learningGoals={admin.learningGoals}
              boards={admin.boards}
              reload={admin.reload}
            />
            <AddChapterForm subjects={admin.subjects} reload={admin.reload} />
            <AddChannelForm reload={admin.reload} />
          </div>
        )}
      </main>
    </div>
  );
}
