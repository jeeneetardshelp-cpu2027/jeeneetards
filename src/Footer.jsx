// =====================================================================
//  Footer.jsx  —  site footer with links + compliance microcopy
//
//  Navigation uses real <Link> anchors (crawlable <a href>), so this
//  component must render inside the app's router.
//
//  REDESIGN NOTES
//  • It used to be a hardcoded navy slab (#142A4F, text-white/80) with no
//    theme awareness, so in dark mode a blue block sat under a near-black
//    page. It is now token-driven and correct in both themes.
//  • It used max-w-6xl (1152px) while every page used the 1280px Container,
//    so the footer's left edge never lined up with the content above it.
//    It now uses the same Container.
// =====================================================================

import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Container } from "./AppShell.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";

const EXPLORE = [
  { label: "Home", to: "/" },
  { label: "Find a course", to: "/explore" },
  { label: "Browse courses", to: "/browse" },
  ...(RELEASE_CAPABILITIES.universalSearch
    ? [{ label: "Search the library", to: "/search" }]
    : []),
];

const LEGAL = [
  { label: "Terms & Disclaimer", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
];

function FooterLink({ to, children }) {
  return (
    <li>
      <Link
        to={to}
        className="group/fl inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm text-ink-2 transition-colors duration-200 hover:text-ink"
      >
        {children}
        <ArrowUpRight
          aria-hidden="true"
          className="h-3.5 w-3.5 opacity-0 transition-opacity duration-200 group-hover/fl:opacity-60"
        />
      </Link>
    </li>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-hairline bg-canvas-2">
      {/* A single wash rising from the bottom edge, and the same grid used on
          the landing sections, faded out before it reaches the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{
            background:
              "radial-gradient(52rem 20rem at 50% 120%, var(--aurora-1), transparent 68%)",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-40 grid-veil mask-fade-b opacity-60" />
      </div>

      <Container className="relative">
        <div className="grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-16 lg:py-20">
          {/* Brand + what this is */}
          <div>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-3 rounded-md"
              aria-label="JEENEETARD home"
            >
              <span
                aria-hidden="true"
                className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md text-sm font-bold"
                style={{
                  background:
                    "linear-gradient(145deg, var(--accent), color-mix(in oklab, var(--accent) 55%, var(--deep)))",
                  color: "var(--accent-ink)",
                }}
              >
                <span className="sheen-layer" />
                <span className="relative">J</span>
              </span>
              <span className="text-[1.0625rem] font-semibold tracking-[-0.03em] text-ink">
                JEENEETARD
              </span>
            </Link>
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-2">
              An independent, free directory that helps students find quality
              educational lectures, organised by the syllabus they are actually
              studying. We link to videos — we don&apos;t host them.
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-3">
              YouTube may show advertisements and same-channel recommendations
              inside its official player.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {["No sponsored rankings", "No account", "₹0 forever"].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-sm border border-hairline px-3 py-1 text-xs font-medium text-ink-3"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h2 className="text-eyebrow text-ink-3">Explore</h2>
            <ul className="mt-4">
              {EXPLORE.map((item) => (
                <FooterLink key={item.to} to={item.to}>{item.label}</FooterLink>
              ))}
            </ul>
          </div>

          {/* Legal + attribution */}
          <div>
            <h2 className="text-eyebrow text-ink-3">Good to know</h2>
            <ul className="mt-4">
              {LEGAL.map((item) => (
                <FooterLink key={item.to} to={item.to}>{item.label}</FooterLink>
              ))}
            </ul>
            <p className="mt-6 max-w-xs text-xs leading-relaxed text-ink-3">
              Videos play through YouTube&apos;s official embedded player and remain
              the property of their respective creators. This site is not affiliated
              with, endorsed by, or sponsored by YouTube, Google, or any coaching
              institute.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-hairline py-8 text-xs text-ink-3 sm:flex-row sm:items-center">
          <p>© {year} JEENEETARD. All institute names &amp; logos belong to their owners.</p>
          <p>Powered by the YouTube embedded player.</p>
        </div>
      </Container>
    </footer>
  );
}
