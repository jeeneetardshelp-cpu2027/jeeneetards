// Every ink token must be readable on every surface it can sit on.
//
// A 2026-09-01 pass measured this by hand and found --ink-3 below AA in the
// light theme on all three tinted backgrounds: 4.38:1 on --canvas-2, 4.23:1
// on --surface-2, 4.09:1 on --surface-inset, passing only on plain white.
// --ink-3 carries card metadata, which is small text. It was left as a written
// note for the owner to decide, and a written note is not a guard — nothing
// stopped the value drifting further, and nothing would have told anyone if it
// had.
//
// So this does not assert the hexes. It parses index.css, pairs every ink with
// every surface in its own theme, and computes the ratio. Change a colour
// below AA and the suite says so, with the pair and the number.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "index.css"), "utf8");

const INKS = ["ink", "ink-2", "ink-3"];
const SURFACES = ["canvas", "canvas-2", "surface", "surface-2", "surface-inset"];
const AA_NORMAL = 4.5;

const rgb = (hex) => {
  const s = String(hex).replace("#", "").trim();
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// The dark block runs from the top to the light selector; light from there on.
const lightAt = css.indexOf('html[data-theme="light"]');
const block = {
  dark: css.slice(0, lightAt),
  light: css.slice(lightAt),
};
const token = (theme, name) => {
  const m = block[theme].match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return m ? m[1] : null;
};

describe("the palette blocks were found and are distinct", () => {
  // Guards the guard. A failed split would read null everywhere and the
  // assertions below would measure nothing while appearing to pass.
  it("reads a different ink and surface for each theme", () => {
    expect(lightAt).toBeGreaterThan(0);
    for (const name of [...INKS, ...SURFACES]) {
      expect(token("dark", name), `--${name} missing from the dark block`).toBeTruthy();
      expect(token("light", name), `--${name} missing from the light block`).toBeTruthy();
    }
    expect(token("dark", "ink")).not.toBe(token("light", "ink"));
    expect(token("dark", "surface")).not.toBe(token("light", "surface"));
  });
});

describe("ink tokens clear WCAG AA on every surface of their own theme", () => {
  it.each(["dark", "light"])("%s theme", (theme) => {
    const failures = [];
    for (const ink of INKS) {
      for (const surface of SURFACES) {
        const fg = token(theme, ink);
        const bg = token(theme, surface);
        const r = contrast(fg, bg);
        if (r < AA_NORMAL) {
          failures.push(`--${ink} ${fg} on --${surface} ${bg} = ${r.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("holds on the tinted light surfaces, which is where it actually broke", () => {
    // The exact three pairings that failed at #75757c. Named individually so a
    // regression points at the surface, not just at "light theme".
    for (const surface of ["canvas-2", "surface-2", "surface-inset"]) {
      const r = contrast(token("light", "ink-3"), token("light", surface));
      expect(r, `--ink-3 on --${surface}`).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it("did not fix light by wrecking dark", () => {
    // The dark palette was already clean; this change must not touch it.
    expect(token("dark", "ink-3")).toBe("#83838a");
  });
});
