// registerServiceWorker: the guards that keep the worker out of dev, tests
// and unsupporting browsers — and the one path where it actually registers.
//
// jsdom has no navigator.serviceWorker, which is itself the environment this
// module must survive; the positive-path tests install a stub. Real install
// behaviour (Lighthouse installability, offline fallback) can only be checked
// in a browser against the deployed site.
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./registerServiceWorker.js";

const stubServiceWorker = (register) => {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register },
  });
  return () => { delete navigator.serviceWorker; };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("stays inert outside production", () => {
  it("does nothing when isProd is false — the vitest/vite-dev case", () => {
    const add = vi.spyOn(window, "addEventListener");
    expect(registerServiceWorker(false)).toBe(false);
    expect(registerServiceWorker(undefined)).toBe(false);
    expect(add).not.toHaveBeenCalledWith("load", expect.any(Function), expect.anything());
  });

  it("under vitest, import.meta.env.PROD really is falsy, so the default call is a no-op", () => {
    // This is the property that lets main.jsx call registerServiceWorker()
    // unconditionally without any test ever registering a worker.
    expect(import.meta.env.PROD).toBeFalsy();
    expect(registerServiceWorker()).toBe(false);
  });
});

describe("feature detection", () => {
  it("returns false in a browser without service worker support (jsdom is one)", () => {
    expect("serviceWorker" in navigator).toBe(false);
    expect(registerServiceWorker(true)).toBe(false);
  });
});

describe("the production path", () => {
  it("registers /sw.js only after the load event", () => {
    const register = vi.fn(() => Promise.resolve({}));
    const cleanup = stubServiceWorker(register);
    try {
      expect(registerServiceWorker(true)).toBe(true);
      // Not yet: registration must not compete with first paint.
      expect(register).not.toHaveBeenCalled();
      window.dispatchEvent(new Event("load"));
      expect(register).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith("/sw.js");
    } finally {
      cleanup();
    }
  });

  it("swallows a registration failure — the site must work identically without the worker", async () => {
    const register = vi.fn(() => Promise.reject(new Error("blocked")));
    const cleanup = stubServiceWorker(register);
    try {
      expect(registerServiceWorker(true)).toBe(true);
      window.dispatchEvent(new Event("load"));
      // Let the rejection propagate through the .catch; an unhandled
      // rejection here would fail the test run.
      await new Promise((resolve) => { setTimeout(resolve, 0); });
      expect(register).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});
