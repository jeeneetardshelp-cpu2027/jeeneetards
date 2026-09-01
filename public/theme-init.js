// Runs before React so the first painted frame uses the right colour scheme.
// Kept in an external file so production can enforce script-src without
// allowing arbitrary inline JavaScript.
//
// Dark is the product default, not a mirror of the OS setting — it is the
// signature theme. A visitor who has explicitly chosen light keeps light.
// This rule is duplicated in src/theme.jsx; the two must agree or the first
// frame will flash the wrong palette.
//
// This file also owns <meta name="theme-color">, the colour the browser paints
// its own chrome (the address bar on Android Chrome, the status bar area on
// iOS). index.html used to carry two theme-color tags gated on
// prefers-color-scheme, which flatly contradicted the rule above: a visitor on
// a light OS with no stored choice got a DARK page under a WHITE address bar.
// Setting it here instead means the tag always describes what was actually
// rendered.
//
// Keeping it correct after a toggle: src/theme.jsx writes data-theme on <html>
// whenever the theme changes, so one MutationObserver on that single attribute
// covers every path — the header toggle, a restore from storage, anything
// added later — without theme.jsx needing to know this file exists.

// Must match --canvas for each theme in src/index.css, and the inline boot CSS
// in index.html.
const CHROME_COLOUR = { dark: "#0a0a0a", light: "#ffffff" };

function applyThemeColour(mode) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", CHROME_COLOUR[mode] || CHROME_COLOUR.dark);
}

function applyTheme(mode) {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
  applyThemeColour(mode);
}

try {
  const saved = localStorage.getItem("lecture-library-theme");
  applyTheme(saved === "light" ? "light" : "dark");
} catch {
  applyTheme("dark");
}

// Only the meta tag is touched here, never data-theme: writing the attribute
// from inside its own observer would queue another mutation record and spin
// the microtask queue forever.
try {
  if (typeof MutationObserver === "function") {
    new MutationObserver(() => {
      applyThemeColour(
        document.documentElement.dataset.theme === "light" ? "light" : "dark",
      );
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }
} catch {
  // An environment without MutationObserver still gets the correct colour for
  // the theme it loaded with; only later toggles go unreflected.
}
