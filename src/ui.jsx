// ui.jsx — the shared primitive layer for student-facing surfaces.
//
// WHY THIS FILE EXISTS
// Before it, the student surface had (counted) sixteen distinct button
// styles, eleven card variants, ten loading treatments and four different
// selected-chip fills, because every primitive lived in adminUI.jsx and was
// admin-only. Each page invented its own. This is the one vocabulary all
// student pages now build from.
//
// Conventions every primitive here honours:
//   • Minimum 44px hit area on every interactive element, at every size —
//     the responsive audit fails any button/a/input under 44px at ≤414px.
//   • Focus comes from the global :focus-visible rule in index.css. Nothing
//     here sets outline-none.
//   • Colour comes from tokens (bg-surface, text-ink, bg-accent …), never a
//     literal hex or a `dark ? … : …` ternary.
//   • Radii come from the token scale: control = md (14px), card = xl (22px).

import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { useMagnetic, usePointerGlow } from "./motion.jsx";

/* ------------------------------------------------------------------ text */

export function Eyebrow({ children, className = "" }) {
  return (
    <p className={`text-eyebrow text-accent ${className}`}>{children}</p>
  );
}

/**
 * The one section header. eyebrow → h2 → lead, with an optional trailing
 * action. `align="center"` for full-width marketing sections, default left
 * for catalogue and app surfaces.
 */
export function SectionHead({
  eyebrow, title, lead, action, align = "left", as: Heading = "h2", className = "", id,
}) {
  const centered = align === "center";
  return (
    <div
      className={`${centered ? "mx-auto max-w-3xl text-center" : "flex flex-wrap items-end justify-between gap-6"} ${className}`}
    >
      <div className={centered ? "" : "max-w-2xl"}>
        {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
        <Heading id={id} className="text-h2 text-ink">{title}</Heading>
        {lead && (
          <p className={`text-lead mt-4 text-ink-2 ${centered ? "mx-auto max-w-2xl" : ""}`}>
            {lead}
          </p>
        )}
      </div>
      {action && !centered && <div className="shrink-0">{action}</div>}
      {action && centered && <div className="mt-8 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- button */

const SIZES = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-6 text-sm",
  lg: "min-h-14 px-8 text-base",
};

const VARIANTS = {
  // The only filled button in the product. Accent is reserved for this.
  primary:
    "bg-accent text-accent-ink font-semibold shadow-accent hover:brightness-110 active:brightness-95",
  // Outlined, sits on any surface, carries a faint glass fill so it reads
  // as a real control on both a card and the bare canvas.
  secondary:
    "border border-hairline-strong bg-surface-2/60 text-ink font-medium hover:border-accent-line hover:bg-surface-2",
  ghost:
    "text-ink-2 font-medium hover:bg-surface-2 hover:text-ink",
  // Text-only, for tertiary links that still need a 44px target.
  quiet:
    "text-accent font-semibold hover:opacity-80",
};

/**
 * Button/Link/anchor in one. Primary gets the magnetic lean and specular
 * sweep; the others stay calm on purpose — if every button moved, none
 * would feel like the primary action.
 */
export const Button = forwardRef(function Button({
  variant = "primary", size = "md", to, href, state, className = "",
  magnetic, children, ...rest
}, forwardedRef) {
  const wantsMagnet = magnetic ?? variant === "primary";
  const magnet = useMagnetic(4);

  const base =
    "group/btn relative inline-flex select-none items-center justify-center gap-2 rounded-md " +
    "transition-[transform,background-color,border-color,box-shadow,filter] duration-300 " +
    "[transition-timing-function:var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-40";

  const cls = `${base} ${SIZES[size] ?? SIZES.md} ${VARIANTS[variant] ?? VARIANTS.primary} ${
    variant === "primary" ? "btn-sweep" : ""
  } ${className}`;

  const body = (
    <>
      {variant === "primary" && <span aria-hidden="true" className="sweep" />}
      {children}
    </>
  );

  const magnetProps = wantsMagnet
    ? { onPointerMove: magnet.onPointerMove, onPointerLeave: magnet.onPointerLeave }
    : {};
  // A forwarded ref wins; otherwise the magnetic ref takes the slot.
  const ref = forwardedRef ?? (wantsMagnet ? magnet.ref : undefined);
  // Keep the magnet working even when a caller forwards its own ref.
  const setRef = (node) => {
    if (wantsMagnet) magnet.ref.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  if (to) {
    return (
      <Link ref={setRef} to={to} state={state} className={cls} {...magnetProps} {...rest}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={setRef} href={href} className={cls} {...magnetProps} {...rest}>
        {body}
      </a>
    );
  }
  return (
    <button ref={ref ? setRef : undefined} type="button" className={cls} {...magnetProps} {...rest}>
      {body}
    </button>
  );
});

/* ------------------------------------------------------------------ card */

/**
 * The one card. `lift` for hover elevation, `glow` for the pointer-tracked
 * rim light, `glass` only for layers that genuinely float over content.
 * `as` keeps semantics correct (li, article, section) without a wrapper.
 */
export function Surface({
  as: Tag = "div", lift = false, glow = false, glass = false, sheen = false,
  padded = true, className = "", children, ...rest
}) {
  const pointer = usePointerGlow();
  const base = glass
    ? "glass rounded-xl"
    : "rounded-xl border border-hairline bg-surface shadow-e1";

  return (
    <Tag
      ref={glow ? pointer.ref : undefined}
      onPointerMove={glow ? pointer.onPointerMove : undefined}
      className={`relative ${base} ${lift ? "hover-lift" : ""} ${glow ? "edge-glow" : ""} ${
        padded ? "p-6 sm:p-8" : ""
      } ${className}`}
      {...rest}
    >
      {sheen && <span aria-hidden="true" className="sheen-layer" />}
      {children}
    </Tag>
  );
}

/** A rounded square that holds an icon. Used across features and cards. */
export function IconTile({ icon: Icon, tint, size = "md", className = "" }) {
  const box = size === "lg" ? "h-14 w-14 rounded-lg" : "h-12 w-12 rounded-md";
  const glyph = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border border-hairline ${box} ${className}`}
      style={
        tint
          ? { background: `color-mix(in oklab, ${tint} 14%, transparent)`, color: tint }
          : { background: "var(--accent-soft)", color: "var(--accent)" }
      }
    >
      <Icon className={glyph} />
    </span>
  );
}

/** Small non-interactive label. `tone="accent"` for the one that matters. */
export function Pill({ tone = "neutral", className = "", children }) {
  const tones = {
    neutral: "border-hairline bg-surface-2 text-ink-2",
    accent: "border-accent-line bg-accent-soft text-accent",
    quiet: "border-hairline text-ink-3",
  };
  // max-w-full + wrapping matters: a flex item defaults to min-width:auto, so
  // a long pill inside a centred flex row pushes past the viewport at 360px
  // and fails the responsive audit's zero-overflow rule.
  return (
    <span
      className={`inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 rounded-sm border px-3 py-1 text-center text-xs font-medium ${
        tones[tone] ?? tones.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ stat */

/**
 * One statistic. Counts up when scrolled into view; `suffix`/`prefix` keep
 * units out of the animated number. `label` explains it, `note` qualifies
 * it — a figure with no qualifier is how dashboards start lying.
 */
export function Stat({
  value, prefix = "", suffix = "", label, note, numeric = true, to = null,
}) {
  // A known measurement must be truthful on the first render. The old
  // count-up animation started every number at zero and waited for an
  // IntersectionObserver. Background tabs, crawlers, and browsers where the
  // observer never fired therefore saw confident but false zeroes forever.
  const numericValue = Number(value);
  const shown = numeric
    ? (Number.isFinite(numericValue) ? numericValue.toLocaleString("en-IN") : "—")
    : value;
  const accessibleValue = shown;
  const Component = to ? Link : "div";

  return (
    <Component
      {...(to ? { to, "aria-label": `${accessibleValue} ${label}. ${note ?? ""}`.trim() } : {})}
      className={`text-center sm:text-left ${
        to
          ? "group/stat -m-3 block min-h-11 rounded-md p-3 transition-colors duration-200 hover:bg-surface-2"
          : ""
      }`}
    >
      <p className="text-num text-display-sm text-ink">
        {prefix}
        {shown}
        {suffix && <span className="text-accent">{suffix}</span>}
      </p>
      <p className={`mt-2 text-sm font-medium text-ink ${to ? "transition-colors group-hover/stat:text-accent" : ""}`}>
        {label}
      </p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </Component>
  );
}

/* -------------------------------------------------------------- accordion */

/**
 * Accessible disclosure. One item open at a time is a deliberate choice for
 * an FAQ: it keeps the section height predictable so the page below it
 * does not jump around as a student reads.
 */
export function Accordion({ items, className = "" }) {
  const [open, setOpen] = useState(null);
  const base = useId();

  return (
    <div className={`divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-surface ${className}`}>
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `${base}-panel-${index}`;
        const buttonId = `${base}-button-${index}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : index)}
                className="flex min-h-14 w-full items-center justify-between gap-6 px-6 py-4 text-left transition-colors duration-200 hover:bg-surface-2"
              >
                <span className="text-base font-medium text-ink">{item.q}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-5 w-5 shrink-0 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] ${
                    isOpen ? "rotate-180 text-accent" : ""
                  }`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-6 pb-6"
            >
              <p className="max-w-2xl text-sm leading-relaxed text-ink-2">{item.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------- states + motion */

/** The one empty state. Replaces three near-identical dashed boxes. */
export function EmptyState({ title, detail, action, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-dashed border-hairline-strong bg-surface p-8 text-center sm:p-12 ${className}`}
    >
      <p className="text-h3 text-ink">{title}</p>
      {detail && <p className="mx-auto mt-3 max-w-md text-sm text-ink-2">{detail}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}

/** The one skeleton block. `h` is a Tailwind height class. */
export function Skeleton({ className = "", rounded = "rounded-md" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-surface-2 ${rounded} ${className}`}
    />
  );
}

/**
 * Edge-to-edge scrolling row for the social-proof strip. Duplicated content
 * plus a 50% translate gives a seamless loop; the copy is aria-hidden so a
 * screen reader hears the names once, not twice.
 *
 * data-allow-horizontal-scroll marks this as an intentional overflow region
 * for the responsive audit, which otherwise fails any element past the
 * viewport edge.
 */
/**
 * Skip-to-content. First focusable element on every page; visually hidden
 * until focused, at which point it becomes a real 44px control.
 */
export function SkipLink({ to = "#main-content" }) {
  return (
    <a
      href={to}
      className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:border focus:border-accent-line focus:bg-surface focus:px-4 focus:text-sm focus:font-medium focus:text-ink focus:shadow-e3"
    >
      Skip to main content
    </a>
  );
}

/** Icon + text metadata, the shape used on every card and detail header. */
export function MetaItem({ icon: Icon, children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-ink-3 ${className}`}>
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </span>
  );
}

/**
 * A value that may legitimately be unknown. The catalogue's honesty rule is
 * that a missing attribute is stated, never guessed — this renders that
 * distinction consistently instead of each surface inventing its own dash.
 */
export function AttributeValue({ value, unverified = false, className = "" }) {
  if (value == null || value === "") {
    return <span className={`text-ink-3 italic ${className}`}>Not provided</span>;
  }
  if (unverified) {
    return (
      <span className={`text-ink-2 ${className}`}>
        {value}
        <span className="ml-1.5 text-xs text-ink-3">(not yet verified)</span>
      </span>
    );
  }
  return <span className={`text-ink ${className}`}>{value}</span>;
}

/* ------------------------------------------------------------------ drawer */

/**
 * The ONE modal layer: mobile filter sheet, comparison tray expansion,
 * anything that floats over the page. Handles what three hand-rolled
 * implementations previously each half-handled:
 *   • focus moves in on open and returns to the trigger on close
 *   • Tab is trapped inside while open
 *   • Escape closes
 *   • the page behind cannot scroll
 *   • aria-modal + a labelled heading, so it is announced as a dialog
 *
 * `side="bottom"` is the phone sheet; `side="right"` is the desktop drawer.
 */
export function Drawer({
  open, onClose, title, side = "bottom", closeLabel = "Close", returnFocusTo,
  footer = null, children, className = "",
}) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const returnTarget = returnFocusTo?.current ?? document.activeElement;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.getClientRects().length > 0);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTarget?.focus?.();
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  const panel = side === "right"
    ? "absolute inset-y-0 right-0 w-full max-w-md border-l"
    : "absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button
        type="button"
        aria-label={`Dismiss ${String(title).toLowerCase()}`}
        tabIndex={-1}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`${panel} flex flex-col overflow-hidden border-hairline bg-surface text-ink shadow-e3 ${className}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 sm:px-6">
          <h2 id={titleId} className="text-sm font-semibold text-ink">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
        {footer && (
          <div className="border-t border-hairline px-4 py-3 sm:px-6">{footer}</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- tabs */

/**
 * Accessible tablist. Roving focus with arrow keys, Home/End, and
 * aria-controls wiring — the pattern the catalogue's Playlists/Lectures
 * switch and the course page both need.
 */
export function Tabs({ tabs, value, onChange, label = "Sections", className = "" }) {
  const base = useId();

  const onKeyDown = useCallback((event) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    let next = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next == null) return;
    event.preventDefault();
    onChange(tabs[next].id);
    document.getElementById(`${base}-tab-${tabs[next].id}`)?.focus();
  }, [tabs, value, onChange, base]);

  return (
    // The key handler lives on the tabs, not the tablist: the tablist itself
    // is never focused under a roving-tabindex pattern, so a listener there
    // would only fire by bubbling — and an interactive role on a
    // non-focusable element is an accessibility lint error, correctly.
    <div
      role="tablist"
      aria-label={label}
      className={`flex items-center gap-1 border-b border-hairline ${className}`}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${base}-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={tab.panelId}
            tabIndex={active ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => onChange(tab.id)}
            className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm transition-colors duration-200 ${
              active
                ? "border-accent font-semibold text-ink"
                : "border-transparent text-ink-2 hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="text-num text-xs text-ink-3">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

/** The one error state: says what failed, and offers the same query again. */
export function ErrorState({ title = "Something went wrong", detail, onRetry, retryLabel = "Try again", className = "" }) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-hairline bg-surface p-8 text-center ${className}`}
    >
      <AlertTriangle aria-hidden="true" className="mx-auto h-5 w-5 text-amber-500" />
      <p className="mt-3 text-base font-semibold text-ink">{title}</p>
      {detail && <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">{detail}</p>}
      {onRetry && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" size="sm" onClick={onRetry}>{retryLabel}</Button>
        </div>
      )}
    </div>
  );
}

/**
 * A quiet inline note. Used for the honesty microcopy this product leans on:
 * "Stored on this device", "Not yet verified", "Coverage not assessed".
 */
export function Note({ icon: Icon, children, className = "" }) {
  return (
    <p className={`flex items-start gap-2 text-xs leading-relaxed text-ink-3 ${className}`}>
      {Icon && <Icon aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

export function Marquee({ children, className = "" }) {
  return (
    <div
      data-allow-horizontal-scroll="true"
      className={`group/marquee relative overflow-hidden mask-fade-x ${className}`}
    >
      <div className="anim-marquee flex w-max items-center gap-4 group-hover/marquee:[animation-play-state:paused]">
        <div className="flex items-center gap-4">{children}</div>
        <div aria-hidden="true" inert className="flex items-center gap-4">{children}</div>
      </div>
    </div>
  );
}
