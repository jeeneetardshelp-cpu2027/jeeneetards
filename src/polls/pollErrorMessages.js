// pollErrorMessages.js — turn a Postgres error into something a 15-year-old
// can act on. Every string here corresponds to a raise in polls_v1.sql.

export function pollActionError(error, action = "save this") {
  const code = String(error?.code ?? "");
  const detail = String(error?.cause?.message ?? error?.message ?? "").toLowerCase();

  if (/rate limit/.test(detail)) {
    if (/submit/.test(detail)) {
      return "You can send two polls a day, so an admin can actually read them. Try again tomorrow.";
    }
    if (/comment/.test(detail)) return "That is a lot of comments in a short time. Take a break and try again later.";
    return "You have done that several times just now. Please wait a little and try again.";
  }
  if (/after 10 minutes/.test(detail)) {
    return "Brand new accounts can take part after 10 minutes. Have a look around in the meantime.";
  }
  if (/temporarily suspended/.test(detail)) {
    return "This account is currently suspended from posting. You can still read and report content.";
  }
  if (/approved image host/.test(detail)) {
    return "Picture links must come from an approved host (YouTube thumbnails or Wikimedia). Paste a different link, or leave it as a text option.";
  }
  if (/between 2 and 6 options/.test(detail)) return "A poll needs between 2 and 6 options.";
  if (/every option needs a label/.test(detail)) return "Give every option a short label, even the ones with a picture.";
  if (/choose a subject/.test(detail)) return "Choose a subject for this poll.";
  if (/needs a short reason/.test(detail)) return "Give the student a short reason for the rejection.";
  if (/already been reviewed/.test(detail)) return "Someone has already reviewed this poll.";
  if (/not accepting votes|has closed/.test(detail)) return "This poll has closed, so votes are no longer counted.";
  if (/does not belong to this poll/.test(detail)) return "That option is not part of this poll. Reload the page and try again.";
  if (/only edit your own|only delete your own/.test(detail)) return "You can only change your own comment.";
  if (/username/.test(detail) || code === "22023") {
    if (/username/.test(detail)) return "Choose a public username before taking part.";
    return "Check the length of what you wrote, then try again.";
  }
  if (/not open|unavailable/.test(detail) || code === "55000") {
    return "Polls are paused right now. Nothing you wrote has been lost.";
  }
  if (/sign in|jwt|permission/.test(detail) || code === "42501") {
    return "Your session may have expired. Sign in again and try once more.";
  }
  if (/fetch|network|timeout/.test(detail)) {
    return "Could not reach the server. Check your connection and try again.";
  }
  return `Could not ${action}. Please try again.`;
}
