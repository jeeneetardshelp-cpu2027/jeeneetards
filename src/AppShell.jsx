// AppShell.jsx — ONE header, ONE container system, every screen.
//
// Two problems this originally fixed, both found by inspecting the running
// site, and both still enforced by tests:
//
// 1. Three navigation systems. Home, Explore and Dashboard each rendered
//    their own header, so the product read as three separate sites. This is
//    now the ONLY file in the student surface allowed to contain <header>.
//
// 2. Content stranded on large screens. Explore used max-w-4xl (896px). At
//    2560px that is 35% of the viewport with 824px of dead space either side.
//    The container scales in steps instead of stopping dead at one breakpoint:
//      phone    full width, 16px gutters
//      tablet   full width, 24px gutters
//      laptop   up to 1280px
//      desktop  up to 1536px
//      wide     up to 1760px
//
// REDESIGN NOTES
// • The bar is glass and gains its border, shadow and opacity only after the
//   page scrolls, so the hero reads edge-to-edge on arrival.
// • A reading-progress hairline sits on the bottom edge of the bar. It is the
//   only always-on animation in the shell and costs one rAF per scroll frame.
// • The mobile nav is a scrollable segmented rail rather than a four-cell
//   text grid, so "Browse courses" no longer wraps to two lines at 360px.
//   Its label text is unchanged — the audit matches nav items by textContent.

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  AtSign, ChevronRight, LogIn, LogOut, Moon, Search, Sun, X,
} from "lucide-react";
import { useTheme } from "./theme.jsx";
import { useSession } from "./useSession.js";
import { supabase } from "./supabaseClient.js";
import { RELEASE_CAPABILITIES, RELEASE_FEATURES } from "./releaseCapabilities.js";
import { clearProgress } from "./progress.js";
import { clearNotes } from "./notes.js";
import { clearStreak } from "./streak.js";
import { prefersReducedMotion } from "./motion.jsx";

// `width` picks the cap. "reading" stays narrow on purpose (guided steps,
// legal text); "catalogue" is for grids that benefit from more columns.
const WIDTHS = {
  reading: "mx-auto w-full max-w-3xl px-4 sm:px-6",
  catalogue: "mx-auto w-full max-w-[1280px] px-4 sm:px-6 2xl:max-w-[1536px] min-[1900px]:max-w-[1760px]",
};

export function Container({ width = "catalogue", className = "", children }) {
  return <div className={`${WIDTHS[width] ?? WIDTHS.catalogue} ${className}`}>{children}</div>;
}

/** True once the page has scrolled past `offset`. Passive, rAF-free. */
function useScrolled(offset = 8) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);
  return scrolled;
}

/** Reading progress as a 0–1 scaleX on a hairline. */
function ProgressLine() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    if (typeof window.requestAnimationFrame !== "function") return undefined;

    let frame = 0;
    let ticking = false;
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      el.style.transform = `scaleX(${ratio.toFixed(4)})`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-accent"
      style={{ transform: "scaleX(0)" }}
      ref={ref}
    />
  );
}

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md text-sm font-bold"
      style={{
        background: "linear-gradient(145deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--deep)))",
        color: "var(--accent-ink)",
        boxShadow: "var(--shadow-accent)",
      }}
    >
      <span className="sheen-layer" />
      <span className="relative">J</span>
    </span>
  );
}

/**
 * The one global header.
 *  crumbs: [{ label, to } | { label, onClick } | { label }]
 *  search: optional node (context search, filter entry point)
 */
export function GlobalHeader({ crumbs = [], search = null, leading = null, width = "catalogue" }) {
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();
  const { session } = useSession();
  const scrolled = useScrolled();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  // ONE discovery door. "Find a course" (/explore, a guided wizard that just
  // redirects into /browse), "Browse courses" (/browse) and "Search" (/search)
  // were three adjacent pills that all meant "find a lecture" but behaved
  // differently — and on a narrow phone the 6-pill rail pushed the last items
  // off-screen. Now: Home · Courses · Mock tests · Study material. /explore and
  // /search keep their routes (reachable from the home page and the persistent
  // search icon below) and their footer links; they are only dropped from the
  // top nav. See DESIGN note in the commit / next-priorities memory.
  const nav = [
    { label: "Home", to: "/" },
    { label: "Courses", to: "/browse" },
    { label: "Mock tests", to: "/tests" },
    ...(RELEASE_CAPABILITIES.studyMaterials ? [{ label: "Study material", to: "/materials" }] : []),
    ...(RELEASE_FEATURES.forum ? [{ label: "Forum", to: "/forum" }] : []),
  ];
  // "Courses" also owns the guided /explore funnel, which only redirects into
  // /browse — so the student is never on a page with no active nav item.
  const isActive = (to) => {
    if (to === "/") return pathname === "/";
    if (to === "/browse") return pathname.startsWith("/browse") || pathname.startsWith("/explore");
    return pathname.startsWith(to);
  };

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) {
      setSignOutError("Could not sign out. Please try again.");
      return;
    }
    // Only after a SUCCESSFUL sign-out: leaving the device-local watch history
    // behind means the next person on a shared machine sees this student's
    // courses in "Continue watching" and their watched ticks on every lesson
    // list. The server copy is untouched, so it returns on next sign-in. Notes
    // are device-local too and carry the same shared-machine risk.
    clearProgress();
    clearNotes();
    // Same shared-machine reasoning: ll_streak_v1 is un-namespaced, so a
    // school-lab browser must not hand the next student someone else's streak.
    clearStreak();
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-500 [transition-timing-function:var(--ease-out-expo)] ${
        scrolled
          ? "glass border-b border-hairline shadow-e2"
          : "border-b border-transparent"
      }`}
      style={scrolled ? undefined : { backgroundColor: "color-mix(in oklab, var(--canvas) 72%, transparent)", backdropFilter: "blur(12px)" }}
    >
      <Container width={width}>
        <div className="flex min-h-14 items-center gap-2 sm:gap-3">
          {leading}
          <Link
            to="/"
            aria-label="JEENEETARD home"
            className="group/brand flex min-h-11 shrink-0 items-center gap-3 rounded-md px-1"
          >
            <BrandMark />
            <span className="hidden text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink transition-opacity duration-300 group-hover/brand:opacity-80 sm:inline">
              JEENEETARD
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="ml-3 hidden items-center gap-1 lg:flex">
            {nav.map((n) => {
              const active = isActive(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-11 items-center rounded-md px-3.5 text-sm transition-colors duration-300 ${
                    active
                      ? "font-medium text-ink"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-md border border-hairline bg-surface-2"
                    />
                  )}
                  <span className="relative">{n.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Below 640px the row is brand + controls; a search box pushed ~53px
              past the viewport at 360. Hidden here rather than clipped — every
              screen that passes a search also offers it in the page body. */}
          <div className="ml-auto hidden min-w-0 flex-1 sm:block sm:max-w-sm">{search}</div>

          {/* The library search now lives as one persistent icon on EVERY page,
              instead of a nav pill that only reached it from a menu. Sits in the
              controls cluster (right-aligned by the ml-auto box above), visible
              on mobile too where the old pill scrolled off-screen. */}
          {RELEASE_CAPABILITIES.universalSearch && (
            <Link
              to="/search"
              aria-label="Search the library"
              aria-current={pathname.startsWith("/search") ? "page" : undefined}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </Link>
          )}

          {session?.user ? (
            <div className="flex shrink-0 items-center">
              {RELEASE_FEATURES.studentAccounts && pathname !== "/forum/username" && (
                <Link
                  to="/forum/username"
                  aria-label="Forum username"
                  className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
                >
                  <AtSign className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden lg:inline">Forum username</span>
                </Link>
              )}
              <button
                type="button"
                onClick={signOut}
                disabled={signingOut}
                aria-label="Sign out"
                className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          ) : (
            // The front door for an account. Only shown when accounts are a
            // real release feature; carries the current path so signing in
            // returns the student to where they were, not to the homepage.
            // /signin is itself excluded from this, or the return would loop.
            RELEASE_FEATURES.studentAccounts && pathname !== "/signin" && (
              <Link
                to={`/signin?next=${encodeURIComponent(pathname)}`}
                aria-label="Sign in"
                className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-2.5 text-sm text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span className="hidden lg:inline">Sign in</span>
              </Link>
            )
          )}

          <button
            type="button"
            onClick={toggle}
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            aria-pressed={dark}
            className="group/theme relative ml-auto flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink sm:ml-0"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>

        {signOutError && (
          <p role="alert" className="pb-2 text-right text-xs text-rose-500">
            {signOutError}
          </p>
        )}

        {/* Mobile / tablet nav: a scrollable segmented rail. Labels are the
            full strings the audit matches on, so nothing wraps or truncates.
            Marked as an intentional horizontal scroller. */}
        <nav
          aria-label="Primary navigation"
          data-allow-horizontal-scroll="true"
          className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto border-t border-hairline px-4 py-2 lg:hidden"
        >
          {nav.map((n) => {
            const active = isActive(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md border px-4 text-sm transition-colors duration-200 ${
                  active
                    ? "border-accent-line bg-accent-soft font-medium text-accent"
                    : "border-hairline text-ink-2"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {crumbs.length > 0 && (
          // Breadcrumbs scroll horizontally on a phone rather than wrapping
          // into a three-line stack or forcing the page wider than the screen.
          <nav
            aria-label="Breadcrumb"
            data-allow-horizontal-scroll="true"
            className="scrollbar-none -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-2 text-sm sm:mx-0 sm:px-0"
          >
            {crumbs.map((c, i) => (
              <span key={`${c.to ?? c.label}-${i}`} className="flex shrink-0 items-center gap-1">
                {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" />}
                {c.onClick ? (
                  <button
                    // A crumb may carry an explicit handler instead of a URL:
                    // the course page returns to the exact filtered results it
                    // came from, which a hardcoded /browse would discard.
                    onClick={() => c.onClick()}
                    className="flex min-h-11 items-center rounded-md px-1.5 text-ink-2 transition-colors duration-200 hover:text-ink"
                  >
                    {c.label}
                  </button>
                ) : c.to ? (
                  <Link
                    to={c.to}
                    className="flex min-h-11 items-center rounded-md px-1.5 text-ink-2 transition-colors duration-200 hover:text-ink"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    aria-current={i === crumbs.length - 1 ? "page" : undefined}
                    className={`flex min-h-11 items-center px-1.5 ${
                      i === crumbs.length - 1 ? "font-medium text-ink" : "text-ink-2"
                    }`}
                  >
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )}
      </Container>

      <ProgressLine />
    </header>
  );
}

// Standard page frame: global header + a correctly-capped main.
export function Page({ crumbs, search, width = "catalogue", children }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader crumbs={crumbs} search={search} width={width} />
      <main className="py-8 sm:py-12">
        <Container width={width}>{children}</Container>
      </main>
    </div>
  );
}

// Search input styled once, so it looks identical on every screen.
export function HeaderSearch({ value, onChange, placeholder = "Search…", onClear }) {
  return (
    <form
      role="search"
      className="group/hs relative"
      // Results update live as you type; Enter/Go just closes the keyboard.
      onSubmit={(event) => {
        event.preventDefault();
        event.currentTarget.querySelector("input")?.blur();
      }}
    >
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3 transition-colors duration-300 group-focus-within/hs:text-accent"
      />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-h-11 w-full min-w-0 rounded-md border border-hairline bg-surface-2 py-2 pl-10 pr-11 text-sm text-ink outline-none transition-colors duration-300 placeholder:text-ink-3 focus:border-accent-line focus:bg-surface"
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-0 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition-colors duration-200 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </form>
  );
}

export default Page;
