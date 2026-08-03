// =====================================================================
//  TestsPage.jsx — the practice-test directory (/tests).
//
//  A directory of OUTBOUND links, not a test engine. JEENEETARD does not
//  set questions, score attempts or store results; every link opens the
//  platform that actually runs the test. That distinction is stated on
//  the page rather than buried in the terms, because a student who thinks
//  they are starting a test here would be misled.
//
//  All content comes from testPlatforms.js — add sources there, not here.
//
//  Sections with nothing in them still render, with an honest empty
//  state. Showing "JEE Advanced" with no link is better than hiding the
//  section: it tells the student we know it is missing, and it is the
//  same promise-nothing-you-cannot-deliver rule the release flags follow.
// =====================================================================

import { ArrowUpRight } from "lucide-react";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { TEST_SECTIONS, totalTestResources, linkHost } from "./testPlatforms.js";

/** One external test source. The whole card is the link target. */
function ResourceCard({ resource }) {
  const { t } = useTheme();
  const host = linkHost(resource.url);
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex h-full flex-col rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-5 transition`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-sm font-semibold ${t.text}`}>{resource.name}</h3>
          <ArrowUpRight
            className={`mt-0.5 h-4 w-4 shrink-0 ${t.faint} transition group-hover:-translate-y-0.5`}
            aria-hidden="true"
          />
        </div>

        <p className={`mt-2 text-sm leading-relaxed ${t.faint}`}>
          {resource.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {resource.official && (
            // Factual, not promotional: this is the body that conducts the
            // exam. testPlatforms.js restricts the flag to exactly that.
            <span className="inline-flex items-center rounded-sm border border-hairline px-2 py-0.5 text-xs font-medium text-ink-2">
              Official
            </span>
          )}
          <span className={`text-xs ${t.muted}`}>{resource.provider}</span>
          {/* Show the destination before the click, not after. */}
          <span className={`ml-auto text-xs ${t.faint}`}>{host}</span>
        </div>
      </a>
    </li>
  );
}

// Deliberately terse: with five empty sections at launch, a paragraph-long
// explanation repeated five times reads as filler. The reason we leave them
// empty is stated once, under the page heading.
function EmptySection({ label }) {
  const { t } = useTheme();
  return (
    <div
      className={`mt-4 rounded-xl border border-dashed ${t.border} ${t.card} px-5 py-4`}
    >
      <p className={`text-sm ${t.faint}`}>
        Nothing added yet — no checked {label} test source so far.
      </p>
    </div>
  );
}

function Section({ section }) {
  const { t } = useTheme();
  const count = section.resources.length;
  return (
    <section id={section.id} className="mt-10 scroll-mt-24">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={`text-lg font-semibold ${t.text}`}>{section.label}</h2>
        {count > 0 && (
          <span className={`text-xs ${t.muted}`}>
            {count} {count === 1 ? "source" : "sources"}
          </span>
        )}
      </div>
      <p className={`mt-1 text-sm ${t.faint}`}>{section.blurb}</p>

      {count === 0 ? (
        <EmptySection label={section.label} />
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {section.resources.map((r) => (
            <ResourceCard key={r.url} resource={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TestsPage() {
  const { t } = useTheme();
  const total = totalTestResources();

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Practice tests" }]} />
      <main className="py-10">
        <Container>
          <h1 className={`text-2xl font-bold ${t.text}`}>Practice tests</h1>
          <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${t.faint}`}>
            Free mock tests and previous-year papers, grouped by exam. Every
            link opens the platform that actually runs the test —{" "}
            <span className={t.muted}>
              JEENEETARD does not conduct tests or store your marks
            </span>
            , and is not affiliated with any of these organisations. Sections
            are listed even when empty, so you can see what is and is not
            covered yet; a source appears only once its link has been checked.
          </p>

          {/* Jump links: six sections is more than fits comfortably above the
              fold on a phone. Plain anchors, so they work without JS. */}
          <nav aria-label="Test sections" className="mt-6 flex flex-wrap gap-2">
            {TEST_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`inline-flex min-h-9 items-center rounded-sm border ${t.border} px-3 text-xs font-medium ${t.muted} ${t.hover} transition`}
              >
                {s.label}
                {s.resources.length === 0 && (
                  <span className={`ml-1.5 ${t.faint}`}>· soon</span>
                )}
              </a>
            ))}
          </nav>

          {TEST_SECTIONS.map((s) => (
            <Section key={s.id} section={s} />
          ))}

          <p className={`mt-12 max-w-2xl text-xs leading-relaxed ${t.faint}`}>
            {total === 0
              ? "No test sources are listed yet."
              : `${total} test ${total === 1 ? "source" : "sources"} listed.`}{" "}
            These are third-party websites: their questions, scoring, accounts
            and privacy practices are their own, and they may change or remove
            a test at any time. Nothing here is sponsored or paid for.
          </p>
        </Container>
      </main>
    </div>
  );
}
