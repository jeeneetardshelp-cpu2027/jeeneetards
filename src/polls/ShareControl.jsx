// ShareControl.jsx — share a poll.
//
// The control itself now lives in src/ShareControl.jsx, shared with the course
// watch page. This wrapper keeps the poll wording and the poll URL helper at
// the path the polls code has always imported them from.

import ShareControl from "../ShareControl.jsx";

/** Absolute URL for a poll, safe to call during a test render with no window. */
export function pollShareUrl(slug, origin = typeof window === "undefined" ? "" : window.location.origin) {
  return `${origin}/polls/${slug}`;
}

export default function PollShareControl(props) {
  return <ShareControl {...props} subject="this poll" />;
}
