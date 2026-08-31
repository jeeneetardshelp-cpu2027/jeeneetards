// =====================================================================
//  ExamTestsPage.jsx — one exam's mock tests (/tests/:examId).
//
//  Split out of the single /tests page because "free NEET mock test" and
//  "JEE Main previous year paper" are different searches: one page with
//  six anchored sections could only ever have one title, one description
//  and one canonical, so it competed for all of those queries at once and
//  won none of them cleanly.
//
//  An unknown :examId renders NotFound rather than an empty shell — the
//  edge middleware gives that URL a real HTTP 404 to match.
//
//  Cards, badges and the cost rules are shared with the hub via
//  testCards.jsx; the data still comes from testPlatforms.js.
// =====================================================================

import { useParams, Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { Eyebrow, Pill, Surface } from "./ui.jsx";
import { Reveal, useReveal } from "./motion.jsx";
import { useStructuredData } from "./PageMetadata.jsx";
import NotFound from "./NotFound.jsx";
import { OnSiteResourceCard, ResourceCard, SECTION_ART } from "./testCards.jsx";
import { RELEASE_CAPABILITIES } from "./releaseCapabilities.js";
import { ON_SITE_TEST_RESOURCES } from "./studyMaterialLandings.js";
import { testPageSchemas } from "./testPageStructuredData.js";
import {
  TEST_SECTIONS,
  findTestSection,
  sectionIsAllFree,
  isFreeToTake,
} from "./testPlatforms.js";

export default function ExamTestsPage() {
  const { examId } = useParams();
  const section = findTestSection(examId);
  // REQUIRED: `.reveal` ships at opacity 0 and is only shown once a
  // useReveal() root observes it. See TestsPage.reveal.test.jsx.
  const revealRoot = useReveal();
  useStructuredData(testPageSchemas(`/tests/${examId ?? ""}`), [examId]);

  // Hooks run before this branch on purpose — bailing out earlier would
  // change the hook order between a known and an unknown exam.
  if (!section) return <NotFound />;

  const art = SECTION_ART[section.id] ?? {};
  const Icon = art.icon;
  const count = section.resources.length;
  const free = section.resources.filter(isFreeToTake).length;
  const allFree = sectionIsAllFree(section);
  const others = TEST_SECTIONS.filter((s) => s.id !== section.id);
  // Papers this site itself curates for the same exam (today: the JEE Main
  // paper landing). Gated on the same release flag as the /materials routes,
  // so the card can never point at a not-yet-released page.
  const onSite = RELEASE_CAPABILITIES.studyMaterials
    ? ON_SITE_TEST_RESOURCES[section.id] ?? null
    : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <GlobalHeader
        crumbs={[{ label: "Mock tests", to: "/tests" }, { label: section.label }]}
      />
      <main ref={revealRoot} className="pb-24">
        <Container>
          <Reveal className="pt-10 sm:pt-14">
            <div className="flex items-center gap-3">
              {Icon && (
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-hairline"
                  style={{
                    background: `color-mix(in oklab, ${art.tint} 14%, transparent)`,
                    color: art.tint,
                  }}
                >
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <Eyebrow>Mock tests</Eyebrow>
            </div>

            <h1 className="text-display-sm mt-4 text-ink">
              {allFree ? `Free ${section.label} mock tests` : `${section.label} mock tests`}
            </h1>
            <p className="text-lead mt-5 max-w-2xl text-ink-2">{section.blurb}</p>

            <div className="mt-8 flex flex-wrap gap-2">
              {count > 0 && (
                <Pill>
                  {count} {count === 1 ? "source" : "sources"}
                </Pill>
              )}
              {free > 0 && <Pill tone="accent">{free} free to take</Pill>}
              <Pill tone="quiet">Not conducted by JEENEETARD</Pill>
            </div>
          </Reveal>

          {count === 0 && !onSite ? (
            <Reveal delay={1}>
              <Surface className="mt-10 max-w-2xl">
                <h2 className="text-h3 text-ink">Nothing listed yet</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink-2">
                  No {section.label} test source has been checked and added so
                  far. Rather than filling this page with links that go
                  nowhere, it stays empty until there is a real one.
                </p>
                <Link
                  to="/tests"
                  className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent hover:opacity-80"
                >
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                  See every exam
                </Link>
              </Surface>
            </Reveal>
          ) : (
            <Reveal delay={1}>
              <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {section.resources.map((r) => (
                  <ResourceCard key={r.url} resource={r} />
                ))}
                {onSite && <OnSiteResourceCard resource={onSite} />}
              </ul>
            </Reveal>
          )}

          {/* Internal links to the sibling exams: a student on the NEET page
              may want JEE, and it gives each exam page a crawlable path to
              every other one instead of stranding them. */}
          <Reveal className="mt-16">
            <p className="text-eyebrow text-ink-3">Other exams</p>
            <nav aria-label="Other exams" className="mt-4 flex flex-wrap gap-2">
              {others.map((s) => (
                <Link
                  key={s.id}
                  to={`/tests/${s.id}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-hairline px-4 text-sm font-medium text-ink-2 transition hover:border-accent-line hover:text-ink"
                >
                  {s.label}
                  <span className="text-xs text-ink-3">
                    {s.resources.length || "–"}
                  </span>
                </Link>
              ))}
            </nav>
          </Reveal>

          <Reveal className="mt-16">
            <Surface className="max-w-3xl">
              <Eyebrow>Before you click</Eyebrow>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                {/* Stays literally true when the grid above carries the one
                    card that does NOT leave the site. */}
                {onSite
                  ? 'Apart from the card marked "On JEENEETARD", these are third-party websites.'
                  : "These are third-party websites."}{" "}
                Their questions, scoring, pricing, accounts and privacy
                practices are their own, and any of them may change or
                withdraw a test at any time.
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
