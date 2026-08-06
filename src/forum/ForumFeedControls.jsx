import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { forumTopicStyle } from "./forumTopicColors.js";

const SORTS = [
  { id: "hot", label: "Hot" },
  { id: "new", label: "New" },
  { id: "top", label: "Top" },
];

export default function ForumFeedControls({ sort, topic, query, topics, onChange }) {
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);

  const groups = [
    { kind: "academic", label: "Academic" },
    { kind: "non_academic", label: "Preparation & admissions" },
  ];

  return (
    <div className="space-y-5 rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      <form
        role="search"
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          onChange({ query: draft.trim().slice(0, 100) });
          event.currentTarget.querySelector("input")?.blur();
        }}
      >
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        <input
          value={draft}
          maxLength={100}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Search discussions"
          placeholder="Search post titles and bodies"
          className="min-h-11 w-full rounded-md border border-hairline bg-surface-inset py-2 pl-10 pr-11 text-sm text-ink placeholder:text-ink-3 focus:border-accent-line"
        />
        {draft && (
          <button
            type="button"
            aria-label="Clear discussion search"
            onClick={() => { setDraft(""); onChange({ query: "" }); }}
            className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:text-ink"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex rounded-md border border-hairline bg-surface-inset p-1" aria-label="Sort discussions">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sort === option.id}
              onClick={() => onChange({ sort: option.id })}
              disabled={Boolean(query)}
              className={`min-h-11 rounded-sm px-4 text-sm font-medium ${
                sort === option.id ? "bg-surface text-ink shadow-e1" : "text-ink-2 hover:text-ink"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {query && <p className="text-xs text-ink-3">Search results are newest first; comments aren’t searched.</p>}
      </div>

      <div className="space-y-3">
        <div data-allow-horizontal-scroll="true" className="flex max-w-full gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={!topic}
            onClick={() => onChange({ topic: "" })}
            className={`min-h-11 shrink-0 rounded-md border px-4 text-sm font-medium ${
              !topic ? "border-accent-line bg-accent-soft text-accent" : "border-hairline text-ink-2 hover:text-ink"
            }`}
          >
            All topics
          </button>
          {groups.map((group) => {
            const rows = topics.filter((item) => item.kind === group.kind);
            if (!rows.length) return null;
            return (
              <div key={group.kind} className="contents">
                <span className="flex shrink-0 items-center px-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                  {group.label}
                </span>
                {rows.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    aria-pressed={topic === item.slug}
                    title={item.description}
                    onClick={() => onChange({ topic: item.slug })}
                    className="min-h-11 shrink-0 rounded-md border px-4 text-sm font-medium"
                    style={topic === item.slug ? forumTopicStyle(item.slug) : undefined}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
