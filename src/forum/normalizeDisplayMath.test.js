import { describe, expect, it } from "vitest";
import { normalizeDisplayMath } from "./normalizeDisplayMath.js";

describe("normalizeDisplayMath", () => {
  it("expands a standalone single-line display formula", () => {
    expect(normalizeDisplayMath("$$\\int x\\,dx$$")).toBe("$$\n\\int x\\,dx\n$$");
  });

  it("leaves inline maths inside a sentence alone", () => {
    const input = "The result $E=mc^2$ follows.";
    expect(normalizeDisplayMath(input)).toBe(input);
  });

  it("leaves prose-adjacent double-dollar maths alone", () => {
    const input = "so $$x^2$$ therefore";
    expect(normalizeDisplayMath(input)).toBe(input);
  });

  it("leaves an already-fenced block untouched", () => {
    const input = "$$\n\\int x\\,dx\n$$";
    expect(normalizeDisplayMath(input)).toBe(input);
  });

  it("does not rewrite inside a fenced code block", () => {
    const input = ["```markdown", "$$x^2$$", "```"].join("\n");
    expect(normalizeDisplayMath(input)).toBe(input);
  });

  it("handles several formulas while preserving surrounding lines", () => {
    const input = ["Intro", "", "$$a^2$$", "", "Middle", "", "$$b^2$$"].join("\n");
    expect(normalizeDisplayMath(input)).toBe(
      ["Intro", "", "$$", "a^2", "$$", "", "Middle", "", "$$", "b^2", "$$"].join("\n"),
    );
  });

  it("ignores an empty delimiter pair", () => {
    expect(normalizeDisplayMath("$$$$")).toBe("$$$$");
  });

  it("trims whitespace inside an expanded block", () => {
    expect(normalizeDisplayMath("  $$  x^2  $$  ")).toBe("$$\nx^2\n$$");
  });
});
