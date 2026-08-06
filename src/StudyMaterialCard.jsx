import { BookOpen, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { materialTypeLabel } from "./useStudyMaterials.js";

const GOAL_LABELS = {
  jee: "JEE",
  neet: "NEET",
  olympiad: "Olympiad",
  school: "School",
};

const CLASS_LABELS = {
  "class-10": "Class 10",
  "class-11": "Class 11",
  "class-12": "Class 12",
  dropper: "Dropper",
};

export function studyMaterialScopeLabel(material) {
  const scope = material?.scopes?.[0];
  if (!scope) return "General study material";
  const pieces = [
    GOAL_LABELS[scope.goal] ?? scope.goal,
    scope.board?.toUpperCase?.() ?? scope.board,
    CLASS_LABELS[scope.class] ?? scope.class,
    scope.subject?.name,
    scope.chapter?.name,
  ].filter(Boolean);
  return pieces.join(" · ") || "General study material";
}

function Detail({ children }) {
  if (!children) return null;
  return <span className="text-xs text-ink-3">{children}</span>;
}

export default function StudyMaterialCard({ material, compact = false }) {
  const details = [
    material.language,
    material.examYear,
    material.pageCount ? `${material.pageCount} pages` : null,
  ].filter(Boolean);

  return (
    <article className="group/material overflow-hidden rounded-xl border border-hairline bg-surface transition-colors duration-200 hover:border-accent-line">
      {!compact && (
        <div className="relative aspect-[16/7] overflow-hidden border-b border-hairline bg-surface-2">
          {material.previewImageUrl ? (
            <img
              src={material.previewImageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover/material:scale-[1.02]"
            />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_top_right,var(--accent-soft),transparent_60%)]">
              <FileText aria-hidden="true" className="h-12 w-12 text-accent" strokeWidth={1.4} />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-md border border-hairline bg-canvas/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
            {material.typeLabel ?? materialTypeLabel(material.type)}
          </span>
        </div>
      )}

      <div className={compact ? "p-4" : "p-5"}>
        {compact && (
          <p className="text-xs font-semibold text-accent">
            {material.typeLabel ?? materialTypeLabel(material.type)}
          </p>
        )}
        <h3 className={`${compact ? "mt-1 text-base" : "text-lg"} font-semibold leading-snug text-ink`}>
          {material.title}
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          {studyMaterialScopeLabel(material)}
        </p>
        {!compact && material.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-2">
            {material.description}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
          {details.map((detail, index) => (
            <span key={detail} className="contents">
              {index > 0 && <span aria-hidden="true" className="text-ink-3">·</span>}
              <Detail>{detail}</Detail>
            </span>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{material.sourceName}</span>
          </span>
          <a
            href={material.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-accent-line bg-accent-soft px-4 text-sm font-semibold text-accent transition-colors hover:bg-surface-2"
          >
            {material.fileFormat === "pdf" ? <FileText aria-hidden="true" className="h-4 w-4" /> : <BookOpen aria-hidden="true" className="h-4 w-4" />}
            Open {material.fileFormat === "pdf" ? "PDF" : "material"}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
