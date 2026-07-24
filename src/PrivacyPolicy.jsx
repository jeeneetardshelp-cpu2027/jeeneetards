import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";

const BRAND = { teal: "#13919B" };
const CONTACT = "rajesh@gmail.com";

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
          <p className={`mt-1 text-xs ${t.muted}`}>Effective: 23 July 2026</p>

          <Section title="1. Scope and operator">
            <p>
              This policy explains how JEENEETARD, based in Jaipur, Rajasthan,
              India, handles information in its current browse-only educational
              directory. It applies to the public website and not to the
              independent services operated by YouTube, Google, Supabase, or
              Vercel.
            </p>
          </Section>

          <Section title="2. Browse-only release">
            <p>
              You can browse courses and lessons without creating an account.
              Public student account creation, ratings, reviews, and report
              submissions are disabled in this release. JEENEETARD does not ask
              public visitors for a name, age, school, phone number, or email
              address to use the directory.
            </p>
          </Section>

          <Section title="3. Information handled when you use the site">
            <p>
              <strong>Technical requests:</strong> Vercel hosts the website and
              Supabase provides database and API services. Those providers may
              receive standard request information such as IP address, browser
              type, timestamps, requested pages, and security diagnostics when
              they deliver or protect the service.
            </p>
            <p>
              <strong>Messages you choose to send:</strong> if you email us, we
              receive your email address, message, and any information you
              include. Please do not send unnecessary personal information.
            </p>
            <p>
              JEENEETARD currently uses no first-party advertising system and
              no third-party audience analytics service. We do not sell or rent
              personal information.
            </p>
          </Section>

          <Section title="4. Information stored only in your browser">
            <p>
              The site uses local browser storage to remember your light or
              dark theme and your on-device watch progress, including recently
              watched courses and lesson identifiers. Session storage may keep
              your return URL and scroll position during navigation. This
              information remains in your browser and is not uploaded to a
              JEENEETARD account. You can remove it by clearing this site's
              browser data.
            </p>
          </Section>

          <Section title="5. YouTube and Google">
            <p>
              Videos use YouTube's privacy-enhanced embed domain. Loading or
              using the player, thumbnails, or a direct YouTube link can still
              send technical and interaction information to YouTube or Google.
              Their processing is governed by the{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>{" "}
              and the{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>
              . Privacy-enhanced mode limits personalisation associated with an
              embedded view, but it does not make YouTube part of JEENEETARD or
              place YouTube's processing under our control.
            </p>
          </Section>

          <Section title="6. Why information is used">
            <p>
              The limited information described above is used to deliver and
              secure the directory, diagnose failures, remember preferences on
              your device, respond to messages, handle rights-holder requests,
              and comply with legal obligations. We do not use it to make
              automated decisions about students or to target advertising.
            </p>
          </Section>

          <Section title="7. Children and students under 18">
            <p>
              JEENEETARD serves exam-preparation and school students, including
              users who may be under 18. For that reason, the public release is
              browse-only and does not offer student accounts or contribution
              forms. Users under 18 should use the service with a parent or
              guardian's involvement.
            </p>
            <p>
              We do not intentionally request personal information from a child
              through the website. If a child sends personal information to the
              contact address, a parent or guardian may ask us to delete it.
            </p>
          </Section>

          <Section title="8. Sharing, transfers, and retention">
            <p>
              Information is shared only as needed with service providers such
              as Vercel and Supabase, with YouTube or Google when their content
              is loaded or used, when you direct us to share it, or when law
              requires it. These providers may process information outside your
              state or country under their own terms and safeguards.
            </p>
            <p>
              Browser-stored preferences and progress remain until you clear
              them or the browser removes them. Hosting and security logs are
              retained according to operational need and provider settings.
              Emails are retained only as long as reasonably needed to answer,
              document, or resolve the request, subject to legal obligations.
            </p>
          </Section>

          <Section title="9. Your choices and requests">
            <p>
              You may block or clear browser storage, decline to load a video,
              or open YouTube under your own browser settings. For information
              that you sent directly by email, you may request access,
              correction, deletion, or withdrawal of consent where applicable.
              We may need enough information to verify and process a request.
            </p>
          </Section>

          <Section title="10. Security and policy changes">
            <p>
              We use reasonable technical and organisational safeguards, but no
              internet service can promise absolute security. This policy will
              be updated before enabling accounts, student submissions,
              analytics, advertising, or another materially different data use.
              The effective date will be revised when material changes are
              published.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For privacy questions, requests, or concerns, contact JEENEETARD
              at{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                {CONTACT}
              </a>
              . The responsible contact is based in Jaipur, Rajasthan, India.
            </p>
          </Section>
        </Container>
      </main>
    </div>
  );
}
