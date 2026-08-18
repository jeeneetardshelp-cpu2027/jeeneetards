import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import { RELEASE_FEATURES } from "./releaseCapabilities.js";

const BRAND = { teal: BRAND_TEAL };

function Section({ title, children }) {
  const { t } = useTheme();
  return (
    <section className="mt-8">
      <h2 className={`text-lg font-semibold ${t.text}`}>{title}</h2>
      <div className={`mt-2 space-y-3 text-sm leading-relaxed ${t.faint}`}>
        {children}
      </div>
    </section>
  );
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline"
      style={{ color: BRAND.teal }}
    >
      {children}
    </a>
  );
}

export default function PrivacyPolicy() {
  const { t } = useTheme();
  const forumAvailable = RELEASE_FEATURES.forum;
  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Privacy Policy" }]} />
      <main className="py-10">
        <Container width="reading">
          <h1 className={`text-2xl font-bold ${t.text}`}>Privacy Policy</h1>
          <p className={`mt-1 text-xs ${t.muted}`}>
            Effective date: 31 July 2026
          </p>

          <Section title="1. Scope and operator details">
            <p>
              This policy describes the information paths implemented by
              JEENEETARD. The service is operated by JEENEETARD, based in Kota,
              Rajasthan, India, and is governed by the laws of India. Privacy
              questions and requests can be sent to{" "}
              <a
                href="mailto:jeeneetardshelp@gmail.com"
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                jeeneetardshelp@gmail.com
              </a>
              . This version is effective 31 July 2026.
            </p>
          </Section>

          <Section title="2. Browsing and account information">
            <p>
              Courses and lessons can be browsed without an account, and
              browsing is the main way this site is used. Student accounts are
              available through Supabase Auth. Authentication handles an{" "}
              {/* Kept on one source line: legalTruth.test.js matches this
                  phrase against the raw file, so a line-wrap here silently
                  breaks the guard rather than the copy. */}
              email address and Supabase user identifier, session and recovery
              tokens, and security events needed to create, access, recover,
              and protect an account.
            </p>
            <p>
              Student accounts, course ratings, written reviews, and content
              reporting are enabled. An account is only needed to rate a
              course, write a review, report a problem, or sync watch progress
              across devices — never to browse or watch.
            </p>
            {forumAvailable ? (
              <p>An account is also needed to contribute to the student forum.</p>
            ) : (
              <p>The student forum is not publicly available in this release.</p>
            )}
          </Section>

          <Section
            title={forumAvailable
              ? "3. Ratings, reviews, forum posts, and content reports"
              : "3. Ratings, reviews, and content reports"}
          >
            <p>
              The course-rating path stores a student account
              identifier; overall, clarity, and question ratings; difficulty
              and suitability selections; and an optional free-text review.
            </p>
            <p>
              <strong>A written review is published publicly</strong> on that
              course&apos;s page, where anyone can read it and search engines
              may index it. No name, email address, or account identifier is
              ever shown alongside a review. Because the text itself is public,
              please do not include your name, school, batch, contact details,
              or anything else you would not want a stranger to read. A review
              can be replaced at any time by submitting the rating form again.
            </p>
            <p>
              The reporting path stores a report reason, optional free-text note, and reporter account identifier. Free
              text may contain personal information if a person chooses to
              include it, so users should submit only what is necessary.
            </p>
            {forumAvailable && (
              <p>
                Forum posts, answers, and public usernames are visible to anyone and may be indexed by search engines.
                Students should not publish real names, contact details, schools, coaching batches, account credentials,
                or other personal information. Reports and moderation records are restricted to authorized moderators.
              </p>
            )}
          </Section>

          <Section title="4. Information stored in your browser">
            <p>
              Local storage key <code>lecture-library-theme</code> remembers
              the light or dark theme. Local storage key{" "}
              <code>ll_progress_v1</code> can remember course and lesson
              identifiers, titles, watched items, and update times on the
              device.
            </p>
            <p>
              Local storage key <code>ll_player_prefs_v1</code> remembers a
              chosen playback speed. Session storage entries beginning with{" "}
              <code>returnTo:</code> can remember the filtered course page to
              return to. Entries beginning with <code>scroll:</code> can
              remember a page&apos;s scroll position.
            </p>
            <p>
              While signed out, this browser data stays on the device and is
              not attached to any account. It can be removed by clearing site
              data for this site.
            </p>
          </Section>

          <Section title="5. Watch progress saved to your account">
            <p>
              While signed in, watch progress is also saved to the server so it
              follows a student between devices. The database table{" "}
              <code>video_progress</code> stores the Supabase user identifier,
              the course and lesson, the last playback position in seconds, the
              lesson length, whether the lesson has been watched, and the time
              the row was updated. It stores nothing else — no free text, no
              device identifier, no browsing history beyond the lessons opened
              on this site.
            </p>
            <p>
              Database rules restrict every row to the account that created it:
              one student cannot read or change another student&apos;s watch
              progress, and signed-out visitors cannot read any of it.
            </p>
            <p>
              Because this copy lives on the server rather than in the browser,
              <strong> clearing site data does not delete it</strong>. To have
              it removed, email{" "}
              <a
                className="underline"
                href="mailto:jeeneetardshelp@gmail.com"
              >
                jeeneetardshelp@gmail.com
              </a>{" "}
              from the address on the account.
            </p>
          </Section>

          <Section title="6. Providers, video playback, and logs">
            <p>
              Vercel and Supabase deliver the site, database, API, and
              authentication services. They may process standard request and security logs,
              such as IP address, browser information,
              timestamps, requested resources, authentication events, and
              diagnostics, under their own terms and settings.
            </p>
            <p>
              Videos use YouTube&apos;s privacy-enhanced embed domain. Loading a
              player, thumbnail, or direct link can still send technical and
              interaction information to YouTube or Google. Their processing is
              described in the{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>{" "}
              and{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>
              .
            </p>
          </Section>

          <Section title="7. Purposes and sharing">
            <p>
              Information is used to deliver and secure the service, maintain
              sessions, recover accounts, remember on-device preferences and
              progress, receive ratings and reports, diagnose
              failures, respond to requests, and meet legal obligations.
            </p>
            <p>
              Information may be shared with the providers above when necessary
              to operate their services, when a user directs the sharing, or
              when law requires it. The site measures traffic with Vercel's
              aggregate, cookieless page-view analytics: it counts visits and
              page views without cookies, device fingerprinting, cross-site
              tracking, or individual visitor profiles. It also uses
              Vercel Speed Insights, which measures aggregate page-load
              performance (Core Web Vitals) the same cookieless,
              non-identifying way. Beyond that, the current frontend
              contains no first-party
              advertising system or third-party audience analytics
              integration and does not implement the sale of personal
              information.
            </p>
          </Section>

          <Section title="8. Retention and deletion">
            <p>
              Browser data remains until the user or browser removes it.
              Server-side records — an account, its ratings and reviews, its
              content reports, and its <code>video_progress</code> rows —
              remain until deletion is requested. Provider logs remain
              according to provider settings.
            </p>
            <p>
              To delete an account and everything attached to it, email{" "}
              <a
                href="mailto:jeeneetardshelp@gmail.com"
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                jeeneetardshelp@gmail.com
              </a>{" "}
              from the address on the account. Fixed retention periods have not
              been set; this policy will be updated when they are, rather than
              stating a period that is not yet being applied.
            </p>
          </Section>

          <Section title="9. Students under 18">
            <p>
              The catalogue is likely to be used by students under 18. A parent
              or guardian should be involved when an under-18 student creates an
              account, follows an external link, or submits information —
              particularly a written review, which is published publicly.
              {forumAvailable && " The same caution applies to a forum contribution."}
            </p>
            <p>
              Browsing and watching never require an account. A parent or
              guardian can request deletion of an under-18 student&apos;s
              account and everything attached to it by emailing{" "}
              <a
                href="mailto:jeeneetardshelp@gmail.com"
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                jeeneetardshelp@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="10. Choices, security, and contact">
            <p>
              Users can clear local or session storage, avoid loading a video,
              sign out of an enabled account, and use the password-reset flow.
              No internet service can promise absolute security.
            </p>
            <p>
              For access, correction, deletion, withdrawal, privacy, and
              rights-holder requests, contact{" "}
              <a
                href="mailto:jeeneetardshelp@gmail.com"
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                jeeneetardshelp@gmail.com
              </a>
              .
            </p>
          </Section>
        </Container>
      </main>
    </div>
  );
}
