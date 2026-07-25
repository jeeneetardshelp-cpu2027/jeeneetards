// AppShell.jsx — ONE header, ONE container system, every screen.
//
// Two problems this fixes, both found by inspecting the running site:
//
// 1. Three navigation systems. Home, Explore and Dashboard each rendered their
//    own header with different branding and controls, so the product read as
//    three separate sites.
//
// 2. Content stranded on large screens. Explore used max-w-4xl (896px). At
//    2560px that is 35% of the viewport with 824px of dead space either side —
//    measured, not guessed. A fixed 896px cap is right for reading prose and
//    wrong for a catalogue.
//
// The container scales in steps instead of stopping dead at one breakpoint:
//   phone      full width, 16px gutters
//   tablet     full width, 24px gutters
//   laptop     up to 1280px
//   desktop    up to 1536px
//   wide       up to 1760px
// so a 2560px monitor shows a usable page instead of a strip.

import { useNavigate, useLocation } from "react-router";
import {
  ChevronRight, Search, GraduationCap, Moon, Sun, X,
} from "lucide-react";
import { useTheme } from "./theme.jsx";

const BRAND = { navy: "#142A4F", teal: "#13919B" };

// `width` picks the cap. "reading" stays narrow on purpose (guided steps, legal
// text); "catalogue" is for grids that genuinely benefit from more columns.
const WIDTHS = {
  reading: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  catalogue: "mx-auto w-full max-w-[1280px] px-4 sm:px-6 2xl:max-w-[1536px] min-[1900px]:max-w-[1760px]",
};

export function Container({ width = "catalogue", className = "", children }) {
  return <div className={`${WIDTHS[width] ?? WIDTHS.catalogue} ${className}`}>{children}</div>;
}

/**
 * The one global header.
 *  crumbs: [{ label, to }] — rendered inline on desktop, scrollable on mobile
 *  search: optional node (context search, filter entry point)
 */
export function GlobalHeader({ crumbs = [], search = null, leading = null, width = "catalogue" }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { dark, t, toggle } = useTheme();
  const nav = [
    { label: "Home", to: "/" },
    { label: "Find a course", to: "/explore" },
    { label: "Browse courses", to: "/browse" },
  ];

  return (
    <header className={`sticky top-0 z-30 border-b ${t.border} ${dark ? "bg-neutral-950/95" : "bg-white/95"} backdrop-blur`}>
      <Container width={width}>
        <div className="flex min-h-14 items-center gap-2 sm:gap-3">
          {leading}
          <button
            onClick={() => navigate("/")}
            aria-label="JEENEETARD home"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 px-1 font-semibold tracking-tight"
            style={{ color: dark ? "#F5F5F5" : BRAND.navy }}
          >
            <GraduationCap className="h-5 w-5" style={{ color: BRAND.teal }} />
            <span className="hidden sm:inline">JEENEETARD</span>
          </button>

          <nav aria-label="Primary navigation" className="ml-2 hidden items-center gap-1 sm:flex">
            {nav.map((n) => {
              const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
              return (
                <button
                  key={n.to}
                  onClick={() => navigate(n.to)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-2.5 text-sm transition sm:px-3 ${
                    active
                      ? dark ? "bg-neutral-800 font-medium text-neutral-100" : "bg-neutral-100 font-medium text-neutral-900"
                      : `${t.muted} ${t.hover}`
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </nav>

          {/* Below 640px the row is menu + brand + three nav items; adding a
              search box pushed ~53px past the viewport at 360. Hidden here
              rather than clipped — every screen that passes a search also
              offers it in the page body (Explore's context search, the
              catalogue's Filters sheet), so nothing becomes unreachable. */}
          <div className="ml-auto hidden min-w-0 flex-1 sm:block sm:max-w-sm">{search}</div>
          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            aria-pressed={dark}
            className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl ${t.muted} ${t.hover}`}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        <nav aria-label="Primary navigation" className={`grid grid-cols-3 border-t ${t.border} sm:hidden`}>
          {nav.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <button
                key={n.to}
                onClick={() => navigate(n.to)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-0 items-center justify-center px-1 text-center text-xs transition ${
                  active
                    ? dark ? "bg-neutral-800 font-medium text-neutral-100" : "bg-neutral-100 font-medium text-neutral-900"
                    : `${t.muted} ${t.hover}`
                }`}
              >
                {n.label}
              </button>
            );
          })}
        </nav>

        {crumbs.length > 0 && (
          // Breadcrumbs scroll horizontally on a phone rather than wrapping into
          // a three-line stack or forcing the page wider than the screen.
          <nav
            aria-label="Breadcrumb"
            data-allow-horizontal-scroll="true"
            className="scrollbar-none -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 text-sm sm:mx-0 sm:px-0"
          >
            {crumbs.map((c, i) => (
              <span key={`${c.to ?? c.label}-${i}`} className="flex shrink-0 items-center gap-1">
                {i > 0 && <ChevronRight className={`h-3.5 w-3.5 ${t.faint}`} />}
                {c.to || c.onClick ? (
                  <button
                    // A crumb may carry an explicit handler instead of a URL:
                    // the course page returns to the exact filtered results it
                    // came from, which a hardcoded /browse would discard.
                    onClick={() => (c.onClick ? c.onClick() : navigate(c.to))}
                    className={`flex min-h-11 items-center px-1 ${t.muted} ${t.hover}`}
                  >
                    {c.label}
                  </button>
                ) : (
                  <span
                    aria-current={i === crumbs.length - 1 ? "page" : undefined}
                    className={`flex min-h-11 items-center px-1 ${i === crumbs.length - 1 ? `font-semibold ${t.text}` : t.muted}`}
                  >
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </Container>
    </header>
  );
}

// Standard page frame: global header + a correctly-capped main.
export function Page({ crumbs, search, width = "catalogue", children }) {
  const { t } = useTheme();
  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={crumbs} search={search} width={width} />
      <main className="py-6 sm:py-8">
        <Container width={width}>{children}</Container>
      </main>
    </div>
  );
}

// Search input styled once, so it looks identical on every screen.
export function HeaderSearch({ value, onChange, placeholder = "Search…", onClear }) {
  const { t } = useTheme();
  return (
    <div className="relative">
      <Search className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.faint}`} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`min-h-11 w-full min-w-0 rounded-lg border ${t.border} ${t.input} ${t.text} py-2 pl-9 pr-11 text-sm outline-none transition focus:ring-2 focus:ring-teal-500`}
      />
      {value && onClear && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          className={`absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg ${t.faint} ${t.hover}`}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default Page;
