import { BookOpen, RefreshCw } from "lucide-react";
import { Link } from "react-router";
// Chapter names are catalogue text, sometimes Devanagari, under a document
// that declares lang="en". See lang.js.
import { langAttrs } from "./lang.js";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { useStudyMaterials } from "./useStudyMaterials.js";

export function StudyMaterialPanelView({
  chapterName, chapterId, items = [], loading = false, error = null, retry = null,
}) {
  return (
    <section aria-labelledby="lesson-material-heading" className="mt-6 rounded-xl border border-hairline bg-surface-2 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Continue studying</p>
          {/* The heading mixes an English lead-in with the chapter name, and a
              mixed string is tagged as a whole rather than split into spans —
              the same call lang.js documents. Latin chapters leave no trace. */}
          <h2
            id="lesson-material-heading"
            {...langAttrs(chapterName)}
            className="mt-1 text-lg font-semibold text-ink"
          >
            Study material{chapterName ? ` for ${chapterName}` : ""}
          </h2>
        </div>
        <Link to={`/materials${chapterId ? `?chapterId=${encodeURIComponent(chapterId)}` : ""}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-accent">
          View all <BookOpen aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      {loading && <p role="status" className="mt-4 text-sm text-ink-3">Loading reviewed material…</p>}
      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-hairline bg-surface p-3 text-sm text-ink-2">
          <span>{error}</span>
          {retry && <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-2 font-semibold text-accent"><RefreshCw aria-hidden="true" className="h-4 w-4" /> Retry</button>}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-4 rounded-lg border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink-2">
          No reviewed material is linked to this chapter yet. The video is still available as usual.
        </p>
      )}
      {items.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((material) => <StudyMaterialCard key={material.id} material={material} compact />)}
        </div>
      )}
    </section>
  );
}

export default function StudyMaterialPanel({ chapterId, chapterName, videoId }) {
  const enabled = RELEASE_CAPABILITIES.studyMaterials && Boolean(chapterId || videoId);
  const state = useStudyMaterials({ chapterId, videoId, limit: 4 }, { enabled });
  if (!enabled || state.unavailable) return null;
  return <StudyMaterialPanelView chapterId={chapterId} chapterName={chapterName} {...state} />;
}
