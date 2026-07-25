import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useTheme } from "./theme.jsx";
import { ACCENT, CourseMetaFields, Input, Labeled } from "./adminUI.jsx";

const PAGE_SIZE = 10;

const asIds = (value) => (Array.isArray(value)
  ? value.map(Number).filter(Number.isInteger)
  : []);

const classLabel = (slug) => {
  if (slug === "dropper") return "Dropper";
  const match = String(slug ?? "").match(/^class-(\d+)$/);
  return match ? `Class ${match[1]}` : String(slug ?? "");
};

const rpcError = (error) => {
  const detail = error?.details || error?.hint || error?.message;
  return detail || "The database rejected this change.";
};

function CheckboxGroup({ label, rows, value, onChange, getLabel }) {
  const { t } = useTheme();
  const selected = asIds(value);

  const toggle = (id) => {
    const numeric = Number(id);
    onChange(
      selected.includes(numeric)
        ? selected.filter((current) => current !== numeric)
        : [...selected, numeric],
    );
  };

  return (
    <fieldset>
      <legend className={`text-xs font-medium ${t.muted}`}>{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows.map((row) => {
          const id = Number(row.id);
          const text = getLabel(row);
          return (
            <label
              key={row.id}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border ${t.border} px-3 py-2 text-sm ${t.text}`}
            >
              <input
                type="checkbox"
                aria-label={`${label}: ${text}`}
                checked={selected.includes(id)}
                onChange={() => toggle(id)}
                style={{ accentColor: ACCENT.teal }}
              />
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function useManagedPlaylists() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [capable, setCapable] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.rpc("catalog_manage_capability").then(({ error: capabilityError }) => {
      if (!active) return;
      if (capabilityError) {
        setUnavailable(capabilityError.code === "PGRST202");
        setError(
          capabilityError.code === "PGRST202"
            ? null
            : rpcError(capabilityError),
        );
        setLoading(false);
        return;
      }
      setCapable(true);
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    if (!capable) return false;
    setLoading(true);
    setError(null);
    const { data, error: listError } = await supabase.rpc(
      "get_manage_playlists",
      {
        p_search: search,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      },
    );
    if (listError) {
      setError(rpcError(listError));
      setLoading(false);
      return false;
    }
    const nextRows = data ?? [];
    setRows(nextRows);
    setTotal(Number(nextRows[0]?.total_count ?? 0));
    setSelected((current) => (
      current
        ? nextRows.find((row) => Number(row.playlist_id) === Number(current.playlist_id)) ?? null
        : null
    ));
    setLoading(false);
    return true;
  }, [capable, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const submitSearch = (event) => {
    event.preventDefault();
    setPage(0);
    setSelected(null);
    setSearch(searchInput.trim());
  };

  return {
    rows,
    total,
    page,
    setPage,
    searchInput,
    setSearchInput,
    submitSearch,
    selected,
    setSelected,
    loading,
    error,
    unavailable,
    reload: load,
  };
}

function PlaylistEditor({
  playlist,
  channels,
  learningGoals,
  classLevelRows,
  chapters,
  onChanged,
  onDeleted,
}) {
  const { t } = useTheme();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [deleteText, setDeleteText] = useState("");

  useEffect(() => {
    setDraft({
      title: playlist.title ?? "",
      teacher: playlist.teacher ?? "",
      channelId: Number(playlist.channel_id),
      learningGoalIds: asIds(playlist.learning_goal_ids),
      classLevelIds: asIds(playlist.class_level_ids),
      contentType: playlist.content_type ?? "",
      language: playlist.language ?? "",
      difficulty: playlist.difficulty ?? "",
      audienceFocus: playlist.audience_focus ?? "",
    });
    setDeleteText("");
    setStatus(null);
  }, [playlist]);

  const run = async (name, args, message, after = onChanged) => {
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.rpc(name, args);
    if (error) {
      setStatus({ ok: false, message: rpcError(error) });
      setBusy(false);
      return false;
    }
    setStatus({ ok: true, message });
    if (after) await after();
    setBusy(false);
    return true;
  };

  if (!draft) return null;

  const savePlaylist = (event) => {
    event.preventDefault();
    return run(
      "update_managed_playlist",
      {
        p_playlist_id: Number(playlist.playlist_id),
        p_expected_title: playlist.title,
        p_title: draft.title,
        p_teacher: draft.teacher || null,
        p_channel_id: Number(draft.channelId),
        p_learning_goal_ids: asIds(draft.learningGoalIds),
        p_class_level_ids: asIds(draft.classLevelIds),
        p_content_type: draft.contentType || null,
        p_language: draft.language || null,
        p_difficulty: draft.difficulty || null,
        p_audience_focus: draft.audienceFocus || null,
      },
      "Playlist changes saved.",
    );
  };

  const deletePlaylist = () => run(
    "delete_managed_playlist",
    {
      p_playlist_id: Number(playlist.playlist_id),
      p_expected_title: playlist.title,
    },
    "Playlist deleted. Video records were retained.",
    onDeleted,
  );

  const relevantChapters = chapters.filter(
    (chapter) => Number(chapter.subject_id) === Number(playlist.subject_id),
  );

  return (
    <section className={`rounded-2xl border ${t.card} ${t.border} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={`text-lg font-semibold ${t.text}`}>{playlist.title}</h2>
          <p className={`mt-1 text-sm ${t.muted}`}>
            {playlist.category_name} · {playlist.subject_name || "No subject"} · ID {playlist.playlist_id}
          </p>
        </div>
        <a
          href={`https://www.youtube.com/playlist?list=${encodeURIComponent(playlist.youtube_playlist_id ?? "")}`}
          target="_blank"
          rel="noreferrer"
          className={`text-sm ${t.muted} hover:underline`}
        >
          Open source playlist
        </a>
      </div>

      <form onSubmit={savePlaylist} className="mt-6 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Course title">
            <Input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({
                ...current,
                title: event.target.value,
              }))}
              required
            />
          </Labeled>
          <Labeled label="Teacher">
            <Input
              value={draft.teacher}
              onChange={(event) => setDraft((current) => ({
                ...current,
                teacher: event.target.value,
              }))}
            />
          </Labeled>
          <Labeled label="Channel">
            <select
              value={draft.channelId}
              onChange={(event) => setDraft((current) => ({
                ...current,
                channelId: Number(event.target.value),
              }))}
              className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm`}
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>{channel.name}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Audience focus">
            <select
              value={draft.audienceFocus}
              onChange={(event) => setDraft((current) => ({
                ...current,
                audienceFocus: event.target.value,
              }))}
              className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm`}
            >
              <option value="">—</option>
              <option value="10th">Class 10</option>
              <option value="11th">Class 11</option>
              <option value="12th">Class 12</option>
              <option value="dropper">Dropper</option>
            </select>
          </Labeled>
        </div>

        <CheckboxGroup
          label="Learning goals"
          rows={learningGoals}
          value={draft.learningGoalIds}
          onChange={(learningGoalIds) => setDraft((current) => ({
            ...current,
            learningGoalIds,
          }))}
          getLabel={(row) => row.name}
        />
        <CheckboxGroup
          label="Class levels"
          rows={classLevelRows}
          value={draft.classLevelIds}
          onChange={(classLevelIds) => setDraft((current) => ({
            ...current,
            classLevelIds,
          }))}
          getLabel={(row) => classLabel(row.slug)}
        />
        <CourseMetaFields
          value={draft}
          onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
        />

        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: ACCENT.teal }}
        >
          {busy ? "Saving…" : "Save playlist changes"}
        </button>
      </form>

      <div className="mt-8 space-y-4">
        <div>
          <h3 className={`text-base font-semibold ${t.text}`}>Videos</h3>
          <p className={`mt-1 text-sm ${t.muted}`}>
            Correct a chapter or the goal/class tags for one existing lecture.
          </p>
        </div>
        {(playlist.videos ?? []).map((video) => (
          <VideoEditor
            key={video.membership_id ?? video.video_id}
            playlist={playlist}
            video={video}
            chapters={relevantChapters}
            learningGoals={learningGoals}
            classLevelRows={classLevelRows}
            onChanged={onChanged}
          />
        ))}
        {(playlist.videos ?? []).length === 0 && (
          <p className={`text-sm ${t.muted}`}>This playlist has no linked videos.</p>
        )}
      </div>

      <div className={`mt-8 border-t ${t.divider} pt-6`}>
        <h3 className="text-base font-semibold" style={{ color: ACCENT.red }}>
          Delete playlist
        </h3>
        <p className={`mt-1 text-sm ${t.muted}`}>
          Video records stay in the library. Type the exact current title to unlock deletion.
        </p>
        <div className="mt-4 max-w-xl">
          <Labeled label="Type the exact playlist title">
            <Input
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
              autoComplete="off"
            />
          </Labeled>
        </div>
        <button
          type="button"
          disabled={busy || deleteText !== playlist.title}
          onClick={deletePlaylist}
          className="mt-3 min-h-11 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: ACCENT.red, color: ACCENT.red }}
        >
          Delete playlist
        </button>
      </div>

      {status && (
        <p
          role="status"
          className="mt-4 text-sm"
          style={{ color: status.ok ? ACCENT.teal : ACCENT.red }}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}

function VideoEditor({
  playlist,
  video,
  chapters,
  learningGoals,
  classLevelRows,
  onChanged,
}) {
  const { t } = useTheme();
  const [chapterId, setChapterId] = useState(String(video.chapter_id ?? ""));
  const [learningGoalIds, setLearningGoalIds] = useState(asIds(video.learning_goal_ids));
  const [classLevelIds, setClassLevelIds] = useState(asIds(video.class_level_ids));
  const [sharedAllowed, setSharedAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const sharedCount = Number(video.shared_playlist_count ?? 1);
  const sharedBlocked = sharedCount > 1 && !sharedAllowed;

  useEffect(() => {
    setChapterId(String(video.chapter_id ?? ""));
    setLearningGoalIds(asIds(video.learning_goal_ids));
    setClassLevelIds(asIds(video.class_level_ids));
    setSharedAllowed(false);
    setStatus(null);
  }, [video]);

  const run = async (name, args, message) => {
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.rpc(name, args);
    if (error) {
      setStatus({ ok: false, message: rpcError(error) });
      setBusy(false);
      return;
    }
    setStatus({ ok: true, message });
    await onChanged();
    setBusy(false);
  };

  const saveChapter = () => run(
    "reassign_video_chapter",
    {
      p_playlist_id: Number(playlist.playlist_id),
      p_video_id: Number(video.video_id),
      p_chapter_id: Number(chapterId),
      p_expected_current_chapter_id: video.chapter_id == null
        ? null
        : Number(video.chapter_id),
      p_allow_shared: sharedAllowed,
    },
    "Chapter saved.",
  );

  const saveTaxonomy = () => run(
    "set_managed_video_taxonomy",
    {
      p_playlist_id: Number(playlist.playlist_id),
      p_video_id: Number(video.video_id),
      p_learning_goal_ids: asIds(learningGoalIds),
      p_class_level_ids: asIds(classLevelIds),
      p_allow_shared: sharedAllowed,
    },
    "Video taxonomy saved.",
  );

  const clearTaxonomy = () => run(
    "clear_managed_video_taxonomy",
    {
      p_playlist_id: Number(playlist.playlist_id),
      p_video_id: Number(video.video_id),
      p_allow_shared: sharedAllowed,
    },
    "Video taxonomy cleared.",
  );

  return (
    <article className={`rounded-xl border ${t.border} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className={`text-sm font-semibold ${t.text}`}>
            {video.position}. {video.title}
          </h4>
          <p className={`mt-1 text-xs ${t.muted}`}>
            Video ID {video.video_id} · {video.youtube_video_id}
          </p>
        </div>
        {sharedCount > 1 && (
          <span className={`rounded-full px-2 py-1 text-xs ${t.chip}`}>
            Shared by {sharedCount} playlists
          </span>
        )}
      </div>

      {sharedCount > 1 && (
        <label className={`mt-4 flex items-start gap-2 text-sm ${t.text}`}>
          <input
            type="checkbox"
            checked={sharedAllowed}
            onChange={(event) => setSharedAllowed(event.target.checked)}
            style={{ accentColor: ACCENT.teal }}
          />
          I understand this changes {sharedCount} playlists
        </label>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Labeled label={`Chapter for ${video.title}`}>
          <select
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            className={`mt-1 w-full rounded-lg border ${t.border} ${t.input} ${t.text} px-3 py-2 text-sm`}
          >
            <option value="">Choose a chapter</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
            ))}
          </select>
        </Labeled>
        <button
          type="button"
          disabled={busy || !chapterId || sharedBlocked}
          onClick={saveChapter}
          className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: ACCENT.teal }}
        >
          Save chapter for {video.title}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CheckboxGroup
          label="Video learning goals"
          rows={learningGoals}
          value={learningGoalIds}
          onChange={setLearningGoalIds}
          getLabel={(row) => row.name}
        />
        <CheckboxGroup
          label="Video class levels"
          rows={classLevelRows}
          value={classLevelIds}
          onChange={setClassLevelIds}
          getLabel={(row) => classLabel(row.slug)}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={
            busy
            || sharedBlocked
            || learningGoalIds.length === 0
            || classLevelIds.length === 0
          }
          onClick={saveTaxonomy}
          className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: ACCENT.teal }}
        >
          Save video taxonomy
        </button>
        <button
          type="button"
          disabled={busy || sharedBlocked}
          onClick={clearTaxonomy}
          className={`min-h-11 rounded-lg border ${t.border} px-3 py-2 text-sm font-semibold ${t.text} disabled:opacity-40`}
        >
          Clear video taxonomy
        </button>
      </div>
      {status && (
        <p
          role="status"
          className="mt-3 text-sm"
          style={{ color: status.ok ? ACCENT.teal : ACCENT.red }}
        >
          {status.message}
        </p>
      )}
    </article>
  );
}

export default function ManageCatalogPanel(props) {
  const { t } = useTheme();
  const manager = useManagedPlaylists();
  const totalPages = Math.max(1, Math.ceil(manager.total / PAGE_SIZE));
  const pageNumber = Math.min(manager.page + 1, totalPages);

  if (manager.unavailable) {
    return (
      <div className={`rounded-2xl border ${t.card} ${t.border} p-6`}>
        <h2 className={`text-base font-semibold ${t.text}`}>Manage catalog</h2>
        <p className={`mt-2 text-sm ${t.muted}`}>
          Catalog management is not installed on this database.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className={`text-xl font-semibold ${t.text}`}>Manage catalog</h1>
        <p className={`mt-1 text-sm ${t.muted}`}>
          Correct existing playlist metadata, taxonomy, and video chapters.
        </p>
      </div>

      <form
        onSubmit={manager.submitSearch}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="manage-playlist-search" className="flex-1">
          <span className="sr-only">Search playlists</span>
          <Input
            id="manage-playlist-search"
            value={manager.searchInput}
            onChange={(event) => manager.setSearchInput(event.target.value)}
            placeholder="Search title, teacher, or playlist ID"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: ACCENT.teal }}
        >
          Search
        </button>
      </form>

      {manager.error && (
        <p role="alert" className="text-sm" style={{ color: ACCENT.red }}>
          {manager.error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-medium ${t.text}`}>
              {manager.total} playlists
            </p>
            {manager.loading && (
              <span className={`text-xs ${t.muted}`}>Loading…</span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {manager.rows.map((playlist) => {
              const active = Number(manager.selected?.playlist_id)
                === Number(playlist.playlist_id);
              return (
                <button
                  key={playlist.playlist_id}
                  type="button"
                  aria-label={`Edit ${playlist.title}`}
                  onClick={() => manager.setSelected(playlist)}
                  className={`min-h-11 w-full rounded-xl border px-3 py-3 text-left ${t.border} ${
                    active ? "text-white" : `${t.card} ${t.text}`
                  }`}
                  style={active ? { backgroundColor: ACCENT.teal } : undefined}
                >
                  <span className="block text-sm font-semibold">{playlist.title}</span>
                  <span className={`mt-1 block text-xs ${active ? "text-white/80" : t.muted}`}>
                    {playlist.teacher || "Teacher not set"} · {(playlist.videos ?? []).length} videos
                  </span>
                </button>
              );
            })}
            {!manager.loading && manager.rows.length === 0 && (
              <p className={`text-sm ${t.muted}`}>No playlists found.</p>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous page"
              disabled={manager.page === 0 || manager.loading}
              onClick={() => manager.setPage((current) => Math.max(0, current - 1))}
              className={`min-h-11 rounded-lg border ${t.border} px-3 text-sm ${t.text} disabled:opacity-40`}
            >
              Previous
            </button>
            <span className={`text-xs ${t.muted}`}>
              {pageNumber} / {totalPages}
            </span>
            <button
              type="button"
              aria-label="Next page"
              disabled={manager.page + 1 >= totalPages || manager.loading}
              onClick={() => manager.setPage((current) => current + 1)}
              className={`min-h-11 rounded-lg border ${t.border} px-3 text-sm ${t.text} disabled:opacity-40`}
            >
              Next
            </button>
          </div>
        </aside>

        <div>
          {manager.selected ? (
            <PlaylistEditor
              {...props}
              playlist={manager.selected}
              onChanged={manager.reload}
              onDeleted={async () => {
                manager.setSelected(null);
                await manager.reload();
              }}
            />
          ) : (
            <div className={`rounded-2xl border ${t.card} ${t.border} p-6`}>
              <p className={`text-sm ${t.muted}`}>
                Choose a playlist to edit its details and videos.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
