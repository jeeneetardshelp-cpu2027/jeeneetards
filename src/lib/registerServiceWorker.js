// registerServiceWorker.js — opt the production site into public/sw.js.
//
// Deliberately boring. All caching policy lives in public/sw.js; this module
// only decides WHETHER to register, and the answer is no unless every guard
// passes:
//
//   * Production builds only. `import.meta.env.PROD` is false under `vite
//     dev` and under vitest, so local work and the test suite never install
//     a worker that would then serve yesterday's assets to a confused
//     developer. Tests can still exercise the logic by passing `isProd`
//     explicitly, the same injection pattern initErrorReporter uses for its
//     DSN.
//   * Feature detection. jsdom and older browsers have no
//     navigator.serviceWorker; they get a plain site, silently.
//   * After the window load event ({ once: true } — load fires once per
//     page), so registration never competes with first-paint work on a
//     student's low-end phone.
//
// A registration failure is swallowed: the worker is a nice-to-have, and the
// site must behave identically without it.

export function registerServiceWorker(isProd = import.meta.env?.PROD) {
  if (!isProd) return false;
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    },
    { once: true },
  );
  return true;
}
