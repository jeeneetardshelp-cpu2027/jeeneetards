import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";

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
  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Privacy Policy" }]} />
      <main className="py-10">
        <Container width="reading">
          <h1 className={`text-2xl font-bold ${t.text}`}>Privacy Policy</h1>
          <p className={`mt-1 text-xs ${t.muted}`}>
            Effective date: 25 July 2026
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
              . This version is effective 25 July 2026.
            </p>
          </Section>

          <Section title="2. Browsing and account information">
            <p>
              Courses and lessons can be browsed without an account. The code
              also supports student accounts through Supabase Auth. When that
              capability is enabled, authentication can handle an email address and Supabase user identifier,
              session and recovery tokens, and
              security events needed to create, access, recover, and protect an
              account.
            </p>
            <p>
              Public account, rating, review, and report controls are currently
              hidden behind release controls. Records created during authorised
              administration, testing, or an earlier enabled period may still
              exist until they are removed under the approved retention policy.
            </p>
          </Section>

          <Section title="3. Ratings, reviews, and content reports">
            <p>
              The implemented course-rating path can store a student account
              identifier; overall, clarity, and question ratings; difficulty
              and suitability selections; and an optional free-text review.
            </p>
            <p>
              The implemented reporting path can store a report reason, optional free-text note, and reporter account identifier. Free
              text may contain personal information if a person chooses to
              include it, so users should submit only what is necessary.
            </p>
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
              Session storage entries beginning with <code>returnTo:</code> can
              remember the filtered course page to return to. Entries beginning
              with <code>scroll:</code> can remember a page&apos;s scroll
              position. This browser data is not attached to a Supabase account
              by the current frontend and can be removed by clearing site data.
            </p>
          </Section>

          <Section title="5. Providers, video playback, and logs">
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

          <Section title="6. Purposes and sharing">
            <p>
              Information is used to deliver and secure the service, maintain
              sessions, recover accounts, remember on-device preferences and
              progress, receive ratings or reports when enabled, diagnose
              failures, respond to requests, and meet legal obligations.
            </p>
            <p>
              Information may be shared with the providers above when necessary
              to operate their services, when a user directs the sharing, or
              when law requires it. The current frontend contains no
              first-party advertising system or third-party audience analytics
              integration and does not implement the sale of personal
              information.
            </p>
          </Section>

          <Section title="7. Retention and deletion">
            <p>
              Browser data remains until the user or browser removes it.
              Provider logs and database records remain according to provider
              settings and the operator&apos;s approved retention policy. Exact
              retention periods and the public request process are owner inputs
              that must be published before launch; the code does not establish
              those legal periods.
            </p>
          </Section>

          <Section title="8. Students under 18">
            <p>
              The catalogue is likely to be used by students under 18. A parent
              or guardian should be involved when an under-18 student creates an
              account, follows an external link, or submits information. The
              owner must approve the applicable age, consent, and deletion
              process before enabling public account or contribution controls.
            </p>
          </Section>

          <Section title="9. Choices, security, and contact">
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
