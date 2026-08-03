// =====================================================================
//  TestsPage.jsx — the mock-test directory (/tests).
//
//  A directory of OUTBOUND links, not a test engine. JEENEETARD does not
//  set questions, score attempts or store results; every link opens the
//  platform that actually runs the test. That distinction is stated on
//  the page rather than buried in the terms, because a student who thinks
//  they are starting a test here would be misled.
//
//  All content comes from testPlatforms.js — add sources there, not here.
//
//  Every card carries a cost badge. The directory lists paid products as
//  well as free ones, and a student must be able to see which is which
//  before clicking, not after arriving. See the ON COST note in
//  testPlatforms.js.
//
//  Sections with nothing in them still render, with an honest empty
//  state. Showing "NEET" with no link is better than hiding the section:
//  it tells the student we know it is missing, and it is the same
//  promise-nothing-you-cannot-deliver rule the release flags follow.
// =====================================================================

import { ArrowUpRight } from "lucide-react";
import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import {
  TEST_SECTIONS,
  ACCESS,
  totalTestResources,
  freeTestResources,
  linkHost,
} from "./testPlatforms.js";

/**
 * The cost badge. Deliberately quiet: a dot plus a word, in the same
 * hairline-pill language as the rest of the site. "Paid" gets a stronger
 * border rather than a loud colour — it must be unmissable without looking
 * like a warning, because a paid series is a legitimate choice, not a trap.
 */
function AccessBadge({ access }) {
  const meta = ACCESS[access];
  if (!meta) return null;
  const isPaid = access === "paid";
  const isFree = access === "free";
  return (
    <span
      title={meta.detail}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${
        isPaid
          ? "border-hairline-strong text-ink"
          : "border-hairline text-ink-2"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${
          isFree ? "bg-accent" : isPaid ? "bg-ink-3" : "bg-ink-3/60"
        }`}
      />
      {meta.label}
    </span>
  );
}

/**
 * One external test source. The whole card is the link target.
 *
 * `hover:shadow-e1` is written out in full rather than built from the theme
 * token: Tailwind scans source text for class names, so a class assembled at
 * runtime is never generated and the hover lift would silently do nothing.
 */
function ResourceCard({ resource }) {
  const { t } = useTheme();
  const host = linkHost(resource.url);
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group flex h-full flex-col rounded-xl border ${t.border} ${t.card} ${t.cardHover} p-5 transition hover:shadow-e1`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-sm font-semibold leading-snug ${t.text}`}>
            {resource.name}
          </h3>
          <ArrowUpRight
            className={`mt-0.5 h-4 w-4 shrink-0 ${t.faint} transition group-hover:-translate-y-0.5`}
            aria-hidden="true"
          />
        </div>

        {/* Who runs it, directly under the name — the source is the point. */}
        <p className={`mt-1 text-xs ${t.muted}`}>{resource.provider}</p>

        <p className={`mt-3 flex-1 text-sm leading-relaxed ${t.faint}`}>
          {resource.description}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <AccessBadge access={resource.access} />
          {resource.official && (
            // Factual, not promotional: this is the body that conducts the
            // exam. testPlatforms.js restricts the flag to exactly that.
            <span
              title="Run by the organisation that conducts the exam"
              className="inline-flex items-center rounded-full border border-hairline px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-ink-2"
            >
              Official
            </span>
          )}
          {/* Show the destination before the click, not after. */}
          <span className={`ml-auto text-[11px] ${t.faint}`}>{host}</span>
        </div>
      </a>
    </li>
  );
}

// Deliberately terse: with four empty sections, a paragraph-long explanation
// repeated four times reads as filler. The reason is stated once, up top.
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
            <ResourceCard key={`${section.id}-${r.url}`} resource={r} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TestsPage() {
  const { t } = useTheme();
  const total = totalTestResources();
  const free = freeTestResources();

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Mock tests" }]} />
      <main className="py-10">
        <Container>
          <h1 className={`text-2xl font-bold ${t.text}`}>Mock tests</h1>
          <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${t.faint}`}>
            Mock tests and previous-year papers, grouped by exam. Every link
            opens the platform that actually runs the test —{" "}
            <span className={t.muted}>
              JEENEETARD does not conduct tests or store your marks
            </span>
            , and is not affiliated with any of these organisations. Each card
            shows what it costs before you click; sections are listed even when
            empty, so you can see what is not covered yet.
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
              : `${total} test ${total === 1 ? "source" : "sources"} listed, ${free} of them free to take.`}{" "}
            These are third-party websites: their questions, scoring, pricing,
            accounts and privacy practices are their own, and they may change or
            remove a test at any time. Nothing here is sponsored, affiliated or
            paid for — a paid product is listed on the same terms as a free one.
          </p>
        </Container>
      </main>
    </div>
  );
}
