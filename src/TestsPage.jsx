// =====================================================================
//  TestsPage.jsx — the mock-test directory (/tests).
//
//  A directory of OUTBOUND links, not a test engine. JEENEETARD does not
//  set questions, score attempts or store results; every link opens the
//  platform that actually runs the test. That distinction is stated in
//  the hero rather than buried in the terms, because a student who thinks
//  they are starting a test here would be misled.
//
//  All content comes from testPlatforms.js — add sources there, not here.
//  Icons and tints live HERE and not in that file on purpose: the data
//  module is imported by ogInject.js, which runs in the Vercel Edge
//  runtime, and must never pull in React or lucide.
//
//  Every card carries a cost badge. The directory lists paid products as
//  well as free ones, and a student must see which is which before
//  clicking. See the ON COST note in testPlatforms.js.
//
//  Built from the shared kit (Surface/Pill/IconTile/SectionHead) so this
//  page inherits the same card, elevation and type scale as the rest of
//  the site instead of re-inventing a slightly-different look.
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
import { GlobalHeader, Container } from "./AppShell.jsx";
import { Eyebrow, Pill, Surface, IconTile } from "./ui.jsx";
import { Reveal, useReveal } from "./motion.jsx";
import {
  TEST_SECTIONS,
  ACCESS,
  totalTestResources,
  freeTestResources,
  linkHost,
} from "./testPlatforms.js";

// Exam identity, kept next to the page that draws it. Tints are the same
// restrained palette the catalogue uses for subject spines.
const SECTION_ART = {
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
// collides — the first attempt gave NTA and Quizrr the identical blue inside
// the same JEE Main section, which defeats the whole point of colouring them.
// Walking the data in order guarantees distinct colours until the palette is
// exhausted, and still gives one institute ONE colour everywhere it appears
// (Quizrr reads identically under JEE Main and JEE Advanced).
//
// Every entry is a mid-tone that survives being pulled toward either theme's
// ink; see tintedInk below.
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

const providerTint = (name) => PROVIDER_TINTS.get(name) ?? PROVIDER_PALETTE[0];

/**
 * Blend a brand tint toward the CURRENT theme's ink. A single fixed hex
 * cannot clear 4.5:1 on both a white and a near-black card — the same blue
 * that reads well on dark is too light on light. Mixing toward `--ink`,
 * which flips with the theme, darkens the tint in light mode and lightens
 * it in dark mode while keeping the hue recognisable.
 */
const tintedInk = (tint) => `color-mix(in oklab, ${tint} 72%, var(--ink))`;

const ACCESS_ART = {
  free: { tone: "accent", icon: null },
  account: { tone: "neutral", icon: LogIn },
  paid: { tone: "neutral", icon: IndianRupee },
};

/**
 * The cost badge. `free` is the only one that gets the accent tone — the
 * page's job is to make free options findable, and accent is the site's
 * reserved "this is the good path" colour. `paid` stays neutral with a ₹
 * glyph: unmissable, but not dressed up as a warning, because a paid
 * series is a legitimate choice rather than a trap.
 */
function AccessBadge({ access }) {
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
 * lift, pointer-tracked rim light); the anchor fills it so the entire
 * card is one 44px+ target rather than a small text link.
 */
function ResourceCard({ resource }) {
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

// Deliberately terse: with four empty sections, a paragraph-long explanation
// repeated four times reads as filler. The reason is stated once, in the hero.
function EmptySection({ label }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-hairline px-6 py-5">
      <p className="text-sm text-ink-3">
        Nothing added yet — no checked {label} source so far.
      </p>
    </div>
  );
}

function Section({ section, index }) {
  const art = SECTION_ART[section.id] ?? {};
  const count = section.resources.length;
  return (
    <Reveal
      as="section"
      id={section.id}
      delay={Math.min(index, 4)}
      className="mt-16 scroll-mt-28 first:mt-12"
    >
      <div className="flex items-start gap-4">
        {art.icon && <IconTile icon={art.icon} tint={art.tint} />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-h3 text-ink">{section.label}</h2>
            <span className="text-xs text-ink-3">
              {count === 0
                ? "None yet"
                : `${count} ${count === 1 ? "source" : "sources"}`}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
            {section.blurb}
          </p>
        </div>
      </div>

      {count === 0 ? (
        <EmptySection label={section.label} />
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {section.resources.map((r) => (
            <ResourceCard key={`${section.id}-${r.url}`} resource={r} />
          ))}
        </ul>
      )}
    </Reveal>
  );
}

export default function TestsPage() {
  const total = totalTestResources();
  const free = freeTestResources();
  // REQUIRED, not decoration: `.reveal` ships at opacity 0 and is only made
  // visible when a useReveal() root observes it. Without this ref every
  // <Reveal> below stays invisible and the page renders blank — the markup
  // is all present, so nothing errors and no test that queries the DOM
  // notices. See TestsPage.reveal.test.jsx.
  const revealRoot = useReveal();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader crumbs={[{ label: "Mock tests" }]} />
      <main ref={revealRoot} className="pb-24">
        <Container>
          <Reveal className="pt-10 sm:pt-14">
            <Eyebrow>Practice</Eyebrow>
            <h1 className="text-display-sm mt-4 text-ink">Mock tests</h1>
            <p className="text-lead mt-5 max-w-2xl text-ink-2">
              Full-length papers and previous-year questions, grouped by exam.
              Every link opens the platform that actually runs the test — and
              every card says what it costs before you click.
            </p>

            <div className="mt-8 flex flex-wrap gap-2">
              <Pill>
                {total} {total === 1 ? "source" : "sources"}
              </Pill>
              {free > 0 && <Pill tone="accent">{free} free to take</Pill>}
              {/* The most important thing on the page, stated as plainly as
                  the counts: a student must not think tests run here. */}
              <Pill tone="quiet">Not conducted by JEENEETARD</Pill>
            </div>
          </Reveal>

          {/* Jump links: six sections is more than fits above the fold on a
              phone. Plain anchors, so they work before React boots. */}
          <Reveal delay={1}>
            <nav
              aria-label="Jump to exam"
              className="mt-10 flex flex-wrap gap-2 border-t border-hairline pt-6"
            >
              {TEST_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-hairline px-4 text-sm font-medium text-ink-2 transition hover:border-accent-line hover:text-ink"
                >
                  {s.label}
                  <span className="text-xs text-ink-3">
                    {s.resources.length || "–"}
                  </span>
                </a>
              ))}
            </nav>
          </Reveal>

          {TEST_SECTIONS.map((s, i) => (
            <Section key={s.id} section={s} index={i} />
          ))}

          <Reveal className="mt-20">
            <Surface className="max-w-3xl">
              <Eyebrow>Before you click</Eyebrow>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                {total === 0
                  ? "No test sources are listed yet."
                  : `${total} test ${total === 1 ? "source" : "sources"} listed, ${free} of them free to take.`}{" "}
                These are third-party websites. Their questions, scoring,
                pricing, accounts and privacy practices are their own, and any
                of them may change or withdraw a test at any time.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                JEENEETARD does not conduct these tests, does not store your
                marks, and is not affiliated with the organisations listed.
                Nothing here is sponsored — a paid product is listed on exactly
                the same terms as a free one, and never ranked above it for
                money.
              </p>
            </Surface>
          </Reveal>
        </Container>
      </main>
    </div>
  );
}
