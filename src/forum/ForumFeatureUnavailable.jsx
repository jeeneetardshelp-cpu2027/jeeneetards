import { MessageCircleQuestion } from "lucide-react";
import { Page } from "../AppShell.jsx";
import { Button, IconTile, Pill, SectionHead, Surface } from "../ui.jsx";

export default function ForumFeatureUnavailable({ released = false }) {
  const title = released ? "Student forum UI is being prepared" : "Student forum is not available yet";
  const detail = released
    ? "The discussion pages are still under review. No student contribution surface is open yet."
    : "The forum is being held behind a release flag until its rules, moderation operations and final launch decision are complete.";

  return (
    <Page crumbs={[{ label: "Student forum" }]} width="reading">
      <Surface as="section" className="overflow-hidden" sheen>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <IconTile icon={MessageCircleQuestion} tint="var(--accent)" size="lg" />
          <div className="min-w-0 flex-1">
            <Pill tone="accent">Behind a release flag</Pill>
            <SectionHead
              as="h1"
              className="mt-5"
              title={title}
              lead={detail}
            />
            <Button to="/browse" variant="secondary" className="mt-8">
              Browse available courses
            </Button>
          </div>
        </div>
      </Surface>
    </Page>
  );
}
