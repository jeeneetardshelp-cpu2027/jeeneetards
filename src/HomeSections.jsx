// HomeSections.jsx — the landing page's sections.
//
// Split out of Home.jsx so the page file stays a readable orchestrator: it
// owns the four data hooks and the search state, these own the layout.
// Nothing in here fetches. Every number and name arrives as a prop from real
// catalogue data, and each section hides itself when its data is absent
// rather than showing a placeholder — the same rule the catalogue follows.

import { Link } from "react-router";
import {
  ArrowRight, ArrowUpRight, Ban, BadgeCheck, Building2, Check, Columns3,
  Compass, Gauge, GraduationCap, IndianRupee, Languages, Layers, ListFilter,
  MonitorPlay, Search, ShieldCheck, Smartphone, Sparkles, Star, Target,
} from "lucide-react";
import { PlaylistCard, ratingDisplay } from "./PlaylistBrowse.jsx";
import { Container } from "./AppShell.jsx";
import {
  Accordion, Button, Eyebrow, IconTile, Marquee, Pill, SectionHead, Skeleton,
  Stat, Surface,
} from "./ui.jsx";
import { Reveal, useParallax, useReveal } from "./motion.jsx";

/* ================================================================ shared */

/**
 * A page section with its own reveal observer, so each one animates from its
 * own scroll position instead of one page-level observer firing everything.
 * `band` alternates the background a half-step off the canvas, which is what
 * gives a long page rhythm without drawing divider lines.
 */
function Section({ id, band = false, tight = false, className = "", children }) {
  const ref = useReveal();
  return (
    <section
      id={id}
      ref={ref}
      className={`relative ${band ? "bg-canvas-2" : ""} ${
        tight ? "py-16 sm:py-20" : "py-20 sm:py-28 lg:py-32"
      } ${className}`}
    >
      {band && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-hairline"
        />
      )}
      <Container>{children}</Container>
    </section>
  );
}

/** Decorative aurora + grid, clipped and faded so no edge is ever visible. */
function Ambience({ grid = true, parallax = 0.06 }) {
  const drift = useParallax(parallax);
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={drift} className="absolute inset-0 aurora anim-glow" />
      {grid && <div className="absolute inset-0 grid-veil mask-fade-b opacity-70" />}
    </div>
  );
}

/* ================================================================== hero */

export function Hero({ searchField, chips, stats }) {
  const ref = useReveal();

  return (
    <section ref={ref} className="relative isolate overflow-hidden">
      <Ambience parallax={0.05} />

      {/* Floating orbs. Three, at different sizes and animation delays, so the
          motion never looks synchronised.

          Positioning note: overflow-hidden clips them VISUALLY but their
          bounding rects still extend past the viewport, and the responsive
          audit measures rects, not paint. So nothing here may sit past the
          RIGHT edge — hence right-0 and a centred bottom orb rather than the
          more natural negative offsets. Negative LEFT is fine; the rule is
          one-sided. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span
          className="anim-float absolute -left-24 top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "var(--aurora-1)", animationDelay: "-2s" }}
        />
        <span
          className="anim-float absolute right-0 top-8 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "var(--aurora-2)", animationDelay: "-7s" }}
        />
        <span
          className="anim-float absolute bottom-0 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: "var(--aurora-3)", animationDelay: "-11s" }}
        />
      </div>

      <Container className="relative">
        <div className="mx-auto max-w-4xl pt-16 pb-12 text-center sm:pt-24 lg:pt-28">
          <Reveal anim="fade" className="flex justify-center">
            <Pill tone="accent" className="gap-2">
              <span
                aria-hidden="true"
                className="anim-glow h-1.5 w-1.5 rounded-full bg-accent"
              />
              Free forever · Independent rankings · JEE, NEET &amp; Boards
            </Pill>
          </Reveal>

          {/* The h1 is the page's single heading and is asserted by test —
              the wording stays, the typography does not. */}
          <h1 className="text-display mt-8 text-ink">
            <Reveal anim="clip" as="span" className="block text-gradient">
              Find the right lecture.
            </Reveal>
            <Reveal anim="clip" as="span" delay={1} className="block text-accent">
              Skip the noise.
            </Reveal>
          </h1>

          <Reveal delay={2}>
            <p className="text-lead mx-auto mt-8 max-w-2xl text-ink-2">
              Thousands of free lectures from India&apos;s best teachers, organised by
              your actual syllabus — and compared side by side, so you can choose
              before you commit twenty hours.
            </p>
          </Reveal>

          <Reveal delay={3} className="mx-auto mt-10 max-w-2xl">
            {searchField}
          </Reveal>

          {chips && (
            <Reveal delay={4} anim="fade" className="mt-8">
              {chips}
            </Reveal>
          )}
        </div>

        {/* The stat rail floats over the hero base — the one place on the page
            where glass is doing real work, sitting between two layers. */}
        {stats?.length > 0 && (
          <Reveal delay={5} anim="scale" className="relative pb-4">
            <Surface
              glass
              sheen
              padded={false}
              // Columns track the item count so the rail is never a 4-up grid
              // holding 3 figures with a dead cell on the end.
              className={`mx-auto grid max-w-4xl grid-cols-2 gap-x-6 gap-y-8 p-8 sm:p-10 ${
                stats.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"
              }`}
            >
              {stats.map((s) => (
                <Stat key={s.label} {...s} />
              ))}
            </Surface>
          </Reveal>
        )}
      </Container>
    </section>
  );
}

/* ========================================================== social proof */

export function SocialProof({ institutes, loading }) {
  const ref = useReveal();
  if (!loading && institutes.length === 0) return null;

  return (
    <section ref={ref} className="relative py-16 sm:py-20">
      <Container>
        <Reveal anim="fade" className="text-center">
          <p className="text-eyebrow text-ink-3">
            Lectures from the channels students already trust
          </p>
        </Reveal>
      </Container>

      <Reveal anim="fade" delay={1} className="mt-10">
        {loading ? (
          <Container>
            <div className="flex flex-wrap justify-center gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-40" rounded="rounded-sm" />
              ))}
            </div>
          </Container>
        ) : (
          <Marquee>
            {institutes.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-2.5 rounded-sm border border-hairline bg-surface px-5 py-3 text-sm font-medium whitespace-nowrap text-ink-2"
              >
                <Building2 aria-hidden="true" className="h-4 w-4 text-ink-3" />
                {name}
              </span>
            ))}
          </Marquee>
        )}
      </Reveal>

      <Container>
        <Reveal anim="fade" delay={2}>
          <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-ink-3">
            An independent directory. Not affiliated with, endorsed by, or sponsored
            by any coaching institute — every lecture stays on its creator&apos;s
            own YouTube channel.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}

/* ============================================================== features */

const FEATURES = [
  {
    icon: Search,
    title: "One search across the whole library",
    body: "Chapters, courses, teachers and individual lectures — ranked, typo-tolerant, and it understands Hindi spellings of English chapter names.",
    span: "lg:col-span-3",
  },
  {
    icon: ListFilter,
    title: "Organised by your syllabus",
    body: "Exam, class, subject, chapter. Filter by teacher, channel, language, course type and difficulty. Only branches that actually have content are offered.",
    span: "lg:col-span-3",
  },
  {
    icon: Columns3,
    title: "Compare before you commit",
    body: "Put up to four courses side by side on seventeen attributes — coverage, pacing, theory focus, prerequisites, duration — with the differences highlighted.",
    span: "lg:col-span-2",
  },
  {
    icon: MonitorPlay,
    title: "A player that stays out of the way",
    body: "YouTube's privacy-enhanced official embed. YouTube may show advertisements and same-channel recommendations; JEENEETARD keeps your course navigation in view.",
    span: "lg:col-span-2",
  },
  {
    icon: BadgeCheck,
    title: "Teachers, verified",
    body: "Faculty names are reviewed editorially and carry their known aliases, so searching a nickname finds the right teacher instead of guessing.",
    span: "lg:col-span-2",
  },
];

export function Features() {
  return (
    <Section id="features" band>
      <SectionHead
        align="center"
        eyebrow="What it does"
        title="Built for one decision: which lecture do I watch next?"
        lead="Every feature exists to shorten the gap between opening a chapter and starting the right lesson."
      />

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i} className={f.span}>
            <Surface lift glow className="flex h-full flex-col">
              <IconTile icon={f.icon} />
              <h3 className="text-h3 mt-6 text-ink">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{f.body}</p>
            </Surface>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================== benefits */

const BENEFITS = [
  {
    icon: Ban,
    title: "Independent rankings. No rabbit holes.",
    before: "Twenty minutes of Shorts before the lesson starts",
    after: "The lesson starts",
  },
  {
    icon: Target,
    title: "No more guessing which course",
    before: "Forty thumbnails, all promising the full chapter",
    after: "Real coverage, pacing and rating side by side",
  },
  {
    icon: Smartphone,
    title: "Nothing to sign up for",
    before: "Create an account to see the syllabus",
    after: "Open it and browse — progress saves on your device",
  },
];

export function Benefits() {
  return (
    <Section id="benefits">
      <SectionHead
        eyebrow="Why students stay"
        title="The same free lectures, minus everything that wastes your time."
        lead="Nothing here is paywalled or gated. The value is in what has been removed."
      />

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {BENEFITS.map((b, i) => (
          <Reveal key={b.title} delay={i}>
            <Surface lift className="flex h-full flex-col">
              <IconTile icon={b.icon} />
              <h3 className="text-h3 mt-6 text-ink">{b.title}</h3>
              <dl className="mt-6 space-y-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    Before
                  </dt>
                  <dd className="mt-1.5 flex items-start gap-2 text-ink-3 line-through decoration-hairline-strong">
                    {b.before}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-accent">
                    Here
                  </dt>
                  <dd className="mt-1.5 flex items-start gap-2 text-ink">
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                    />
                    {b.after}
                  </dd>
                </div>
              </dl>
            </Surface>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* =============================================================== process */

const STEPS = [
  {
    icon: Compass,
    title: "Pick your exam and chapter",
    body: "JEE, NEET or your board. Then class, subject, chapter — four taps, and every option shows how many courses sit behind it.",
    to: "/explore",
    cta: "Start the guided path",
  },
  {
    icon: Columns3,
    title: "Compare what's available",
    body: "See every teacher who covers that chapter, with syllabus coverage, lecture count, language and rating. Select up to four and put them side by side.",
    to: "/browse",
    cta: "Open the catalogue",
  },
  {
    icon: MonitorPlay,
    title: "Watch, in order, without the noise",
    body: "The full lesson sequence sits beside the player. Watched lessons get ticked, and where you stopped is remembered on your device.",
    to: null,
    cta: null,
  },
];

export function Process() {
  return (
    <Section id="process" band>
      <SectionHead
        align="center"
        eyebrow="How it works"
        title="Three steps, about ninety seconds."
        lead="No account, no card, no onboarding flow. You are browsing on the first tap."
      />

      <div className="relative mt-16">
        {/* The connector: a hairline that fades in from the accent at both
            ends. Desktop only — stacked cards on mobile need no rail. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-12 hidden h-px lg:block"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--accent-line) 12%, var(--accent-line) 88%, transparent)",
          }}
        />

        <ol className="grid gap-4 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} as="li" delay={i}>
              <Surface lift glow className="flex h-full flex-col">
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="text-num grid h-12 w-12 shrink-0 place-items-center rounded-md border border-accent-line bg-canvas text-base font-semibold text-accent"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <IconTile icon={s.icon} />
                </div>
                <h3 className="text-h3 mt-6 text-ink">{s.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
                {s.to && (
                  <Button variant="quiet" size="sm" to={s.to} className="mt-6 -ml-4 self-start">
                    {s.cta}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </Button>
                )}
              </Surface>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

/* ================================================= exam entry + catalogue */

const EXAM_TINT = {
  jee: "#24d3c4",
  neet: "#f0709b",
  school: "#5b8def",
  olympiad: "#a78bfa",
};
const EXAM_ICON = {
  jee: GraduationCap,
  neet: Gauge,
  school: Layers,
  olympiad: Sparkles,
};

export function ExamGrid({ exams }) {
  return (
    <Section id="exams">
      <SectionHead
        eyebrow="Start here"
        title="Choose your exam."
        lead="Each track is built from the real syllabus, so you never land on a chapter that has nothing behind it."
        action={
          <Button variant="secondary" size="md" to="/browse">
            Browse everything
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

      <div className="mt-16 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {exams.map((exam, i) => {
          const tint = EXAM_TINT[exam.id] ?? "var(--accent)";
          const Icon = EXAM_ICON[exam.id] ?? GraduationCap;
          const body = (
            <>
              <div className="flex items-start justify-between gap-3">
                <IconTile icon={Icon} tint={tint} size="lg" />
                <Pill tone={exam.available ? "accent" : "quiet"}>
                  {exam.available ? "Live" : "Soon"}
                </Pill>
              </div>
              <h3 className="text-h3 mt-8 text-ink">{exam.label}</h3>
              <p className="mt-2 text-sm text-ink-3">
                {exam.available ? "Class, subject & chapter" : exam.hint}
              </p>
              {exam.available && (
                <p className="text-num mt-6 flex items-baseline gap-1.5 border-t border-hairline pt-5">
                  <span className="text-2xl font-semibold text-ink">{exam.count}</span>
                  <span className="text-sm text-ink-3">courses</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="ml-auto h-4 w-4 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-1 group-hover:text-accent"
                  />
                </p>
              )}
            </>
          );

          return (
            <Reveal key={exam.id} delay={i}>
              {exam.available ? (
                <Surface
                  as={Link}
                  to={`/explore/${exam.id}`}
                  lift
                  glow
                  className="group flex h-full min-h-56 flex-col"
                >
                  {body}
                </Surface>
              ) : (
                <Surface className="flex h-full min-h-56 flex-col opacity-55">{body}</Surface>
              )}
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

/**
 * Real courses from the catalogue, rendered by the one shared course card so
 * home and /browse can never drift. Highest-rated first — that is the honest
 * form of social proof for a directory with no user accounts: the ratings are
 * real, and the count is shown so a 5.0 from two students cannot mislead.
 */
export function TopRated({ courses, loading }) {
  if (!loading && courses.length === 0) return null;

  return (
    <Section id="top-rated" band>
      <SectionHead
        eyebrow="Rated by students"
        title="Choose with numbers, not thumbnails."
        lead="Every course carries its real rating and how many students it came from. Where we do not have the data, the field is simply absent — nothing here is invented."
        action={
          <Button variant="secondary" size="md" to="/browse?sort=rating">
            See all rated courses
            <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        }
      />

      <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72" rounded="rounded-xl" />
            ))
          : courses.map((c, i) => (
              <Reveal key={c.id} delay={i}>
                <PlaylistCard course={c} comparisonEnabled={false} to={`/course/${c.id}`} />
              </Reveal>
            ))}
      </div>

      <Reveal anim="fade" className="mt-10">
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-ink-3">
          {[
            [Star, "Real student ratings"],
            [Gauge, "Syllabus coverage %"],
            [Languages, "Hindi, English, Hinglish"],
            [Layers, "Lecture count & duration"],
          ].map(([Icon, label]) => (
            <li key={label} className="inline-flex items-center gap-2">
              <Icon aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
              {label}
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  );
}

/* ============================================================ statistics */

export function Statistics({ stats }) {
  if (!stats?.length) return null;
  return (
    <Section id="numbers" tight>
      <Reveal anim="scale">
        <Surface
          glow
          sheen
          padded={false}
          className="relative isolate overflow-hidden p-10 sm:p-14"
        >
          <Ambience grid={false} parallax={0.03} />
          <div className="relative grid grid-cols-2 gap-x-8 gap-y-12 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i}>
                <Stat {...s} />
              </Reveal>
            ))}
          </div>
        </Surface>
      </Reveal>
    </Section>
  );
}

/* =============================================================== pricing */

const INCLUDED = [
  "Every course, chapter and lecture in the library",
  "Side-by-side comparison on 17 attributes",
  "Full-library search across chapters, teachers and lectures",
  "Official YouTube player; YouTube may show advertisements and same-channel recommendations",
  "Watch progress and resume — on this device, or across devices if you sign in",
  "Light and dark themes, and it works on a slow connection",
];

const NEVER = [
  "No advertisements or sponsored rankings from JEENEETARD.",
  "No account required to browse, search, compare or watch",
  "No selling or sharing of personal data",
  "No cross-site tracking cookies",
];

export function Pricing() {
  return (
    <Section id="pricing" band>
      <SectionHead
        align="center"
        eyebrow="Pricing"
        title="It is free. That is the whole model."
        lead="Not a trial, not a freemium tier, not free-for-now. There is nothing to buy on this site."
      />

      <Reveal anim="scale" className="mt-16">
        <Surface
          glow
          sheen
          className="relative isolate mx-auto max-w-4xl overflow-hidden border-accent-line"
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
            <div>
              <div className="flex items-end gap-3">
                <IndianRupee aria-hidden="true" className="mb-3 h-8 w-8 text-accent" />
                <span className="text-num text-display-sm text-ink">0</span>
                <span className="mb-3 text-sm text-ink-3">/ forever</span>
              </div>
              <p className="mt-6 text-sm leading-relaxed text-ink-2">
                Lectures are hosted on YouTube by the teachers who made them and stay
                their property. This site is the index on top — curriculum tagging,
                comparison and search. Indexing costs almost nothing to run, so there
                is nothing to charge for.
              </p>
              {/* md, not lg: at this column width two lg buttons wrap onto
                  separate lines at different widths, which reads as a mistake. */}
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="md" to="/explore">
                  Start browsing
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="md" to="/search">
                  Search the library
                </Button>
              </div>
              <p className="mt-5 text-xs text-ink-3">
                No card. No email. No account.
              </p>
            </div>

            <span aria-hidden="true" className="hidden bg-hairline lg:block" />

            <div>
              <p className="text-eyebrow text-ink-3">What&apos;s included</p>
              <ul className="mt-5 space-y-3">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-ink-2">
                    <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="text-eyebrow mt-10 text-ink-3">What we will never do</p>
              <ul className="mt-5 space-y-3">
                {NEVER.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-ink-2">
                    <Ban aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Surface>
      </Reveal>
    </Section>
  );
}

/* =================================================================== faq */

const FAQS = [
  {
    q: "Is it really free? What's the catch?",
    a: "There is no catch and nothing to buy. The videos live on YouTube on their creators' own channels; this site is a curriculum-organised index over them. You are watching the same free lectures, just without hunting for them.",
  },
  {
    q: "Do I need to create an account?",
    a: "No. Browsing, searching, comparing and watching all work without signing in, and they always will. An account only unlocks two optional things: rating a course, and having your watch progress follow you to another device.",
  },
  {
    q: "Is my progress saved, and does it sync?",
    a: "Signed out, your progress is stored in this browser only — clear your browser data and it is gone, and it will not appear on your phone. Signed in, it is also saved to your account and pulled back down when you open a course elsewhere.",
  },
  {
    q: "Do you host or own these lectures?",
    a: "No. We store only YouTube video identifiers and descriptive catalogue information. Playback happens through YouTube's official privacy-enhanced player, and every video remains the property of the teacher or channel that published it.",
  },
  {
    q: "How are courses tagged to chapters?",
    a: "Editorially, course by course, against the actual exam syllabus. Where a lecture's chapter is not known, we leave it untagged rather than guess — that is why a chapter never shows a course that does not genuinely cover it.",
  },
  {
    q: "Where do the ratings come from?",
    a: "From signed-in students, and they are shown with the number of ratings behind them. A course with too few ratings to be meaningful shows the count instead of a score, so a single five-star review can never make a course look better than it is. Nobody pays to rank higher.",
  },
  {
    q: "How do I report something wrong?",
    a: "Every lecture has a report control, and every course page links to it. Use it for a broken or removed video, a lecture filed under the wrong chapter, or a teacher credited incorrectly. Reports go to an editorial queue, not a public thread.",
  },
  {
    q: "Are you affiliated with any coaching institute?",
    a: "No. The directory is independent and not affiliated with, endorsed by, or sponsored by YouTube, Google, or any coaching institute. Institute and teacher names appear only to credit whose lectures you are watching.",
  },
];

export function Faq() {
  return (
    <Section id="faq">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Reveal>
            <Eyebrow className="mb-4">Questions</Eyebrow>
            <h2 className="text-h2 text-ink">Everything students ask first.</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              Still unsure about something? These spell out exactly what this site
              does and does not do.
            </p>
            {/* Deliberately NOT links inside the sentence above: an inline
                anchor in prose is ~17px tall and fails the 44px minimum tap
                target at phone widths. Pulled out as real controls instead. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" to="/terms">
                Terms &amp; Disclaimer
              </Button>
              <Button variant="secondary" size="sm" to="/privacy">
                Privacy Policy
              </Button>
            </div>
          </Reveal>
        </div>
        <Reveal delay={1}>
          <Accordion items={FAQS} />
        </Reveal>
      </div>
    </Section>
  );
}

/* ============================================================ final CTA */

export function FinalCta() {
  const ref = useReveal();
  return (
    <section ref={ref} className="relative pb-24 sm:pb-32">
      <Container>
        <Reveal anim="scale">
          <Surface
            glow
            sheen
            padded={false}
            className="relative isolate overflow-hidden border-accent-line px-8 py-20 text-center sm:px-16 sm:py-24"
          >
            <Ambience parallax={0.04} />
            <div className="relative mx-auto max-w-2xl">
              <Eyebrow className="mb-6">Ready when you are</Eyebrow>
              <h2 className="text-h2 text-ink">
                Your next lecture is two taps away.
              </h2>
              <p className="text-lead mx-auto mt-6 max-w-xl text-ink-2">
                Pick a chapter, see who teaches it best, and start. No sign-up, no
                card — just the lesson. YouTube may show advertisements and
                same-channel recommendations inside its official player.
              </p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" to="/explore">
                  Find a course
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="lg" to="/browse">
                  Browse all courses
                </Button>
              </div>
              <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-ink-3">
                {[
                  [ShieldCheck, "No sponsored rankings or trackers"],
                  [Smartphone, "Works on any phone"],
                  [IndianRupee, "Free forever"],
                ].map(([Icon, label]) => (
                  <li key={label} className="inline-flex items-center gap-2">
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 text-accent" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </Surface>
        </Reveal>
      </Container>
    </section>
  );
}

/* ==================================================== continue watching */

export function ContinueWatching({ entries }) {
  const ref = useReveal();
  if (!entries?.length) return null;

  return (
    <section ref={ref} className="relative pt-4 pb-8">
      <Container>
        <Reveal anim="fade" className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow className="mb-3">Pick up where you left off</Eyebrow>
            <h2 className="text-h3 text-ink">Continue watching</h2>
          </div>
        </Reveal>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {entries.map((e, i) => (
            <Reveal key={e.playlistId} as="li" delay={i}>
              <Surface
                as={Link}
                to={`/course/${e.playlistId}/chapter/${e.chapterId}?v=${e.lastVideoId}`}
                lift
                glow
                padded={false}
                className="group flex h-full items-center gap-4 p-5"
              >
                <IconTile icon={MonitorPlay} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {e.lastVideoTitle || e.courseTitle}
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-3">
                    {e.courseTitle}
                    {e.totalLessons
                      ? ` · lesson ${e.lastPosition ?? "?"} of ${e.totalLessons}`
                      : ""}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-ink-3 transition-transform duration-300 [transition-timing-function:var(--ease-out-expo)] group-hover:translate-x-1 group-hover:text-accent"
                />
              </Surface>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------- utilities */

/**
 * Ranks fetched courses for the "rated by students" strip: only courses
 * whose rating is confident enough to display as a score, best first.
 * ratingDisplay is the shared implementation the card and course page use,
 * so this cannot disagree with what the card then renders.
 */
export function pickTopRated(items, limit = 3) {
  return (items ?? [])
    .map((course) => ({ course, rating: ratingDisplay(course.rating, course.ratingCount) }))
    .filter((row) => row.rating?.kind === "scored")
    .sort((a, b) =>
      b.rating.score - a.rating.score || (b.course.ratingCount ?? 0) - (a.course.ratingCount ?? 0))
    .slice(0, limit)
    .map((row) => row.course);
}

/** Distinct channel names from whatever the catalogue actually returned. */
export function pickInstitutes(items, limit = 8) {
  const seen = [];
  (items ?? []).forEach((course) => {
    const name = course.institute?.trim();
    if (name && !seen.includes(name)) seen.push(name);
  });
  return seen.slice(0, limit);
}
