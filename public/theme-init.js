// Runs before React so the first painted frame uses the right colour scheme.
// Kept in an external file so production can enforce script-src without
// allowing arbitrary inline JavaScript.
//
// Dark is the product default, not a mirror of the OS setting — it is the
// signature theme. A visitor who has explicitly chosen light keeps light.
// This rule is duplicated in src/theme.jsx; the two must agree or the first
// frame will flash the wrong palette.
try {
  const saved = localStorage.getItem("lecture-library-theme");
  const mode = saved === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
} catch {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.style.colorScheme = "dark";
}
