import { MessageCircleQuestion } from "lucide-react";
import { Button, ErrorState, IconTile, Surface } from "../ui.jsx";

export function ForumLoading({ kind = "feed" }) {
  const rows = kind === "thread" ? 3 : 5;
  return (
    <div role="status" aria-label={`Loading forum ${kind}`} className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Surface key={index} aria-hidden="true" className="animate-pulse">
          <div className="h-4 w-32 rounded bg-surface-2" />
          <div className="mt-4 h-6 w-4/5 rounded bg-surface-2" />
          <div className="mt-4 h-4 w-full rounded bg-surface-2" />
          <div className="mt-2 h-4 w-2/3 rounded bg-surface-2" />
        </Surface>
      ))}
      <span className="sr-only">Loading discussions…</span>
    </div>
  );
}
export function ForumUnavailable() {
  return (
    <Surface as="section" className="flex flex-col items-start gap-5 sm:flex-row">
      <IconTile icon={MessageCircleQuestion} tint="var(--accent)" />
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-ink">Discussions are temporarily unavailable</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Reading and posting have been paused. Your course library is still available.
        </p>
        <Button to="/browse" variant="secondary" size="sm" className="mt-5">
          Browse courses
        </Button>
      </div>
    </Surface>
  );
}

export function ForumLoadError({ detail, onRetry }) {
  return (
    <ErrorState
      title="Could not load discussions"
      detail={detail || "The discussion service did not respond. Your filters have not been changed."}
      onRetry={onRetry}
    />
  );
}

export function ForumEmpty({ query, topicName }) {
  const detail = query
    ? `No post title or body matched “${query}”. Comments are not included in search.`
    : topicName
      ? `There are no visible posts in ${topicName} yet.`
      : "There are no visible discussions yet.";
  return (
    <Surface as="section" className="text-center">
      <h2 className="text-lg font-semibold text-ink">No discussions found</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-ink-2">{detail}</p>
    </Surface>
  );
}
