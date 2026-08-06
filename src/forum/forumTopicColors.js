const TOPIC_TINTS = ["#3B6FE0", "#CF8526", "#2E9E6B", "#7A5AF0", "#D85B84", "#0F9DA8"];
const LAUNCH_TOPIC_TINTS = Object.freeze({
  physics: TOPIC_TINTS[0],
  chemistry: TOPIC_TINTS[1],
  mathematics: TOPIC_TINTS[2],
  biology: TOPIC_TINTS[3],
  strategy: TOPIC_TINTS[4],
  "exam-admissions": TOPIC_TINTS[5],
});

export function forumTopicTint(slug = "") {
  const knownTint = LAUNCH_TOPIC_TINTS[String(slug)];
  if (knownTint) return knownTint;

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
