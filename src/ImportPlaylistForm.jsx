// =====================================================================
//  ImportPlaylistForm.jsx  —  paste a YouTube playlist, import every video
//
//  Flow: paste url -> Fetch -> preview the videos -> assign
//  category/subject/chapter to all of them -> Import All.
//
//  Videos already in the database are detected and skipped, so re-running
//  an import is safe and tells you what it skipped.
// =====================================================================

import { useState } from "react";
import { supabase } from "./supabaseClient";
import TeacherPicker from "./TeacherPicker.jsx";
import EditorialTitleField from "./EditorialTitleField.jsx";
import { titleCanBeApproved } from "./titleQuality.js";
import { playlistImportRpc, withFacultySelection, withSourceTitle } from "./facultyImport.js";
import { useContentQualityCapability } from "./useContentQuality.js";
import { useTheme } from "./theme.jsx";
import {
  ACCENT, Labeled, Input, Select, FormCard, useSubmit, throwIfError,
  ChapterField, resolveChapterId, ClassLevelPicker,
  CourseMetaFields,
} from "./adminUI.jsx";
import {
  extractPlaylistId, fetchPlaylistMeta, fetchAllPlaylistItems, hasYouTubeKey,
} from "./youtube.js";

export default function ImportPlaylistForm({
  channels, categories, subjects, chapters, classLevelRows,
  learningGoals = [], boards = [], reload,
}) {
  const { t } = useTheme();
  const qualityCapability = useContentQualityCapability();

  const [raw, setRaw] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [videos, setVideos] = useState([]);
  const [truncated, setTruncated] = useState(false);

  const [title, setTitle] = useState(""); // curated display title, editable
  const [titleReviewed, setTitleReviewed] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [learningGoalId, setLearningGoalId] = useState(""); // explicit, never derived
  const [boardIds, setBoardIds] = useState([]);             // School Boards only
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [newChapterName, setNewChapterName] = useState("");
  const [classLevels, setClassLevels] = useState([]);   // applicable classes
  const [audienceFocus, setAudienceFocus] = useState(""); // primary audience
  const [teacher, setTeacher] = useState("");
  const [facultyList, setFacultyList] = useState([]); // {teacher_id, display_name}
  const [facultySupported, setFacultySupported] = useState(false);
  const [replaceFaculty, setReplaceFaculty] = useState(false);
  const [courseMeta, setCourseMeta] = useState({
    contentType: "", language: "", difficulty: "",
  });

  const { busy, status, run } = useSubmit(reload);

  const playlistId = extractPlaylistId(raw);
  const goalSlug = learningGoals.find((g) => String(g.id) === learningGoalId)?.slug;

  const loadPlaylist = async () => {
    setFetching(true);
    setFetchError(null);
    setMeta(null);
    setVideos([]);
    setTruncated(false);
    try {
      const info = await fetchPlaylistMeta(playlistId);
      const { videos, truncated } = await fetchAllPlaylistItems(playlistId);
      if (videos.length === 0)
        throw new Error("That playlist has no public videos.");
      setMeta(info);
      setTitle(info.title); // default the display title to the YouTube title
      setTitleReviewed(false);
      setVideos(videos);
      setTruncated(truncated);
    } catch (err) {
      setFetchError(err.message);
    }
    setFetching(false);
  };

  const importAll = async (e) => {
    e.preventDefault();
    await run(async () => {
      if (videos.length === 0) throw new Error("Fetch a playlist first.");
      if (!title.trim()) throw new Error("Give the course a display title.");
      if (!titleCanBeApproved(title)) throw new Error("Fix the blocking display-title issue.");
      if (!titleReviewed) throw new Error("Review and confirm the student-facing title.");
      if (!learningGoalId) throw new Error("Pick a learning goal.");
      if (classLevels.length === 0)
        throw new Error("Pick at least one class level.");

      // Resolve/create the chapter first (reference data, find-or-create). The
      // content + taxonomy write below is the part that must be atomic.
      const resolvedChapterId = await resolveChapterId(supabase, {
        value: chapterId,
        newName: newChapterName,
        subjectId,
      });

      // ONE transactional call. The RPC (import_playlist) does channel, videos,
      // playlist, all four junction tables and the ordered links inside a single
      // Postgres transaction — a partial failure rolls the whole thing back, so
      // content can never land without its taxonomy relationships.
      const payload = withFacultySelection(withSourceTitle({
          channel_id: Number(channelId),
          category_id: Number(categoryId),
          // Explicit. The database no longer guesses the goal from the
          // category's name — that guess silently broke all school-board
          // content, which has no matching category.
          learning_goal_id: Number(learningGoalId),
          board_ids: boardIds.map(Number),
          subject_id: Number(subjectId),
          chapter_id: resolvedChapterId,
          class_labels: classLevels,
          audience_focus: audienceFocus || null,
          content_type: courseMeta.contentType || null,
          language: courseMeta.language || null,
          difficulty: courseMeta.difficulty || null,
          youtube_playlist_id: meta.id,
          title: title.trim(),
          teacher: teacher.trim() || null,   // legacy free text, still written, never deleted
          videos: videos.map((v) => ({
            youtube_video_id: v.videoId,
            title: v.title,
            duration_seconds: v.durationSeconds ?? null,
            caption_status: v.captionStatus ?? null,
            embedding_status: v.embeddingStatus ?? null,
          })),
        }, meta.title, qualityCapability.supported), {
          capability: facultySupported,
          replace: facultySupported && replaceFaculty,
          selected: facultyList,
        });
      const rpc = playlistImportRpc(payload);
      const { data, error } = await supabase.rpc(rpc, {
        payload,
        ...(rpc === "import_playlist_with_teachers" ? { mode: "merge" } : {}),
      });
      throwIfError(error);

      return `${data.reused_playlist ? "Re-imported" : "Imported"}: ${data.videos_added} new video(s), ${data.videos_reused} reused, ${data.lessons} lesson(s) — tagged ${classLevels.join(", ")}.`;
    });
  };

  if (!hasYouTubeKey) {
    return (
      <div className={`rounded-2xl border ${t.card} ${t.border} p-6`}>
        <h2 className={`text-base font-semibold ${t.text}`}>Import a playlist</h2>
        <p className={`mt-2 text-sm ${t.muted}`}>
          No <code>VITE_YOUTUBE_API_KEY</code> found. Add it to .env and restart
          the dev server.
        </p>
      </div>
    );
  }

  return (
    <FormCard
      title="Import a playlist"
      description="Paste a YouTube playlist link. Every video is fetched, then saved with the category, subject and chapter you choose."
      onSubmit={importAll}
      busy={busy}
      status={status}
      submitLabel={`Import all${videos.length ? ` (${videos.length})` : ""}`}
    >
      {/* ---- 1. the url ---- */}
      <Labeled
        label="Playlist link"
        hint={
          playlistId
            ? `Detected playlist ID: ${playlistId}`
            : raw
            ? "No playlist ID found — the link needs a ?list=… part."
            : "e.g. https://www.youtube.com/playlist?list=PL..."
        }
      >
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="https://www.youtube.com/playlist?list=..."
            />
          </div>
          <button
            type="button"
            onClick={loadPlaylist}
            disabled={!playlistId || fetching}
            className={`mt-1 shrink-0 rounded-lg border px-4 text-sm font-medium ${t.border} ${t.text} ${t.hover} disabled:opacity-40`}
          >
            {fetching ? "Fetching…" : "Fetch"}
          </button>
        </div>
      </Labeled>

      {fetchError && (
        <p className="text-sm" style={{ color: ACCENT.red }}>
          {fetchError}
        </p>
      )}

      {/* ---- 2. the preview ---- */}
      {meta && (
        <div className={`rounded-xl border ${t.border} p-4`}>
          <p className={`text-sm font-semibold ${t.text}`}>{meta.title}</p>
          <p className={`mt-0.5 text-xs ${t.faint}`}>
            {meta.channelTitle} · {videos.length} video(s) found
          </p>
          {truncated && (
            <p className="mt-1 text-xs" style={{ color: ACCENT.red }}>
              Only the first {videos.length} videos were read — this playlist is
              very long.
            </p>
          )}

          <div className={`mt-3 max-h-64 overflow-y-auto rounded-lg border ${t.border}`}>
            {videos.map((v, i) => (
              <div
                key={v.videoId}
                className={`flex items-center gap-3 border-b px-3 py-2 last:border-b-0 ${t.divider}`}
              >
                <span className={`w-5 shrink-0 text-xs ${t.faint}`}>{i + 1}</span>
                <img
                  src={v.thumbnail}
                  alt=""
                  className="h-8 w-14 shrink-0 rounded object-cover"
                />
                <span className={`min-w-0 flex-1 truncate text-sm ${t.muted}`}>
                  {v.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- 3. where it all goes ---- */}
      {meta && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Channel (institute)">
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
            <Labeled label="Learning goal">
              <Select
                options={learningGoals}
                placeholder="Choose…"
                value={learningGoalId}
                onChange={(e) => { setLearningGoalId(e.target.value); setBoardIds([]); }}
                required
              />
            </Labeled>
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
            <Labeled label="Subject">
              <Select
                options={subjects}
                placeholder="Choose…"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setChapterId("");
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

          <div className="space-y-4">
            <EditorialTitleField
              sourceTitle={meta.title}
              value={title}
              onChange={setTitle}
              reviewed={titleReviewed}
              onReviewedChange={setTitleReviewed}
            />
            <Labeled
              label="Teacher (legacy free text)"
              hint="Kept for now so nothing is lost. Faculty identity comes from the picker below."
            >
              <Input
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="ABJ Sir"
              />
            </Labeled>
            <div className="sm:col-span-2">
              <TeacherPicker
                value={facultyList}
                onChange={setFacultyList}
                label="Faculty registry (name, initials or alias)"
                replace={replaceFaculty}
                onReplaceChange={setReplaceFaculty}
                onCapabilityChange={setFacultySupported}
              />
            </div>
            <ClassLevelPicker
              value={classLevels}
              onChange={setClassLevels}
              label="Applicable classes (pick at least one)"
            />
            {classLevels.length > 1 && (
              <Labeled
                label="Audience focus"
                hint="Which class is this course primarily made for? (optional)"
              >
                <select
                  value={audienceFocus}
                  onChange={(e) => setAudienceFocus(e.target.value)}
                  className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm outline-none`}
                >
                  <option value="">No specific focus</option>
                  {classLevels.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Labeled>
            )}
            <CourseMetaFields
              value={courseMeta}
              onChange={(patch) => setCourseMeta((m) => ({ ...m, ...patch }))}
            />
          </div>

          {/* Final review before publishing — exactly what will be written. */}
          <div className={`rounded-xl border ${t.border} ${t.card} p-4 text-sm`}>
            <p className={`font-semibold ${t.text}`}>Review before importing</p>
            <ul className={`mt-2 space-y-1 ${t.muted}`}>
              <li>Title: {title.trim() || "— (required)"}</li>
              <li>Title review: {titleReviewed ? "confirmed" : "— (confirmation required)"}</li>
              <li>Source title: {qualityCapability.supported ? "will be preserved" : "quality migration not installed"}</li>
              <li>Category: {categories.find((c) => String(c.id) === categoryId)?.name ?? "—"}</li>
              <li>Learning goal: {learningGoals.find((g) => String(g.id) === learningGoalId)?.name ?? "— (required)"}</li>
              {goalSlug === "school" && (
                <li>Board(s): {boards.filter((b) => boardIds.includes(String(b.id))).map((b) => b.name).join(", ") || "— (required)"}</li>
              )}
              <li>Applicable classes: {classLevels.join(", ") || "— (required)"}</li>
              {facultySupported && (
                <li>
                  Faculty links: {replaceFaculty
                    ? facultyList.length
                      ? facultyList.map((f) => f.display_name).join(", ")
                      : "clear existing links"
                    : "preserve existing links"}
                </li>
              )}
              {audienceFocus && <li>Audience focus: {audienceFocus}</li>}
              <li>Subject: {subjects.find((s) => String(s.id) === subjectId)?.name ?? "—"}</li>
              <li>
                Chapter:{" "}
                {newChapterName.trim() ||
                  chapters.find((c) => String(c.id) === chapterId)?.name ||
                  "— (none)"}
              </li>
              <li>{videos.length} lesson(s) will be created/linked in order</li>
            </ul>
          </div>
        </>
      )}
    </FormCard>
  );
}
