import { GlobalHeader, Container, MAIN_CONTENT_ID } from "./AppShell.jsx";
import { useTheme } from "./theme.jsx";
import { BRAND_TEAL } from "./brandColors.js";
import {
  METHODOLOGY_CONTACT,
  METHODOLOGY_INTRO,
  METHODOLOGY_SECTIONS,
  METHODOLOGY_UPDATED,
} from "./methodologyContent.js";

export default function MethodologyPage() {
  const { t } = useTheme();

  return (
    <div className={`min-h-screen ${t.page} ${t.text}`}>
      <GlobalHeader crumbs={[{ label: "How courses are curated" }]} />
      <main id={MAIN_CONTENT_ID} className="py-10">
        <Container width="reading">
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${t.muted}`}>
            Curation methodology
          </p>
          <h1 className={`mt-2 text-2xl font-bold tracking-tight ${t.text}`}>
            How JEENEETARD curates courses
          </h1>
          <p className={`mt-4 text-sm leading-relaxed ${t.faint}`}>
            {METHODOLOGY_INTRO}
          </p>
          <p className={`mt-2 text-xs ${t.muted}`}>
            Last updated: {METHODOLOGY_UPDATED}
          </p>

          {METHODOLOGY_SECTIONS.map((section) => (
            <section key={section.title} className="mt-8">
              <h2 className={`text-lg font-semibold ${t.text}`}>{section.title}</h2>
              <div className={`mt-2 space-y-3 text-sm leading-relaxed ${t.faint}`}>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </section>
          ))}

          <section className={`mt-8 border-t ${t.border} pt-8`}>
            <h2 className={`text-lg font-semibold ${t.text}`}>Request a correction</h2>
            <p className={`mt-2 text-sm leading-relaxed ${t.faint}`}>
              Send the page URL, the field that appears wrong, and a public source that supports
              the correction to{" "}
              <a
                href={`mailto:${METHODOLOGY_CONTACT}`}
                className="font-medium underline underline-offset-4"
                style={{ color: BRAND_TEAL }}
              >
                {METHODOLOGY_CONTACT}
              </a>
              . Do not send passwords, private student information, or documents containing
              personal data.
            </p>
          </section>
        </Container>
      </main>
    </div>
  );
}
