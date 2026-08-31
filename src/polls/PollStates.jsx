import { BarChart3 } from "lucide-react";
import { Button, ErrorState, IconTile, Surface, Skeleton } from "../ui.jsx";

export function PollsLoading({ rows = 3 }) {
  return (
    <div role="status" aria-label="Loading polls" className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Surface key={index} aria-hidden="true">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-6 w-4/5" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-11 w-full" rounded="rounded-md" />
            <Skeleton className="h-11 w-full" rounded="rounded-md" />
            <Skeleton className="h-11 w-2/3" rounded="rounded-md" />
          </div>
        </Surface>
      ))}
      <span className="sr-only">Loading polls…</span>
    </div>
  );
}

export function PollsUnavailable() {
  return (
    <Surface as="section" className="flex flex-col items-start gap-5 sm:flex-row">
      <IconTile icon={BarChart3} tint="var(--accent)" />
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">Polls are temporarily unavailable</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Voting and comments have been paused. Your course library is still available.
        </p>
        <Button to="/browse" variant="secondary" size="sm" className="mt-5">
          Browse courses
        </Button>
      </div>
    </Surface>
  );
}

export function PollsLoadError({ detail, onRetry }) {
  return (
    <ErrorState
      title="Could not load polls"
      detail={detail || "The poll service did not respond. Nothing you have voted on has changed."}
      onRetry={onRetry}
    />
  );
}

export function PollsEmpty({ topicName }) {
  return (
    <Surface as="section" className="text-center">
      <h2 className="text-lg font-semibold text-ink">No polls yet</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-2">
        {topicName
          ? `There are no live polls in ${topicName} right now.`
          : "There are no live polls right now. Be the first to suggest one."}
      </p>
      <Button to="/polls/new" variant="secondary" size="sm" className="mt-6">
        Suggest a poll
      </Button>
    </Surface>
  );
}
