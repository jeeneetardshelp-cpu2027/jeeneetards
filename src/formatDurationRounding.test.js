// formatDuration must never print a minute component of 60.
//
// Why this test exists: both copies did `Math.round((seconds % 3600) / 60)`,
// which splits the value first and rounds the remainder second. A remainder of
// 3570-3599 seconds rounds up to 60, so a 25176-second lesson -- "Madam Rides
// the Bus with The Tale of Custard the Dragon", a real row -- rendered as
// "6h 60m". 21 lessons in the catalogue landed in that branch, five of them with
// an hour component.
//
// There are two independent copies (src/metadata.js and src/usePlaylistBrowse.js)
// feeding different screens, so both are tested here.

import { describe, expect, it } from "vitest";
import { formatDuration as metadataFormat } from "./metadata.js";
import { formatDuration as browseFormat } from "./usePlaylistBrowse.js";

const COPIES = [
  ["metadata.js", metadataFormat],
  ["usePlaylistBrowse.js", browseFormat],
];

describe.each(COPIES)("formatDuration (%s)", (_name, formatDuration) => {
  it("never renders a 60-minute component", () => {
    // Every second from 0 to just over 8 hours -- the catalogue holds lessons up
    // to 9h 46m, and the defect lives in a 30-second window before each hour.
    for (let s = 0; s <= 8 * 3600 + 120; s += 1) {
      const out = formatDuration(s);
      if (out == null) continue;
      expect(out, `${s}s rendered as ${out}`).not.toMatch(/\b60m\b/);
    }
  });

  it("rolls the real 25176-second lesson up to 7 hours", () => {
    // "Madam Rides the Bus with The Tale of Custard the Dragon" (video 4257).
    // 25176s = 6h 59m 36s, which rounds to 7h 0m -- not 6h 60m.
    expect(formatDuration(25176)).toBe("7h 0m");
  });

  it("rolls a sub-hour value up to 1h rather than printing 60m", () => {
    expect(formatDuration(3590)).toBe("1h 0m");
  });

  it("still formats the ordinary cases the old code got right", () => {
    expect(formatDuration(6000)).toBe("1h 40m");
    expect(formatDuration(3723)).toBe("1h 2m");
    // metadata.js's docstring claimed 2616 -> "43m" for as long as it has
    // existed. It never did: 2616s is 43m36s and both copies round it to 44m.
    // Pinned here so the comment and the behaviour cannot drift apart again.
    expect(formatDuration(2616)).toBe("44m");
  });

  it("keeps rounding to the NEAREST minute, not truncating", () => {
    // 100s is 1m40s, closer to 2m than to 1m. Truncation would say "1m".
    expect(formatDuration(100)).toBe("2m");
    expect(formatDuration(89)).toBe("1m");
  });
});
