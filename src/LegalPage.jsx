import { GlobalHeader, Container } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";

const BRAND = { teal: BRAND_TEAL };
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

export default function LegalPage() {
  const { t } = useTheme();
  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "Terms & Disclaimer" }]} />
      <main className="py-10">
        <Container width="reading">
          <h1 className={`text-2xl font-bold ${t.text}`}>
            Terms of Service &amp; Disclaimer
          </h1>
          <p className={`mt-1 text-xs ${t.muted}`}>Effective: 23 July 2026</p>

          <Section title="1. About JEENEETARD">
            <p>
              JEENEETARD is an independent, free educational directory. It
              organises links to publicly available YouTube lessons by exam,
              class, subject, chapter, teacher, and institute so students can
              find useful material more easily.
            </p>
            <p>
              JEENEETARD is not affiliated with, endorsed by, or sponsored by
              YouTube, Google, examination authorities, coaching institutes, or
              content creators unless a relationship is expressly stated.
            </p>
          </Section>

          <Section title="2. Browse-only access">
            <p>
              The current public release is browse-only. Students do not need
              an account, and public account creation, ratings, reviews, and
              issue-report submissions are unavailable. Access to listed
              lessons is not placed behind a payment, survey, or subscription.
            </p>
            <p>
              Students under 18 should use the service with the involvement of
              a parent or guardian, particularly when following links or using
              third-party services.
            </p>
          </Section>

          <Section title="3. YouTube content and intellectual property">
            <p>
              JEENEETARD does not claim ownership of the videos it indexes.
              Videos remain hosted and controlled by YouTube and their
              respective creators. Video content, thumbnails, channel names,
              institute names, trademarks, and logos belong to their respective
              owners.
            </p>
            <p>
              Names and marks are used only to identify and organise the source
              of educational material. Their appearance does not imply a
              partnership, endorsement, or transfer of rights.
            </p>
          </Section>

          <Section title="4. YouTube terms apply">
            <p>
              Embedded playback and links to YouTube are also governed by the{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>{" "}
              and the{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>
              . JEENEETARD uses YouTube's privacy-enhanced embed domain, but
              YouTube and Google may still process information when their
              player or services are used.
            </p>
          </Section>

          <Section title="5. Educational disclaimer">
            <p>
              Listings, filters, classifications, coverage labels, comparisons,
              ratings, and other metadata are provided for discovery only. They
              are not academic, career, legal, or professional advice and do
              not guarantee examination results.
            </p>
            <p>
              Curriculum, eligibility, dates, rules, and syllabi can change.
              Always verify important examination information with the relevant
              official authority. Students and guardians remain responsible for
              deciding whether a lesson is suitable for their needs.
            </p>
          </Section>

          <Section title="6. Availability and accuracy">
            <p>
              Creators may edit, restrict, make private, or remove videos at any
              time. Metadata may be incomplete, outdated, or incorrect despite
              reasonable efforts to review it. JEENEETARD does not guarantee
              uninterrupted availability, completeness, accuracy, or fitness
              for a particular purpose.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>
              You may use JEENEETARD for lawful personal and educational
              purposes. You must not attempt to disrupt the service, bypass
              security controls, submit malicious requests, misuse automated
              access, or use the directory to infringe another person's rights.
            </p>
          </Section>

          <Section title="8. Rights-holder notices and corrections">
            <p>
              A creator, rights holder, or other affected person may request a
              listing review, correction, or removal by emailing{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                {CONTACT}
              </a>
              . Include the relevant URL, the requested action, and enough
              information to understand your relationship to the material.
            </p>
          </Section>

          <Section title="9. Limitation of responsibility">
            <p>
              To the maximum extent permitted by applicable law, JEENEETARD is
              not responsible for losses arising from third-party content,
              unavailable videos, reliance on directory metadata, external
              links, or interruptions outside its reasonable control. Nothing
              in these terms excludes rights or responsibilities that cannot
              lawfully be excluded.
            </p>
          </Section>

          <Section title="10. Changes, law, and contact">
            <p>
              These terms may be updated as the service changes. The effective
              date above will be revised when material changes are published.
              These terms are governed by the laws of India, and disputes are
              subject to the competent courts in Jaipur, Rajasthan, India,
              unless applicable law requires otherwise.
            </p>
            <p>
              Questions about these terms may be sent to{" "}
              <a
                href={`mailto:${CONTACT}`}
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                {CONTACT}
              </a>
              .
            </p>
          </Section>
        </Container>
      </main>
    </div>
  );
}
