// =====================================================================
//  testCards.jsx — the card, badges and colour rules shared by the
//  mock-test hub (/tests) and each exam page (/tests/:examId).
//
//  Extracted when /tests split into per-exam pages: two copies of a card
//  drift, and the cost badge is the one thing on these pages that must
//  never be wrong in one place and right in the other.
//
//  Icons and tints live HERE rather than in testPlatforms.js on purpose:
//  that data module is imported by ogInject.js, which runs in the Vercel
//  Edge runtime and must never pull in React or lucide.
// =====================================================================

import {
  ArrowUpRight,
  Atom,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  IndianRupee,
  LogIn,
  Sigma,
  Stethoscope,
  Trophy,
} from "lucide-react";
import { Pill, Surface } from "./ui.jsx";
import { TEST_SECTIONS, ACCESS, linkHost } from "./testPlatforms.js";

// Exam identity. Tints are the restrained palette the catalogue uses for
// subject spines.
export const SECTION_ART = {
  "jee-main": { icon: Atom, tint: "#3B6FE0" },
  "jee-advanced": { icon: Sigma, tint: "#7A5AF0" },
  neet: { icon: Stethoscope, tint: "#D85B84" },
  olympiad: { icon: Trophy, tint: "#CF8526" },
  "class-10": { icon: BookOpen, tint: "#2E9E6B" },
  "class-12": { icon: GraduationCap, tint: "#0F6F78" },
};

// The institute's own colour, used for the kicker above each card's title —
// the same coloured-kicker idiom the catalogue uses for subjects.
//
// Assigned by order of first appearance, NOT by hashing the name. A hash
// collides: the first attempt gave NTA and Quizrr the identical blue inside
// the same JEE Main section, which defeats the point of colouring them.
// Walking the data in order keeps providers distinct while one institute
// still gets ONE colour everywhere it appears.
const PROVIDER_PALETTE = [
  "#3B6FE0", "#CF8526", "#2E9E6B", "#7A5AF0", "#D85B84", "#0F9DA8",
];

const PROVIDER_TINTS = (() => {
  const map = new Map();
  for (const section of TEST_SECTIONS) {
    for (const r of section.resources) {
      if (!map.has(r.provider)) {
        map.set(r.provider, PROVIDER_PALETTE[map.size % PROVIDER_PALETTE.length]);
      }
    }
  }
  return map;
})();

export const providerTint = (name) =>
  PROVIDER_TINTS.get(name) ?? PROVIDER_PALETTE[0];

/**
 * Blend a brand tint toward the CURRENT theme's ink. A single fixed hex
 * cannot clear 4.5:1 on both a white and a near-black card — the same blue
 * that reads well on dark is too light on light. Mixing toward `--ink`,
 * which flips with the theme, darkens the tint in light mode and lightens
 * it in dark mode while keeping the hue recognisable.
 */
export const tintedInk = (tint) => `color-mix(in oklab, ${tint} 72%, var(--ink))`;

const ACCESS_ART = {
  free: { tone: "accent", icon: null },
  account: { tone: "neutral", icon: LogIn },
  paid: { tone: "neutral", icon: IndianRupee },
};

/**
 * The cost badge. `free` is the only one that gets the accent tone — making
 * free options findable is these pages' job, and accent is the site's
 * reserved "this is the good path" colour. `paid` stays neutral with a ₹
 * glyph: unmissable, but not dressed up as a warning, because a paid series
 * is a legitimate choice rather than a trap.
 */
export function AccessBadge({ access }) {
  const meta = ACCESS[access];
  const art = ACCESS_ART[access];
  if (!meta || !art) return null;
  const Icon = art.icon;
  return (
    <Pill tone={art.tone} className="whitespace-nowrap">
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {meta.label}
    </Pill>
  );
}

/**
 * One external test source. The whole card is the link target.
 *
 * Surface carries the site's card treatment (hairline, elevation, hover
 * lift, pointer-tracked rim light); the anchor fills it so the entire card
 * is one large target rather than a small text link.
 */
export function ResourceCard({ resource }) {
  const host = linkHost(resource.url);
  const tint = providerTint(resource.provider);
  return (
    <Surface as="li" lift glow padded={false} className="overflow-hidden">
      {/* A thin spine in the institute's colour — the catalogue's course
          cards carry the same marker, so a source card reads as a sibling
          of a course card rather than a different species. */}
      <span
        aria-hidden="true"
        className="block h-1 w-full"
        style={{ background: tint }}
      />
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col p-6"
      >
        {/* Who runs it, ABOVE the title and in its own colour: the institute
            is what a student recognises and scans for first. */}
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.09em]"
          style={{ color: tintedInk(tint) }}
        >
          {resource.provider}
        </p>

        <div className="mt-2 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug text-ink">
            {resource.name}
          </h3>
          <ArrowUpRight
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 transition group-hover:-translate-y-0.5 group-hover:text-accent"
          />
        </div>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-3">
          {resource.description}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <AccessBadge access={resource.access} />
          {resource.official && (
            // Factual, not promotional: this is the body that conducts the
            // exam. testPlatforms.js restricts the flag to exactly that.
            <Pill className="whitespace-nowrap">
              <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
              Official
            </Pill>
          )}
          {/* Show the destination before the click, not after. */}
          <span className="ml-auto text-xs text-ink-3">{host}</span>
        </div>
      </a>
    </Surface>
  );
}
