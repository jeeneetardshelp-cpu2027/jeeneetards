// pollFormatting.js — poll-specific text helpers.
//
// timeAgo and compactNumber are deliberately NOT re-implemented here; they are
// imported from the forum module, which already has them under test. Two
// copies of "3h ago" is how a product starts disagreeing with itself.
export { compactNumber, timeAgo } from "../forum/forumFormatting.js";

/**
 * "Closes in 3 days" / "Closes in 4 hours" / "Closed".
 * Returns null for a poll with no closing date, so the caller renders nothing
 * rather than an empty pill.
 */
export function closesIn(value, now = Date.now()) {
  if (!value) return null;
  const end = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  const seconds = (end.getTime() - now) / 1000;
  if (seconds <= 0) return "Closed";
  if (seconds < 3600) {
    const minutes = Math.max(1, Math.round(seconds / 60));
    return `Closes in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return `Closes in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = Math.round(seconds / 86400);
  return `Closes in ${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * A share for display. The database sends a numeric with one decimal; a
 * student does not want to read "33.3%" of a four-person poll, but they do
 * want 33.3 to stay 33% rather than becoming 33.30000000000001.
 */
export function sharePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(number);
}

/** "1 vote" / "12 votes", never "1 votes". */
export function voteLabel(count) {
  const number = Number(count) || 0;
  return `${number.toLocaleString("en-IN")} ${number === 1 ? "vote" : "votes"}`;
}

/** "1 comment" / "12 comments". */
export function commentLabel(count) {
  const number = Number(count) || 0;
  return `${number.toLocaleString("en-IN")} ${number === 1 ? "comment" : "comments"}`;
}
