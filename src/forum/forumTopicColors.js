const TOPIC_TINTS = ["#3B6FE0", "#CF8526", "#2E9E6B", "#7A5AF0", "#D85B84", "#0F9DA8"];

export function forumTopicTint(slug = "") {
  let hash = 0;
  for (const character of String(slug)) hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  return TOPIC_TINTS[hash % TOPIC_TINTS.length];
}

export function forumTopicStyle(slug) {
  const tint = forumTopicTint(slug);
  return {
    color: `color-mix(in oklab, ${tint} 72%, var(--ink))`,
    background: `color-mix(in oklab, ${tint} 12%, transparent)`,
    borderColor: `color-mix(in oklab, ${tint} 34%, var(--hairline))`,
  };
}
