// ChapterChampions — "who teaches this chapter best, on the dimensions
// students actually rate", on the watch page next to ChapterTeachers.
//
// The site collects clarity and question-quality ratings on every structured
// review and has never shown them. This board names the chapter's top course
// on each dimension — the answer to the most-forwarded batch-group question
// ("iss chapter ke best teacher kaun?") — using the get_chapter_champions
// aggregates, which are confidence-gated server-side at the same 5-vote floor
// as every other rating surface.
//
// Honesty rule, same as ChapterTeachers directly below it: if no course has a
// confident dimension yet (true for most chapters while the rating prompt is
// young), render NOTHING. No empty panel, no "not enough data" filler.
import { Link } from "react-router";
import { courseCredit } from "./courseCredit.js";
import { Award, ArrowRight } from "lucide-react";
import { useTheme } from "./theme.jsx";
import { useChapterChampions } from "./useChapterChampions.js";
// Chapter names, course titles and faculty names are catalogue text, and this
// catalogue writes plenty of it in Devanagari under a document that declares
// lang="en". See lang.js.
import { hasDevanagari, langAttrs } from "./lang.js";
import { BRAND_TEAL } from "./brandColors.js";

const DIMENSIONS = [
  { key: "clarity", label: "Clearest explanations", unit: "clarity" },
  { key: "question", label: "Best question practice", unit: "question quality" },
];

export default function ChapterChampions({ chapterId, chapterName }) {
  const { t } = useTheme();
  const { loading, clarity, question } = useChapterChampions(
    Number.isInteger(chapterId) && chapterId > 0 ? chapterId : null,
  );

  if (loading) return null;
  const champions = { clarity, question };
  const rows = DIMENSIONS.filter((d) => champions[d.key]);
  if (rows.length === 0) return null;

  return (
    <section
      aria-label={`Top rated courses for ${chapterName ?? "this chapter"}`}
      className={`mt-4 rounded-2xl border ${t.border} ${t.card} p-4 sm:p-5`}
    >
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4" style={{ color: BRAND_TEAL }} aria-hidden="true" />
        <h2 className={`text-sm font-semibold ${t.text}`}>
          Chapter champions{" "}
          {chapterName
            ? <span {...langAttrs(chapterName)} className={t.muted}>{chapterName}</span>
            : null}
        </h2>
      </div>
      <p className={`mt-1 text-xs ${t.muted}`}>
        Rated by students who watched these courses.
      </p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map(({ key, label, unit }) => {
          const champion = champions[key];
          // The credit line runs "<teacher — institute> · 4.5/5 clarity (6
          // ratings)". Only the first half is catalogue text; tagging the whole
          // line would read the score in Hindi phonetics too, so the names get
          // their own element — and only when they need one.
          // Same rule as the cards: a teacher that is only the channel's own
          // name would render "Competishun+ — Competishun+".
          const named = courseCredit({ teacher: champion.teacher, institute: champion.institute });
          const credit = [named.teacher, named.institute].filter(Boolean).join(" — ");
          return (
            <li key={key}>
              <Link
                to={`/course/${champion.playlist_id}/chapter/${chapterId}`}
                className={`group flex min-h-11 items-center gap-3 rounded-xl border ${t.border} p-3 transition-colors hover:border-teal-500`}
              >
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold uppercase tracking-wide ${t.muted}`}>
                    {label}
                  </span>
                  <span
                    {...langAttrs(champion.title)}
                    className={`mt-0.5 block truncate text-sm font-medium ${t.text}`}
                  >
                    {champion.title}
                  </span>
                  <span className={`block truncate text-xs ${t.muted}`}>
                    {hasDevanagari(credit) ? <span lang="hi">{credit}</span> : credit}
                    {" · "}
                    {champion.score.toFixed(1)}/5 {unit} ({champion.count} ratings)
                  </span>
                </span>
                <ArrowRight
                  className={`h-4 w-4 shrink-0 ${t.faint} transition-transform group-hover:translate-x-0.5`}
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
