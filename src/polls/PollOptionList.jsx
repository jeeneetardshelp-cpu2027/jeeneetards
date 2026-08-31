// PollOptionList.jsx — the thing students actually touch.
//
// Two layouts from one component, chosen by the data rather than by a prop:
// if any option carries a picture the whole poll renders as a picture grid,
// otherwise as full-width rows. A poll with pictures on some options and not
// others would look broken either way, so the grid wins and a text-only
// option simply shows its label on the tinted placeholder.
//
// RESULTS ARE NOT HIDDEN HERE. The server sends vote_count: null until the
// viewer has voted (poll_results_visible in polls_v1.sql). This component
// renders what it is given — it never receives numbers it must remember not
// to draw.

import { Check } from "lucide-react";
import { sharePercent } from "./pollFormatting.js";

function ResultBar({ share, chosen }) {
  const width = Math.max(0, Math.min(100, share ?? 0));
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 rounded-md transition-[width] duration-700 [transition-timing-function:var(--ease-out-expo)]"
      style={{
        width: `${width}%`,
        background: chosen
          ? "color-mix(in oklab, var(--accent) 26%, transparent)"
          : "color-mix(in oklab, var(--accent) 10%, transparent)",
      }}
    />
  );
}

function OptionRow({ option, resultsVisible, disabled, busy, onChoose }) {
  const chosen = option.viewer_choice === true;
  const share = sharePercent(option.share);

  return (
    <li>
      <button
        type="button"
        disabled={disabled || busy}
        aria-pressed={chosen}
        onClick={() => onChoose(option)}
        className={`group/opt relative flex min-h-12 w-full items-center gap-3 overflow-hidden rounded-md border px-4 py-3 text-left transition-[border-color,background-color] duration-300 ${
          chosen ? "border-accent-line" : "border-hairline"
        } ${disabled ? "cursor-default" : "hover:border-accent-line"} ${
          resultsVisible ? "bg-surface" : "bg-surface-2/60"
        }`}
      >
        {resultsVisible && <ResultBar share={share} chosen={chosen} />}
        <span
          aria-hidden="true"
          className={`relative grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
            chosen ? "border-accent bg-accent text-accent-ink" : "border-hairline-strong"
          }`}
        >
          {chosen && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
        <span className={`relative min-w-0 flex-1 text-sm ${chosen ? "font-semibold text-ink" : "text-ink"}`}>
          {option.label}
        </span>
        {resultsVisible && share != null && (
          <span className="text-num relative shrink-0 text-sm font-semibold tabular-nums text-ink-2">
            {share}%
          </span>
        )}
      </button>
    </li>
  );
}

function OptionCard({ option, resultsVisible, disabled, busy, onChoose }) {
  const chosen = option.viewer_choice === true;
  const share = sharePercent(option.share);

  return (
    <li>
      <button
        type="button"
        disabled={disabled || busy}
        aria-pressed={chosen}
        onClick={() => onChoose(option)}
        className={`group/opt flex w-full flex-col overflow-hidden rounded-md border text-left transition-[border-color,transform] duration-300 [transition-timing-function:var(--ease-out-expo)] ${
          chosen ? "border-accent-line" : "border-hairline"
        } ${disabled ? "cursor-default" : "hover:border-accent-line hover:-translate-y-0.5"}`}
      >
        <span className="relative block aspect-video w-full overflow-hidden bg-surface-inset">
          {option.image_url ? (
            <img
              src={option.image_url}
              alt=""
              loading="lazy"
              // A picture option whose host 404s must not leave a broken-image
              // glyph where a choice should be; the label below still names it.
              onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
              className="h-full w-full object-cover transition-transform duration-500 group-hover/opt:scale-[1.03]"
            />
          ) : (
            <span className="grid h-full w-full place-items-center px-4 text-center text-sm font-medium text-ink-3">
              {option.label}
            </span>
          )}
          {chosen && (
            <span
              aria-hidden="true"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-ink shadow-e2"
            >
              <Check className="h-4 w-4" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="relative flex min-h-12 items-center gap-2 overflow-hidden px-3 py-2.5">
          {resultsVisible && <ResultBar share={share} chosen={chosen} />}
          <span className={`relative min-w-0 flex-1 text-sm ${chosen ? "font-semibold text-ink" : "text-ink"}`}>
            {option.label}
          </span>
          {resultsVisible && share != null && (
            <span className="text-num relative shrink-0 text-sm font-semibold tabular-nums text-ink-2">
              {share}%
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export default function PollOptionList({
  poll, busy = false, disabled = false, onChoose, labelledBy,
}) {
  const options = Array.isArray(poll?.options) ? poll.options : [];
  const hasPictures = options.some((option) => Boolean(option.image_url));
  const resultsVisible = poll?.results_visible === true;
  const Item = hasPictures ? OptionCard : OptionRow;

  return (
    <ul
      aria-labelledby={labelledBy}
      className={hasPictures
        ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
        : "space-y-3"}
    >
      {options.map((option) => (
        <Item
          key={option.id}
          option={option}
          resultsVisible={resultsVisible}
          disabled={disabled}
          busy={busy}
          onChoose={onChoose}
        />
      ))}
    </ul>
  );
}
