// =====================================================================
//  TestsPage.jsx — the mock-test hub (/tests).
//
//  A directory of OUTBOUND links, not a test engine. JEENEETARD does not
//  set questions, score attempts or store results; every link opens the
//  platform that actually runs the test. That is stated in the hero
//  rather than buried in the terms, because a student who thinks they are
//  starting a test here would be misled.
//
//  This page used to list every source under six anchored sections. Each
//  exam now has its own page (/tests/:examId, see ExamTestsPage.jsx) so
//  it can carry its own title, description and canonical — "free NEET
//  mock test" and "JEE Main previous year paper" are different searches.
//  What is left here is the index: one card per exam, linking onward.
//
//  Exams with nothing in them still get a card. Showing "Olympiad — none
//  yet" tells a student what is not covered, which is the same
//  promise-nothing-you-cannot-deliver rule the release flags follow.
// =====================================================================

import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { Eyebrow, Pill, Surface, IconTile } from "./ui.jsx";
import { Reveal, useReveal } from "./motion.jsx";
import { useStructuredData } from "./PageMetadata.jsx";
import { SECTION_ART, providerTint, tintedInk } from "./testCards.jsx";
import { testPageSchemas } from "./testPageStructuredData.js";
import {
  TEST_SECTIONS,
  totalTestResources,
  freeTestResources,
  isFreeToTake,
} from "./testPlatforms.js";

/** One exam, linking to its own page. */
function ExamCard({ section }) {
  const art = SECTION_ART[section.id] ?? {};
  const count = section.resources.length;
  const free = section.resources.filter(isFreeToTake).length;
  // Institutes are the recognisable part — show who is inside before the
  // student commits to a click, each in its own colour.
  const providers = [...new Set(section.resources.map((r) => r.provider))];

  return (
    <Surface as="li" lift glow padded={false} className="overflow-hidden">
      <Link
        to={`/tests/${section.id}`}
        className="group flex h-full flex-col p-6"
      >
        <div className="flex items-start gap-4">
          {art.icon && <IconTile icon={art.icon} tint={art.tint} />}
          <div className="min-w-0 flex-1">
            <h2 className="text-h3 text-ink">{section.label}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {count === 0
                ? "None yet"
                : `${count} ${count === 1 ? "source" : "sources"}`}
            </p>
          </div>
        </div>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-2">
          {section.blurb}
        </p>

        {providers.length > 0 && (
          <p className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-[0.7rem] font-semibold uppercase tracking-[0.09em]">
            {providers.map((p) => (
              <span key={p} style={{ color: tintedInk(providerTint(p)) }}>
                {p}
              </span>
            ))}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {free > 0 && <Pill tone="accent">{free} free</Pill>}
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-accent">
            {count === 0 ? "See status" : "View tests"}
            <ArrowRight
              aria-hidden="true"
              className="h-4 w-4 transition group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Link>
    </Surface>
  );
}

export default function TestsPage() {
  const total = totalTestResources();
  const free = freeTestResources();
  // REQUIRED: `.reveal` ships at opacity 0 and is only shown once a
  // useReveal() root observes it. See TestsPage.reveal.test.jsx.
  const revealRoot = useReveal();
  useStructuredData(testPageSchemas("/tests"), []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader crumbs={[{ label: "Mock tests" }]} />
      <main ref={revealRoot} className="pb-24">
        <Container>
          <Reveal className="pt-10 sm:pt-14">
            <Eyebrow>Practice</Eyebrow>
            <h1 className="text-display-sm mt-4 text-ink">Mock tests</h1>
            <p className="text-lead mt-5 max-w-2xl text-ink-2">
              Full-length papers and previous-year questions, one page per
              exam. Every link opens the platform that actually runs the test —
              and every card says what it costs before you click.
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

          <Reveal delay={1}>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {TEST_SECTIONS.map((s) => (
                <ExamCard key={s.id} section={s} />
              ))}
            </ul>
          </Reveal>

          <Reveal className="mt-16">
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
