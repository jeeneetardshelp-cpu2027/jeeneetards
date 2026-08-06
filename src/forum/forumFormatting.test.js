import { describe, expect, it } from "vitest";
import { compactNumber, previewText, timeAgo } from "./forumFormatting.js";

describe("forum formatting", () => {
  const now = Date.parse("2026-08-06T12:00:00Z");

  it("formats compact relative times", () => {
    expect(timeAgo("2026-08-06T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-08-06T11:57:00Z", now)).toBe("3m");
    expect(timeAgo("2026-08-04T12:00:00Z", now)).toBe("2d");
  });

  it("formats signed large scores", () => {
    expect(compactNumber(999)).toBe("999");
    expect(compactNumber(1200)).toBe("1.2k");
    expect(compactNumber(-12500)).toBe("-13k");
    expect(compactNumber(2_500_000)).toBe("2.5m");
  });

  it("creates plain text without rendering markdown, code or images", () => {
    const source = "# Doubt\n**Force** [notes](https://example.com) ![plot](https://example.com/x.png)\n```js\nalert(1)\n```";
    expect(previewText(source)).toBe("Doubt Force notes");
  });

  it("truncates with one ellipsis inside the requested limit", () => {
    const result = previewText("abcdefghij", 6);
    expect(result).toBe("abcde…");
    expect(result.length).toBe(6);
  });
});
