import { GlobalHeader, Container, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";

const BRAND = { teal: BRAND_TEAL };

function Section({ id, title, children }) {
  const { t } = useTheme();
  return (
    <section id={id} className="mt-8 scroll-mt-24">
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
      <main id={MAIN_CONTENT_ID} className="py-10">
        <Container width="reading">
          <h1 className={`text-2xl font-bold ${t.text}`}>
            Terms of Service &amp; Disclaimer
          </h1>
          <p className={`mt-1 text-xs ${t.muted}`}>
            Effective date: 31 August 2026
          </p>

          <Section title="1. About the service">
            <p>
              JEENEETARD is an independent educational directory that organises
              links to publicly available YouTube lessons by exam, class,
              subject, chapter, teacher, and institute.
            </p>
            <p>
              It is not affiliated with, endorsed by, or sponsored by YouTube,
              Google, examination authorities, coaching institutes, or content
              creators unless a relationship is expressly stated.
            </p>
          </Section>

          <Section title="2. Accounts and contributions">
            <p>
              Browsing does not require an account. Account, rating, review,
              and report controls are enabled. Users must protect their
              credentials, provide accurate information, and sign out on a
              shared device. A written review is published publicly on the
              course page, without any name attached.
            </p>
            <p>
              Students under 18 should use the service with a parent or
              guardian&apos;s involvement, particularly when creating an
              account, submitting information, or following external links.
            </p>
          </Section>

          <Section id="forum-rules" title="3. Student forum rules">
            <p>
              The student forum is operating as a limited closed beta. Anyone
              can read visible discussions, but only invited signed-in members
              can contribute during this phase. Forum posts, answers, and
              public usernames can be read by anyone and may be indexed by
              search engines. Use a pseudonym and do not publish real names,
              contact details, schools, coaching batches, account credentials,
              or another person&apos;s private information.
            </p>
            <p>
              Keep discussions connected to JEE, NEET, school study, exam
              preparation, or student wellbeing. Do not bully, harass,
              threaten, impersonate, sexually exploit, discriminate against,
              or deliberately endanger another person. Spam, scams, illegal
              material, malicious links, doxxing, instructions for wrongdoing,
              and content that infringes another person&apos;s rights are also
              prohibited.
            </p>
            <p>
              Use the report control for unsafe or rule-breaking content.
              Self-harm or suicide concerns receive a distinct urgent review
              path, but JEENEETARD is not an emergency or crisis service and
              moderation is not real-time. If someone may be in immediate
              danger, contact local emergency services and a trusted adult.
            </p>
            <p>
              Moderators may hide, restore, lock, remove, or dismiss reported
              content and may temporarily suspend forum participation for up
              to 365 days. Enforcement considers context and repeated conduct;
              it does not guarantee that every post is reviewed before
              publication. A moderation decision can be questioned at{" "}
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

          <Section title="4. YouTube content and intellectual property">
            <p>
              JEENEETARD does not claim ownership of indexed videos. Videos
              remain hosted and controlled by YouTube and their respective
              creators. Video content, thumbnails, channel and institute names,
              trademarks, and logos belong to their respective owners.
            </p>
            <p>
              Embedded playback and links are also governed by the{" "}
              <ExternalLink href="https://www.youtube.com/t/terms">
                YouTube Terms of Service
              </ExternalLink>{" "}
              and{" "}
              <ExternalLink href="https://policies.google.com/privacy">
                Google Privacy Policy
              </ExternalLink>
              .
            </p>
          </Section>

          <Section title="5. Educational disclaimer">
            <p>
              Listings, filters, classifications, coverage labels, ratings, and
              metadata are for discovery only. They are not academic, career,
              legal, or professional advice and do not guarantee examination
              results.
            </p>
            <p>
              Curriculum, eligibility, dates, rules, and syllabi can change.
              Check important examination information with the relevant
              official authority. Students and guardians remain responsible for
              deciding whether a lesson is suitable.
            </p>
          </Section>

          <Section title="6. Availability and accuracy">
            <p>
              Creators may edit, restrict, make private, or remove videos at any
              time. Metadata may be incomplete, outdated, or incorrect despite
              reasonable review. The service does not promise uninterrupted
              availability, completeness, accuracy, or fitness for a particular
              purpose.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>
              Use the service only for lawful personal and educational
              purposes. Do not disrupt the service, bypass security controls,
              submit malicious requests, misuse automated access, impersonate
              another person, or infringe another person&apos;s rights.
            </p>
          </Section>

          <Section title="8. Notices, responsibility, and owner details">
            <p>
              Listing corrections, rights-holder notices, privacy requests, and
              support can be sent to{" "}
              <a
                href="mailto:jeeneetardshelp@gmail.com"
                className="font-medium underline"
                style={{ color: BRAND.teal }}
              >
                jeeneetardshelp@gmail.com
              </a>
              .
            </p>
            <p>
              To the extent allowed by applicable law, the service is not
              responsible for losses caused by third-party content, unavailable
              videos, reliance on directory metadata, external links, or events
              outside its reasonable control. Rights and responsibilities that
              cannot lawfully be excluded remain unaffected.
            </p>
            <p>
              This service is operated by JEENEETARD, based in Kota, Rajasthan,
              India. These Terms are governed by the laws of India, and any
              dispute is subject to the courts of Kota, Rajasthan. This
              version is effective 31 August 2026.
            </p>
          </Section>
        </Container>
      </main>
    </div>
  );
}
