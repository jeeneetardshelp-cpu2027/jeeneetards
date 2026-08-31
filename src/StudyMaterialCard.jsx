import { ArrowRight, BookOpen, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { findTestSection } from "./testPlatforms.js";
import { materialTypeLabel } from "./useStudyMaterials.js";

const GOAL_LABELS = {
  jee: "JEE",
  "jee-main": "JEE Main",
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
  const sameFamily = (candidate) => (
    candidate?.goal === scope.goal
    && candidate?.board === scope.board
    && candidate?.class === scope.class
    && candidate?.subject?.slug === scope.subject?.slug
  );
  const chapterNames = [...new Set(
    material.scopes
      .filter(sameFamily)
      .map((candidate) => candidate?.chapter?.name)
      .filter(Boolean),
  )];
  const chapterLabel = chapterNames.length > 2
    ? `${chapterNames.slice(0, 2).join(" + ")} + ${chapterNames.length - 2} more`
    : chapterNames.join(" + ");
  const pieces = [
    GOAL_LABELS[scope.goal] ?? scope.goal,
    scope.board?.toUpperCase?.() ?? scope.board,
    CLASS_LABELS[scope.class] ?? scope.class,
    scope.subject?.name,
    chapterLabel || scope.chapter?.name,
  ].filter(Boolean);
  return pieces.join(" · ") || "General study material";
}

// A previous-year paper pairs naturally with a timed attempt at the same
// exam — but only goals whose /tests/:examId page actually lists timed
// tests are mapped. Checked against testPlatforms.js, deliberately NOT
// derived: "jee" is ambiguous between Main and Advanced, and the olympiad
// and school tests pages list untimed PDF papers, where "timed attempt"
// would promise something the destination does not offer.
const TIMED_TESTS_EXAM_BY_GOAL = Object.freeze({
  "jee-main": "jee-main",
  neet: "neet",
});

export function mockTestsPathForMaterial(material) {
  if (material?.type !== "previous_year_paper") return null;
  const examId = TIMED_TESTS_EXAM_BY_GOAL[material?.scopes?.[0]?.goal];
  // findTestSection is the same lookup the route uses, so the link can only
  // exist when the page does.
  if (!examId || !findTestSection(examId)) return null;
  return `/tests/${examId}`;
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
  const mockTestsPath = mockTestsPathForMaterial(material);

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

        {mockTestsPath && (
          <Link
            to={mockTestsPath}
            className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-ink-3 transition-colors hover:text-accent"
          >
            Want a timed attempt? Mock tests
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </article>
  );
}
