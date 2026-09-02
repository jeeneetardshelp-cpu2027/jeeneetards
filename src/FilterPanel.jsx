// FilterPanel.jsx — ONE filter component, rendered twice.
//
// The desktop sidebar and the mobile bottom sheet are the same <FilterPanel/>
// with a different `variant`. They cannot drift because there is nothing to
// drift: no duplicated option lists, no duplicated cascade, no second copy of
// "which filters exist". State lives entirely in the URL, so the two instances
// are always showing the same thing.
//
// Only filters in filterSchema.AVAILABLE are rendered. Deferred ones are
// absent, not disabled — see filterSchema.js for why.
//
// One filter is rendered differently rather than differently defined:
// LANGUAGE leads the panel as a chip row instead of a checkbox group. Same
// schema entry, same URL parameter, same applyFilterChange — see LanguageChips.

import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { AVAILABLE, filterByKey } from "./filterSchema.js";
import { applyFilterChange } from "./filterChips.js";
import { STAGES_BY_EXAM, SUBJECT_SLUGS_BY_GOAL } from "./filterModel.js";
import { classSlugToStage } from "./canonicalUrl.js";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import ChannelAvatar from "./ChannelAvatar.jsx";

const BRAND = { teal: BRAND_TEAL };

// Long lists get a search box; short ones would just gain clutter.
const SEARCH_THRESHOLD = 8;

function Group({ label, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const { t } = useTheme();
  return (
    <section className={`border-b ${t.border} py-1 last:border-b-0`}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={count > 0 ? `${label}, ${count} selected` : label}
        className={`flex min-h-11 w-full items-center justify-between px-1 text-left text-sm font-medium ${t.text}`}
      >
        <span>
          {label}
          {count > 0 && <span className={`ml-1.5 text-xs font-normal ${t.muted}`}>{count}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 ${t.muted} transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </section>
  );
}

function Option({ selected, onClick, count, label, imageUrl = null }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={count == null
        ? undefined
        : `${label}, ${count} course${count === 1 ? "" : "s"}`}
      className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition ${
        selected ? `font-medium ${t.text}` : `${t.faint} ${t.hover}`
      }`}
    >
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          selected ? "border-transparent" : t.border
        }`}
        style={selected ? { backgroundColor: BRAND.teal } : undefined}
      >
        {/* Fixed white on purpose, not a token: this dot sits on BRAND.teal
            (#0F6F78), which is the same colour in both themes, so the tick has
            to be the same colour in both themes too. bg-surface would make it
            near-black in the dark default. Until 2026-09-02 the index.css
            LEGACY BRIDGE rewrote .bg-white to var(--surface) inside the
            student surface, which did exactly that — the tick was all but
            invisible in dark mode. That rule is gone. */}
        {selected && <span className="block h-1.5 w-1.5 rounded-sm bg-white" />}
      </span>
      {imageUrl && <ChannelAvatar url={imageUrl} name={label} className="h-7 w-7" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <span
          className={`shrink-0 text-xs tabular-nums ${t.muted}`}
          aria-hidden="true"
        >
          {count}
        </span>
      )}
    </button>
  );
}

/** Options for one filter, with an optional search box when the list is long. */
function OptionList({ filter, options, selected, onToggle, counts }) {
  const [term, setTerm] = useState("");
  const { t } = useTheme();
  const searchable = filter.searchable && options.length > SEARCH_THRESHOLD;
  const shown = useMemo(() => {
    if (!searchable || !term.trim()) return options;
    const t = term.trim().toLowerCase();
    return options.filter((o) => String(o.label).toLowerCase().includes(t));
  }, [options, term, searchable]);

  if (options.length === 0)
    return <p className={`px-2 py-1 text-xs ${t.muted}`}>Nothing to choose from yet.</p>;

  return (
    <>
      {searchable && (
        <div className="relative mb-1 px-1">
          <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${t.muted}`} />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={`Search ${filter.label.toLowerCase()}`}
            aria-label={`Search ${filter.label}`}
            className={`min-h-11 w-full rounded-lg border ${t.border} ${t.card} ${t.text} pl-8 pr-2 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
          />
        </div>
      )}
      {/* Bounded height so a long list scrolls INSIDE its group rather than
          pushing every other filter off the screen. */}
      <div className={searchable ? "max-h-60 overflow-y-auto" : ""}>
        {shown.map((o) => (
          <Option
            key={o.value}
            selected={selected.includes(String(o.value))}
            onClick={() => onToggle(filter, o.value)}
            count={optionCount(counts, filter.key, o.value)}
            label={o.label}
            imageUrl={filter.key === "channel" ? o.logoUrl : null}
          />
        ))}
        {shown.length === 0 && (
          <p className={`px-2 py-1 text-xs ${t.muted}`}>No match for “{term.trim()}”.</p>
        )}
      </div>
    </>
  );
}

/**
 * LANGUAGE, PROMOTED OUT OF THE CHECKBOX LIST.
 *
 * The catalogue genuinely is multilingual — `playlists.language` is hindi,
 * english or hinglish — but as one more collapsible group below Exam, Class,
 * Subject, Chapter and Channel, that fact was invisible. A Hindi-medium
 * student had to already suspect the filter existed in order to find it, and
 * Hindi-medium students are most of the NEET cohort outside the metros.
 *
 * So language leads the panel as a row of chips: no disclosure to open, no
 * checkbox to aim at, one 44px tap. It writes through the SAME
 * applyFilterChange as every other enum filter, so the URL, the removable
 * chips above the results and the catalogue query are all unchanged — this is
 * a change of prominence, not a second filter model.
 *
 * The honest-filters rule still holds: a language this view has no courses in
 * is not offered at all (see optionsFor).
 */
function LanguageChips({ filter, variant, options, selected, onToggle, counts }) {
  const { t } = useTheme();
  if (options.length === 0) return null;
  // Both variants are mounted at once on /browse (desktop column + mobile
  // sheet), so the heading id must be per-variant or the two collide.
  const headingId = `filter-language-${variant}`;
  return (
    <section className={`border-b ${t.border} py-3 last:border-b-0`} aria-labelledby={headingId}>
      <h3 id={headingId} className={`px-1 text-sm font-medium ${t.text}`}>{filter.label}</h3>
      <div className="mt-2 flex flex-wrap gap-2 px-1">
        {options.map((o) => {
          const active = selected.includes(String(o.value));
          const count = optionCount(counts, filter.key, o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onToggle(filter, o.value)}
              aria-pressed={active}
              aria-label={count == null
                ? undefined
                : `${o.label}, ${count} course${count === 1 ? "" : "s"}`}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
                active
                  ? "border-transparent font-medium text-white"
                  : `${t.border} ${t.card} ${t.faint} ${t.hover}`
              }`}
              style={active ? { backgroundColor: BRAND.teal } : undefined}
            >
              {o.label}
              {count != null && (
                <span
                  className={`tabular-nums ${active ? "text-white/80" : t.muted}`}
                  aria-hidden="true"
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * @param variant  "sidebar" | "sheet"
 * @param options  { goal: [{value,label}], class: [...], ... } — dimension rows
 *                 already loaded by the caller. Enum filters supply their own.
 * @param params   URLSearchParams (the single source of truth)
 * @param onChange (nextParams) => void
 * @param chapterScopeValues null for no extra scope, otherwise the chapter
 *                           slugs allowed by the current exam/class curriculum
 */
export default function FilterPanel({
  variant = "sidebar", options = {}, params, onChange,
  loading = false, error = null, onRetry = null,
  counts = null, countsLoading = false,
  // False on a board or teacher view: the count RPC has no such argument, so
  // its numbers ignore that predicate and can only be too HIGH. Such counts
  // still prune (a zero is a real zero) but are never rendered as figures.
  countsExact = true,
  chapterScopeValues = null,
}) {
  const { t } = useTheme();
  const selectedFor = (f) => {
    const raw = params.get(f.param);
    if (!raw) return [];
    return f.kind === "enum" ? raw.split(",").filter(Boolean) : [raw];
  };

  const toggle = (filter, value) => onChange(applyFilterChange(params, filter, value));

  // The URL may contain either the canonical goal slug or a legacy database
  // id. Resolve both through the bounded goal options before deciding which
  // classes are legitimate for that exam.
  const goalRaw = params.get("goal");
  const goalSlug = goalRaw
    ? options.goal?.find((o) => String(o.value) === goalRaw || String(o.id) === goalRaw)?.value ?? goalRaw
    : null;

  const baseOptionsFor = (filter) => {
    let raw = filter.kind === "enum"
      ? filter.options.map((o) => ({ value: o.id, label: o.label }))
      : options[filter.key] ?? [];
    // When board/teacher filters suppress the older facet-count RPC, the
    // dimension table alone is too broad (for example it mixes JEE Maths
    // chapters into CBSE Class 10 Maths). The guided curriculum RPC supplies
    // an exam/class-bounded allow-list. Preserve a selected out-of-scope value
    // so a legacy/shared URL is never trapped and can still be cleared.
    if (filter.key === "chapter" && chapterScopeValues != null) {
      const allowed = new Set(chapterScopeValues.map(String));
      const selected = params.get(filter.param);
      raw = raw.filter((option) =>
        String(option.value) === String(selected) || allowed.has(String(option.value))
      );
    }
    // Chapters are reference data, so the dimension table can legitimately
    // contain reviewed chapters before any public course uses them. Once the
    // contextual count RPC has settled, omit those dead-end choices. Preserve
    // an already-selected value so an old/shared URL can still be cleared.
    if (filter.key === "chapter" && counts?.chapter && !countsLoading) {
      const selected = params.get(filter.param);
      return raw.filter((option) =>
        String(option.value) === String(selected) ||
        Number(counts.chapter[String(option.value)] ?? 0) > 0
      );
    }
    // Same honesty as the chapter list, applied to the promoted language row:
    // once the contextual counts have settled, a language with no courses in
    // this view is not offered. Chips sit at the top of the panel where they
    // are read as "what this catalogue has", so a dead-end chip there is a
    // worse lie than a dead-end checkbox further down. An already-selected
    // value is preserved so a shared or stale URL can still be cleared.
    if (filter.key === "language" && counts?.language && !countsLoading) {
      const chosen = selectedFor(filter);
      return raw.filter((option) =>
        chosen.includes(String(option.value)) ||
        Number(counts.language[String(option.value)] ?? 0) > 0
      );
    }
    if (!goalSlug) return raw;
    if (filter.key === "class") {
      const allowed = STAGES_BY_EXAM[goalSlug] ?? [];
      return raw.filter((o) => allowed.includes(classSlugToStage(String(o.value))));
    }
    if (filter.key === "subject" && SUBJECT_SLUGS_BY_GOAL[goalSlug]) {
      const allowed = SUBJECT_SLUGS_BY_GOAL[goalSlug];
      return raw.filter((o) => allowed.includes(String(o.value)));
    }
    return raw;
  };

  // With EXACT counts every rule above stands, including showing a class or a
  // course type with its honest zero. With UPPER-BOUND counts there is no
  // honest zero to show - the figure is withheld - so an option whose bound is
  // already zero would sit there as a silent dead end. School offered Class 11
  // and Class 12 that way with no courses behind either. A certain dead end
  // that cannot be labelled is dropped; a selected value is always kept so a
  // shared or stale URL can still be cleared.
  const optionsFor = (filter) => {
    const base = baseOptionsFor(filter);
    if (countsExact || counts == null || countsLoading) return base;
    const chosen = selectedFor(filter).map(String);
    return base.filter((option) =>
      chosen.includes(String(option.value)) || optionCount(counts, filter.key, option.value) > 0
    );
  };
  // What the figures are drawn from. null withholds them without touching the
  // pruning above, which reads `counts` directly.
  const displayCounts = countsExact ? counts : null;

  // Which filters can be shown right now. A dimension whose parent is not
  // chosen yet (chapter without a subject) is HIDDEN rather than shown empty:
  // an empty list invites the student to conclude there are no chapters.
  const visible = AVAILABLE.filter((f) => {
    // Language is still an AVAILABLE filter — it just renders above the groups
    // as its own chip row, so it must not also appear as a checkbox group.
    if (f.key === "language") return false;
    if (f.dependsOn && !params.get(f.dependsOn)) return false;
    if (f.scopedBy && !params.get(f.scopedBy)) return false;
    if (f.kind === "dimension" && optionsFor(f).length === 0) return false;
    // An enum group can only empty out on an upper-bound view (its vocabulary
    // is fixed, and exact views keep zeros). Then it is hidden, not shown bare.
    if (f.kind === "enum" && !countsExact && optionsFor(f).length === 0) return false;
    // A single-option dimension is not a filter — picking the only value
    // changes nothing, and offering it implies a choice that does not exist.
    // Production currently has exactly one (placeholder-backed) channel.
    // Still shown when already selected, so a shared URL remains removable.
    if (f.key === "channel" && (options.channel ?? []).length < 2 && !params.get(f.param))
      return false;
    return true;
  });

  // Language leads the panel, above the groups. Read through filterByKey
  // rather than written as a literal, so removing it from AVAILABLE removes
  // the row too — filterSchema stays the single answer to "which filters exist".
  const languageFilter = filterByKey("language");
  const languageOptions = languageFilter ? optionsFor(languageFilter) : [];

  if (error) {
    return (
      <div className="p-4 text-sm">
        <p className={`font-medium ${t.text}`}>Filters aren’t available.</p>
        <p className={`mt-1 ${t.muted}`}>
          The catalogue may still be browsable without them.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className={`mt-3 min-h-11 rounded-xl border ${t.border} px-4 text-sm font-medium ${t.hover}`}
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  if (loading)
    return (
      <div className="space-y-3 p-4" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-9 animate-pulse rounded-lg ${t.input}`} />
        ))}
      </div>
    );

  return (
    <div
      className={variant === "sidebar" ? "px-3 py-2" : "px-2 pb-2"}
      data-testid={`filter-panel-${variant}`}
      data-variant={variant}
      aria-busy={countsLoading || undefined}
    >
      {languageFilter && (
        <LanguageChips
          filter={languageFilter}
          variant={variant}
          options={languageOptions}
          selected={selectedFor(languageFilter)}
          onToggle={toggle}
          counts={displayCounts}
        />
      )}
      {visible.map((f) => {
        const opts = optionsFor(f);
        return (
          <Group
            key={f.key}
            label={f.label}
            count={f.kind === "enum" ? selectedFor(f).length : 0}
          >
            <OptionList
              filter={f}
              options={opts}
              selected={selectedFor(f)}
              onToggle={toggle}
              counts={displayCounts}
            />
          </Group>
        );
      })}
      {visible.length === 0 && languageOptions.length === 0 && (
        <p className={`px-2 py-4 text-sm ${t.muted}`}>No filters apply here yet.</p>
      )}
    </div>
  );
}

export { SEARCH_THRESHOLD };

function optionCount(counts, key, value) {
  if (counts == null) return undefined;
  const facetValue = key === "class"
    ? classSlugToStage(String(value))
    : String(value);
  return Number(counts[key]?.[facetValue] ?? 0);
}
