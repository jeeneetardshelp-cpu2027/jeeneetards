/** Compact relative time for feed metadata. */
export function timeAgo(value, now = Date.now()) {
  const then = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, (now - then.getTime()) / 1000);
  const steps = [[60, "s"], [3600, "m"], [86400, "h"], [2592000, "d"], [31536000, "mo"]];
  if (seconds < 60) return "just now";
  for (let index = 1; index < steps.length; index += 1) {
    const [limit, unit] = steps[index];
    if (seconds < limit) return `${Math.floor(seconds / steps[index - 1][0])}${unit}`;
  }
  return `${Math.floor(seconds / 31536000)}y`;
}

/** Compact large forum scores without losing their sign. */
export function compactNumber(value) {
  const number = Number(value) || 0;
  const absolute = Math.abs(number);
  if (absolute < 1000) return String(number);
  if (absolute < 1_000_000) return `${(number / 1000).toFixed(absolute < 10_000 ? 1 : 0)}k`;
  return `${(number / 1_000_000).toFixed(1)}m`;
}

/** Strip presentation syntax for a fast, non-rendered feed-card preview. */
export function previewText(markdown = "", limit = 220) {
  const text = String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}
