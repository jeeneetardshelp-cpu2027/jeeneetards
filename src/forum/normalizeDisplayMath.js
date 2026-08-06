/**
 * Expand a standalone `$$…$$` line into the three-line display-math form.
 * Prose-adjacent maths and examples inside fenced code blocks stay untouched.
 */
export function normalizeDisplayMath(source = "") {
  const lines = String(source).split("\n");
  const output = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    const match = inFence ? null : line.match(/^\s*\$\$(.+?)\$\$\s*$/);
    if (match && !match[1].includes("$$")) {
      output.push("$$", match[1].trim(), "$$");
    } else {
      output.push(line);
    }
  }

  return output.join("\n");
}
