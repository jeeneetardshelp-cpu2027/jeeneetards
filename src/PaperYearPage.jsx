// PaperYearPage.jsx — ONE exam year of previous-year papers, e.g.
// /materials/jee-main/previous-year-papers/2024.
//
// The landing lists every year at once, so it is a single page competing for
// every "<exam> <year> question paper" search and its ItemList spent all of
// its outbound signal on files hosted elsewhere. This is the child that can
// actually win one of those searches: one year, its sessions and shifts,
// each paper labelled with whether it carries the official answer key or
// worked solutions.
//
// Question papers are grouped by SESSION (papers are per-shift, official
// keys are per-session), and a session whose final answer key is in the
// loaded data gets a direct "Official answer key" link. A session without
// one shows nothing — older years have no keys, and a dead link would be a
// promise the catalogue does not keep.
//
// Which papers exist is the database's answer, never the URL's: a year with
// no reviewed paper renders the honest 404, and the edge middleware serves
// that URL a real HTTP 404 to match.

import { Link, useLocation } from "react-router";
import { ExternalLink, FileCheck2 } from "lucide-react";
import { Page } from "./AppShell.jsx";
import NotFound from "./NotFound.jsx";
import StudyMaterialCard from "./StudyMaterialCard.jsx";
import { StudyMaterialsDirectoryView } from "./StudyMaterialsPage.jsx";
import { useStructuredData } from "./PageMetadata.jsx";
import { paperYearSchemas } from "./studyMaterialsStructuredData.js";
import {
  groupPapersBySession,
  paperYearMeta,
  parsePaperYearPath,
  splitJeeMainPapers,
} from "./studyMaterialLandings.js";
import { useJeeMainPapers } from "./useJeeMainPapers.js";

function PaperGrid({ items, typeLabel }) {
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((paper) => (
        <StudyMaterialCard
          key={paper.id}
          material={typeLabel ? { ...paper, typeLabel } : paper}
        />
      ))}
    </div>
  );
}

function PaperSection({ id, eyebrow, heading, items, typeLabel, emptyDescription }) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-heading`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2
        id={`${id}-heading`}
        className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
      >
        {heading}
      </h2>
      {items.length ? (
        <PaperGrid items={items} typeLabel={typeLabel} />
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-hairline bg-surface p-6">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-3">{emptyDescription}</p>
        </div>
      )}
    </section>
  );
}

/**
 * The question-paper section, grouped by session and paired with each
 * session's official answer key when the loaded data holds one. A year whose
 * titles name no session (older exams) keeps today's flat grid.
 */
function QuestionPapersBySession({ id, eyebrow, heading, groups, emptyDescription }) {
  const hasSessions = groups.some((group) => group.session !== null);
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={`${id}-heading`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
      <h2
        id={`${id}-heading`}
        className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl"
      >
        {heading}
      </h2>
      {groups.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-hairline bg-surface p-6">
          <p className="max-w-2xl text-sm leading-relaxed text-ink-3">{emptyDescription}</p>
        </div>
      )}
      {!hasSessions && groups.map((group) => (
        // One session-less group: the flat grid, exactly as before. Its keys,
        // if any, are the whole year's — the answer-key section below already
        // lists them in full, so no extra affordance is invented here.
        <PaperGrid key="all" items={group.papers} />
      ))}
      {hasSessions && (
        <div className="mt-6 space-y-10">
          {groups.map((group) => (
            <div key={group.session ?? "no-session"}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline pb-3">
                <h3 className="text-xl font-semibold text-ink">
                  {group.session ?? "Session not listed"}
                </h3>
                {group.answerKeys.length > 0 && (
                  <span className="flex flex-wrap items-center gap-x-3">
                    {group.answerKeys.map((answerKey, index) => (
                      <a
                        key={answerKey.id}
                        href={answerKey.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Official answer key: ${answerKey.title}`}
                        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-accent"
                      >
                        <FileCheck2 aria-hidden="true" className="h-4 w-4" />
                        Official answer key{group.answerKeys.length > 1 ? ` ${index + 1}` : ""}
                        <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </span>
                )}
              </div>
              <PaperGrid items={group.papers} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PaperYearPage() {
  const { pathname } = useLocation();
  const route = parsePaperYearPath(pathname);
  const papers = useJeeMainPapers({
    year: route?.year ?? null,
    landing: route?.landing ?? null,
  });
  const groups = splitJeeMainPapers(papers.items);
  const sessionGroups = groupPapersBySession(groups.questionOnly, groups.answerKeys);
  useStructuredData(
    route ? paperYearSchemas(papers.items, route) : [],
    [papers.items, pathname],
  );

  // An unregistered landing or a non-year segment never reaches here through
  // the router, but a hand-typed URL must not fall through to a blank page.
  if (!route) return <NotFound />;

  const { landing, year } = route;
  const exam = landing.examLabel;
  const meta = paperYearMeta(landing, year);

  // A year with nothing reviewed in it is not a page. Say so, exactly as the
  // edge does, instead of publishing an empty year.
  if (!papers.loading && !papers.error && papers.items.length === 0) {
    return <NotFound />;
  }

  return (
    <Page crumbs={[
      { label: "Study material", to: "/materials" },
      { label: landing.crumbLabel, to: landing.path },
      { label: String(year) },
    ]}>
      <section className="rounded-2xl border border-hairline bg-surface px-5 py-8 sm:px-8 sm:py-10">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
          <FileCheck2 aria-hidden="true" className="h-5 w-5" />
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          {exam} · {year}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {meta.heading}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-2">
          {landing.sessionGrammar
            ? `Every reviewed ${exam} ${year} paper on JEENEETARD, listed by session and shift.`
            : `Every reviewed ${exam} ${year} paper on JEENEETARD.`}
          {" "}Each card says exactly what the PDF contains and opens the recorded source.
        </p>
        <Link
          to={landing.path}
          className="mt-5 inline-flex min-h-11 items-center rounded-lg border border-accent-line bg-accent-soft px-4 text-sm font-semibold text-accent"
        >
          All {exam} papers by year
        </Link>
      </section>

      {(papers.loading || papers.error) && (
        <div className="my-8">
          <StudyMaterialsDirectoryView
            {...papers}
            eyebrow={`${exam} ${year}`}
            heading={`${exam} ${year} papers`}
          />
        </div>
      )}

      {!papers.loading && !papers.error && (
        <div className="my-8 space-y-12">
          <QuestionPapersBySession
            id="question-papers"
            eyebrow="Questions only"
            heading={`${exam} ${year} question papers`}
            groups={sessionGroups}
            emptyDescription={`No question-only ${exam} ${year} paper is listed yet.`}
          />
          <PaperSection
            id="official-answer-keys"
            eyebrow="Official result-stage keys"
            heading={`${exam} ${year} official answer keys`}
            items={groups.answerKeys}
            typeLabel="Official answer key"
            emptyDescription={`No official final answer key is listed for ${exam} ${year}. Challenge-stage provisional drafts are excluded.`}
          />
          <PaperSection
            id="papers-with-solutions"
            eyebrow="Questions and worked answers"
            heading={`${exam} ${year} papers with solutions`}
            items={groups.withSolutions}
            typeLabel="Paper with worked solutions"
            emptyDescription="No reviewed paper with worked solutions is listed for this year. Official answer keys are not labelled as worked solutions."
          />
        </div>
      )}
    </Page>
  );
}
