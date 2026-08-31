// PollsFeatureUnavailable.jsx — what /polls resolves to while the release
// flag is off. A shared poll link explains itself instead of 404ing, which
// matters because sharing is the whole point of the feature.

import { BarChart3 } from "lucide-react";
import { Page } from "../AppShell.jsx";
import { Button, IconTile, Pill, SectionHead, Surface } from "../ui.jsx";

export default function PollsFeatureUnavailable() {
  return (
    <Page crumbs={[{ label: "Polls" }]} width="reading">
      <Surface as="section" className="overflow-hidden" sheen>
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <IconTile icon={BarChart3} tint="var(--accent)" size="lg" />
          <div className="min-w-0 flex-1">
            <Pill tone="accent">Behind a release flag</Pill>
            <SectionHead
              as="h1"
              className="mt-5"
              title="Polls are not open yet"
              lead="The poll pages are built and tested, but voting and comments stay closed until the database module is installed and the owner has signed off on the community rules."
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
