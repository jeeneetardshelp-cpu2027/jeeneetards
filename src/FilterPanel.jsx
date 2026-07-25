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

import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { AVAILABLE } from "./filterSchema.js";
import { applyFilterChange } from "./filterChips.js";
import { STAGES_BY_EXAM, SUBJECT_SLUGS_BY_GOAL } from "./filterModel.js";
import { classSlugToStage } from "./canonicalUrl.js";
import { useTheme } from "./theme.jsx";

const BRAND = { teal: "#13919B" };

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

function Option({ selected, onClick, count, children }) {
  const { t } = useTheme();
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      aria-label={count == null
        ? undefined
        : `${children}, ${count} course${count === 1 ? "" : "s"}`}
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
        {selected && <span className="block h-1.5 w-1.5 rounded-sm bg-white" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
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
          >
            {o.label}
          </Option>
        ))}
        {shown.length === 0 && (
          <p className={`px-2 py-1 text-xs ${t.muted}`}>No match for “{term.trim()}”.</p>
        )}
      </div>
    </>
  );
}

/**
 * @param variant  "sidebar" | "sheet"
 * @param options  { goal: [{value,label}], class: [...], ... } — dimension rows
 *                 already loaded by the caller. Enum filters supply their own.
 * @param params   URLSearchParams (the single source of truth)
 * @param onChange (nextParams) => void
 */
export default function FilterPanel({
  variant = "sidebar", options = {}, params, onChange,
  loading = false, error = null, onRetry = null,
  counts = null, countsLoading = false,
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

  const optionsFor = (filter) => {
    const raw = filter.kind === "enum"
      ? filter.options.map((o) => ({ value: o.id, label: o.label }))
      : options[filter.key] ?? [];
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

  // Which filters can be shown right now. A dimension whose parent is not
  // chosen yet (chapter without a subject) is HIDDEN rather than shown empty:
  // an empty list invites the student to conclude there are no chapters.
  const visible = AVAILABLE.filter((f) => {
    if (f.dependsOn && !params.get(f.dependsOn)) return false;
    if (f.scopedBy && !params.get(f.scopedBy)) return false;
    if (f.kind === "dimension" && optionsFor(f).length === 0) return false;
    // A single-option dimension is not a filter — picking the only value
    // changes nothing, and offering it implies a choice that does not exist.
    // Production currently has exactly one (placeholder-backed) channel.
    // Still shown when already selected, so a shared URL remains removable.
    if (f.key === "channel" && (options.channel ?? []).length < 2 && !params.get(f.param))
      return false;
    return true;
  });

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
              counts={counts}
            />
          </Group>
        );
      })}
      {visible.length === 0 && (
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
