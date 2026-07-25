// UniversalSearch.jsx — one search box for the whole library.
//
// Results are grouped: Faculty · Chapters · Playlists · Lectures · Institutes.
//
//   Amit Bijarnia
//   Also known as: ABJ Sir
//   Competishun · Physics · JEE
//
// Two rules dominate the interaction design:
//
//   * NEVER AUTO-SELECT AN AMBIGUOUS IDENTITY (requirement 2). When two real
//     teachers share a name or an alias, both are listed with their institute,
//     subject and exam, and neither is pre-highlighted. Pressing Enter on a
//     query — not on a chosen row — must not pick one of them for you.
//   * The list is what the server sent, in the order the server sent it. No
//     client-side re-ranking (requirement 4/5).

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router";
import { Search, X, Loader2, AlertTriangle, Users } from "lucide-react";
import { useUniversalSearch, GROUPS, MIN_QUERY } from "./useUniversalSearch.js";
import { normalizeForHighlight } from "./searchHighlight.js";
import { useTheme } from "./theme.jsx";
import { BRAND_NAVY, BRAND_TEAL } from "./brandColors.js";

const BRAND = { navy: BRAND_NAVY, teal: BRAND_TEAL };

// ---------------------------------------------------------------- highlight
/**
 * Split `text` so the part matching `query` can be marked. Highlighting is
 * cosmetic and must never change the words: we locate the match on a
 * normalised copy and slice the ORIGINAL string by those offsets, so
 * punctuation and case survive exactly as stored.
 */
export function highlightParts(text, query) {
  const src = text ?? "";
  const nText = normalizeForHighlight(src);
  const nQuery = normalizeForHighlight(query ?? "");
  if (!nQuery || nQuery.length < MIN_QUERY) return [{ text: src, hit: false }];
  const at = nText.indexOf(nQuery);
  if (at < 0) return [{ text: src, hit: false }];       // fuzzy hit, nothing literal to mark
  return [
    { text: src.slice(0, at), hit: false },
    { text: src.slice(at, at + nQuery.length), hit: true },
    { text: src.slice(at + nQuery.length), hit: false },
  ].filter((p) => p.text.length > 0);
}

function Highlight({ text, query }) {
  const { dark } = useTheme();
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className={`rounded px-0.5 text-inherit ${dark ? "bg-amber-900" : "bg-amber-100"}`}>{p.text}</mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

// ---------------------------------------------------------------- one result
function Row({ item, group, query, active, onPick, id }) {
  const { t, dark } = useTheme();
  return (
    <li>
      <button
        id={id}
        role="option"
        aria-selected={active}
        onClick={() => onPick(item, group)}
        className={`flex min-h-11 w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left ${
          active ? t.input : t.hover
        }`}
      >
        <span className="flex w-full items-center gap-2">
          <span className={`truncate text-sm font-medium ${t.text}`}>
            <Highlight text={item.title} query={query} />
          </span>
          {/* Requirement 2 made visible: this row is one of several people who
              answer to that name. It is a warning, not a ranking signal. */}
          {item.isAmbiguous && (
            <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${dark ? "bg-amber-950 text-amber-300" : "bg-amber-50 text-amber-800"}`}>
              <Users className="h-3 w-3" /> More than one match
            </span>
          )}
        </span>

        {/* "Also known as: ABJ Sir" — verified aliases only; the server never
            sends an unreviewed one to a student. */}
        {item.aka && (
          <span className={`truncate text-xs ${t.muted}`}>
            Also known as: <Highlight text={item.aka} query={query} />
          </span>
        )}

        {item.subtitle && (
          <span className={`truncate text-xs ${t.muted}`}>{item.subtitle}</span>
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- page
export default function UniversalSearch() {
  const navigate = useNavigate();
  const { t, dark } = useTheme();
  const [params, setParams] = useSearchParams();

  // Requirement 9: the query and the selected entity type live in the URL, so
  // a search is shareable, survives a refresh, and Back works.
  const urlQuery = params.get("q") ?? "";
  const urlType = params.get("type");
  const type = GROUPS.some((g) => g.key === urlType) ? urlType : null;

  // The input is local so typing stays instant; the URL is updated on a
  // trailing edge. Writing every keystroke to history would make the browser
  // Back button walk backwards through the letters of the word.
  const [text, setText] = useState(urlQuery);
  useEffect(() => { setText(urlQuery); }, [urlQuery]);

  const { groups, loading, error, tooShort, retry } = useUniversalSearch(text, {
    type, limit: type ? 20 : 5,       // one group open -> show more of it
  });

  useEffect(() => {
    const id = setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (text.trim()) next.set("q", text.trim()); else next.delete("q");
        return next;
      }, { replace: true });
    }, 400);
    return () => clearTimeout(id);
  }, [text, setParams]);

  const setType = (key) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key) next.set("type", key); else next.delete("type");
      return next;
    });

  // ---- flatten for keyboard navigation ----
  // Arrow keys move through results as ONE list even though they are drawn in
  // groups; a student pressing Down should not have to know where a group ends.
  const flat = useMemo(() => {
    const out = [];
    for (const g of GROUPS) {
      const bucket = groups[g.key];
      if (!bucket?.rows?.length) continue;
      for (const item of bucket.rows) out.push({ item, group: g.key });
    }
    return out;
  }, [groups]);

  const [cursor, setCursor] = useState(-1);
  // -1, not 0: nothing is preselected. Pressing Enter after typing must not
  // open whichever result happened to sort first — that is auto-selecting an
  // identity the student never chose (requirement 2).
  useEffect(() => { setCursor(-1); }, [text, type]);

  const listRef = useRef(null);

  const pick = useCallback((item, group) => {
    if (group === "faculty") {
      // A faculty slug is the only safe handle; the display name is not unique.
      navigate(item.slug ? `/faculty/${item.slug}` : `/browse?q=${encodeURIComponent(item.title)}`);
    } else if (group === "chapter") {
      navigate(`/browse?ch=${item.id}`);
    } else if (group === "playlist") {
      navigate(item.extra?.chapter_id
        ? `/course/${item.id}/chapter/${item.extra.chapter_id}`
        : `/course/${item.id}`);
    } else if (group === "lecture") {
      navigate(item.extra?.chapter_id ? `/browse?ch=${item.extra.chapter_id}` : "/browse");
    } else {
      navigate(`/browse?q=${encodeURIComponent(item.title)}`);
    }
  }, [navigate]);

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      // Only a DELIBERATELY highlighted row is opened.
      if (cursor >= 0 && flat[cursor]) {
        e.preventDefault();
        pick(flat[cursor].item, flat[cursor].group);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setText("");
      setCursor(-1);
    } else if (e.key === "Home" && flat.length) {
      e.preventDefault(); setCursor(0);
    } else if (e.key === "End" && flat.length) {
      e.preventDefault(); setCursor(flat.length - 1);
    }
  };

  // Keep the highlighted row on screen when arrowing past the fold.
  useEffect(() => {
    if (cursor < 0) return;
    const el = listRef.current?.querySelector(`#usr-opt-${cursor}`);
    // Feature-detected, not assumed. scrollIntoView is absent in jsdom and in
    // some embedded webviews, and an unguarded call there throws inside an
    // effect — which unmounts the whole search box over a cosmetic scroll.
    if (typeof el?.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const hasResults = flat.length > 0;
  const activeId = cursor >= 0 ? `usr-opt-${cursor}` : undefined;
  let index = -1;   // running index across groups, matches `flat`

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ---- input ---- */}
      <div className="relative">
        <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`} />
        <input
          autoFocus
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search teachers, chapters, courses…"
          aria-label="Search the library"
          role="combobox"
          aria-expanded={hasResults}
          aria-controls="usr-listbox"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          className={`min-h-11 w-full rounded-xl border ${t.border} ${t.card} ${t.text} py-2 pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-teal-500`}
        />
        {/* Clear button: a 44px tap target, not the 32px the icon implies —
            it sits inside the input, where a mis-tap lands on the text field. */}
        {text && (
          <button
            onClick={() => setText("")}
            aria-label="Clear search"
            className={`absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg ${t.muted} ${t.hover}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ---- type filter, mirrored in the URL ---- */}
      {(hasResults || type) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setType(null)}
            className={`min-h-11 rounded-full border px-3 text-xs ${
              !type
                ? (dark ? "border-neutral-200 bg-neutral-100 text-neutral-900" : "border-neutral-800 bg-neutral-800 text-white")
                : `${t.border} ${t.faint}`
            }`}
          >
            All
          </button>
          {GROUPS.map((g) => {
            const n = groups[g.key]?.total;
            if (!type && !n) return null;         // don't offer an empty group
            return (
              <button
                key={g.key}
                onClick={() => setType(type === g.key ? null : g.key)}
                className={`min-h-11 rounded-full border px-3 text-xs ${
                  type === g.key
                    ? (dark ? "border-neutral-200 bg-neutral-100 text-neutral-900" : "border-neutral-800 bg-neutral-800 text-white")
                    : `${t.border} ${t.faint}`
                }`}
              >
                {g.label}{n ? ` (${n})` : ""}
              </button>
            );
          })}
        </div>
      )}

      {/* ---- states: loading / error / too short / empty / results ---- */}
      <div className="mt-3">
        {tooShort ? (
          <p className={`px-1 py-6 text-center text-sm ${t.muted}`}>
            Type at least {MIN_QUERY} characters.
          </p>
        ) : error ? (
          <div className={`rounded-xl border ${t.border} ${t.card} p-6 text-center`}>
            <AlertTriangle className="mx-auto h-5 w-5 text-amber-500" />
            <p className={`mt-2 text-sm font-medium ${t.text}`}>{error}</p>
            <button
              onClick={retry}
              className={`mt-3 min-h-11 rounded-xl border ${t.border} ${t.hover} px-4 text-sm`}
            >
              Try again
            </button>
          </div>
        ) : loading && !hasResults ? (
          <div className={`flex items-center justify-center gap-2 py-8 text-sm ${t.muted}`}>
            <Loader2 className="h-4 w-4 animate-spin" /> Searching…
          </div>
        ) : text.trim().length >= MIN_QUERY && !hasResults ? (
          <div className={`rounded-xl border border-dashed ${t.border} ${t.card} p-8 text-center`}>
            <p className={`text-sm font-medium ${t.text}`}>
              Nothing matches “{text.trim()}”.
            </p>
            <p className={`mt-1 text-sm ${t.muted}`}>
              Try a teacher’s name, a chapter, or an institute.
            </p>
          </div>
        ) : hasResults ? (
          <div
            ref={listRef}
            id="usr-listbox"
            role="listbox"
            aria-label="Search results"
            aria-busy={loading}
            className={`overflow-hidden rounded-xl border ${t.border} ${t.card}`}
          >
            {GROUPS.map((g) => {
              const bucket = groups[g.key];
              if (!bucket?.rows?.length) return null;
              return (
                <section key={g.key}>
                  <h2 className={`flex min-h-11 items-center justify-between border-b ${t.border} ${t.input} px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide ${t.muted}`}>
                    <span>{g.label}</span>
                    {bucket.total > bucket.rows.length && (
                      <button
                        onClick={() => setType(g.key)}
                        className="min-h-11 px-2 text-[11px] font-medium normal-case tracking-normal"
                        style={{ color: BRAND.teal }}
                      >
                        See all {bucket.total}
                      </button>
                    )}
                  </h2>
                  <ul className={`divide-y ${t.divider}`}>
                    {bucket.rows.map((item) => {
                      index += 1;
                      return (
                        <Row
                          key={`${g.key}-${item.id}`}
                          id={`usr-opt-${index}`}
                          item={item}
                          group={g.key}
                          query={text}
                          active={cursor === index}
                          onPick={pick}
                        />
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
