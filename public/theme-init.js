// Runs before React so the first painted frame uses the saved colour scheme.
// Kept in an external file so production can enforce script-src without
// allowing arbitrary inline JavaScript.
try {
  const saved = localStorage.getItem("lecture-library-theme");
  const mode = saved === "dark" || saved === "light"
    ? saved
    : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
} catch {
  // Storage may be unavailable in privacy modes. React applies its default.
}
